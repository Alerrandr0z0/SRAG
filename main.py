"""SRAG Outbreak Prediction: Mossoró/RN Edition CLI."""

import argparse
import json
import logging
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
SRC_DIR = ROOT_DIR / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from srag.data.loader import export_secure_dataset 
from srag.pipelines import run_surveillance_pipeline  

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

    export_parser = subparsers.add_parser(
        "secure-export", help="Exporta uma versão anonimizada e filtrada para Mossoró (LGPD)."
    )
    export_parser.add_argument(
        "input", type=str, help="Caminho para o arquivo bruto (CSV ou Excel)"
    )
    export_parser.add_argument(
        "output", type=str, help="Caminho_destino para o arquivo limpo (ex: dados_limpos.csv)"
    )

    weekly_parser = subparsers.add_parser(
        "weekly-update",
        help="Ingere um arquivo seguro e gera snapshot semanal (analise + previsao).",
    )
    weekly_parser.add_argument(
        "input",
        type=str,
        help="Diretório contendo arquivos brutos ou caminho para arquivo específico.",
    )
    weekly_parser.add_argument(
        "--last-n-weeks",
        type=int,
        default=26,
        help="Quantidade de semanas historicas.",
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
        db_path = Path("data/processed/srag_mossoro.db")
        
        logger.info("Iniciando atualização semanal (Pipeline de Vigilância)...")
        
        result = run_surveillance_pipeline(
            db_path=db_path,
            data_dirs=[input_path.parent if input_path.is_file() else input_path],
            force=False
        )

        logger.info("Pipeline finalizado com sucesso.")
        print(json.dumps(result, ensure_ascii=False, indent=2, default=str))

    else:
        parser.print_help()


if __name__ == "__main__":
    main()