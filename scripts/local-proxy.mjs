import http from 'node:http';

const HOST = '127.0.0.1';
const PORT = 3000;

const server = http.createServer((request, response) => {
  const apiRequest = request.url?.startsWith('/api/');
  const targetPort = apiRequest ? 4317 : 3001;
  const proxyRequest = http.request(
    {
      hostname: HOST,
      port: targetPort,
      path: request.url,
      method: request.method,
      headers: { ...request.headers, host: `${HOST}:${targetPort}` },
    },
    (proxyResponse) => {
      response.writeHead(
        proxyResponse.statusCode || 502,
        proxyResponse.headers,
      );
      proxyResponse.pipe(response);
    },
  );

  proxyRequest.on('error', () => {
    if (response.headersSent) return response.end();
    response.writeHead(502, {
      'content-type': 'application/json; charset=utf-8',
    });
    response.end(
      JSON.stringify({
        error: 'The local service is still starting. Try again in a moment.',
      }),
    );
  });
  request.pipe(proxyRequest);
});

server.listen(PORT, HOST, () => {
  console.log(`Lees available at http://localhost:${PORT}`);
});

function close() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', close);
process.on('SIGTERM', close);
