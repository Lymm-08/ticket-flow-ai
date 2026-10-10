const path = require('node:path');
const express = require('express');
const repository = require('./db/chamadosRepository');
const { createChamadosService } = require('./services/chamadosService');
const { createChamadosController } = require('./controllers/chamadosController');
const { createChamadosRouter, validate } = require('./routes/chamados');
const { asyncHandler } = require('./utils/asyncHandler');
const { z } = require('zod');

function createApp({ service = createChamadosService(repository), logger = console } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    const allowed = (process.env.CORS_ORIGIN || '*').split(',').map((origin) => origin.trim());
    const origin = req.headers.origin;
    if (allowed.includes('*') || (origin && allowed.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', allowed.includes('*') ? '*' : origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  const controller = createChamadosController(service);
  app.get('/health', asyncHandler(async (req, res, next) => {
    try {
      await service.health();
      res.json({ status: 'ok', banco: 'conectado' });
    } catch (error) {
      next(Object.assign(error, {
        status: 503,
        message: 'Banco de dados indisponível',
        publicMessage: 'Banco de dados indisponível'
      }));
    }
  }));

  app.use('/api/chamados', createChamadosRouter(controller));
  app.get('/api/metricas', asyncHandler(controller.metrics));
  app.get(
    '/api/logs',
    validate(z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }), 'query', 'validatedQuery'),
    asyncHandler(controller.logs)
  );
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada', detalhes: [] }));
  app.use((error, req, res, next) => {
    const status = Number.isInteger(error.status) ? error.status : 500;
    const details = error.details || (status >= 500 ? [] : [error.message]);
    logger.error(JSON.stringify({
      level: 'error',
      message: error.message,
      method: req.method,
      path: req.path,
      status
    }));
    res.status(status).json({
      erro: error.publicMessage || (status >= 500 ? 'Erro interno do servidor' : error.message),
      detalhes: details
    });
  });

  return app;
}

module.exports = { createApp };
