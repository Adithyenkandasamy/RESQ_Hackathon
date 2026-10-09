"""API routers package."""

from app.routers import admin, ambulances, auth, emergencies, health, hospital_requests, hospitals

__all__ = [
    "admin",
    "ambulances",
    "auth",
    "emergencies",
    "health",
    "hospital_requests",
    "hospitals",
]
