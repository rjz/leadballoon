var cluster = require('cluster');
var domain = require('domain');
var http = require('http');

module.exports = function (appHandler, opts) {

  'use strict';

  var httpHandler, httpServer, killTimer, log, timeoutMs;

  var _isClosing = false;

  if (typeof appHandler !== 'function') {
    throw new ReferenceError('Handler function is required');
  }

  if (!opts) {
    opts = {};
  }

  // Set some sensible defaults
  log       = opts.log     || console.log.bind(console);
  timeoutMs = opts.timeout || 10000;

  // Send an error message
  function sendError (res, code) {
    res.statusCode = code;
    res.setHeader('connection', 'close');
    res.end(http.STATUS_CODES[code]);
  }

  // Close the server down
  function close () {

    if (_isClosing) return;

    _isClosing = true;

    httpServer.close(function () {
      log('Connections closed, gracefully exiting now');
      process.exit(0);
    });

    if (!cluster.isMaster) {
      cluster.worker.disconnect();
    }

    killTimer = setTimeout(function () {
      log('Connections timed out, going down hard');
      process.exit(1);
    }, timeoutMs);

    killTimer.unref();
  }

  // Wrap the `appHandler` with middleware for setting up the domain and
  // handling requests while the server is closing.
  httpHandler = function (req, res) {

    var d = domain.create();

    d.on('error', function (err) {
      log('Uncaught Exception', { err: err });
      sendError(res, 500);
      close();
    });

    d.add(req);
    d.add(res);

    d.run(function () {
      if (_isClosing) {
        return sendError(res, 502);
      }
      appHandler(req, res);
    });
  };

  // Add a hook for SIGTERM events
  process.on('SIGTERM', function () {
    log('SIGTERM received, closing server');
    close();
  });

  httpServer = http.createServer(httpHandler);

  return httpServer;
};

