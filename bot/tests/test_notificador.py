import pytest
import requests

from bot.src.notificador import NotificadorWebhook, criar_notificador

REGISTRO = {"origem": "email", "texto": "Falha crítica", "hash_texto": "abc"}
CLASSIFICACAO = {"categoria": "Suporte Técnico", "urgencia": "alta", "resumo": "Sistema indisponível"}


def test_discord_envia_resumo_para_webhook():
    chamadas = []
    notificador = NotificadorWebhook(
        "discord",
        "https://discord.test/webhook",
        post=lambda *args, **kwargs: (
            chamadas.append((args, kwargs))
            or type("Response", (), {"raise_for_status": lambda self: None})()
        ),
    )
    notificador.enviar(REGISTRO, CLASSIFICACAO)
    assert chamadas[0][0] == ("https://discord.test/webhook",)
    assert chamadas[0][1]["json"]["content"] == (
        "Chamado urgente | Suporte Técnico | Origem: email\nSistema indisponível"
    )
    assert chamadas[0][1]["timeout"] == 10


def test_telegram_confirma_envio():
    chamadas = []

    def post(url, **kwargs):
        chamadas.append((url, kwargs))
        return type("Response", (), {
            "raise_for_status": lambda self: None,
            "json": lambda self: {"ok": True},
        })()

    notificador = NotificadorWebhook("telegram", "https://telegram.test/sendMessage", "chat-1", post)
    notificador.enviar(REGISTRO, CLASSIFICACAO)
    assert chamadas[0][1]["json"]["chat_id"] == "chat-1"
    assert chamadas[0][1]["json"]["text"].startswith("Chamado urgente")


def test_telegram_sinaliza_resposta_negativa():
    notificador = NotificadorWebhook(
        "telegram",
        "https://telegram.test/sendMessage",
        "chat-1",
        post=lambda *args, **kwargs: type("Response", (), {
            "raise_for_status": lambda self: None,
            "json": lambda self: {"ok": False},
        })(),
    )
    with pytest.raises(RuntimeError, match="não confirmou"):
        notificador.enviar(REGISTRO, CLASSIFICACAO)


def test_notificador_propaga_falhas_http():
    def post(*args, **kwargs):
        raise requests.Timeout("timeout simulado")

    notificador = NotificadorWebhook("discord", "https://discord.test/webhook", post=post)
    with pytest.raises(requests.Timeout):
        notificador.enviar(REGISTRO, CLASSIFICACAO)


def test_factory_desabilita_alertas_sem_provedor(monkeypatch):
    monkeypatch.delenv("ALERT_PROVIDER", raising=False)
    assert criar_notificador() is None


def test_factory_valida_configuracao_discord(monkeypatch):
    monkeypatch.setenv("ALERT_PROVIDER", "discord")
    monkeypatch.delenv("ALERT_WEBHOOK_URL", raising=False)
    with pytest.raises(ValueError, match="ALERT_WEBHOOK_URL"):
        criar_notificador()
