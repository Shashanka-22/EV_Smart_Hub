# 📄 backend/api/admin.py

from flask import Blueprint, request, jsonify
from backend.db_config import get_db_connection
from flask_cors import CORS
import os
import jwt
from functools import wraps

# 📩 Email sender
from backend.utils.email_service import (
    send_station_approved_email,
    send_station_rejected_email,
)

# ---------------------------------------
# 🔧 Blueprint + CORS
# ---------------------------------------
admin_bp = Blueprint("admin", __name__)
CORS(
    admin_bp,
    resources={r"/*": {"origins": "*"}},
    supports_credentials=True
)

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "secret123")


# ---------------------------------------
# 🔐 AUTH HELPERS
# ---------------------------------------
def decode_token(token):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload.get("user_id") or payload.get("id"), payload.get("role")
    except Exception:
        return None, None


def super_admin_required(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        user_id, role = decode_token(token)

        if not user_id or role != "super_admin":
            return jsonify({"error": "Super admin access required"}), 403

        return func(*args, **kwargs)

    return wrapper


# =====================================================================
# 1️⃣ GET PENDING STATIONS
# =====================================================================
@admin_bp.route("/stations/pending", methods=["GET"])
@super_admin_required
def get_pending_stations():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT 
            s.id,
            s.name,
            s.location,
            s.latitude,
            s.longitude,
            s.price_per_kwh,
            s.total_slots,
            s.fast_charger,
            s.status,
            s.rejection_reason,
            u.id AS owner_id,
            u.username AS owner_name,
            u.email AS owner_email
        FROM stations s
        JOIN users u ON s.owner_id = u.id
        WHERE s.status = 'pending'
        ORDER BY s.created_at DESC
    """)

    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    return jsonify(rows), 200


# =====================================================================
# 2️⃣ APPROVE STATION
# =====================================================================
@admin_bp.route("/stations/approve/<int:station_id>", methods=["POST"])
@super_admin_required
def approve_station(station_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT 
            s.id,
            s.name,
            u.email AS owner_email
        FROM stations s
        JOIN users u ON s.owner_id = u.id
        WHERE s.id = %s
    """, (station_id,))
    station = cursor.fetchone()

    if not station:
        cursor.close()
        conn.close()
        return jsonify({"error": "Station not found"}), 404

    cursor.execute(
        "UPDATE stations SET status='approved', rejection_reason=NULL WHERE id=%s",
        (station_id,)
    )
    conn.commit()

    cursor.close()
    conn.close()

    # 📩 Send approval email
    send_station_approved_email(station["owner_email"], station["name"])

    return jsonify({"message": "Station approved"}), 200


# =====================================================================
# 3️⃣ REJECT STATION
# =====================================================================
@admin_bp.route("/stations/reject/<int:station_id>", methods=["POST"])
@super_admin_required
def reject_station(station_id):
    data = request.json or {}
    reason = data.get("reason", "No reason provided")

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT 
            s.id,
            s.name,
            u.email AS owner_email
        FROM stations s
        JOIN users u ON s.owner_id = u.id
        WHERE s.id = %s
    """, (station_id,))
    station = cursor.fetchone()

    if not station:
        cursor.close()
        conn.close()
        return jsonify({"error": "Station not found"}), 404

    cursor.execute("""
        UPDATE stations
        SET status='rejected',
            rejection_reason=%s
        WHERE id=%s
    """, (reason, station_id))
    conn.commit()

    cursor.close()
    conn.close()

    # 📩 Send rejection email
    send_station_rejected_email(station["owner_email"], station["name"], reason)

    return jsonify({"message": "Station rejected"}), 200


# =====================================================================
# 4️⃣ ADMIN OVERVIEW DASHBOARD STATS
# =====================================================================
@admin_bp.route("/analytics/overview", methods=["GET"])
@super_admin_required
def admin_overview():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # Total stations
    cursor.execute("SELECT COUNT(*) AS total FROM stations")
    total_st = cursor.fetchone()["total"]

    # Pending stations
    cursor.execute("SELECT COUNT(*) AS pending FROM stations WHERE status='pending'")
    pending = cursor.fetchone()["pending"]

    # Total users
    cursor.execute("SELECT COUNT(*) AS users FROM users")
    users = cursor.fetchone()["users"]

    # Total station owners
    cursor.execute("SELECT COUNT(*) AS owners FROM users WHERE role='station_owner'")
    owners = cursor.fetchone()["owners"]

    # Total revenue
    cursor.execute("SELECT SUM(amount) AS revenue FROM payments WHERE status='paid'")
    revenue = cursor.fetchone()["revenue"] or 0

    # Total reservations
    cursor.execute("SELECT COUNT(*) AS total_res FROM reservations")
    total_res = cursor.fetchone()["total_res"]

    cursor.close()
    conn.close()

    return jsonify({
        "total_stations": total_st,
        "pending_stations": pending,
        "total_users": users,
        "total_station_owners": owners,
        "total_revenue": float(revenue),
        "total_reservations": total_res
    }), 200


# =====================================================================
# 5️⃣ STATION PERFORMANCE (Reservations + Revenue)
# =====================================================================
@admin_bp.route("/analytics/station-performance", methods=["GET"])
@super_admin_required
def station_performance():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT 
            s.name AS station_name,
            COUNT(r.id) AS reservations,
            SUM(p.amount) AS revenue
        FROM stations s
        LEFT JOIN reservations r ON r.station_id = s.id
        LEFT JOIN payments p ON p.station_id = s.id AND p.status='paid'
        GROUP BY s.id
    """)

    data = cursor.fetchall()
    cursor.close()
    conn.close()

    for d in data:
        d["revenue"] = float(d["revenue"] or 0)

    return jsonify(data), 200


# =====================================================================
# 6️⃣ REFUND LOGS
# =====================================================================
@admin_bp.route("/refunds/logs", methods=["GET"])
@super_admin_required
def refund_logs():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT 
            r.id,
            r.user_id,
            u.username AS user_name,
            r.reason,
            r.created_at,
            r.amount,
            r.status
        FROM refunds r
        JOIN users u ON u.id = r.user_id
        ORDER BY r.created_at DESC
    """)

    logs = cursor.fetchall()
    cursor.close()
    conn.close()

    return jsonify(logs), 200


# =====================================================================
# 7️⃣ FLAGGED USERS
# =====================================================================
@admin_bp.route("/users/flags", methods=["GET"])
@super_admin_required
def flagged_users():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT 
            id,
            username,
            email,
            created_at,
            flag_reason,
            is_flagged
        FROM users
        WHERE is_flagged = 1
        ORDER BY created_at DESC
    """)

    flags = cursor.fetchall()
    cursor.close()
    conn.close()

    return jsonify(flags), 200


# =====================================================================
# 8️⃣ ALL USERS LIST
# =====================================================================
@admin_bp.route("/users/all", methods=["GET"])
@super_admin_required
def get_all_users():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT 
            id,
            username,
            email,
            phone_number,
            role,
            created_at
        FROM users
        ORDER BY created_at DESC
    """)

    users = cursor.fetchall()
    cursor.close()
    conn.close()

    return jsonify(users), 200


# =====================================================================
# 9️⃣ ALL STATION OWNERS
# =====================================================================
@admin_bp.route("/owners/all", methods=["GET"])
@super_admin_required
def get_all_owners():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT 
            id,
            username,
            email,
            phone_number,
            created_at
        FROM users
        WHERE role='station_owner'
        ORDER BY created_at DESC
    """)

    owners = cursor.fetchall()
    cursor.close()
    conn.close()

    return jsonify(owners), 200


# =====================================================================
# 🔟 ALL STATIONS (WITH OWNER INFO)
# =====================================================================
@admin_bp.route("/stations/all", methods=["GET"])
@super_admin_required
def get_all_stations():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT 
            s.id,
            s.name,
            s.location,
            s.latitude,
            s.longitude,
            s.price_per_kwh,
            s.fast_charger,
            s.total_slots,
            s.status,
            s.rejection_reason,
            s.created_at,
            u.id AS owner_id,
            u.username AS owner_name,
            u.email AS owner_email
        FROM stations s
        JOIN users u ON u.id = s.owner_id
        ORDER BY s.created_at DESC
    """)

    stations = cursor.fetchall()
    cursor.close()
    conn.close()

    return jsonify(stations), 200




# =====================================================================
# 1️⃣1️⃣ REVENUE PER STATION (for /super-admin/revenue)
# =====================================================================
@admin_bp.route("/analytics/revenue-stations", methods=["GET"])
@super_admin_required
def revenue_per_station():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT 
            s.id,
            s.name,
            u.username AS owner_name,
            COALESCE(SUM(p.amount), 0) AS total_revenue
        FROM stations s
        LEFT JOIN payments p ON p.station_id = s.id AND p.status='paid'
        JOIN users u ON s.owner_id = u.id
        GROUP BY s.id
        ORDER BY total_revenue DESC
    """)

    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    for r in rows:
        r["total_revenue"] = float(r["total_revenue"] or 0)

    return jsonify(rows), 200


# =====================================================================
# 1️⃣2️⃣ ALL RESERVATIONS (ACTIVE ON TOP, GROUPED BY STATION)
# =====================================================================
@admin_bp.route("/reservations/all-grouped", methods=["GET"])
@super_admin_required
def admin_all_reservations():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT 
            r.*,
            u.username AS user_name,
            u.email    AS user_email,
            s.name     AS station_name
        FROM reservations r
        JOIN users u   ON r.user_id   = u.id
        JOIN stations s ON r.station_id = s.id
        ORDER BY 
            (r.status='active') DESC,
            r.station_id ASC,
            r.created_at DESC
    """)

    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    return jsonify(rows), 200


# =====================================================================
# 1️⃣3️⃣ DELETE USER
# =====================================================================
@admin_bp.route("/users/delete/<int:user_id>", methods=["DELETE"])
@super_admin_required
def delete_user(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    # NOTE: if you have FK constraints, you may need
    # to delete reservations/payments before deleting user.
    cursor.execute("DELETE FROM users WHERE id=%s", (user_id,))
    conn.commit()

    cursor.close()
    conn.close()

    return jsonify({"message": "User deleted"}), 200


# =====================================================================
# 1️⃣4️⃣ DELETE OWNER (ROLE = station_owner)
# =====================================================================
@admin_bp.route("/owners/delete/<int:owner_id>", methods=["DELETE"])
@super_admin_required
def delete_owner(owner_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Optional: also delete their stations first if FK errors appear.
    cursor.execute("DELETE FROM users WHERE id=%s AND role='station_owner'", (owner_id,))
    conn.commit()

    cursor.close()
    conn.close()

    return jsonify({"message": "Owner deleted"}), 200


# =====================================================================
# 1️⃣5️⃣ DELETE STATION
# =====================================================================
@admin_bp.route("/stations/delete/<int:station_id>", methods=["DELETE"])
@super_admin_required
def delete_station_admin(station_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM stations WHERE id=%s", (station_id,))
    conn.commit()

    cursor.close()
    conn.close()

    return jsonify({"message": "Station deleted"}), 200
