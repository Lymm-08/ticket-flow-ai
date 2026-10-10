IF OBJECT_ID(N'dbo.categorias', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.categorias (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_categorias PRIMARY KEY,
        nome NVARCHAR(80) NOT NULL,
        CONSTRAINT UQ_categorias_nome UNIQUE (nome)
    );
END;
GO

IF OBJECT_ID(N'dbo.chamados', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.chamados (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_chamados PRIMARY KEY,
        origem NVARCHAR(80) NOT NULL,
        texto NVARCHAR(MAX) NOT NULL,
        resumo NVARCHAR(140) NOT NULL,
        categoria_id INT NOT NULL,
        urgencia NVARCHAR(10) NOT NULL,
        status NVARCHAR(20) NOT NULL CONSTRAINT DF_chamados_status DEFAULT N'novo',
        hash_texto CHAR(64) NOT NULL,
        criado_em DATETIME2(0) NOT NULL CONSTRAINT DF_chamados_criado_em DEFAULT SYSUTCDATETIME(),
        atualizado_em DATETIME2(0) NOT NULL CONSTRAINT DF_chamados_atualizado_em DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_chamados_categorias FOREIGN KEY (categoria_id) REFERENCES dbo.categorias(id),
        CONSTRAINT UQ_chamados_hash_texto UNIQUE (hash_texto),
        CONSTRAINT CK_chamados_urgencia CHECK (urgencia IN (N'baixa', N'media', N'alta')),
        CONSTRAINT CK_chamados_status CHECK (status IN (N'novo', N'em_andamento', N'resolvido'))
    );
END;
GO

IF OBJECT_ID(N'dbo.historico_status', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.historico_status (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_historico_status PRIMARY KEY,
        chamado_id BIGINT NOT NULL,
        status_anterior NVARCHAR(20) NULL,
        status_novo NVARCHAR(20) NOT NULL,
        alterado_em DATETIME2(0) NOT NULL CONSTRAINT DF_historico_status_alterado_em DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_historico_status_chamados FOREIGN KEY (chamado_id) REFERENCES dbo.chamados(id),
        CONSTRAINT CK_historico_status_anterior CHECK (status_anterior IS NULL OR status_anterior IN (N'novo', N'em_andamento', N'resolvido')),
        CONSTRAINT CK_historico_status_novo CHECK (status_novo IN (N'novo', N'em_andamento', N'resolvido'))
    );
END;
GO

IF OBJECT_ID(N'dbo.logs_robo', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.logs_robo (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_logs_robo PRIMARY KEY,
        execucao_id UNIQUEIDENTIFIER NOT NULL,
        nivel NVARCHAR(10) NOT NULL,
        mensagem NVARCHAR(2000) NOT NULL,
        criado_em DATETIME2(0) NOT NULL CONSTRAINT DF_logs_robo_criado_em DEFAULT SYSUTCDATETIME()
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_chamados_status' AND object_id = OBJECT_ID(N'dbo.chamados'))
    CREATE INDEX IX_chamados_status ON dbo.chamados(status);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_chamados_urgencia' AND object_id = OBJECT_ID(N'dbo.chamados'))
    CREATE INDEX IX_chamados_urgencia ON dbo.chamados(urgencia);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_chamados_categoria_id' AND object_id = OBJECT_ID(N'dbo.chamados'))
    CREATE INDEX IX_chamados_categoria_id ON dbo.chamados(categoria_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_chamados_criado_em' AND object_id = OBJECT_ID(N'dbo.chamados'))
    CREATE INDEX IX_chamados_criado_em ON dbo.chamados(criado_em DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_historico_status_chamado_id_alterado_em' AND object_id = OBJECT_ID(N'dbo.historico_status'))
    CREATE INDEX IX_historico_status_chamado_id_alterado_em ON dbo.historico_status(chamado_id, alterado_em DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_logs_robo_execucao_criado_em' AND object_id = OBJECT_ID(N'dbo.logs_robo'))
    CREATE INDEX IX_logs_robo_execucao_criado_em ON dbo.logs_robo(execucao_id, criado_em DESC);
GO
