import sqlite3
import json
import datetime
import uuid

def epoch_to_iso(epoch_val):
    if not epoch_val:
        return datetime.datetime.now(datetime.timezone.utc).isoformat()
    # Check if epoch is in seconds or milliseconds
    val = int(epoch_val)
    if val > 100000000000: # ms
        dt = datetime.datetime.fromtimestamp(val / 1000.0, tz=datetime.timezone.utc)
    else: # seconds
        dt = datetime.datetime.fromtimestamp(val, tz=datetime.timezone.utc)
    return dt.strftime("%Y-%m-%d %H:%M:%S")

def run_migration():
    src_conn = sqlite3.connect("private/backups/source_p2p.db")
    src_conn.row_factory = sqlite3.Row
    src_cur = src_conn.cursor()

    tgt_conn = sqlite3.connect("web/prisma/dev.db")
    tgt_conn.row_factory = sqlite3.Row
    tgt_cur = tgt_conn.cursor()

    print("Beginning P2P Data Migration...")
    tgt_cur.execute("BEGIN TRANSACTION;")

    stats = {
        "users_existing_matched": 0,
        "users_inserted": 0,
        "wallets_updated": 0,
        "wallets_inserted": 0,
        "payment_methods_inserted": 0,
        "ads_inserted": 0,
        "orders_inserted": 0,
        "messages_inserted": 0
    }

    # 1. Existing Users in Target
    tgt_users = tgt_cur.execute("SELECT id, uid, email FROM User").fetchall()
    tgt_email_map = {u["email"].lower(): u for u in tgt_users}
    
    max_uid_row = tgt_cur.execute("SELECT MAX(uid) FROM User").fetchone()
    current_max_uid = max_uid_row[0] if max_uid_row and max_uid_row[0] else 100000
    if current_max_uid < 300000:
        next_uid = 300001
    else:
        next_uid = current_max_uid + 1

    # Map source user_id -> target user_id
    user_id_map = {}

    src_users = src_cur.execute("SELECT * FROM users").fetchall()
    for su in src_users:
        src_id = su["id"]
        src_email = su["email"].lower()

        if src_email in tgt_email_map:
            matched_user = tgt_email_map[src_email]
            user_id_map[src_id] = matched_user["id"]
            stats["users_existing_matched"] += 1
            print(f"Matched existing user: {src_email} (source ID: {src_id} -> target ID: {matched_user['id']})")
            
            # Update target user with merchant stats if applicable
            tgt_cur.execute("""
                UPDATE User SET 
                    p2pTotalOrders = MAX(p2pTotalOrders, ?),
                    isMerchant = CASE WHEN ? = 1 THEN 1 ELSE isMerchant END
                WHERE id = ?
            """, (su["p2p_total_orders"] or 0, su["is_merchant"] or 0, matched_user["id"]))
        else:
            new_uid = next_uid
            next_uid += 1
            user_id_map[src_id] = src_id

            name = su["display_name"] or (f"{su['first_name'] or ''} {su['last_name'] or ''}".strip()) or src_email.split("@")[0]
            created_at = epoch_to_iso(su["created_at"])
            updated_at = epoch_to_iso(su["updated_at"])

            # Map role
            role = su["role"]
            if role not in ["USER", "ADMIN", "SUPER_ADMIN", "RM"]:
                role = "ADMIN" if "ADMIN" in role else "USER"

            tgt_cur.execute("""
                INSERT INTO User (
                    id, uid, email, name, avatarUrl, passwordHash, role, status,
                    isKycVerified, createdAt, updatedAt, p2pTotalOrders, p2pCompletedOrders,
                    p2pCompletionRate, p2pPositiveFeedback, p2pNegativeFeedback, isMerchant, merchantTier
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                src_id,
                new_uid,
                src_email,
                name,
                su["avatar_url"],
                su["password_hash"], # preserved SHA-256 hash
                role,
                su["status"] or "ACTIVE",
                1 if su["email_verified"] else 0,
                created_at,
                updated_at,
                su["p2p_total_orders"] or 0,
                0,
                str(su["p2p_completion_rate"] or "100"),
                su["p2p_positive_feedback"] or 0,
                su["p2p_negative_feedback"] or 0,
                1 if su["is_merchant"] else 0,
                "VERIFIED" if su["is_merchant"] else "STANDARD"
            ))
            stats["users_inserted"] += 1
            print(f"Inserted new user: {src_email} (UID: {new_uid}, ID: {src_id})")

    # 2. Wallets Migration
    src_wallets = src_cur.execute("SELECT * FROM wallets WHERE type = 'REAL'").fetchall()
    for sw in src_wallets:
        mapped_user_id = user_id_map.get(sw["user_id"])
        if not mapped_user_id:
            continue
        
        asset = sw["asset_symbol"]
        if "(TRC20)" in asset or "(BEP20)" in asset:
            asset = asset.split("(")[0]

        balance = float(sw["balance"] or 0.0)
        escrow = float(sw["escrow_balance"] or 0.0)
        created_at = epoch_to_iso(sw["created_at"])
        updated_at = epoch_to_iso(sw["updated_at"])

        # Check existing Currency wallet in target
        exist_curr = tgt_cur.execute("SELECT id, balance, escrowBalance FROM Wallet WHERE userId = ? AND asset = ? AND type = 'Currency'", (mapped_user_id, asset)).fetchone()
        if exist_curr:
            tgt_cur.execute("""
                UPDATE Wallet SET balance = balance + ?, escrowBalance = escrowBalance + ?, updatedAt = ?
                WHERE id = ?
            """, (balance, escrow, updated_at, exist_curr["id"]))
            stats["wallets_updated"] += 1
        else:
            w_id = f"w_{uuid.uuid4().hex[:16]}"
            tgt_cur.execute("""
                INSERT INTO Wallet (id, userId, asset, balance, lockedBalance, escrowBalance, type, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, 0.0, ?, 'Currency', ?, ?)
            """, (w_id, mapped_user_id, asset, balance, escrow, created_at, updated_at))
            stats["wallets_inserted"] += 1

        # Also create or sync Funding (P2P) wallet
        exist_p2p = tgt_cur.execute("SELECT id FROM Wallet WHERE userId = ? AND asset = ? AND type = 'P2P'", (mapped_user_id, asset)).fetchone()
        if not exist_p2p:
            p2p_w_id = f"wp2p_{uuid.uuid4().hex[:16]}"
            tgt_cur.execute("""
                INSERT INTO Wallet (id, userId, asset, balance, lockedBalance, escrowBalance, type, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, 0.0, ?, 'P2P', ?, ?)
            """, (p2p_w_id, mapped_user_id, asset, balance, escrow, created_at, updated_at))
            stats["wallets_inserted"] += 1

    # Ensure all users have standard wallets
    all_users = tgt_cur.execute("SELECT id FROM User").fetchall()
    for u in all_users:
        u_id = u["id"]
        for a in ["USDT", "BTC", "ETH"]:
            for wtype in ["Currency", "P2P"]:
                w_exists = tgt_cur.execute("SELECT id FROM Wallet WHERE userId = ? AND asset = ? AND type = ?", (u_id, a, wtype)).fetchone()
                if not w_exists:
                    tgt_cur.execute("""
                        INSERT INTO Wallet (id, userId, asset, balance, lockedBalance, escrowBalance, type, createdAt, updatedAt)
                        VALUES (?, ?, ?, 0.0, 0.0, 0.0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """, (f"w_{uuid.uuid4().hex[:16]}", u_id, a, wtype))

    # 3. P2P Payment Methods from ads & methods
    seen_pms = set()
    src_ads = src_cur.execute("SELECT * FROM p2p_ads").fetchall()
    for sa in src_ads:
        mapped_user_id = user_id_map.get(sa["user_id"])
        if not mapped_user_id:
            continue
        try:
            methods = json.loads(sa["payment_methods"])
            if isinstance(methods, list):
                for m in methods:
                    if isinstance(m, dict) and "type" in m and "details" in m:
                        details_json = json.dumps(m["details"])
                        pm_key = (mapped_user_id, m["type"], details_json)
                        if pm_key not in seen_pms:
                            seen_pms.add(pm_key)
                            pm_id = m.get("id") or f"pm_{uuid.uuid4().hex[:16]}"
                            bank_name = m["details"].get("bankName") or m["type"]
                            
                            # Check if already exists in target
                            exists_pm = tgt_cur.execute("SELECT id FROM P2pPaymentMethod WHERE id = ?", (pm_id,)).fetchone()
                            if not exists_pm:
                                tgt_cur.execute("""
                                    INSERT INTO P2pPaymentMethod (id, userId, type, name, details, isActive, isPrimary, createdAt, updatedAt)
                                    VALUES (?, ?, ?, ?, ?, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                                """, (pm_id, mapped_user_id, m["type"], bank_name, details_json))
                                stats["payment_methods_inserted"] += 1
        except Exception as e:
            pass

    # 4. P2P Ads Migration
    for sa in src_ads:
        mapped_user_id = user_id_map.get(sa["user_id"])
        if not mapped_user_id:
            continue
        
        ad_id = sa["id"]
        status = sa["status"]
        if status == "CLOSED":
            status = "COMPLETED"

        created_at = epoch_to_iso(sa["created_at"])
        updated_at = epoch_to_iso(sa["updated_at"])

        # Normalize payment_methods JSON string
        raw_pm = sa["payment_methods"]
        try:
            parsed = json.loads(raw_pm)
            if isinstance(parsed, list) and len(parsed) > 0 and isinstance(parsed[0], dict):
                pm_names = [p.get("type", "Bank Transfer") for p in parsed]
                pm_str = json.dumps(pm_names)
            else:
                pm_str = raw_pm
        except:
            pm_str = json.dumps(["Bank Transfer"])

        tgt_cur.execute("""
            INSERT OR REPLACE INTO P2pAd (
                id, displayId, userId, type, asset, fiat, price, isFloating, priceMargin,
                totalAmount, availableAmount, minLimit, maxLimit, paymentWindow, paymentMethods,
                terms, autoReply, countryRestrictions, status, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            ad_id,
            sa["display_id"],
            mapped_user_id,
            sa["type"],
            sa["asset"],
            sa["fiat"],
            sa["price"],
            bool(sa["is_floating"]),
            sa["price_margin"],
            sa["total_amount"],
            sa["available_amount"],
            sa["min_limit"],
            sa["max_limit"],
            sa["payment_window"] or 15,
            pm_str,
            sa["terms"],
            sa["auto_reply"],
            sa["country_restrictions"],
            status,
            created_at,
            updated_at
        ))
        stats["ads_inserted"] += 1

    # 5. P2P Orders Migration
    src_orders = src_cur.execute("SELECT * FROM p2p_orders").fetchall()
    migrated_order_ids = set()

    for so in src_orders:
        order_id = so["id"]
        ad_id = so["ad_id"]
        buyer_id = user_id_map.get(so["buyer_id"])
        seller_id = user_id_map.get(so["seller_id"])

        if not buyer_id or not seller_id:
            continue

        created_at = epoch_to_iso(so["created_at"])
        updated_at = epoch_to_iso(so["updated_at"])
        expires_at = epoch_to_iso(so["expires_at"])

        tgt_cur.execute("""
            INSERT OR REPLACE INTO P2pOrder (
                id, displayId, adId, buyerId, sellerId, cryptoAmount, fiatAmount, price,
                status, paymentMethod, paymentDetails, expiresAt, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            order_id,
            so["display_id"],
            ad_id,
            buyer_id,
            seller_id,
            so["crypto_amount"],
            so["fiat_amount"],
            so["price"],
            so["status"],
            so["payment_method"],
            so["payment_details"],
            expires_at,
            created_at,
            updated_at
        ))
        migrated_order_ids.add(order_id)
        stats["orders_inserted"] += 1

    # 6. P2P Messages Migration
    src_messages = src_cur.execute("SELECT * FROM p2p_messages").fetchall()
    for sm in src_messages:
        order_id = sm["order_id"]
        if order_id not in migrated_order_ids:
            continue

        sender_id = user_id_map.get(sm["sender_id"])
        if not sender_id:
            continue

        msg_id = sm["id"]
        created_at = epoch_to_iso(sm["created_at"])

        tgt_cur.execute("""
            INSERT OR REPLACE INTO P2pMessage (
                id, orderId, senderId, content, type, attachmentUrl, isRead, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            msg_id,
            order_id,
            sender_id,
            sm["content"],
            sm["type"] or "TEXT",
            sm["attachment_url"],
            bool(sm["is_read"]),
            created_at
        ))
        stats["messages_inserted"] += 1

    # 7. Update User Order Stats
    for u_id in user_id_map.values():
        total_orders = tgt_cur.execute("SELECT count(*) FROM P2pOrder WHERE buyerId = ? OR sellerId = ?", (u_id, u_id)).fetchone()[0]
        completed_orders = tgt_cur.execute("SELECT count(*) FROM P2pOrder WHERE (buyerId = ? OR sellerId = ?) AND status = 'COMPLETED'", (u_id, u_id)).fetchone()[0]
        comp_rate = f"{(completed_orders / total_orders * 100):.1f}" if total_orders > 0 else "100"
        
        tgt_cur.execute("""
            UPDATE User SET 
                p2pTotalOrders = ?,
                p2pCompletedOrders = ?,
                p2pCompletionRate = ?
            WHERE id = ?
        """, (total_orders, completed_orders, comp_rate, u_id))

    tgt_conn.commit()
    print("Migration Transaction Committed Successfully!")
    print(f"Migration Summary: {json.dumps(stats, indent=2)}")

    src_conn.close()
    tgt_conn.close()

if __name__ == "__main__":
    run_migration()
