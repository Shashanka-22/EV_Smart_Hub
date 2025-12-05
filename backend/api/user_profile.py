from flask import Blueprint, request, jsonify, send_from_directory
from backend.db_config import get_db_connection
import jwt, os

user_profile_bp = Blueprint("user_profile", __name__)
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "secret123")


# =========================================================
# 🔐 Decode JWT
# =========================================================
def decode_token(token):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload.get("user_id") or payload.get("id")
    except:
        return None


# =========================================================
# 📤 Serve Profile Pictures (STATIC ROUTE)
# =========================================================
@user_profile_bp.route("/uploads/profile/<path:filename>")
def serve_profile_image(filename):
    # Absolute path to folder (universal fix)
    upload_folder = os.path.abspath("uploads/profile")
    return send_from_directory(upload_folder, filename)


# =========================================================
# ✅ GET USER PROFILE
# =========================================================
@user_profile_bp.route("/profile", methods=["GET"])
def get_profile():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = decode_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT id, username, email, phone_number, 
               profile_pic_url, role
        FROM users
        WHERE id=%s
    """, (user_id,))

    user = cursor.fetchone()
    cursor.close()
    conn.close()

    # Add BASE URL automatically for React
    base_url = request.host_url.rstrip("/")
    if user and user.get("profile_pic_url"):
        user["profile_pic_url"] = base_url + user["profile_pic_url"]

    return jsonify(user), 200


# =========================================================
# 🔄 UPDATE USER PROFILE
# =========================================================
@user_profile_bp.route("/profile/update", methods=["PUT"])
def update_profile():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    user_id = decode_token(token)

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    username = request.form.get("username")
    phone_number = request.form.get("phone")
    profile_pic_file = request.files.get("profile_pic")

    # Validate
    if username is not None and username.strip() == "":
        return jsonify({"error": "Username cannot be empty"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT username, phone_number, profile_pic_url
        FROM users WHERE id=%s
    """, (user_id,))
    existing = cursor.fetchone()

    if not existing:
        return jsonify({"error": "User not found"}), 404

    new_username = username if username else existing["username"]
    new_phone = phone_number if phone_number else existing["phone_number"]
    new_profile_pic_url = existing["profile_pic_url"]

    # =========================================================
    # 🖼 Save Profile Picture
    # =========================================================
    if profile_pic_file:
        folder = os.path.abspath("uploads/profile")
        os.makedirs(folder, exist_ok=True)

        ext = profile_pic_file.filename.rsplit(".", 1)[-1].lower()
        filename = f"user_{user_id}.{ext}"
        file_path = os.path.join(folder, filename)

        profile_pic_file.save(file_path)

        new_profile_pic_url = f"/uploads/profile/{filename}"

    # =========================================================
    # 📝 Update DB
    # =========================================================
    cursor.execute("""
        UPDATE users
        SET username=%s, phone_number=%s, profile_pic_url=%s
        WHERE id=%s
    """, (new_username, new_phone, new_profile_pic_url, user_id))

    conn.commit()
    cursor.close()
    conn.close()

    base_url = request.host_url.rstrip("/")
    final_image_url = base_url + new_profile_pic_url if new_profile_pic_url else None

    return jsonify({
        "message": "Profile updated successfully",
        "profile": {
            "username": new_username,
            "phone_number": new_phone,
            "profile_pic_url": final_image_url
        }
    }), 200
