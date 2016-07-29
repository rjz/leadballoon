'use strict';

var http = require('http');

var BAD_GATEWAY = 502;

module.exports = function (appHandler, opts) {

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
  function sendUnavailable (res) {
    res.statusCode = BAD_GATEWAY;
    res.setHeader('connection', 'close');
    res.end(http.STATUS_CODES[BAD_GATEWAY]);
  }

  // Close the server down
  function closeGracefully () {

    if (_isClosing) return;

    _isClosing = true;

    httpServer.emit('closing');
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
      return sendUnavailable(res);
    }

    res.endAndCloseServer = function () {
      sendUnavailable(res);
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

