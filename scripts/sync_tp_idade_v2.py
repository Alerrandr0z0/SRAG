import pandas as pd
import sqlite3
import glob
import hashlib
from pathlib import Path

def generate_hash_v2(row):
    # Map 'MOSSORO' to '240800' to match DB ingestion logic
    mun = str(row.get("ID_MUNICIP"))
    if mun == "MOSSORO": mun = "240800"
    
    unit = str(row.get("ID_UNIDADE"))
    if unit == "None" or unit == "nan": unit = "None" # In DB it was stored as NULL which str() might have handled differently
    
    key_fields = [
        str(row.get("DT_NOTIFIC")),
        mun,
        str(row.get("DT_SIN_PRI")),
        str(row.get("NU_IDADE_N")),
        str(row.get("CS_SEXO")),
        unit,
    ]
    hash_input = "|".join(key_fields).encode("utf-8")
    return hashlib.md5(hash_input).hexdigest()

db_path = 'data/srag_mossoro.db'
conn = sqlite3.connect(db_path)

staging_files = glob.glob('data/staging/*.parquet')
total_updated = 0

for f in staging_files:
    print(f"Processing {f}...")
    df = pd.read_parquet(f)
    
    # Try multiple ways to match if the first fails
    df['UNIQUE_HASH'] = df.apply(generate_hash_v2, axis=1)
    
    df[['UNIQUE_HASH', 'TP_IDADE']].to_sql('temp_age_sync', conn, if_exists='replace', index=False)
    
    cursor = conn.execute('''
        UPDATE casos_srag 
        SET TP_IDADE = (SELECT TP_IDADE FROM temp_age_sync WHERE temp_age_sync.UNIQUE_HASH = casos_srag.UNIQUE_HASH)
        WHERE EXISTS (SELECT 1 FROM temp_age_sync WHERE temp_age_sync.UNIQUE_HASH = casos_srag.UNIQUE_HASH)
    ''')
    total_updated += cursor.rowcount
    print(f"Updated {cursor.rowcount} rows from {f}")

conn.commit()
conn.close()
print(f"Done! Total updated: {total_updated}")
