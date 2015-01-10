Lead Balloon
===================================

Wraps an instance of `http.Server` with logic to gracefully close out in
response to an unhandled internal error or a SIGTERM.

To close a running server (e.g., to deploy a new version), use `kill`:

    $ kill -SIGTERM <PID>

As the process closes,

  * All new requests will receive a 502 response

  * All existing connections will remain open until responses can be
      served or the timeout is reached

  * Status updates will be logged

When the process finishes closing,

  * The cluster master (if running as a worker) will receive a
      `'disconnect'` event

  * This process will exit with 0 (served closed gracefully) or 1 (some
      connections timed out)

Usage
-----------------------------------

    var createServer = require('leadballoon');

    function handleRequest (req, res) {
      res.statusCode = 200;
      res.end('Hello, world');
    }

    var server = createServer(handleRequest, {
      timeout: 5000,
    });

    server.listen(process.env.PORT);

Options:

  * `log` `{Function(String, Object)}` - print a message and any iterable
    data in the (optional) object. Defaults to `console.log`.

  * `timeout` `Number` - the time (ms) to wait for connections
    to close before forcing a hard shutdown. Defaults to `10000`.

