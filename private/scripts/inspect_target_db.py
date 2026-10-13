import sqlite3

conn = sqlite3.connect("web/prisma/dev.db")
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("=== TARGET DEV.DB USERS ===")
users = cursor.execute("SELECT id, uid, email, role, status FROM User").fetchall()
for u in users:
    print(dict(u))

print(f"\nTotal users in target dev.db: {len(users)}")

print("\n=== TARGET DEV.DB P2P ADS ===")
ads = cursor.execute("SELECT id, type, asset, fiat, price FROM P2pAd").fetchall()
print(f"Total P2pAd in target dev.db: {len(ads)}")

print("\n=== TARGET DEV.DB P2P ORDERS ===")
orders = cursor.execute("SELECT id, status, cryptoAmount, fiatAmount FROM P2pOrder").fetchall()
print(f"Total P2pOrder in target dev.db: {len(orders)}")

print("\n=== TARGET DEV.DB WALLETS ===")
wallets = cursor.execute("SELECT asset, type, count(*), sum(balance), sum(escrowBalance) FROM Wallet GROUP BY asset, type").fetchall()
for w in wallets:
    print(dict(w))

conn.close()
