from flask import Blueprint, send_file, jsonify
from ..utils.invoice_generator import generate_invoice_pdf
from ..utils.email_service import send_invoice_email
from ..db_config import get_db_connection as get_db
import io

invoice = Blueprint("invoice", __name__)

# ---------------------------
# 1) Download Invoice (existing)
# ---------------------------

@invoice.route("/download/<int:reservation_id>", methods=["GET"])
def download_invoice(reservation_id):
    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        # JOIN reservation → user → station → payment
        cursor.execute("""
            SELECT 
                r.id AS reservation_id,
                r.duration,
                r.status,
                r.eta_time,
                r.expire_time,
                r.created_at AS reservation_time,

                u.username AS user_name,
                u.email AS user_email,
                u.phone_number AS user_phone,

                s.name AS station_name,
                s.location AS station_location,
                s.price_per_kwh,

                p.amount,
                p.created_at,
                p.payment_id

            FROM reservations r
            INNER JOIN users u ON r.user_id = u.id
            INNER JOIN stations s ON r.station_id = s.id
            INNER JOIN payments p ON r.payment_id = p.payment_id
            WHERE r.id = %s
        """, (reservation_id,))

        invoice_data = cursor.fetchone()

        if not invoice_data:
            return jsonify({"error": "Reservation not found"}), 404

        # Add energy consumption estimate  
        invoice_data["energy_kwh"] = round(invoice_data["duration"] / 30 * 6, 2)

        # Create PDF
        pdf_buffer = generate_invoice_pdf(invoice_data)

        return send_file(
            pdf_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"invoice_{reservation_id}.pdf"
        )

    except Exception as e:
        print("Invoice Error:", e)
        return jsonify({"error": str(e)}), 500


# ----------------------------------------------------------
# 📧 EMAIL INVOICE (Brevo)
# ----------------------------------------------------------
@invoice.route("/email/<int:reservation_id>", methods=["GET"])
def email_invoice(reservation_id):
    try:
        db = get_db()
        cursor = db.cursor(dictionary=True)

        cursor.execute("""
            SELECT 
                r.id AS reservation_id,
                r.duration,
                r.status,
                r.eta_time,
                r.expire_time,
                r.created_at AS reservation_time,

                u.username AS user_name,
                u.email AS user_email,
                u.phone_number AS user_phone,

                s.name AS station_name,
                s.location AS station_location,
                s.price_per_kwh,

                p.amount,
                p.created_at AS payment_time,
                p.payment_id

            FROM reservations r
            INNER JOIN users u ON r.user_id = u.id
            INNER JOIN stations s ON r.station_id = s.id
            INNER JOIN payments p ON r.payment_id = p.payment_id
            WHERE r.id = %s
        """, (reservation_id,))

        data = cursor.fetchone()

        if not data:
            return jsonify({"error": "Reservation not found"}), 404

        # ----------------------------------------------------------
        # Generate Premium Invoice PDF
        # ----------------------------------------------------------
        pdf_buffer = generate_invoice_pdf(data)
        pdf_bytes = pdf_buffer.getvalue()

        # ----------------------------------------------------------
        # Send Email using BREVO API (correct arguments)
        # ----------------------------------------------------------
        email_status = send_invoice_email(
            to_email=data["user_email"],
            user_name=data["user_name"],
            payment_id=data["payment_id"],     # Invoice Number
            amount=float(data["amount"]),      # Convert Decimal
            payment_time=data["payment_time"], # Date/time of payment
            station_name=data["station_name"],
            pdf_bytes=pdf_bytes
        )

        if not email_status:
            return jsonify({"error": "Email could not be sent"}), 500

        return jsonify({"message": "📧 Invoice emailed successfully"}), 200

    except Exception as e:
        print("EMAIL ERROR:", e)
        return jsonify({"error": str(e)}), 500
