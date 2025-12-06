# 📄 backend/api/emergency.py
from flask import Blueprint, request, jsonify
from ..db_config import get_db_connection
import jwt, os

emergency_bp = Blueprint("emergency", __name__)

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "secret123")


def decode_token(token):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload.get("user_id") or payload.get("id")
    except Exception:
        return None


def user_required(func):
    def wrapper(*args, **kwargs):
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        user_id = decode_token(token)

        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401

        return func(user_id, *args, **kwargs)

    wrapper.__name__ = func.__name__
    return wrapper


# ---------------------------------------------------------
# ✅ LOG EMERGENCY EVENT (user → support)
# ---------------------------------------------------------
@emergency_bp.route("/emergency", methods=["POST"])
@user_required
def emergency_alert(user_id):
    data = request.json or {}

    station_id = data.get("station_id")
    issue_type = data.get("issue_type", "general")
    message = data.get("message", "")
    lat = data.get("lat")
    lng = data.get("lng")

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT INTO emergency_logs (user_id, station_id, issue_type, message, location_lat, location_lng)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (user_id, station_id, issue_type, message, lat, lng),
    )
    conn.commit()

    cursor.close()
    conn.close()

    return jsonify({"message": "Emergency reported. Support will contact you shortly."}), 201
