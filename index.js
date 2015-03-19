var http = require('http');

module.exports = function (appHandler, opts) {

  'use strict';

  var httpHandler, httpServer, killTimer, timeoutMs;

  var _isClosing = false;

  if (typeof appHandler !== 'function') {
    throw new ReferenceError('Handler function is required');
  }

  if (!opts) {
    opts = {};
  }

  // Set some sensible defaults
  timeoutMs = opts.timeout || 10000;

  // Send an error message
  function sendError (res, code) {
    res.statusCode = code;
    res.setHeader('connection', 'close');
    res.end(http.STATUS_CODES[code]);
  }

  // Close the server down
  function closeGracefully () {

    if (_isClosing) return;

    _isClosing = true;

    httpServer.close();

    killTimer = setTimeout(function () {
      httpServer.emit('close', new Error('Forced close with open connections'));
    }, timeoutMs);

    killTimer.unref();
  }

  // Wrap the `appHandler` with middleware for handling requests while the
  // server is closing.
  httpHandler = function (req, res) {
    if (_isClosing) {
      return sendError(res, 502);
    }

    res.endAndCloseServer = function () {
      sendError(res, 502);
      closeGracefully();
    };

    appHandler(req, res);
  };

  // Add a hook for SIGTERM events
  process.on('SIGTERM', closeGracefully);

  // Construct a server around `httpHandler`
  httpServer = http.createServer(httpHandler);

  // Put a kill switch on the instantiated server
  httpServer.closeGracefully = closeGracefully;

  return httpServer;
};

