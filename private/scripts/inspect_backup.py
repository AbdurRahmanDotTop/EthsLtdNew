import sqlite3
import os

sql_path = os.path.join("private", "backups", "p2p_ethsltd_db_backup.sql")
db_path = os.path.join("private", "backups", "source_p2p.db")

if os.path.exists(db_path):
    os.remove(db_path)

conn = sqlite3.connect(db_path)
with open(sql_path, "r", encoding="utf-8") as f:
    sql_content = f.read()

conn.executescript(sql_content)
print("Database restored successfully into source_p2p.db")

cursor = conn.cursor()

# Get row counts
tables = ["users", "wallets", "p2p_ads", "p2p_orders", "p2p_messages", "p2p_payment_methods", "payment_methods", "wallet_transactions"]
for t in tables:
    try:
        cursor.execute(f"SELECT COUNT(*) FROM {t}")
        count = cursor.fetchone()[0]
        print(f"Table {t}: {count} rows")
    except Exception as e:
        print(f"Table {t}: Error {e}")

conn.close()
