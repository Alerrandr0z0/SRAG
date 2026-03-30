import pandas as pd
import sqlite3
import glob
import hashlib
from pathlib import Path

def generate_hash(row):
    key_fields = [
        str(row.get("DT_NOTIFIC")),
        str(row.get("ID_MUNICIP")),
        str(row.get("DT_SIN_PRI")),
        str(row.get("NU_IDADE_N")),
        str(row.get("CS_SEXO")),
        str(row.get("ID_UNIDADE")),
    ]
    hash_input = "|".join(key_fields).encode("utf-8")
    return hashlib.md5(hash_input).hexdigest()

db_path = 'data/srag_mossoro.db'
conn = sqlite3.connect(db_path)

# Ensure column exists
try:
    conn.execute('ALTER TABLE casos_srag ADD COLUMN TP_IDADE INTEGER;')
except sqlite3.OperationalError:
    pass # Already exists

staging_files = glob.glob('data/staging/*.parquet')
for f in staging_files:
    print(f"Processing {f}...")
    df = pd.read_parquet(f)
    
    # Generate hashes to match DB
    df['UNIQUE_HASH'] = df.apply(generate_hash, axis=1)
    
    # Create temp table
    df[['UNIQUE_HASH', 'TP_IDADE']].to_sql('temp_age_sync', conn, if_exists='replace', index=False)
    
    # Update DB
    cursor = conn.execute('''
        UPDATE casos_srag 
        SET TP_IDADE = (SELECT TP_IDADE FROM temp_age_sync WHERE temp_age_sync.UNIQUE_HASH = casos_srag.UNIQUE_HASH)
        WHERE EXISTS (SELECT 1 FROM temp_age_sync WHERE temp_age_sync.UNIQUE_HASH = casos_srag.UNIQUE_HASH)
    ''')
    print(f"Updated {cursor.rowcount} rows from {f}")

conn.commit()
conn.close()
print("Done!")
