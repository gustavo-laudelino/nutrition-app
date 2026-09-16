module.exports = {
  '/api/**': {
    target: process.env.API_TARGET || 'http://127.0.0.1:8081',
    secure: false,
    changeOrigin: true,
  },
};
