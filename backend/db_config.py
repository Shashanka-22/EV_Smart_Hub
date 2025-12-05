import mysql.connector

def get_db_connection():
    return mysql.connector.connect(
        host='localhost',
        user='root',
        password='Shashank',  # 🔁 Replace with your DB password
        database='ev_charge_db'
    )
