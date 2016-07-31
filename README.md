Lead Balloon
===================================

[![Build Status](https://travis-ci.org/rjz/leadballoon.svg?branch=master)](https://travis-ci.org/rjz/leadballoon)

Wraps `http.Server` with graceful shutdown logic. Useful for ensuring service
within fail-fast applications.

With its default configuration, a `LeadBalloon` server will close out by:

  1. Emitting a `'closing'` event
  2. Servicing all existing requests (subject to a timeout)
  3. Sending a 502 (Bad Gateway) response to any new requests

When the process finishes closing, this server will emit the usual `'close'`
event with no arguments (served closed gracefully) or an error (some connections
timed out).

Note: in good, fail-fast fashion, unhandled exceptions in the server logic
[remain exceptional][rjzaworski-exceptions]. No assumptions are made here about
whether or not they can be recovered, and no attempt is made to recover them.

Usage
-----------------------------------

```js
var createServer = require('leadballoon').createServer;

function handleRequest (req, res) {
  res.statusCode = 200;
  res.end('Hello, world');
}

var server = createServer(handleRequest, {
  timeout: 5000,
});

server.listen(process.env.PORT);
```

Later, to close the server while resolving as many open connections as possible:

```js
server.close();
```

Options:

  * `timeout` `Number` - the time (ms) to wait for connections to close before
      forcing a hard shutdown. Default: `10000`.

  * `closingHandler` `Function` - a `(req, res)` handler for requests received
      while the server is shutting down. Default: `leadballoon.sendUnavailable`.

Events:

  * `'closing'` - emitted when the server begins shutting down

### Cleaning up

With the server closed, it's polite to bring the process down. This is the time
to print any last words and exit with an appropriate status.

```js
server.on('close', function (err) {
  if (err) {
    console.error('Went down hard', err);
    process.exit(1);
  }

  process.exit(0);
});
```

## License

MIT

[rjzaworski-exceptions]: https://rjzaworski.com/2015/01/javascript-async-exceptions-handling
