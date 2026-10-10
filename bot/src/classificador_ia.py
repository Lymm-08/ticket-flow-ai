import json
import os
import time
from typing import Callable, Dict, Optional

import requests

CATEGORIAS = {
    "Financeiro",
    "Suporte Técnico",
    "Comercial",
    "RH",
    "Dúvida Geral",
}
URGENCIAS = {"baixa", "media", "alta"}
ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages"
PROMPT = (
    "Classifique a solicitação em uma categoria permitida, defina a urgência e "
    "gere um resumo de até 140 caracteres. Responda SOMENTE com JSON válido no "
    "formato {\"categoria\":\"...\",\"urgencia\":\"baixa|media|alta\","
    "\"resumo\":\"...\"}. Categorias permitidas: Financeiro, Suporte Técnico, "
    "Comercial, RH, Dúvida Geral.\n\nSolicitação:\n"
)


def resposta_fallback(texto: str) -> Dict[str, str]:
    return {
        "categoria": "Dúvida Geral",
        "urgencia": "media",
        "resumo": texto[:140],
    }


def validar_classificacao(conteudo: str) -> Optional[Dict[str, str]]:
    try:
        dados = json.loads(conteudo)
    except (json.JSONDecodeError, TypeError):
        return None
    if not isinstance(dados, dict):
        return None

    categoria = dados.get("categoria")
    urgencia = dados.get("urgencia")
    resumo = dados.get("resumo")
    if not isinstance(categoria, str) or not isinstance(urgencia, str):
        return None
    if categoria not in CATEGORIAS or urgencia not in URGENCIAS:
        return None
    if not isinstance(resumo, str) or len(resumo.strip()) > 140:
        return None
    return {"categoria": categoria, "urgencia": urgencia, "resumo": resumo.strip()}


class ClassificadorIA:
    def __init__(
        self,
        mode: Optional[str] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout: Optional[float] = None,
        post: Optional[Callable] = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self.mode = (mode or os.getenv("CLASSIFIER_MODE", "mock")).strip().lower()
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY", "")
        self.model = model or os.getenv("ANTHROPIC_MODEL", "claude-3-5-haiku-latest")
        self.timeout = timeout or float(os.getenv("ANTHROPIC_TIMEOUT_SECONDS", "20"))
        self.post = post or requests.post
        self.sleep = sleep
        if self.mode not in {"mock", "anthropic"}:
            raise ValueError(f"Modo de classificação inválido: {self.mode}")
        if self.mode == "anthropic" and not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY é obrigatória no modo anthropic")

    def classificar(self, texto: str) -> Dict[str, str]:
        if self.mode == "mock":
            return self._classificar_mock(texto)

        for tentativa in range(2):
            conteudo = self._consultar_anthropic(texto)
            classificacao = validar_classificacao(conteudo)
            if classificacao:
                return classificacao
        return resposta_fallback(texto)

    def _consultar_anthropic(self, texto: str) -> str:
        payload = {
            "model": self.model,
            "max_tokens": 256,
            "messages": [{"role": "user", "content": PROMPT + texto}],
        }
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }

        for tentativa in range(3):
            try:
                response = self.post(
                    ANTHROPIC_MESSAGES_URL,
                    headers=headers,
                    json=payload,
                    timeout=self.timeout,
                )
            except requests.RequestException:
                if tentativa == 2:
                    raise
                self.sleep(2**tentativa)
                continue

            if response.status_code == 429 or response.status_code >= 500:
                if tentativa == 2:
                    raise RuntimeError(
                        f"Anthropic indisponível após retries (HTTP {response.status_code})"
                    )
                self.sleep(2**tentativa)
                continue
            response.raise_for_status()
            body = response.json()
            blocks = body.get("content", [])
            if not blocks or not isinstance(blocks[0].get("text"), str):
                return ""
            return blocks[0]["text"]
        raise RuntimeError("Não foi possível obter uma resposta da Anthropic")

    @staticmethod
    def _classificar_mock(texto: str) -> Dict[str, str]:
        normalizado = texto.casefold()
        urgencia = "media"
        if any(palavra in normalizado for palavra in (
            "urgente", "imediatamente", "hoje", "parada", "fora do ar", "bloqueado",
            "não consigo acessar", "nao consigo acessar", "não liga", "nao liga",
            "aguardando atendimento", "erro de conexão", "erro ao emitir",
            "não recebi", "nao recebi", "não caiu", "nao caiu",
            "não estão chegando", "nao estao chegando", "não consigo concluir",
            "nao consigo concluir", "desconto de horas", "destinatário incorreto",
            "destinatario incorreto", "impedindo o fechamento",
            "cartão corporativo perdido", "cartao corporativo perdido",
        )):
            urgencia = "alta"
        elif any(palavra in normalizado for palavra in (
            "dúvida", "duvida", "como faço", "informações", "informacoes"
        )):
            urgencia = "baixa"

        regras = [
            ("RH", ("funcionári", "colaborador", "férias", "ferias", "salário", "salario", "folha", "vale-transporte", "processo seletivo")),
            ("Financeiro", ("pagamento", "fatura", "financeir", "nota fiscal", "reembolso", "cobrança", "cobranca", "bancári", "bancari", "salário", "salario")),
            ("Suporte Técnico", ("sistema", "computador", "notebook", "servidor", "acesso", "senha", "erro", "vpn", "impressora", "aplicativo")),
            ("Comercial", ("contratar", "proposta", "orçamento", "orcamento", "vendas", "catálogo", "catalogo", "parceria", "demonstração", "demonstracao", "cliente")),
        ]
        categoria = "Dúvida Geral"
        for nome, palavras in regras:
            if any(palavra in normalizado for palavra in palavras):
                categoria = nome
                break

        return {
            "categoria": categoria,
            "urgencia": urgencia,
            "resumo": texto[:140],
        }
