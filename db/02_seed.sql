SET XACT_ABORT ON;
BEGIN TRANSACTION;

INSERT INTO dbo.categorias (nome)
SELECT categoria.nome
FROM (VALUES
    (N'Financeiro'),
    (N'Suporte Técnico'),
    (N'Comercial'),
    (N'RH'),
    (N'Dúvida Geral')
) AS categoria(nome)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.categorias existente WHERE existente.nome = categoria.nome
);

COMMIT TRANSACTION;
GO
