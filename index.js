'use strict';

var http = require('http');

var BAD_GATEWAY = 502;

module.exports = function (appHandler, opts) {

  var httpServer, timeoutMs;

  var _isClosing = false;
  var pendingResponseCount = 0;

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

  function tryClose () {
    if (pendingResponseCount === 0) {
      httpServer.close();
    }
  }

  function forceClose () {
    httpServer.close();
    httpServer.emit('close', new Error('Forced close with open connections'));
  }

  // Close the server down
  function closeGracefully () {
    if (!_isClosing) {
      _isClosing = true;
      httpServer.emit('closing');
      tryClose();
      setTimeout(forceClose, timeoutMs).unref();
    }
  }

  // Wrap the `appHandler` with middleware for handling requests while the
  // server is closing.
  function httpHandler (req, res) {
    var _end = res.end;

    if (_isClosing) {
      return sendUnavailable(res);
    }

    res.endAndCloseServer = function () {
      sendUnavailable(res);
      closeGracefully();
    };

    res.end = function () {
      --pendingResponseCount;
      if (_isClosing) tryClose();
      _end.apply(this, arguments);
    };

    ++pendingResponseCount;
    appHandler(req, res);
  }

  // Add a hook for SIGTERM events
  process.on('SIGTERM', closeGracefully);

  // Construct a server around `httpHandler`
  httpServer = http.createServer(httpHandler);

  // Put a kill switch on the instantiated server
  httpServer.closeGracefully = closeGracefully;

  return httpServer;
};
