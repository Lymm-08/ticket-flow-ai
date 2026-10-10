const { sql, getPool, query } = require('./pool');

async function list({ status, urgencia, categoria, busca, page, limit, sort, order }) {
  const conditions = [];
  const bind = {};

  if (status) {
    conditions.push('ch.status = @status');
    bind.status = status;
  }
  if (urgencia) {
    conditions.push('ch.urgencia = @urgencia');
    bind.urgencia = urgencia;
  }
  if (categoria) {
    conditions.push('c.nome = @categoria');
    bind.categoria = categoria;
  }
  if (busca) {
    conditions.push('(ch.texto LIKE @busca OR ch.resumo LIKE @busca)');
    bind.busca = `%${busca}%`;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortable = {
    criado_em: 'ch.criado_em',
    atualizado_em: 'ch.atualizado_em',
    urgencia: 'ch.urgencia',
    status: 'ch.status'
  };
  const sortColumn = sortable[sort] || sortable.criado_em;

  bind.offset = (page - 1) * limit;
  bind.limit = limit;
  const result = await query(
    `SELECT ch.id, ch.origem, ch.resumo, ch.urgencia, ch.status, ch.criado_em, ch.atualizado_em, c.nome AS categoria
     FROM dbo.chamados ch
     JOIN dbo.categorias c ON c.id = ch.categoria_id
     ${where}
     ORDER BY ${sortColumn} ${order === 'asc' ? 'ASC' : 'DESC'}, ch.id DESC
     OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
     SELECT COUNT_BIG(*) AS total
     FROM dbo.chamados ch
     JOIN dbo.categorias c ON c.id = ch.categoria_id
     ${where};`,
    bind
  );

  return { itens: result.recordsets[0], total: Number(result.recordsets[1][0].total), page, limit };
}

async function findById(id) {
  const pool = await getPool();
  const result = await pool.request().input('id', sql.BigInt, id).query(
    `SELECT ch.id, ch.origem, ch.texto, ch.resumo, ch.urgencia, ch.status, ch.criado_em, ch.atualizado_em, c.nome AS categoria
     FROM dbo.chamados ch
     JOIN dbo.categorias c ON c.id = ch.categoria_id
     WHERE ch.id = @id;
     SELECT id, status_anterior, status_novo, alterado_em
     FROM dbo.historico_status
     WHERE chamado_id = @id
     ORDER BY alterado_em DESC, id DESC;`,
    { id }
  );
  const chamado = result.recordsets[0][0];
  return chamado ? { ...chamado, historico: result.recordsets[1] } : null;
}

async function getStatus(id) {
  const pool = await getPool();
  const result = await pool.request()
    .input('id', sql.BigInt, id)
    .query('SELECT status FROM dbo.chamados WHERE id = @id');
  return result.recordset[0]?.status || null;
}

async function changeStatus(id, previousStatus, status) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const request = new sql.Request(transaction);
    const updated = await request
      .input('id', sql.BigInt, id)
      .input('previousStatus', sql.NVarChar(20), previousStatus)
      .input('status', sql.NVarChar(20), status)
      .query(
        `UPDATE dbo.chamados
         SET status = @status, atualizado_em = SYSUTCDATETIME()
         WHERE id = @id AND status = @previousStatus;
         SELECT @@ROWCOUNT AS atualizados;`
      );

    if (updated.recordset[0].atualizados !== 1) {
      await transaction.rollback();
      return false;
    }

    await new sql.Request(transaction)
      .input('id', sql.BigInt, id)
      .input('previousStatus', sql.NVarChar(20), previousStatus)
      .input('status', sql.NVarChar(20), status)
      .query(
        `INSERT INTO dbo.historico_status (chamado_id, status_anterior, status_novo)
         VALUES (@id, @previousStatus, @status)`
      );

    await transaction.commit();
    return true;
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      error.rollbackError = rollbackError;
    }
    throw error;
  }
}

async function getMetrics() {
  const result = await query(
    `SELECT status, COUNT_BIG(*) AS total FROM dbo.chamados GROUP BY status;
     SELECT c.nome AS categoria, COUNT_BIG(ch.id) AS total
     FROM dbo.categorias c LEFT JOIN dbo.chamados ch ON ch.categoria_id = c.id
     GROUP BY c.nome ORDER BY c.nome;
     SELECT urgencia, COUNT_BIG(*) AS total FROM dbo.chamados GROUP BY urgencia;
     SELECT COUNT_BIG(*) AS total FROM dbo.chamados WHERE urgencia = N'alta' AND status <> N'resolvido';
     SELECT AVG(CAST(DATEDIFF(SECOND, criado_em, atualizado_em) AS FLOAT)) AS segundos
     FROM dbo.chamados WHERE status = N'resolvido';`
  );
  return {
    por_status: result.recordsets[0],
    por_categoria: result.recordsets[1],
    por_urgencia: result.recordsets[2],
    urgentes_abertos: Number(result.recordsets[3][0].total),
    tempo_medio_resolucao_segundos: result.recordsets[4][0].segundos
  };
}

async function getLogs(limit) {
  const result = await query(
    `SELECT execucao_id, nivel, mensagem, criado_em
     FROM dbo.logs_robo
     ORDER BY criado_em DESC, id DESC
     OFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY`,
    { limit }
  );
  return result.recordset;
}

async function health() {
  await query('SELECT 1 AS healthy');
  return true;
}

module.exports = { list, findById, getStatus, changeStatus, getMetrics, getLogs, health };
