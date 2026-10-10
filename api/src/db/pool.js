const sql = require('mssql');

let poolPromise;

function getPool() {
  if (!poolPromise) {
    const config = {
      server: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 1433),
      database: process.env.DB_NAME || 'CentralAutomacao',
      user: process.env.DB_USER || 'sa',
      password: process.env.DB_PASSWORD,
      options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false'
      },
      pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
      connectionTimeout: 15000,
      requestTimeout: 30000
    };

    poolPromise = sql.connect(config).catch((error) => {
      poolPromise = undefined;
      throw error;
    });
  }

  return poolPromise;
}

async function query(statement, bind = {}) {
  const pool = await getPool();
  const request = pool.request();

  for (const [name, value] of Object.entries(bind)) {
    request.input(name, value);
  }

  return request.query(statement);
}

async function closePool() {
  if (poolPromise) {
    const pool = await poolPromise;
    poolPromise = undefined;
    await pool.close();
  }
}

module.exports = { sql, getPool, query, closePool };
