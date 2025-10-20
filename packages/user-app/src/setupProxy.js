const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy API requests to backend
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:8080',
      changeOrigin: true,
      secure: false,
      logLevel: 'debug',
      pathRewrite: {
        '^/api': '/api', // Keep the /api path as-is since backend expects /api
      },
    })
  );

  // Proxy WebSocket connections
  app.use(
    '/ws',
    createProxyMiddleware({
      target: process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:8080',
      ws: true,
      changeOrigin: true,
      secure: false
    })
  );
};