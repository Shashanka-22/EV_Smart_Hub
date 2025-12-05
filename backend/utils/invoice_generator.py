from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.graphics.barcode import code128
import qrcode
import io
import datetime
from decimal import Decimal


def to_float(value):
    if isinstance(value, Decimal):
        return float(value)
    try:
        return float(value)
    except:
        return 0.0


def generate_invoice_pdf(data):
    # Convert values
    data["amount"] = to_float(data["amount"])
    data["price_per_kwh"] = to_float(data["price_per_kwh"])
    data["duration"] = to_float(data["duration"])

    invoice_no = f"INV-{datetime.datetime.now().strftime('%Y%m%d')}-{data['reservation_id']}"
    duration_hr = round(data["duration"] / 60, 2)
    rate = data["price_per_kwh"]
    amount = round(duration_hr * rate, 2)
    gst_amount = round(amount * 0.18, 2)
    total = round(amount + gst_amount, 2)

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    y = height - 40

    # -------------------------------------
    # HEADER (Blue theme)
    # -------------------------------------
    pdf.setFillColor(colors.HexColor("#1E88E5"))
    pdf.roundRect(30, y - 45, width - 60, 60, 12, fill=True, stroke=False)

    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 24)
    pdf.drawString(45, y - 17, "⚡ EV SMART HUB – CHARGING INVOICE")
    y -= 80

    # Subtitle
    pdf.setFont("Helvetica", 11)
    pdf.setFillColor(colors.HexColor("#444444"))
    pdf.drawString(45, y, "Premium GST Invoice • EV Smart Charging Solutions")
    y -= 25

    # Invoice No
    pdf.setFont("Helvetica-Bold", 12)
    pdf.setFillColor(colors.black)
    pdf.drawString(45, y, f"Invoice Number: {invoice_no}")
    y -= 40

    # -------------------------------------
    # QR CODE + BARCODE (Right corner)
    # -------------------------------------

    # QR Code
    qr_data = f"""
        Invoice #{data['payment_id']}
        User: {data['user_name']}
        Amount: ₹{data['amount']}
        Date: {data['payment_time']}
    """
    qr = qrcode.make(qr_data)
    qr_buf = io.BytesIO()
    qr.save(qr_buf)
    qr_buf.seek(0)

    pdf.drawImage(ImageReader(qr_buf), width - 140, height - 220, 100, 100)

    # Barcode (Code128)
    barcode = code128.Code128(invoice_no, barHeight=20, barWidth=0.7)
    barcode.drawOn(pdf, width - 200, height - 240)

    y-= 70
    # -------------------------------------
    # CUSTOMER + STATION DETAILS BOX
    # -------------------------------------
    pdf.setFillColor(colors.HexColor("#F5F5F5"))
    pdf.roundRect(40, y - 120, width - 80, 110, 12, fill=True, stroke=False)

    pdf.setFillColor(colors.black)
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawString(55, y - 10, "Customer Details")
    pdf.drawString(width/2 + 20, y - 10, "Charging Station Details")

    pdf.setFont("Helvetica", 11)
    y -= 35

    # Left column
    pdf.drawString(55, y, f"Name: {data['user_name']}")
    y -= 16
    pdf.drawString(55, y, f"Email: {data['user_email']}")
    y -= 16
    pdf.drawString(55, y, f"Phone: {data.get('user_phone', 'N/A')}")

    # Right column
    y += 32
    x_right = width / 2 + 20

    pdf.drawString(x_right, y, f"Station: {data['station_name']}")
    y -= 16
    pdf.drawString(x_right, y, f"Location: {data['station_location']}")
    y -= 16
    pdf.drawString(x_right, y, f"Rate (₹/hr): {rate}")

    y -= 70

    # -------------------------------------
    # BILLING TABLE
    # -------------------------------------

    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(40, y, "🧾 Billing Summary")
    y -= 25

    # Table header
    pdf.setFillColor(colors.HexColor("#1976D2"))
    pdf.rect(40, y - 20, width - 80, 20, fill=True, stroke=False)

    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(50, y - 14, "Description")
    pdf.drawString(250, y - 14, "Hours")
    pdf.drawString(350, y - 14, "Rate")
    pdf.drawString(450, y - 14, "Amount")

    # Table body background
    pdf.setFillColor(colors.HexColor("#FAFAFA"))
    pdf.rect(40, y - 80, width - 80, 60, fill=True, stroke=True)

    # Table rows
    pdf.setFont("Helvetica", 11)
    pdf.setFillColor(colors.black)

    y -= 40
    pdf.drawString(50, y, "Charging Duration")
    pdf.drawString(250, y, f"{duration_hr}")
    pdf.drawString(350, y, f"₹{rate}")
    pdf.drawString(450, y, f"₹{amount}")

    # GST row
    y -= 20
    pdf.drawString(50, y, "GST (18%)")
    pdf.drawString(450, y, f"₹{gst_amount}")

    # Total row
    y -= 30
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(350, y, "Grand Total:")
    pdf.drawString(450, y, f"₹{total}")

    y -= 60

    # -------------------------------------
    # SIGNATURE LINE
    # -------------------------------------
    pdf.line(40, y, 200, y)
    pdf.setFont("Helvetica", 10)
    pdf.drawString(40, y - 12, "Authorized Signatory")

    y -= 40

    # -------------------------------------
    # FOOTER
    # -------------------------------------
    pdf.setFillColor(colors.HexColor("#555555"))
    pdf.setFont("Helvetica", 10)
    pdf.drawString(40, y, "Thank you for choosing EV Smart Hub. Drive Clean. Charge Smart ⚡")
    pdf.drawString(40, y - 12, f"Generated on: {datetime.datetime.now().strftime('%d-%m-%Y %H:%M:%S')}")

    pdf.save()
    buffer.seek(0)
    return buffer
