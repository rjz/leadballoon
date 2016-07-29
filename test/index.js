'use strict';

var http = require('http');
var fork = require('child_process').fork;
var path = require('path');
var test = require('tape');

function forkServer (cb) {
  var server = fork(path.resolve(__dirname, 'server'));
  var port;

  function request (path, callback) {
    var req = http.request({
      port: port,
      path: path
    }, function (res) {
      var body = '';
      res.setEncoding('utf8');
      res.on('data', function (data) {
        body += data;
      });

      res.on('end', function () {
        callback(null, body);
      });
    });

    req.on('error', function (err) {
      callback(err);
    });

    req.end();
  }

  server.on('error', cb);

  server.on('message', function (data) {
    if (!data.port) throw new Error('Expected port from child server');
    port = data.port;
    server.get = request;
    cb(null, server);
  });
}

test('server responds', function (t) {
  t.plan(3);

  forkServer(function (err, server) {
    t.error(err, 'Opening server');

    server.get('/ok', function (err, body) {
      t.error(err, 'Request sent');
      t.equal(body, 'OK');
      server.kill();
    });
  });
});

test('handles existing requests when failing', function (t) {
  t.plan(5);

  forkServer(function (err, server) {
    t.error(err, 'Opening server');

    server.get('/wait?ms=50', function (err, body) {
      t.error(err);
      t.equal(body, 'RESUMED');
      server.kill();
    });

    server.get('/failviareq', function (err, body) {
      t.error(err);
      t.equal(body, 'Bad Gateway');
    });
  });
});

test('rejects new connections when failing', function (t) {
  t.plan(6);

  forkServer(function (err, server) {
    t.error(err, 'Opening server');

    // Will keep server alive for 100ms
    server.get('/wait?ms=100', function (err, body) {
      t.error(err);
      t.equal(body, 'RESUMED');
      server.kill();
    });

    server.get('/failviareq', function (err, body) {
      t.error(err);
      t.equal(body, 'Bad Gateway');
    });

    setTimeout(function () {
      server.get('/ok', function (err) {
        t.equal(err.code, 'ECONNREFUSED', 'rejects new connection');
      });
    }, 50);
  });
});

test('rejects new connections when SIGTERMd', function (t) {
  t.plan(4);

  forkServer(function (err, server) {
    t.error(err, 'Opening server');

    // Will keep server alive for 1s
    server.get('/wait?ms=100', function (err, body) {
      t.error(err);
      t.equal(body, 'RESUMED');
    });

    setTimeout(function () {
      server.kill();
    }, 20);

    setTimeout(function () {
      server.get('/ok', function (err) {
        t.equal(err.code, 'ECONNREFUSED', 'rejects new connection');
      });
    }, 50);
  });
});

test('still explodes on exception', function (t) {
  t.plan(3);

  forkServer(function (err, server) {
    t.error(err, 'Opening server');

    server.get('/wait?ms=100', function (err) {
      t.equal(err.code, 'ECONNRESET', 'rejects new connection');
    });

    server.get('/throw', function (err) {
      t.equal(err.code, 'ECONNRESET', 'rejects new connection');
    });
  });
});
