import pandas as pd
from sqlalchemy import create_engine
from srag.data.database import DB_URL

engine = create_engine(DB_URL)

def test():
    # Simular o get_df() do main.py
    df = pd.read_sql("SELECT dt_interna, dt_evoluca FROM casos_srag", engine)
    df["dt_interna"] = pd.to_datetime(df["dt_interna"], errors="coerce").dt.date
    df["dt_evoluca"] = pd.to_datetime(df["dt_evoluca"], errors="coerce").dt.date
    
    # Simular o endpoint hospitalization_duration
    sub = df[df["dt_interna"].notna() & df["dt_evoluca"].notna()].copy()
    print(f"Registros filtrados: {len(sub)}")
    
    if not sub.empty:
        dt_int = pd.to_datetime(sub["dt_interna"])
        dt_evo = pd.to_datetime(sub["dt_evoluca"])
        durations = (dt_evo - dt_int).dt.days
        valid = durations[(durations >= 0) & (durations <= 60)]
        print(f"Durações válidas calculadas: {len(valid)}")
        if len(valid) > 0:
            print(f"Amostra: {valid.tolist()[:10]}")

if __name__ == "__main__":
    test()
