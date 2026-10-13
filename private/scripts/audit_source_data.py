import sqlite3
import json

conn = sqlite3.connect("private/backups/source_p2p.db")
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("=== USERS AUDIT ===")
users = cursor.execute("SELECT id, email, role, status, display_name, display_id, is_merchant, created_at FROM users").fetchall()
for u in users:
    print(dict(u))

print("\n=== P2P ADS AUDIT ===")
ads = cursor.execute("SELECT id, user_id, type, asset, fiat, price, total_amount, available_amount, min_limit, max_limit, payment_methods, status, display_id FROM p2p_ads").fetchall()
for a in ads:
    print(dict(a))

print("\n=== PAYMENT METHODS AUDIT ===")
pms = cursor.execute("SELECT id, method, enabled, supported_assets, instructions FROM payment_methods").fetchall()
for pm in pms:
    print(dict(pm))

print("\n=== WALLETS AUDIT (Summary) ===")
wallets = cursor.execute("SELECT asset_symbol, type, count(*) as count, sum(cast(balance as real)) as total_bal, sum(cast(escrow_balance as real)) as total_escrow FROM wallets GROUP BY asset_symbol, type").fetchall()
for w in wallets:
    print(dict(w))

print("\n=== P2P ORDERS AUDIT (Status Distribution) ===")
orders = cursor.execute("SELECT status, count(*) as count, sum(cast(crypto_amount as real)) as crypto_sum, sum(cast(fiat_amount as real)) as fiat_sum FROM p2p_orders GROUP BY status").fetchall()
for o in orders:
    print(dict(o))

print("\n=== P2P ORDERS SAMPLE (First 5) ===")
sample_orders = cursor.execute("SELECT id, ad_id, buyer_id, seller_id, crypto_amount, fiat_amount, price, status, payment_method, display_id FROM p2p_orders LIMIT 5").fetchall()
for so in sample_orders:
    print(dict(so))

conn.close()
