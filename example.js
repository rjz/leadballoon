var createServer = require('./index');

var port = process.env.port || 5000;

function handleRequest (req, res) {
  if (req.url === '/throw') {
    throw new Error('foobbar');
  }
  else if (req.url === '/manual') {
    server.closeGracefully();
    res.statusCode = 502;
    res.setHeader('connection', 'close');
    res.end('Closing now...');
  }
  else {
    res.statusCode = 200;
    res.end('Hello, world');
  }
}

var server = createServer(handleRequest, {
  timeout: 5000,
});

server.on('close', function (err) {

  if (err) {
    console.error('Closing error', err);
    process.exit(1);
  }

  console.log('Server has closed successfully');
  process.exit(0);
});

server.listen(port, function (err) {
  if (err) return console.error(err);
  console.log('Listening on', port, 'as', process.pid);
});

