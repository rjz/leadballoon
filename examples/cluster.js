'use strict';

// LeadBalloon clustering
//
// net.Server interoperates seamlessly with the cluster module, but servers
// with relatively high latency can use `LeadBalloon`'s `'closing'` event to
// proactively repopulate the cluster's worker pool.
//
// In this demo, workers within the cluster will begin `'closing'` as soon as
// `kill` is received, but will remain alive until established connections are
// finished.
//
// The cluster master will spin up new workers in response to the `'closing'`
// event to maintain a mostly-constant count of listening workers.
//
//     $ curl localhost:5555 & \
//       sleep 0.1 && \
//       kill ${WORKER_PID} && \
//       curl localhost:5555
//
var cluster = require('cluster');
var leadballoon = require('../index');

var PORT = 5555;

// Number of active workers/handlers
var NUM_WORKERS = 2;

// Time allowed for graceful shutdown
var SHUTDOWN_TIMEOUT = 5000;

function log (name, msg) {
  console.log('[' + name + ']: ' + msg);
}

// Fork a `cluster.Worker` and set up handling of its `'closing'` message
function forkWorker () {
  var worker = cluster.fork();
  var name = 'worker/' + worker.process.pid;
  var shutdownTimer;
  var _isClosing = false;

  worker.on('message', function (message) {
    if (message === 'closing') {
      log(name, 'closing');
      _isClosing = true;

      // Spawn a new worker immediately, as this one is about to disconnect
      forkWorker();

      // Force a hard shutdown if the closing worker takes too long to finish up
      shutdownTimer = setTimeout(function () {
        log(name, 'timed out shutting down; forcing exit');
        worker.kill();
      }, SHUTDOWN_TIMEOUT);

      // Disconnect the worker to block new connections. Note that any new
      // connection attempts will _not_ reach the worker's `closingHandler`, as
      // other workers should be available to handle new requests.
      //
      // In the case of catastrophic failure (i.e., no workers available to
      // respond) the error response will need to be generated upstream.
      worker.disconnect();
    }
  });

  worker.once('disconnect', function (code) {
    clearTimeout(shutdownTimer);
  });

  worker.once('exit', function (code) {
    // If the worker closed without sending a `'closing'` message (i.e. in
    // response to an exception or explicit `process.exit` call) we still want
    // to replace it in the cluster
    if (!_isClosing) {
      log(name, 'exited with (' + code + ') and no "closing" event!');
      forkWorker();
    }
  });

  worker.once('listening', function (address) {
    log(name, 'listening on :' + address.port + '.');
  });
}

if (cluster.isMaster) {
  // Fork new workers
  for (var i = 0; i < NUM_WORKERS; i++) {
    forkWorker();
  }
}
else {

  // Toy server
  var server = leadballoon.createServer(function (req, res) {
    if (req.url === '/throw') {
      throw new Error('throwing by request');
    }

    setTimeout(function () {
      res.end('OK');
    }, 1000);
  });

  // Notify the cluster `master` when the server begins to close. We'll use
  // this signal to start readying a replacement worker.
  server.on('closing', function () {
    process.send('closing');
  });

  // Exit out once we're done closing
  server.on('close', function () {
    process.exit(0);
  });

  process.on('SIGTERM', function () {
    server.close();
  });

  server.listen(PORT);
}
