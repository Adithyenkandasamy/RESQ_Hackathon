"""API routers package."""

from app.routers import admin, ambulances, auth, emergencies, health, hospitals

__all__ = [
    "admin",
    "ambulances",
    "auth",
    "emergencies",
    "health",
    "hospitals",
]
