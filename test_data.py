import pandas as pd
from sqlalchemy import create_engine
from srag.data.analytics import compute_time_series, compute_severity_metrics
from srag.data.database import DB_URL

engine = create_engine(DB_URL)

def test():
    try:
        print(f"Conectando ao banco: {DB_URL}")
        df = pd.read_sql("SELECT * FROM casos_srag", engine)
        
        # Simular o tratamento do main.py
        date_cols = ["dt_notific", "dt_sin_pri", "dt_interna", "dt_entuti", "dt_evoluca"]
        for col in date_cols:
            if col in df.columns:
                df[col] = pd.to_datetime(df[col], errors="coerce").dt.date
        
        df = df[df["dt_sin_pri"].notna()]
        print(f"Total de registros válidos: {len(df)}")
        
        if df.empty:
            print("AVISO: DataFrame vazio!")
            return

        print("\n--- Testando compute_severity_metrics ---")
        metrics = compute_severity_metrics(df)
        print(metrics)

        print("\n--- Testando compute_time_series ---")
        ts = compute_time_series(df)
        print(ts.tail())
        
    except Exception as e:
        print(f"ERRO: {e}")

if __name__ == "__main__":
    test()
