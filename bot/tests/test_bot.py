import json
from pathlib import Path

import pytest
import requests

from bot.src.classificador_ia import (
    ClassificadorIA,
    resposta_fallback,
    validar_classificacao,
)
from bot.src.coletor import ColetorCSV, calcular_hash, limpar_registro
from bot.src.main import executar


def test_limpa_registro_e_ignora_texto_vazio():
    registro = limpar_registro({"origem": " email ", "texto": "  Olá \n mundo  "})
    assert registro == {
        "origem": "email",
        "texto": "Olá mundo",
        "hash_texto": calcular_hash("Olá mundo"),
    }
    assert limpar_registro({"texto": "  \n "}) is None


def test_hash_e_estavel_apos_normalizar_espacos():
    assert calcular_hash(" solicitação  nova ") == calcular_hash("solicitação\nnova")
    assert calcular_hash("uma solicitação") != calcular_hash("outra solicitação")


def test_coletor_csv_le_registros_e_valida_colunas(tmp_path: Path):
    caminho = tmp_path / "chamados.csv"
    caminho.write_text("origem,texto\nemail,  Preciso de ajuda  \nformulario, \n", encoding="utf-8")
    assert list(ColetorCSV(str(caminho)).coletar()) == [
        {
            "origem": "email",
            "texto": "Preciso de ajuda",
            "hash_texto": calcular_hash("Preciso de ajuda"),
        }
    ]

    caminho.write_text("origem,assunto\nemail,sem campo texto\n", encoding="utf-8")
    with pytest.raises(ValueError, match="coluna obrigatória"):
        list(ColetorCSV(str(caminho)).coletar())


def test_valida_json_e_campos_permitidos():
    assert validar_classificacao(json.dumps({
        "categoria": "Financeiro", "urgencia": "alta", "resumo": "Fatura incorreta"
    })) == {
        "categoria": "Financeiro", "urgencia": "alta", "resumo": "Fatura incorreta"
    }
    assert validar_classificacao("não é json") is None
    assert validar_classificacao('{"categoria":"Outra","urgencia":"alta","resumo":"x"}') is None
    assert validar_classificacao(json.dumps({
        "categoria": "RH", "urgencia": "baixa", "resumo": "x" * 141
    })) is None


def test_fallback_usa_duvida_geral_media_e_corta_resumo():
    resultado = resposta_fallback("x" * 180)
    assert resultado == {"categoria": "Dúvida Geral", "urgencia": "media", "resumo": "x" * 140}


def test_mock_classifica_por_palavras_chave():
    classificador = ClassificadorIA(mode="mock")
    assert classificador.classificar("O sistema está fora do ar hoje") == {
        "categoria": "Suporte Técnico",
        "urgencia": "alta",
        "resumo": "O sistema está fora do ar hoje",
    }
    assert classificador.classificar("Qual o prazo das férias")["categoria"] == "RH"


def test_classificador_repete_json_invalido_e_depois_aplica_fallback():
    respostas = ["texto solto", "json inválido"]

    def post(*args, **kwargs):
        resposta = respostas.pop(0)
        return type("Response", (), {
            "status_code": 200,
            "raise_for_status": lambda self: None,
            "json": lambda self: {"content": [{"text": resposta}]},
        })()

    classificador = ClassificadorIA(
        mode="anthropic", api_key="chave-de-teste", post=post, sleep=lambda _: None
    )
    assert classificador.classificar("Solicitação sem resposta válida") == {
        "categoria": "Dúvida Geral",
        "urgencia": "media",
        "resumo": "Solicitação sem resposta válida",
    }


def test_classificador_tenta_novamente_rate_limit_com_backoff():
    chamadas = []
    esperas = []

    def post(*args, **kwargs):
        chamadas.append(kwargs)
        if len(chamadas) == 1:
            return type("Response", (), {"status_code": 429})()
        return type("Response", (), {
            "status_code": 200,
            "raise_for_status": lambda self: None,
            "json": lambda self: {
                "content": [{"text": json.dumps({
                    "categoria": "Comercial",
                    "urgencia": "baixa",
                    "resumo": "Cotação",
                })}]
            },
        })()

    classificador = ClassificadorIA(
        mode="anthropic",
        api_key="chave-de-teste",
        post=post,
        sleep=esperas.append,
    )
    assert classificador.classificar("Quero uma cotação")["categoria"] == "Comercial"
    assert len(chamadas) == 2
    assert esperas == [1]
    assert chamadas[0]["timeout"] == 20


def test_executar_segue_apos_falha_e_registra_resumo():
    registro = {
        "origem": "email",
        "texto": "chamado",
        "hash_texto": calcular_hash("chamado"),
    }

    class Coletor:
        def coletar(self):
            return iter([registro, registro, {**registro, "hash_texto": "outro"}])

    class Classificador:
        def classificar(self, texto):
            return {"categoria": "Dúvida Geral", "urgencia": "media", "resumo": texto}

    class Repositorio:
        logs = []
        inseridos = 0

        def registrar_log(self, *args):
            self.logs.append(args)

        def existe_hash(self, hash_texto):
            return hash_texto == registro["hash_texto"]

        def inserir(self, ticket, classificacao):
            self.inseridos += 1
            raise RuntimeError("falha simulada")

    repo = Repositorio()
    resultado = executar(Coletor(), Classificador(), repo)
    assert resultado["lidos"] == 3
    assert resultado["duplicados"] == 2
    assert resultado["falhas"] == 1
    assert resultado["inseridos"] == 0
    assert len(repo.logs) == 3
