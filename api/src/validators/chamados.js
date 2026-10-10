const { z } = require('zod');

const listQuery = z.object({
  status: z.enum(['novo', 'em_andamento', 'resolvido']).optional(),
  urgencia: z.enum(['baixa', 'media', 'alta']).optional(),
  categoria: z.string().trim().min(1).max(80).optional(),
  busca: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['criado_em', 'atualizado_em', 'urgencia', 'status']).default('criado_em'),
  order: z.enum(['asc', 'desc']).default('desc')
});

const idParam = z.object({ id: z.coerce.number().int().positive() });
const statusBody = z.object({
  status: z.enum(['novo', 'em_andamento', 'resolvido'])
});

module.exports = { listQuery, idParam, statusBody };
