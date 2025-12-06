# 📄 backend/api/reviews.py
from flask import Blueprint, request, jsonify
from ..db_config import get_db_connection
import jwt, os
from datetime import datetime

reviews_bp = Blueprint("reviews", __name__)

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
# ✅ GET REVIEWS FOR A STATION
# ---------------------------------------------------------
@reviews_bp.route("/stations/<int:station_id>/reviews", methods=["GET"])
def get_station_reviews(station_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT 
            r.id,
            r.rating,
            r.comment AS review_text,
            r.photo_url,
            r.created_at,
            u.username
        FROM reviews r
        JOIN users u ON r.user_id = u.id
        WHERE r.station_id = %s
        ORDER BY r.created_at DESC
        """,
        (station_id,),
    )

    rows = cursor.fetchall() or []

    cursor.close()
    conn.close()

    return jsonify(rows), 200


# ---------------------------------------------------------
# ✅ CREATE NEW REVIEW (with optional photo)
# ---------------------------------------------------------
@reviews_bp.route("/stations/<int:station_id>/reviews", methods=["POST"])
@user_required
def add_station_review(user_id, station_id):
    """
    Accepts multipart/form-data:
      - rating (1-5)
      - review_text
      - photo (file) [optional]
    """
    rating = request.form.get("rating")
    review_text = request.form.get("review_text", "")
    photo_file = request.files.get("photo")

    if not rating:
        return jsonify({"error": "Rating is required"}), 400

    try:
        rating_val = int(rating)
        if rating_val < 1 or rating_val > 5:
            raise ValueError()
    except ValueError:
        return jsonify({"error": "Rating must be between 1 and 5"}), 400

    photo_url = None

    # Simple file saving (adjust path as needed)
    if photo_file:
        # create uploads folder if not exists
        upload_folder = os.path.join("static", "uploads", "reviews")
        os.makedirs(upload_folder, exist_ok=True)

        filename = f"review_{station_id}_{user_id}_{int(datetime.utcnow().timestamp())}.jpg"
        file_path = os.path.join(upload_folder, filename)
        photo_file.save(file_path)

        # URL (assuming /static is served from Flask)
        photo_url = f"/static/uploads/reviews/{filename}"

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT INTO reviews (station_id, user_id, rating, comment, photo_url, created_at)
        VALUES (%s, %s, %s, %s, %s, NOW())
        """,
        (station_id, user_id, rating_val, review_text, photo_url),
    )
    conn.commit()

    cursor.close()
    conn.close()

    return jsonify({"message": "Review added"}), 201
