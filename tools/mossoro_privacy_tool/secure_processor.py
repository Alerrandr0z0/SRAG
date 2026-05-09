"""MOSSORÓ PRIVACY TOOL - SIVEP-GRIPE
Este é um programa independente para uso local no Setor de Epidemiologia de Mossoró/RN.
Ele realiza a filtragem e anonimização de dados de SRAG conforme a LGPD.
"""

import tkinter as tk
import unicodedata
from pathlib import Path
from tkinter import filedialog, messagebox, ttk
from typing import TYPE_CHECKING

import pandas as pd
from pydantic import BaseModel, Field, field_validator

if TYPE_CHECKING:
    from datetime import date

# --- LÓGICA DE NEGÓCIO (EMBUTIDA PARA SER INDEPENDENTE) ---

SENSITIVE_FIELDS = [
    "NM_PACIENT",
    "NU_CPF",
    "NU_CNS",
    "NM_MAE_PAC",
    "ID_LOGRADO",
    "NM_LOGRADO",
    "NU_NUMERO",
    "NM_COMPLEM",
    "NM_BAIRRO",
    "NU_CEP",
    "NU_DDD_TEL",
    "NU_TELEFON",
    "ID_RG_RESI",
]

COLUMN_ALIASES = {
    "CO_MUN_NOT": "ID_MUNICIP",
    "CO_MUN_RES": "ID_MN_RESI",
    "CO_UNI_NOT": "ID_UNIDADE",
}

RURAL_KEYWORDS = [
    "RURAL",
    "SITIO",
    "ASSENTAMENTO",
    "FAZENDA",
    "VILA RURAL",
]


def normalize_bairro_name(value):
    if value is None:
        return None
    text = str(value).strip().upper()
    if not text or text in {"NAN", "NONE", "NULL", "IGNORADO", "SEM INFORMACAO"}:
        return None
    text = "".join(
        ch for ch in unicodedata.normalize("NFKD", text) if not unicodedata.combining(ch)
    )
    return " ".join(text.split())


def infer_zone(bairro_ref) -> str | None:
    if bairro_ref is None:
        return None
    if any(k in bairro_ref for k in RURAL_KEYWORDS):
        return "Rural"
    return "Urbana"


class SragCase(BaseModel):
    """Esquema simplificado para validação local."""

    dt_notific: date = Field(alias="DT_NOTIFIC")
    id_municip: str = Field(alias="ID_MUNICIP")
    id_mn_resi: str = Field(alias="ID_MN_RESI")
    dt_sin_pri: date = Field(alias="DT_SIN_PRI")
    classi_fin: int | None = Field(alias="CLASSI_FIN", default=None)

    @field_validator("dt_notific", "dt_sin_pri", mode="before")
    @classmethod
    def parse_date(cls, v):
        if isinstance(v, str) and v.strip():
            for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
                try:
                    import datetime

                    return datetime.datetime.strptime(v, fmt).date()
                except ValueError:
                    continue
        return v


def process_file(input_path, output_path):
    """Filtra para Mossoró e remove dados sensíveis."""
    # Carregar
    suffix = input_path.suffix.lower()
    if suffix == ".csv":
        df = pd.read_csv(input_path, sep=None, engine="python", dtype=str)
    elif suffix == ".parquet":
        df = pd.read_parquet(input_path)
    elif suffix in {".xls", ".xlsx"}:
        df = pd.read_excel(input_path, dtype=str)
    else:
        raise ValueError(f"Formato não suportado: {input_path.suffix}")

    # Compatibilidade com exportacoes que usam nomes alternativos de coluna
    rename_map = {
        source: target
        for source, target in COLUMN_ALIASES.items()
        if source in df.columns and target not in df.columns
    }
    if rename_map:
        df = df.rename(columns=rename_map)

    if "NM_BAIRRO" in df.columns and "BAIRRO_REF" not in df.columns:
        df["BAIRRO_REF"] = df["NM_BAIRRO"].apply(normalize_bairro_name)
    if "BAIRRO_REF" in df.columns and "ZONA" not in df.columns:
        df["ZONA"] = df["BAIRRO_REF"].apply(infer_zone)

    # 1. LGPD - Remover sensíveis imediatamente
    cols_to_drop = [c for c in SENSITIVE_FIELDS if c in df.columns]
    df = df.drop(columns=cols_to_drop)

    # 2. Filtrar Mossoró (Código IBGE: 2408003)
    MOSSORO_CODE = "2408003"
    # Filtra se notificado em Mossoró OU residente em Mossoró
    mask = (df["ID_MUNICIP"].astype(str) == MOSSORO_CODE) | (
        df["ID_MN_RESI"].astype(str) == MOSSORO_CODE
    )
    df_mossoro = df[mask].copy()

    if df_mossoro.empty:
        return 0

    # 3. Salvar (UTF-8 com Bom para abrir direto no Excel se precisarem)
    df_mossoro.to_csv(output_path, index=False, encoding="utf-8-sig")
    return len(df_mossoro)


# --- INTERFACE GRÁFICA (GUI) ---


class App:
    def __init__(self, root) -> None:
        self.root = root
        root.title("Mossoró - Processador de Dados SRAG (LGPD)")
        root.geometry("500x300")

        style = ttk.Style()
        style.configure("TButton", padding=6)

        main_frame = ttk.Frame(root, padding="20")
        main_frame.pack(fill=tk.BOTH, expand=True)

        ttk.Label(
            main_frame,
            text="Selecione a planilha bruta do SIVEP-Gripe:",
            font=("Arial", 10, "bold"),
        ).pack(pady=(0, 10))

        # Seleção de Arquivo de Entrada
        self.input_path = tk.StringVar()
        input_frame = ttk.Frame(main_frame)
        input_frame.pack(fill=tk.X, pady=5)
        ttk.Entry(input_frame, textvariable=self.input_path).pack(
            side=tk.LEFT, fill=tk.X, expand=True
        )
        ttk.Button(input_frame, text="Procurar", command=self.browse_input).pack(
            side=tk.LEFT, padx=5
        )

        # Seleção de Arquivo de Saída
        self.output_path = tk.StringVar()
        ttk.Label(main_frame, text="Salvar arquivo limpo em:", font=("Arial", 10, "bold")).pack(
            pady=(15, 10)
        )
        output_frame = ttk.Frame(main_frame)
        output_frame.pack(fill=tk.X, pady=5)
        ttk.Entry(output_frame, textvariable=self.output_path).pack(
            side=tk.LEFT, fill=tk.X, expand=True
        )
        ttk.Button(output_frame, text="Salvar como", command=self.browse_output).pack(
            side=tk.LEFT, padx=5
        )

        # Botão de Processar
        ttk.Button(main_frame, text="PROCESSAR E ANONIMIZAR", command=self.run).pack(pady=20)

    def browse_input(self) -> None:
        filename = filedialog.askopenfilename(
            filetypes=[("Arquivos de Dados", "*.csv *.xlsx *.xls *.parquet")]
        )
        if filename:
            self.input_path.set(filename)
            # Sugerir nome de saída
            p = Path(filename)
            self.output_path.set(str(p.parent / f"{p.stem}_MOSSORO_LIMPO.csv"))

    def browse_output(self) -> None:
        filename = filedialog.asksaveasfilename(
            defaultextension=".csv", filetypes=[("CSV", "*.csv")]
        )
        if filename:
            self.output_path.set(filename)

    def run(self) -> None:
        if not self.input_path.get() or not self.output_path.get():
            messagebox.showwarning("Erro", "Por favor, selecione os arquivos de entrada e saída.")
            return

        try:
            count = process_file(Path(self.input_path.get()), Path(self.output_path.get()))
            if count > 0:
                messagebox.showinfo(
                    "Sucesso",
                    f"Processamento concluído!\n{count} casos de Mossoró exportados com segurança.",
                )
            else:
                messagebox.showwarning(
                    "Aviso", "Nenhum caso de Mossoró foi encontrado no arquivo selecionado."
                )
        except Exception as e:
            messagebox.showerror("Erro Fatal", f"Ocorreu um erro ao processar: {e!s}")


if __name__ == "__main__":
    root = tk.Tk()
    app = App(root)
    root.mainloop()
