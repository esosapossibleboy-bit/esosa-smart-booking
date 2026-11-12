# 📅 Esosa Smart Booking Platform — Conflict-Free Scheduling System

A full-stack appointment and service booking platform engineered with **React**, **TypeScript**, **Python (Flask)**, and **PostgreSQL**. Features real-time slot availability checks, database-level double-booking prevention, and role-based Client and Provider Admin dashboards.

🌐 **Live Production App:** [https://esosapossibleboy-bit.github.io/esosa-smart-booking/](https://esosapossibleboy-bit.github.io/esosa-smart-booking/)  
⚙️ **REST API Endpoint:** [https://onrender.com](https://onrender.com)

---

## 🚀 Key Engineering Features

* **Database-Level Concurrency Protection:** Enforces a composite `UNIQUE(appointment_date, time_slot)` constraint in PostgreSQL (`Neon Cloud`) and handles `IntegrityError` conflicts (`409 Conflict`) to guarantee zero double-bookings.
* **Role-Based Client & Provider Views:** Provides a **Client Booking** portal that dynamically disables reserved time slots and a **Provider Admin** dashboard to inspect schedules and cancel reservations to reopen slots.
* **Client-Side State Persistence:** Preserves active role views, selected dates, and draft inputs across browser reloads using `localStorage`.

---

## 🛠️ Tech Stack

* **Frontend:** React, TypeScript, Vite, CSS3
* **Backend:** Python 3, Flask, Flask-CORS, Gunicorn
* **Database:** PostgreSQL (`psycopg2` on Neon Cloud)
* **Deployment:** GitHub Pages (`gh-pages`), Render Cloud
