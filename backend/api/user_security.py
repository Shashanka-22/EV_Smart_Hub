from flask import Blueprint, request, jsonify
from backend.db_config import get_db_connection
import bcrypt, jwt, os

user_security_bp = Blueprint("user_security", __name__)

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "secret123")

def decode_token(token):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload.get("user_id") or payload.get("id")
    except:
        return None


# -------------------------------------------------------
# ✅ CHANGE PASSWORD (requires old password)
# -------------------------------------------------------
@user_security_bp.route("/change-password", methods=["PUT"])
def change_password():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = decode_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    old_password = data.get("old_password")
    new_password = data.get("new_password")

    if not old_password or not new_password:
        return jsonify({"error": "Both fields are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT password FROM users WHERE id=%s", (user_id,))
    user = cursor.fetchone()

    if not user:
        return jsonify({"error": "User not found"}), 404

    # Check old password
    if not bcrypt.checkpw(old_password.encode(), user["password"].encode()):
        return jsonify({"error": "Incorrect old password"}), 400

    # Hash new password
    hashed = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()

    cursor.execute("UPDATE users SET password=%s WHERE id=%s", (hashed, user_id))
    conn.commit()

    cursor.close()
    conn.close()

    return jsonify({"message": "Password updated successfully"}), 200

# -------------------------------------------------------
# ❌ DELETE ACCOUNT (password required)
# -------------------------------------------------------
@user_security_bp.route("/delete-account", methods=["DELETE"])
def delete_account():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = decode_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    password = data.get("password")

    if not password:
        return jsonify({"error": "Password is required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT password FROM users WHERE id=%s", (user_id,))
    user = cursor.fetchone()

    if not user:
        return jsonify({"error": "User not found"}), 404

    # Check password
    if not bcrypt.checkpw(password.encode(), user["password"].encode()):
        return jsonify({"error": "Incorrect password"}), 400

    # Delete user
    cursor.execute("DELETE FROM users WHERE id=%s", (user_id,))
    conn.commit()

    cursor.close()
    conn.close()

    return jsonify({"message": "Account deleted successfully"}), 200
