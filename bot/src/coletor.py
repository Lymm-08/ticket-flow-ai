import csv
import hashlib
import re
from pathlib import Path
from typing import Dict, Iterable, Optional


def limpar_registro(registro: Dict[str, str]) -> Optional[Dict[str, str]]:
    texto = re.sub(r"\s+", " ", (registro.get("texto") or "").strip())
    if not texto:
        return None

    origem = (registro.get("origem") or "desconhecida").strip() or "desconhecida"
    return {"origem": origem, "texto": texto, "hash_texto": calcular_hash(texto)}


def calcular_hash(texto: str) -> str:
    texto_normalizado = re.sub(r"\s+", " ", texto.strip())
    return hashlib.sha256(texto_normalizado.encode("utf-8")).hexdigest()


class ColetorCSV:
    def __init__(self, caminho: str) -> None:
        self.caminho = Path(caminho)

    def coletar(self) -> Iterable[Dict[str, str]]:
        if not self.caminho.is_file():
            raise FileNotFoundError(f"Arquivo CSV não encontrado: {self.caminho}")

        with self.caminho.open("r", encoding="utf-8-sig", newline="") as arquivo:
            leitor = csv.DictReader(arquivo)
            if not leitor.fieldnames or "texto" not in leitor.fieldnames:
                raise ValueError("CSV deve conter a coluna obrigatória 'texto'")
            for linha in leitor:
                registro = limpar_registro(linha)
                if registro:
                    yield registro


def criar_coletor() -> ColetorCSV:
    import os

    tipo = os.getenv("SOURCE_TYPE", "csv").strip().lower()
    if tipo != "csv":
        raise ValueError(f"Fonte não suportada: {tipo}")
    return ColetorCSV(os.getenv("CSV_PATH", "data/exemplo_chamados.csv"))
