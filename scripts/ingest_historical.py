"""Import cleaned dataset into the database."""

from pathlib import Path
import pandas as pd
from srag.data.database import init_db, save_cases

# 1. Load the cleaned CSV
clean_path = Path("data/processed/INFLUD19_MOSSORO_CLEAN.csv")
df = pd.read_csv(clean_path)

# Convert strings back to date objects for database insertion
# These are exported as YYYY-MM-DD by pandas to CSV
for col in ["dt_notific", "dt_sin_pri", "dt_nasc", "dt_interna", "dt_evoluca"]:
    if col in df.columns:
        df[col] = pd.to_datetime(df[col]).dt.date

# 2. Initialize DB and Save
init_db()
added = save_cases(df.to_dict(orient="records"))
print(f"Sucesso: {added} novos casos de 2019 adicionados ao banco de dados.")
