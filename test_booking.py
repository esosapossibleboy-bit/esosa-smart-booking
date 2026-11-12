import pytest
from booking_server import app, SERVICE_CATALOG

@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

def test_service_pricing_catalog():
    assert SERVICE_CATALOG["1-on-1 Software Coaching"] == 120.00
    assert SERVICE_CATALOG["Full-Stack Code Review"] == 85.00
    assert SERVICE_CATALOG["Technical Consultation"] == 50.00

def test_admin_login_and_jwt_protection(client):
    # 1. Unauthenticated request to /appointments must be blocked
    unauth = client.get("/appointments")
    assert unauth.status_code == 401

    # 2. Wrong password must fail
    bad_login = client.post("/admin/login", json={"username": "admin", "password": "wrong"})
    assert bad_login.status_code == 401

    # 3. Valid admin login returns a JWT token
    good_login = client.post("/admin/login", json={"username": "admin", "password": "admin123"})
    assert good_login.status_code == 200
    data = good_login.get_json()
    assert data["status"] == "Success"
    assert "token" in data

def test_booking_requires_payment_verification(client):
    res = client.post("/book", json={
        "client_name": "Test Client",
        "client_email": "test@example.com",
        "service_type": "Technical Consultation",
        "appointment_date": "2026-12-01",
        "time_slot": "09:00 AM",
        "card_last4": ""
    })
    assert res.status_code == 402
    assert b"payment confirmation required" in res.data
