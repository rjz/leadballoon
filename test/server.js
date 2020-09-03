'use strict';

var url = require('url');

var leadballoon = require('../index');

var BASE_PORT = 60001;
var PORT_ATTEMPTS = 1000;

function listen (port, attemptsRemaining) {

  var server = leadballoon.createServer(function handleTestRequest (req, res) {

    var parsedUrl = url.parse(req.url, true);

    switch (parsedUrl.pathname) {

      case '/ok':
        return res.end('OK');

      case '/throw':
        throw new Error('Just exceptional');

      case '/wait':
        var timeout = parsedUrl.query.ms;
        if (!timeout) {
          throw new Error('Missing timeout');
        }

        return setTimeout(function () {
          res.end('RESUMED');
        }, parseInt(timeout, 10));

      case '/failviareq':
        leadballoon.sendUnavailable(res);
        return server.close();

      default:
        throw new Error('Not implemented');
    }
  });

  function proxyEvent (ee, name) {
    ee.on(name, function () {
      process.send({
        name: name,
        args: [].slice.call(arguments)
      });
    });
  }

  server.listen(port, function () {
    // Tell the test suite what port to use
    process.send({ port: port });

    proxyEvent(server, 'closing');
    proxyEvent(server, 'close');
  });

  server.on('error', function (err) {
    if (err.code === 'EADDRINUSE' && attemptsRemaining > 0) {
      return listen(port + 1, attemptsRemaining - 1);
    }
    throw err;
  });

  // Add a hook for SIGTERM events
  process.on('SIGTERM', server.close.bind(server));
}

listen(BASE_PORT, PORT_ATTEMPTS);
