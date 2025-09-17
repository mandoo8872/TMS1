export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    url: process.env.DATABASE_URL,
  },
  plugins: {
    directory: process.env.PLUGIN_DIR || './plugins',
    autoEnable: process.env.PLUGIN_AUTO_ENABLE === 'true',
  },
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || true,
  },
});
