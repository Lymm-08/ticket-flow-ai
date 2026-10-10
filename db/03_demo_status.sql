SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @hoje DATE = CONVERT(DATE, SYSUTCDATETIME());
DECLARE @datas_uteis TABLE (
    ordem INT NOT NULL PRIMARY KEY,
    data DATE NOT NULL
);

;WITH calendario AS (
    SELECT @hoje AS data, 0 AS dias_atras
    UNION ALL
    SELECT DATEADD(DAY, -1, data), dias_atras + 1
    FROM calendario
    WHERE dias_atras < 45
),
dias_uteis AS (
    SELECT
        data,
        ROW_NUMBER() OVER (ORDER BY data DESC) - 1 AS ordem
    FROM calendario
    WHERE DATEDIFF(DAY, CONVERT(DATE, '19000101'), data) % 7 BETWEEN 0 AND 4
)
INSERT INTO @datas_uteis (ordem, data)
SELECT ordem, data
FROM dias_uteis
OPTION (MAXRECURSION 50);

DECLARE @alvos TABLE (
    chamado_id BIGINT NOT NULL PRIMARY KEY,
    ordem INT NOT NULL,
    status_demo NVARCHAR(20) NOT NULL,
    criado_em DATETIME2(0) NOT NULL
);

;WITH chamados_ordenados AS (
    SELECT
        id,
        ROW_NUMBER() OVER (ORDER BY id) AS ordem
    FROM (SELECT TOP (50) id FROM dbo.chamados ORDER BY id) AS amostra
)
INSERT INTO @alvos (chamado_id, ordem, status_demo, criado_em)
SELECT
    chamados_ordenados.id,
    chamados_ordenados.ordem,
    CASE
        WHEN chamados_ordenados.ordem <= 15 THEN N'em_andamento'
        WHEN chamados_ordenados.ordem <= 30 THEN N'resolvido'
        ELSE N'novo'
    END,
    DATEADD(
        MINUTE,
        660 + ((chamados_ordenados.ordem * 37) % 361),
        CONVERT(DATETIME2(0), datas_uteis.data)
    )
FROM chamados_ordenados
JOIN @datas_uteis AS datas_uteis
    ON datas_uteis.ordem = (chamados_ordenados.ordem - 1) % 20;

UPDATE chamado
SET
    criado_em = alvos.criado_em,
    status = CASE
        WHEN chamado.status = N'novo' THEN alvos.status_demo
        ELSE chamado.status
    END
FROM dbo.chamados AS chamado
JOIN @alvos AS alvos ON alvos.chamado_id = chamado.id;

INSERT INTO dbo.historico_status (chamado_id, status_anterior, status_novo, alterado_em)
SELECT alvos.chamado_id, N'novo', N'em_andamento', DATEADD(MINUTE, 90, alvos.criado_em)
FROM @alvos AS alvos
WHERE alvos.status_demo = N'em_andamento'
  AND NOT EXISTS (
      SELECT 1 FROM dbo.historico_status AS historico
      WHERE historico.chamado_id = alvos.chamado_id
  )
UNION ALL
SELECT alvos.chamado_id, N'novo', N'em_andamento', DATEADD(MINUTE, 90, alvos.criado_em)
FROM @alvos AS alvos
WHERE alvos.status_demo = N'resolvido'
  AND NOT EXISTS (
      SELECT 1 FROM dbo.historico_status AS historico
      WHERE historico.chamado_id = alvos.chamado_id
  )
UNION ALL
SELECT alvos.chamado_id, N'em_andamento', N'resolvido', DATEADD(MINUTE, 180, alvos.criado_em)
FROM @alvos AS alvos
WHERE alvos.status_demo = N'resolvido'
  AND NOT EXISTS (
      SELECT 1 FROM dbo.historico_status AS historico
      WHERE historico.chamado_id = alvos.chamado_id
  );

;WITH historico_ordenado AS (
    SELECT
        historico.id,
        alvos.criado_em,
        ROW_NUMBER() OVER (
            PARTITION BY historico.chamado_id
            ORDER BY historico.alterado_em, historico.id
        ) AS etapa
    FROM dbo.historico_status AS historico
    JOIN @alvos AS alvos ON alvos.chamado_id = historico.chamado_id
)
UPDATE historico
SET alterado_em = DATEADD(
    MINUTE,
    CONVERT(INT, 90 * historico_ordenado.etapa),
    historico_ordenado.criado_em
)
FROM dbo.historico_status AS historico
JOIN historico_ordenado ON historico_ordenado.id = historico.id;

UPDATE chamado
SET atualizado_em = COALESCE(ultimos_eventos.alterado_em, chamado.criado_em)
FROM dbo.chamados AS chamado
JOIN @alvos AS alvos ON alvos.chamado_id = chamado.id
OUTER APPLY (
    SELECT MAX(historico.alterado_em) AS alterado_em
    FROM dbo.historico_status AS historico
    WHERE historico.chamado_id = chamado.id
) AS ultimos_eventos;

UPDATE dbo.chamados
SET urgencia = N'alta'
WHERE id IN (SELECT chamado_id FROM @alvos)
  AND (
      texto LIKE N'%urgente%'
      OR texto LIKE N'%imediatamente%'
      OR texto LIKE N'%hoje%'
      OR texto LIKE N'%parada%'
      OR texto LIKE N'%fora do ar%'
      OR texto LIKE N'%bloqueado%'
      OR texto LIKE N'%não consigo acessar%'
      OR texto LIKE N'%não liga%'
      OR texto LIKE N'%aguardando atendimento%'
      OR texto LIKE N'%erro de conexão%'
      OR texto LIKE N'%erro ao emitir%'
      OR texto LIKE N'%não recebi%'
      OR texto LIKE N'%não caiu%'
      OR texto LIKE N'%não estão chegando%'
      OR texto LIKE N'%não consigo concluir%'
      OR texto LIKE N'%desconto de horas%'
      OR texto LIKE N'%destinatário incorreto%'
      OR texto LIKE N'%impedindo o fechamento%'
      OR texto LIKE N'%cartão corporativo perdido%'
  );

COMMIT TRANSACTION;
GO
