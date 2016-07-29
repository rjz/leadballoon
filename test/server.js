'use strict';

var createServer = require('../index');
var url = require('url');

var BASE_PORT = 60001;
var PORT_ATTEMPTS = 1000;

function handleTestRequest (req, res) {

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
      return res.endAndCloseServer();

    default:
      throw new Error('Not implemented');
  }
}

function listen (port, attemptsRemaining) {

  var server = createServer(handleTestRequest, {
    timeout: 5000,
  });

  server.listen(port, function () {
    // Tell the test suite what port to use
    process.send({ port: port });
  });

  server.on('error', function (err) {
    if (err.code === 'EADDRINUSE' && attemptsRemaining > 0) {
      return listen(port + 1, attemptsRemaining - 1);
    }
    throw err;
  });
}

listen(BASE_PORT, PORT_ATTEMPTS);
