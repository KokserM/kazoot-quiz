const { createServer } = require('./src/createServer');
const { config } = require('./src/config');

const { server, questionService } = createServer();

server.listen(config.port, config.host, () => {
  console.log(`Kazoot server listening on ${config.host}:${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Question model: ${config.openAiModel}`);
  console.log(
    `Question source: ${questionService.hasOpenAI() ? 'OpenAI enabled' : 'Demo fallback only'}`
  );
});