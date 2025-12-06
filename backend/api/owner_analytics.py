# 📄 backend/api/owner_analytics.py
from flask import Blueprint, request, jsonify
from ..db_config import get_db_connection
from datetime import datetime, timedelta
import jwt, os

owner_analytics_bp = Blueprint("owner_analytics", __name__)

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "secret123")

# ============================================================
# 🔐 TOKEN HELPERS
# ============================================================
def decode_token(token):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload.get("user_id") or payload.get("id"), payload.get("role")
    except:
        return None, None


def get_auth_info():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    return decode_token(token)


# Owner-role middleware
def owner_required(func):
    def wrapper(*args, **kwargs):
        user_id, role = get_auth_info()
        if not user_id or role != "station_owner":
            return jsonify({"error": "Owner access required"}), 403
        return func(user_id, *args, **kwargs)
    wrapper.__name__ = func.__name__
    return wrapper


# ============================================================
# 📌 OWNER OVERVIEW SUMMARY STATISTICS
# ============================================================
@owner_analytics_bp.route("/overview", methods=["GET"])
@owner_required
def owner_overview(owner_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT COUNT(*) AS total_stations
        FROM stations 
        WHERE owner_id=%s AND status='approved'
    """, (owner_id,))
    total_stations = cursor.fetchone()["total_stations"]

    cursor.execute("""
        SELECT COUNT(*) AS reservations
        FROM reservations r
        JOIN stations s ON r.station_id = s.id
        WHERE s.owner_id=%s
    """, (owner_id,))
    reservations = cursor.fetchone()["reservations"]

    cursor.execute("""
        SELECT COALESCE(SUM(p.amount),0) AS revenue
        FROM payments p
        JOIN stations s ON p.station_id = s.id
        WHERE p.status='paid' AND s.owner_id=%s
    """, (owner_id,))
    revenue = float(cursor.fetchone()["revenue"])

    cursor.close()
    conn.close()

    return jsonify({
        "total_stations": total_stations,
        "total_reservations": reservations,
        "total_revenue": revenue
    }), 200


# ============================================================
# 📈 ADVANCED REVENUE SYSTEM (Hourly / 7 days / 30 days)
# ============================================================
@owner_analytics_bp.route("/revenue", methods=["GET"])
@owner_required
def owner_revenue(owner_id):

    range_type = request.args.get("range", "today")

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # ====================================================
    # 1️⃣ TODAY (Hourly Revenue)
    # ====================================================
    if range_type == "today":

        cursor.execute("""
            SELECT 
                HOUR(p.created_at) AS hour,
                SUM(p.amount) AS revenue
            FROM payments p
            JOIN stations s ON p.station_id = s.id
            WHERE DATE(p.created_at) = CURDATE()
              AND p.status='paid'
              AND s.owner_id=%s
            GROUP BY hour
        """, (owner_id,))

        raw = cursor.fetchall()
        cursor.close()
        conn.close()

        result = []
        for h in range(24):
            match = next((r for r in raw if r["hour"] == h), None)
            result.append({
                "label": f"{h}:00",
                "revenue": float(match["revenue"]) if match else 0
            })

        return jsonify({"range": "today", "data": result}), 200


    # ====================================================
    # 2️⃣ LAST 7 DAYS
    # ====================================================
    if range_type == "7days":
        cursor.execute("""
            SELECT 
                DATE(p.created_at) AS day,
                SUM(p.amount) AS revenue
            FROM payments p
            JOIN stations s ON p.station_id = s.id
            WHERE p.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
              AND p.status='paid'
              AND s.owner_id=%s
            GROUP BY day
            ORDER BY day ASC
        """, (owner_id,))

        raw = cursor.fetchall()
        cursor.close()
        conn.close()

        result = []
        for i in range(7):
            day = (datetime.utcnow() - timedelta(days=6 - i)).date()
            match = next((r for r in raw if str(r["day"]) == str(day)), None)
            result.append({
                "label": str(day),
                "revenue": float(match["revenue"]) if match else 0
            })

        return jsonify({"range": "7days", "data": result}), 200


    # ====================================================
    # 3️⃣ LAST 30 DAYS
    # ====================================================
    if range_type == "30days":
        cursor.execute("""
            SELECT 
                DATE(p.created_at) AS day,
                SUM(p.amount) AS revenue
            FROM payments p
            JOIN stations s ON p.station_id = s.id
            WHERE p.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
              AND p.status='paid'
              AND s.owner_id=%s
            GROUP BY day
            ORDER BY day ASC
        """, (owner_id,))

        raw = cursor.fetchall()
        cursor.close()
        conn.close()

        result = []
        for i in range(30):
            day = (datetime.utcnow() - timedelta(days=29 - i)).date()
            match = next((r for r in raw if str(r["day"]) == str(day)), None)
            result.append({
                "label": str(day),
                "revenue": float(match["revenue"]) if match else 0
            })

        return jsonify({"range": "30days", "data": result}), 200

    return jsonify({"error": "Invalid range type"}), 400


# ============================================================
# ⭐ OWNER — REVIEWS (Correct Column: review)
# ============================================================
@owner_analytics_bp.route("/reviews", methods=["GET"])
@owner_required
def owner_reviews(owner_id):

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT 
            u.username,
            r.rating,
            r.review AS review_text,
            s.name AS station_name,
            r.created_at
        FROM reviews r
        JOIN stations s ON r.station_id = s.id
        JOIN users u ON r.user_id = u.id
        WHERE s.owner_id=%s
        ORDER BY r.created_at DESC
    """, (owner_id,))

    rows = cursor.fetchall() or []

    cursor.close()
    conn.close()

    return jsonify({"reviews": rows}), 200


# ============================================================
# 🟩 STATION-WISE COMPARISON (Last 7 Days)
# ============================================================
@owner_analytics_bp.route("/compare-stations", methods=["GET"])
@owner_required
def owner_station_comparison(owner_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT id, name FROM stations
        WHERE owner_id=%s AND status='approved'
    """, (owner_id,))
    stations = cursor.fetchall()

    comparison = []

    for st in stations:
        cursor.execute("""
            SELECT 
                DATE(p.created_at) AS day,
                SUM(p.amount) AS revenue
            FROM payments p
            WHERE p.station_id=%s 
              AND p.status='paid'
              AND p.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY day
            ORDER BY day ASC
        """, (st["id"],))

        rows = cursor.fetchall()

        formatted = []
        for i in range(7):
            day = (datetime.utcnow() - timedelta(days=6 - i)).date()
            match = next((r for r in rows if str(r["day"]) == str(day)), None)
            formatted.append(float(match["revenue"]) if match else 0)

        comparison.append({
            "station_name": st["name"],
            "revenue": formatted
        })

    cursor.close()
    conn.close()

    return jsonify(comparison), 200
