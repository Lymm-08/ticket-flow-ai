require('dotenv').config();
const { createApp } = require('./app');

const port = Number(process.env.PORT || 3000);
const app = createApp();
const server = app.listen(port, () => {
  console.log(JSON.stringify({ level: 'info', message: 'API iniciada', port }));
});

async function shutdown(signal) {
  console.log(JSON.stringify({ level: 'info', message: 'Encerrando API', signal }));
  server.close(async (error) => {
    if (error) {
      console.error(JSON.stringify({ level: 'error', message: error.message }));
      process.exitCode = 1;
    }
    const { closePool } = require('./db/pool');
    await closePool();
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
