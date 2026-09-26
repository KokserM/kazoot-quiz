const { createServer } = require('./src/createServer');

const runtime = createServer();
const { server, config, logger, questionService, authService, billingService } = runtime;

server.listen(config.port, config.host, () => {
  logger.info('server_started', {
    port: config.port,
    env: config.nodeEnv,
    storeMode: config.storeMode,
    model: config.openAiModel,
    aiEnabled: questionService.hasOpenAI(),
    authEnabled: authService.isConfigured(),
    billingEnabled: billingService.isConfigured(),
    billingMode: billingService.isConfigured() ? (billingService.isTestMode() ? 'test' : 'live') : 'off',
    deploymentId: config.railway.deploymentId || null,
  });
  if (config.nodeEnv === 'production') {
    logger.warn('single_replica_required', { note: 'Room state is in memory. Keep exactly one Railway replica.' });
    if (!config.frontendUrl) {
      logger.warn('frontend_url_missing', { note: 'Set FRONTEND_URL so CORS, checkout and billing portal return URLs are correct.' });
    }
  }
});

async function stop(signal) {
  await runtime.shutdown(signal);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('unhandled_rejection', { message: reason?.message || String(reason), stack: reason?.stack });
});
process.on('uncaughtException', (error) => {
  logger.error('uncaught_exception', { message: error.message, stack: error.stack });
  // State may be inconsistent: restart cleanly (Railway restarts on failure).
  stop('uncaughtException').finally(() => process.exit(1));
});
