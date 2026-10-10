-- Chamados novos e urgentes aguardando atendimento.
SELECT id, origem, resumo, urgencia, criado_em
FROM dbo.chamados
WHERE status = N'novo' AND urgencia = N'alta'
ORDER BY criado_em;

-- Volume por status e categoria.
SELECT c.nome AS categoria, ch.status, COUNT_BIG(*) AS total
FROM dbo.chamados AS ch
JOIN dbo.categorias AS c ON c.id = ch.categoria_id
GROUP BY c.nome, ch.status
ORDER BY c.nome, ch.status;

-- Histórico de um chamado.
SELECT status_anterior, status_novo, alterado_em
FROM dbo.historico_status
WHERE chamado_id = @chamado_id
ORDER BY alterado_em, id;

-- Execuções recentes do robô.
SELECT TOP (100) execucao_id, nivel, mensagem, criado_em
FROM dbo.logs_robo
ORDER BY criado_em DESC, id DESC;
