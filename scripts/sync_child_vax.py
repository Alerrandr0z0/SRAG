import pandas as pd
import sqlite3
import glob
import hashlib

def generate_hash(row):
    mun = str(row.get("ID_MUNICIP"))
    if mun == "MOSSORO": mun = "240800"
    unit = str(row.get("ID_UNIDADE"))
    if unit in ["None", "nan"]: unit = "None"
    
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

new_cols = [
    ("MAE_VAC", "INTEGER"),
    ("DT_VAC_MAE", "DATE"),
    ("DT_DOSEUNI", "DATE"),
    ("DT_1_DOSE", "DATE"),
    ("DT_2_DOSE", "DATE")
]

# 1. Add columns
for col_name, col_type in new_cols:
    try:
        conn.execute(f'ALTER TABLE casos_srag ADD COLUMN {col_name} {col_type};')
        print(f"Added column {col_name}")
    except sqlite3.OperationalError:
        print(f"Column {col_name} already exists")

# 2. Sync data from parquets
staging_files = glob.glob('data/staging/*.parquet')
total_updated = 0

for f in staging_files:
    print(f"Processing {f}...")
    df = pd.read_parquet(f)
    df['UNIQUE_HASH'] = df.apply(generate_hash, axis=1)
    
    sync_cols = ['UNIQUE_HASH'] + [c[0] for c in new_cols if c[0] in df.columns]
    df[sync_cols].to_sql('temp_vax_sync', conn, if_exists='replace', index=False)
    
    set_clause = ", ".join([f"{c[0]} = (SELECT {c[0]} FROM temp_vax_sync WHERE temp_vax_sync.UNIQUE_HASH = casos_srag.UNIQUE_HASH)" for c in new_cols if c[0] in df.columns])
    
    cursor = conn.execute(f'''
        UPDATE casos_srag 
        SET {set_clause}
        WHERE EXISTS (SELECT 1 FROM temp_vax_sync WHERE temp_vax_sync.UNIQUE_HASH = casos_srag.UNIQUE_HASH)
    ''')
    total_updated += cursor.rowcount
    print(f"Updated {cursor.rowcount} rows from {f}")

conn.commit()
conn.close()
print(f"Done! Total records updated: {total_updated}")
