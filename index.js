'use strict';

var http = require('http');
var util = require('util');

var BAD_GATEWAY = 502;

function sendUnavailable (res) {
  res.statusCode = BAD_GATEWAY;
  res.setHeader('connection', 'close');
  res.end(http.STATUS_CODES[BAD_GATEWAY]);
}

// LeadBalloon wraps `http.Server` with graceful shutdown logic
function LeadBalloon (requestListener, opts) {

  this._timeout = opts && opts.timeout || 10000;
  this._isClosing = false;

  // Instantiate new server
  http.Server.call(this, this.middleware(requestListener));
}

util.inherits(LeadBalloon, http.Server);

// middleware contains server shutdown logic
LeadBalloon.prototype.middleware = function (requestListener) {
  return function (req, res) {

    // Deny new requests while the server is shutting down
    if (this._isClosing) {
      return sendUnavailable(res);
    }

    req.connection.once('close', function () {
      if (this._isClosing) {
        this.tryClose();
      }
    }.bind(this));

    // Hand off to the provided handler
    requestListener.apply(null, arguments);
  }.bind(this);
};

// close emits a `'closing'` event and initiates server shutdown
LeadBalloon.prototype.close = function () {
  if (!this._isClosing) {
    this._isClosing = true;
    this.emit('closing');
    this.tryClose();
    setTimeout(http.Server.prototype.close.bind(this), this._timeout).unref();
  }
};

// tryClose checks pending responses and shuts the server if none are found
LeadBalloon.prototype.tryClose = function () {
  this.getConnections(function (err, count) {
    if (err) throw err;
    if (count === 0) {
      http.Server.prototype.close.call(this);
    }
  }.bind(this));
};

function createServer (appHandler) {
  return new LeadBalloon(appHandler);
}

// Compatibility for previous versions of leadballoon
var exports = module.exports = util.deprecate(function (appHandler, opts) {
  var server = createServer(appHandler, opts);
  var closeGracefully = server.close.bind(server);

  server.closeGracefully = closeGracefully;
  process.on('SIGTERM', closeGracefully);

  return server;

}, 'leadballoon default export is deprecated; prefer .createServer().');

exports.LeadBalloon = LeadBalloon;

exports.sendUnavailable = sendUnavailable;

exports.createServer = createServer;
