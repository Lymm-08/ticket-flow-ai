import os
import time
import uuid

from dotenv import load_dotenv

from .classificador_ia import ClassificadorIA
from .coletor import criar_coletor
from .repositorio import RepositorioChamados


def executar(
    coletor=None,
    classificador=None,
    repositorio=None,
    notificador=None,
) -> dict:
    inicio = time.monotonic()
    execucao_id = uuid.uuid4()
    coletor = coletor or criar_coletor()
    classificador = classificador or ClassificadorIA()
    repositorio = repositorio or RepositorioChamados()
    resumo = {"lidos": 0, "inseridos": 0, "duplicados": 0, "falhas": 0}

    repositorio.registrar_log(execucao_id, "INFO", "Execução do robô iniciada")
    try:
        for registro in coletor.coletar():
            resumo["lidos"] += 1
            try:
                if repositorio.existe_hash(registro["hash_texto"]):
                    resumo["duplicados"] += 1
                    continue
                classificacao = classificador.classificar(registro["texto"])
                repositorio.inserir(registro, classificacao)
                resumo["inseridos"] += 1
                if classificacao["urgencia"] == "alta" and notificador:
                    notificador.enviar(registro, classificacao)
            except Exception as erro:
                resumo["falhas"] += 1
                repositorio.registrar_log(
                    execucao_id,
                    "ERROR",
                    f"Falha ao processar chamado (hash={registro['hash_texto']}): {erro}",
                )
    except Exception as erro:
        repositorio.registrar_log(execucao_id, "ERROR", f"Falha ao coletar fonte: {erro}")
        raise

    resumo["duracao_segundos"] = round(time.monotonic() - inicio, 3)
    repositorio.registrar_log(execucao_id, "INFO", f"Execução concluída: {resumo}")
    return resumo


def main() -> None:
    load_dotenv()
    intervalo = int(os.getenv("BOT_INTERVAL_SECONDS", "0"))
    while True:
        executar()
        if intervalo <= 0:
            break
        time.sleep(intervalo)


if __name__ == "__main__":
    main()
