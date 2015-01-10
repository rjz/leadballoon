var createServer = require('./index');

var port = process.env.port || 5000;

function handleRequest (req, res) {
  if (req.url === '/throw') {
    throw new Error('foobbar');
  }
  else {
    res.statusCode = 200;
    res.end('Hello, world');
  }
}

var server = createServer(handleRequest, {
  timeout: 5000,
});

server.listen(port, function (err) {
  if (err) return console.error(err);
  console.log('Listening on', port, 'as', process.pid);
});

