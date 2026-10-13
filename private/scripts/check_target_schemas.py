import sqlite3

conn = sqlite3.connect("web/prisma/dev.db")
cursor = conn.cursor()

tables = ["User", "Wallet", "P2pAd", "P2pOrder", "P2pMessage", "P2pPaymentMethod", "P2pFeedback", "P2pDispute"]
for t in tables:
    cursor.execute(f"PRAGMA table_info({t});")
    cols = cursor.fetchall()
    print(f"\n--- {t} ---")
    for c in cols:
        print(f"  {c[1]} ({c[2]}) pk={c[5]} dflt={c[4]}")

conn.close()
