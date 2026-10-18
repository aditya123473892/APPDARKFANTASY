const http = require('node:http');

// Local Metro sessions only. The upstream is fixed; callers cannot choose a host.
function createDevApiProxy(next, port = 9000) {
  return (request, response, nextMiddleware) => {
    if (!/^\/(api|uploads|socket\.io)(?:[/?]|$)/.test(request.url || ''))
      return next(request, response, nextMiddleware);
    const upstream = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: request.url,
        method: request.method,
        // Local backend restarts must not leave a stale pooled socket for login/profile requests.
        agent: false,
        headers: { ...request.headers, host: `127.0.0.1:${port}` },
      },
      (incoming) => {
        response.writeHead(incoming.statusCode, incoming.headers);
        incoming.pipe(response);
        incoming.on('error', () => response.destroy());
      },
    );
    upstream.setTimeout(60_000, () => upstream.destroy(new Error('Backend timeout')));
    upstream.on('error', () => {
      if (response.headersSent) return response.destroy();
      response.writeHead(502, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ message: 'Local backend is unavailable on port 9000' }));
    });
    request.on('aborted', () => upstream.destroy());
    response.on('close', () => {
      // A normal completed response is not a client abort.
      if (!response.writableFinished) upstream.destroy();
    });
    request.pipe(upstream);
  };
}

module.exports = { createDevApiProxy };
