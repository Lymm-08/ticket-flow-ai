const express = require('express');
const { listQuery, idParam, statusBody } = require('../validators/chamados');
const { asyncHandler } = require('../utils/asyncHandler');

function validate(schema, source, target) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      return next(Object.assign(new Error('Parâmetros inválidos'), {
        status: 400,
        details: parsed.error.issues.map((issue) => ({
          campo: issue.path.join('.'),
          mensagem: issue.message
        }))
      }));
    }
    req[target] = parsed.data;
    next();
  };
}

function createChamadosRouter(controller) {
  const router = express.Router();
  router.get('/', validate(listQuery, 'query', 'validatedQuery'), asyncHandler(controller.list));
  router.get('/:id', validate(idParam, 'params', 'validatedParams'), asyncHandler(controller.findById));
  router.patch(
    '/:id/status',
    validate(idParam, 'params', 'validatedParams'),
    validate(statusBody, 'body', 'validatedBody'),
    asyncHandler(controller.changeStatus)
  );
  return router;
}

module.exports = { createChamadosRouter, validate };
