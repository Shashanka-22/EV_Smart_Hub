from flask import Blueprint, request, jsonify
from backend.db_config import get_db_connection

from datetime import datetime
import jwt

battery_bp = Blueprint('battery', __name__)
SECRET_KEY = "secret123"

# Helper: Decode token and extract user ID
def decode_token(token):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload['user_id'], payload['role']
    except:
        return None, None

# 🔸 Submit real-time battery data (via ESP32 or frontend)
@battery_bp.route("/api/battery/submit", methods=["POST"])
def submit_battery_data():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id, _ = decode_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    soc = data.get("soc")  # State of Charge
    soh = data.get("soh")  # State of Health
    temp = data.get("temperature")  # Battery Temp

    if not all([soc, soh, temp]):
        return jsonify({"error": "Missing data"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO battery_logs (user_id, soc, soh, temperature, timestamp)
        VALUES (%s, %s, %s, %s, %s)
    """, (user_id, soc, soh, temp, datetime.now()))
    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"message": "Battery data saved"})

# 🔍 Get last battery record for current user
@battery_bp.route("/api/battery/latest", methods=["GET"])
def get_latest_battery():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id, _ = decode_token(token)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT soc, soh, temperature, timestamp
        FROM battery_logs
        WHERE user_id = %s
        ORDER BY timestamp DESC
        LIMIT 1
    """, (user_id,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()

    if not row:
        return jsonify({"message": "No battery data found"}), 404

    return jsonify(row)
