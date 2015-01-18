Lead Balloon
===================================

Wraps an instance of `http.Server` with logic to gracefully close out in
response to an unhandled internal error, programmatic termination, or a SIGTERM.

To close a running server (e.g., to deploy a new version), use `kill`:

    $ kill -SIGTERM <PID>

As the process closes,

  * All new requests will receive a 502 response

  * All existing connections will remain open until responses can be
      served or the timeout is reached

When the process finishes closing, this server will emit a `'close'` event with
no arguments (served closed gracefully) or an error (some connections timed
out).

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

Later, to close the server but handle as many open connections as possible:

    server.closeGracefully();

Options:

  * `timeout` `Number` - the time (ms) to wait for connections
    to close before forcing a hard shutdown. Defaults to `10000`.

Events:

  * `'close'` - emitted when the server has finished closing with an optional
    error argument. If error is absent, all connections were cleaned up
    before the server went down.

### Cleaning up

It's polite to bring the process down. This is the time to print any last words
and exit with an appropriate status.

    server.on('close', function (err) {
      if (err) {
        console.error('Went down hard', err);
        process.exit(1);
      }

      process.exit(0);
    });

## License

MIT

