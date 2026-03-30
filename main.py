"""SRAG Outbreak Prediction: Mossoró/RN Edition CLI."""

import argparse
import json
import logging
import sys
from pathlib import Path

# Allow running `python main.py ...` without editable install.
ROOT_DIR = Path(__file__).resolve().parent
SRC_DIR = ROOT_DIR / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from srag.data.loader import export_secure_dataset  # noqa: E402
from srag.pipelines import run_weekly_update  # noqa: E402

# Setup logging to show progress in terminal
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger(__name__)


def main() -> None:
    """Entry point for the SRAG Mossoró CLI."""
    parser = argparse.ArgumentParser(
        description="SRAG Mossoró: Ferramenta de Análise e Privacidade Epidemiológica."
    )

    subparsers = parser.add_subparsers(dest="command", help="Comandos disponíveis")

    # Command: secure-export
    export_parser = subparsers.add_parser(
        "secure-export", help="Exporta uma versão anonimizada e filtrada para Mossoró (LGPD)."
    )
    export_parser.add_argument(
        "input", type=str, help="Caminho para o arquivo bruto (CSV ou Excel)"
    )
    export_parser.add_argument(
        "output", type=str, help="Camin_destino para o arquivo limpo (ex: dados_limpos.csv)"
    )

    # Command: weekly-update
    weekly_parser = subparsers.add_parser(
        "weekly-update",
        help="Ingere um arquivo seguro e gera snapshot semanal (analise + previsao).",
    )
    weekly_parser.add_argument(
        "input",
        type=str,
        help="Caminho para o arquivo seguro (CSV/XLS/XLSX) a ser ingerido.",
    )
    weekly_parser.add_argument(
        "--last-n-weeks",
        type=int,
        default=26,
        help="Quantidade de semanas historicas retornadas no bloco de tendencias.",
    )
    weekly_parser.add_argument(
        "--weeks-to-predict",
        type=int,
        default=4,
        help="Horizonte de previsao em semanas.",
    )
    weekly_parser.add_argument(
        "--output",
        type=str,
        default="",
        help="Arquivo JSON opcional para salvar o snapshot completo.",
    )

    args = parser.parse_args()

    if args.command == "secure-export":
        input_path = Path(args.input)
        output_path = Path(args.output)

        if not input_path.exists():
            logger.error(f"Arquivo de entrada não encontrado: {input_path}")
            sys.exit(1)

        logger.info("Iniciando processamento seguro para Mossoró/RN...")
        export_secure_dataset(input_path, output_path)
        logger.info("Concluído. O arquivo gerado pode ser compartilhado com segurança.")

    elif args.command == "weekly-update":
        input_path = Path(args.input)
        if not input_path.exists():
            logger.error(f"Arquivo de entrada não encontrado: {input_path}")
            sys.exit(1)

        logger.info("Iniciando atualização semanal (ingestão + snapshot)...")
        result = run_weekly_update(
            input_path,
            last_n_weeks=args.last_n_weeks,
            weeks_to_predict=args.weeks_to_predict,
        )

        ingestion = result["ingestion"]
        snapshot = result["snapshot"]
        logger.info(
            "Ingestão concluída: %s processados, %s novos.",
            ingestion["processed"],
            ingestion["new_cases_added"],
        )
        logger.info(
            "Snapshot gerado: total_cases=%s, trend_status=%s",
            snapshot["summary"].get("total_cases", 0),
            snapshot["trends"].get("status", "unknown"),
        )

        if args.output:
            output_path = Path(args.output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(
                json.dumps(result, ensure_ascii=False, indent=2, default=str),
                encoding="utf-8",
            )
            logger.info("Snapshot salvo em: %s", output_path)

        print(json.dumps(result, ensure_ascii=False, indent=2, default=str))

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
