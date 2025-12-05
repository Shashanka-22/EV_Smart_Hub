import requests
import base64
import os

# Load environment variables
BREVO_API_KEY = os.getenv("BREVO_API_KEY")
BREVO_USER = os.getenv("BREVO_USER", "evsmartchargingstation@gmail.com")


def send_email(to_email, subject, html_message, attachment_bytes=None, attachment_name=None):
    """
    Generic Email Sender using Brevo SMTP API.
    
    Parameters:
        to_email (str): Recipient email
        subject (str): Email subject
        html_message (str): HTML content of the email
        attachment_bytes (bytes): Optional attachment (PDF, images, etc.)
        attachment_name (str): Name of the attachment
    """

    if not BREVO_API_KEY:
        print("❌ BREVO_API_KEY missing in .env file")
        return False

    try:
        payload = {
            "sender": {"email": BREVO_USER, "name": "EV Smart Hub"},
            "to": [{"email": to_email}],
            "subject": subject,
            "htmlContent": html_message
        }

        # ✔ Handle attachment (PDF, etc.)
        if attachment_bytes and attachment_name:
            pdf_b64 = base64.b64encode(attachment_bytes).decode()
            payload["attachment"] = [
                {"content": pdf_b64, "name": attachment_name}
            ]

        # Send email using Brevo
        response = requests.post(
            "https://api.brevo.com/v3/smtp/email",
            json=payload,
            headers={
                "accept": "application/json",
                "api-key": BREVO_API_KEY,
                "content-type": "application/json"
            }
        )

        print("📨 BREVO RESPONSE →", response.text)

        return response.status_code in (200, 201)

    except Exception as e:
        print("❌ BREVO EMAIL ERROR:", e)
        return False

def send_invoice_email(to_email, user_name, payment_id, amount, payment_time, station_name, pdf_bytes):
    html = f"""
        <h2>⚡ EV Smart Hub - Charging Invoice</h2>
        <p>Hello <b>{user_name}</b>,</p>
        <p>Thank you for using EV Smart Hub!</p>

        <ul>
            <li><b>Invoice ID:</b> {payment_id}</li>
            <li><b>Amount Paid:</b> ₹{amount}</li>
            <li><b>Station:</b> {station_name}</li>
            <li><b>Date & Time:</b> {payment_time}</li>
        </ul>

        <p>Your PDF invoice is attached.</p>
        <br>
        <b>Drive clean, charge smart! 🚗⚡</b>
    """

    return send_email(
        to_email=to_email,
        subject=f"Your EV Charging Invoice #{payment_id}",
        html_message=html,
        attachment_bytes=pdf_bytes,
        attachment_name=f"invoice_{payment_id}.pdf"
    )


def send_station_approved_email(to_email, station_name):
    html = f"""
        <h2>🎉 Station Approved!</h2>
        <p>Your charging station <b>{station_name}</b> has been approved.</p>
        <p>It is now live for users to book and charge their EVs.</p>
        <br>
        <b>EV Smart Hub Team ⚡</b>
    """
    return send_email(to_email, "Your Charging Station Is Approved!", html)


def send_station_rejected_email(to_email, station_name, reason):
    html = f"""
        <h2>❌ Station Rejected</h2>
        <p>Your station <b>{station_name}</b> was not approved.</p>
        <p><b>Reason:</b> {reason}</p>
        <p>Please fix the issue and apply again.</p>
        <br>
        <b>EV Smart Hub Team ⚡</b>
    """
    return send_email(to_email, "Charging Station Application Rejected", html)
