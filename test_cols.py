from srag.api.main import CORE_COLS
import sqlite3

conn = sqlite3.connect("data/srag_mossoro.db")
cursor = conn.cursor()
cursor.execute("PRAGMA table_info(casos_srag)")
db_cols = {row[1] for row in cursor.fetchall()}

missing = [col for col in CORE_COLS if col not in db_cols]
print("Missing columns:", missing)
