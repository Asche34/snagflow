/** Local-device test bridge. Bind one explicit private interface; upstream stays loopback. */
import http from 'node:http';
import net from 'node:net';
const [listenHost, listenPortValue, upstreamPortValue = listenPortValue] = process.argv.slice(2);
const octets = (listenHost ?? '').split('.').map(Number);
const privateAddress =
  octets.length === 4 &&
  octets.every((v) => Number.isInteger(v) && v >= 0 && v <= 255) &&
  (octets[0] === 10 ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31));
const listenPort = Number(listenPortValue),
  upstreamPort = Number(upstreamPortValue);
if (
  !privateAddress ||
  ![listenPort, upstreamPort].every((v) => Number.isInteger(v) && v >= 1024 && v <= 65535)
)
  throw Error(
    'Usage: node scripts/mobile/lan-forwarder.mjs <private-LAN-IPv4> <port> [loopback-upstream-port]',
  );
const server = http.createServer((request, response) => {
  const upstream = http.request(
    {
      hostname: '127.0.0.1',
      port: upstreamPort,
      method: request.method,
      path: request.url,
      headers: {
        ...request.headers,
        host: `127.0.0.1:${upstreamPort}`,
        'x-forwarded-host': `${listenHost}:${listenPort}`,
        'x-forwarded-proto': 'http',
      },
    },
    (result) => {
      response.writeHead(result.statusCode ?? 502, result.headers);
      result.pipe(response);
    },
  );
  upstream.on('error', () => {
    if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'text/plain' });
    response.end('The local SnagFlow service is unavailable.');
  });
  request.on('aborted', () => upstream.destroy());
  response.on('close', () => {
    if (!response.writableEnded) upstream.destroy();
  });
  request.pipe(upstream);
});
server.on('upgrade', (request, socket, head) => {
  const upstream = net.connect(upstreamPort, '127.0.0.1', () => {
    const headers = { ...request.headers, host: `127.0.0.1:${upstreamPort}` };
    upstream.write(
      `${request.method} ${request.url} HTTP/${request.httpVersion}\r\n${Object.entries(headers)
        .map(([name, value]) => `${name}: ${value}`)
        .join('\r\n')}\r\n\r\n`,
    );
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
  socket.on('close', () => upstream.destroy());
});
server.listen(listenPort, listenHost, () =>
  process.stdout.write(
    `Local-device bridge: http://${listenHost}:${listenPort} -> loopback:${upstreamPort}\n`,
  ),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => server.close(() => process.exit(0)));
