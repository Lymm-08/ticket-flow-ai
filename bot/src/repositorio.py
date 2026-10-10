import os
import uuid
from typing import Dict


class RepositorioChamados:
    def __init__(self, connect=None) -> None:
        self.connect = connect or self._conectar

    @staticmethod
    def _conectar():
        import pyodbc

        host = os.getenv("DB_HOST", "localhost")
        port = os.getenv("DB_PORT", "1433")
        database = os.getenv("DB_NAME", "CentralAutomacao")
        user = os.getenv("DB_USER", "sa")
        password = os.getenv("DB_PASSWORD", "")
        driver = os.getenv("ODBC_DRIVER", "ODBC Driver 18 for SQL Server")
        connection_string = (
            f"DRIVER={{{driver}}};SERVER={host},{port};DATABASE={database};"
            f"UID={user};PWD={password};Encrypt=yes;TrustServerCertificate=yes"
        )
        return pyodbc.connect(connection_string, timeout=10)

    def existe_hash(self, hash_texto: str) -> bool:
        with self.connect() as conexao:
            linha = conexao.cursor().execute(
                "SELECT 1 FROM dbo.chamados WHERE hash_texto = ?", hash_texto
            ).fetchone()
            return linha is not None

    def inserir(self, registro: Dict[str, str], classificacao: Dict[str, str]) -> None:
        with self.connect() as conexao:
            cursor = conexao.cursor()
            categoria = cursor.execute(
                "SELECT id FROM dbo.categorias WHERE nome = ?",
                classificacao["categoria"],
            ).fetchone()
            if categoria is None:
                raise ValueError(f"Categoria inexistente no banco: {classificacao['categoria']}")
            chamado = cursor.execute(
                """
                INSERT INTO dbo.chamados
                    (origem, texto, resumo, categoria_id, urgencia, hash_texto)
                OUTPUT INSERTED.id
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                registro["origem"],
                registro["texto"],
                classificacao["resumo"],
                categoria[0],
                classificacao["urgencia"],
                registro["hash_texto"],
            ).fetchone()
            cursor.execute(
                """
                INSERT INTO dbo.historico_status (chamado_id, status_anterior, status_novo)
                VALUES (?, NULL, N'novo')
                """,
                chamado[0],
            )
            conexao.commit()

    def registrar_log(self, execucao_id: uuid.UUID, nivel: str, mensagem: str) -> None:
        with self.connect() as conexao:
            conexao.cursor().execute(
                """
                INSERT INTO dbo.logs_robo (execucao_id, nivel, mensagem)
                VALUES (?, ?, ?)
                """,
                str(execucao_id),
                nivel,
                mensagem[:2000],
            )
            conexao.commit()
