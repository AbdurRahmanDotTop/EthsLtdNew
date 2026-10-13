import sqlite3

def reconcile():
    src_conn = sqlite3.connect("private/backups/source_p2p.db")
    src_conn.row_factory = sqlite3.Row
    src_cur = src_conn.cursor()

    tgt_conn = sqlite3.connect("web/prisma/dev.db")
    tgt_conn.row_factory = sqlite3.Row
    tgt_cur = tgt_conn.cursor()

    print("================ RECONCILIATION AUDIT ================")
    
    # 1. Users
    src_users_count = src_cur.execute("SELECT count(*) FROM users").fetchone()[0]
    tgt_users_count = tgt_cur.execute("SELECT count(*) FROM User").fetchone()[0]
    print(f"Users: Source={src_users_count}, Target Total={tgt_users_count}")

    # 2. Ads
    src_ads_count = src_cur.execute("SELECT count(*) FROM p2p_ads").fetchone()[0]
    tgt_ads_count = tgt_cur.execute("SELECT count(*) FROM P2pAd").fetchone()[0]
    print(f"P2P Ads: Source={src_ads_count}, Target={tgt_ads_count} (Delta: {tgt_ads_count - src_ads_count})")

    # 3. Orders
    src_orders_count = src_cur.execute("SELECT count(*) FROM p2p_orders").fetchone()[0]
    tgt_orders_count = tgt_cur.execute("SELECT count(*) FROM P2pOrder").fetchone()[0]
    print(f"P2P Orders: Source={src_orders_count}, Target={tgt_orders_count} (Delta: {tgt_orders_count - src_orders_count})")

    # 4. Messages
    src_msg_count = src_cur.execute("SELECT count(*) FROM p2p_messages").fetchone()[0]
    tgt_msg_count = tgt_cur.execute("SELECT count(*) FROM P2pMessage").fetchone()[0]
    print(f"P2P Messages: Source={src_msg_count}, Target={tgt_msg_count} (Delta: {tgt_msg_count - src_msg_count})")

    # 5. Financial Volumes
    src_vol = src_cur.execute("SELECT sum(cast(crypto_amount as real)) as crypto, sum(cast(fiat_amount as real)) as fiat FROM p2p_orders WHERE status = 'COMPLETED'").fetchone()
    tgt_vol = tgt_cur.execute("SELECT sum(cast(cryptoAmount as real)) as crypto, sum(cast(fiatAmount as real)) as fiat FROM P2pOrder WHERE status = 'COMPLETED'").fetchone()
    print(f"Completed Crypto Volume: Source={src_vol['crypto']:.4f}, Target={tgt_vol['crypto']:.4f}")
    print(f"Completed Fiat Volume:   Source={src_vol['fiat']:.2f}, Target={tgt_vol['fiat']:.2f}")

    # 6. Foreign Key Integrity Checks
    orphaned_ads = tgt_cur.execute("SELECT count(*) FROM P2pAd WHERE userId NOT IN (SELECT id FROM User)").fetchone()[0]
    orphaned_orders_buyer = tgt_cur.execute("SELECT count(*) FROM P2pOrder WHERE buyerId NOT IN (SELECT id FROM User)").fetchone()[0]
    orphaned_orders_seller = tgt_cur.execute("SELECT count(*) FROM P2pOrder WHERE sellerId NOT IN (SELECT id FROM User)").fetchone()[0]
    orphaned_orders_ad = tgt_cur.execute("SELECT count(*) FROM P2pOrder WHERE adId NOT IN (SELECT id FROM P2pAd)").fetchone()[0]
    orphaned_messages = tgt_cur.execute("SELECT count(*) FROM P2pMessage WHERE orderId NOT IN (SELECT id FROM P2pOrder) OR senderId NOT IN (SELECT id FROM User)").fetchone()[0]

    print("\n--- Relational Integrity Checks ---")
    print(f"Orphaned Ads: {orphaned_ads} (Must be 0)")
    print(f"Orphaned Orders (Buyer): {orphaned_orders_buyer} (Must be 0)")
    print(f"Orphaned Orders (Seller): {orphaned_orders_seller} (Must be 0)")
    print(f"Orphaned Orders (Ad): {orphaned_orders_ad} (Must be 0)")
    print(f"Orphaned Messages: {orphaned_messages} (Must be 0)")

    # 7. Check Active Ads sample
    print("\n--- Migrated Active Ads Sample ---")
    active_ads = tgt_cur.execute("SELECT id, type, asset, fiat, price, availableAmount, status, paymentMethods FROM P2pAd WHERE status = 'ACTIVE' LIMIT 4").fetchall()
    for ad in active_ads:
        print(f"[{ad['type']}] {ad['asset']}/{ad['fiat']} Price={ad['price']} Avail={ad['availableAmount']} PM={ad['paymentMethods']}")

    src_conn.close()
    tgt_conn.close()

if __name__ == "__main__":
    reconcile()
