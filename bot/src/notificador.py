import os
from typing import Callable, Dict, Optional

import requests


class NotificadorWebhook:
    def __init__(
        self,
        provider: str,
        url: str,
        chat_id: Optional[str] = None,
        post: Optional[Callable] = None,
        timeout: float = 10,
    ) -> None:
        self.provider = provider
        self.url = url
        self.chat_id = chat_id
        self.post = post or requests.post
        self.timeout = timeout

    def enviar(self, registro: Dict[str, str], classificacao: Dict[str, str]) -> None:
        mensagem = (
            f"Chamado urgente | {classificacao['categoria']} | "
            f"Origem: {registro['origem']}\n{classificacao['resumo']}"
        )
        if self.provider == "discord":
            response = self.post(
                self.url,
                json={"content": mensagem},
                timeout=self.timeout,
            )
        elif self.provider == "telegram":
            response = self.post(
                self.url,
                json={"chat_id": self.chat_id, "text": mensagem},
                timeout=self.timeout,
            )
        else:
            raise ValueError(f"Provedor de alerta não suportado: {self.provider}")

        response.raise_for_status()
        if self.provider == "telegram" and response.json().get("ok") is not True:
            raise RuntimeError("Telegram não confirmou o envio do alerta")


def criar_notificador() -> Optional[NotificadorWebhook]:
    provider = os.getenv("ALERT_PROVIDER", "").strip().lower()
    if not provider:
        return None
    if provider == "discord":
        url = os.getenv("ALERT_WEBHOOK_URL", "").strip()
        if not url:
            raise ValueError("ALERT_WEBHOOK_URL é obrigatória para alertas Discord")
        return NotificadorWebhook(provider, url)
    if provider == "telegram":
        token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
        chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
        if not token or not chat_id:
            raise ValueError("TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID são obrigatórios")
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        return NotificadorWebhook(provider, url, chat_id=chat_id)
    raise ValueError(f"ALERT_PROVIDER inválido: {provider}")
