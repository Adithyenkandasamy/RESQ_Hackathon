"""Tests for the in-process TTL cache."""

from __future__ import annotations

import pytest

from app.core.cache import TTLCache


class FakeClock:
    """Deterministic clock for testing TTL behavior without sleep."""

    def __init__(self, start: float = 0.0) -> None:
        self._now = start

    def __call__(self) -> float:
        return self._now

    def advance(self, seconds: float) -> None:
        self._now += seconds


# ── Basic set / get ──────────────────────────────────────────────


@pytest.mark.anyio
async def test_set_and_get() -> None:
    cache = TTLCache(default_ttl=60, clock=FakeClock())
    await cache.set("key1", "value1")
    assert await cache.get("key1") == "value1"


@pytest.mark.anyio
async def test_get_missing_key_returns_none() -> None:
    cache = TTLCache(default_ttl=60, clock=FakeClock())
    assert await cache.get("nonexistent") is None


# ── Expiration ───────────────────────────────────────────────────


@pytest.mark.anyio
async def test_expired_entry_returns_none() -> None:
    clock = FakeClock()
    cache = TTLCache(default_ttl=10, clock=clock)
    await cache.set("key1", "value1")

    clock.advance(11)  # past TTL
    assert await cache.get("key1") is None


@pytest.mark.anyio
async def test_entry_available_before_expiry() -> None:
    clock = FakeClock()
    cache = TTLCache(default_ttl=10, clock=clock)
    await cache.set("key1", "value1")

    clock.advance(9)  # before TTL
    assert await cache.get("key1") == "value1"


@pytest.mark.anyio
async def test_custom_ttl_per_entry() -> None:
    clock = FakeClock()
    cache = TTLCache(default_ttl=60, clock=clock)
    await cache.set("short", "data", ttl=5)

    clock.advance(6)
    assert await cache.get("short") is None


@pytest.mark.anyio
async def test_evict_expired_removes_entries() -> None:
    clock = FakeClock()
    cache = TTLCache(default_ttl=5, clock=clock)
    await cache.set("a", 1)
    await cache.set("b", 2)

    clock.advance(6)
    removed = await cache.evict_expired()
    assert removed == 2
    assert await cache.size() == 0


# ── Deletion ─────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_delete_existing_key() -> None:
    cache = TTLCache(default_ttl=60, clock=FakeClock())
    await cache.set("key1", "value1")
    assert await cache.delete("key1") is True
    assert await cache.get("key1") is None


@pytest.mark.anyio
async def test_delete_nonexistent_key() -> None:
    cache = TTLCache(default_ttl=60, clock=FakeClock())
    assert await cache.delete("nope") is False


# ── Clear ────────────────────────────────────────────────────────


@pytest.mark.anyio
async def test_clear_removes_all() -> None:
    cache = TTLCache(default_ttl=60, clock=FakeClock())
    await cache.set("a", 1)
    await cache.set("b", 2)
    await cache.clear()
    assert await cache.size() == 0
    assert await cache.get("a") is None


# ── Max entries ──────────────────────────────────────────────────


@pytest.mark.anyio
async def test_max_entries_evicts_oldest() -> None:
    cache = TTLCache(default_ttl=60, max_entries=2, clock=FakeClock())
    await cache.set("first", 1)
    await cache.set("second", 2)
    await cache.set("third", 3)  # should evict "first"

    assert await cache.get("first") is None
    assert await cache.get("second") == 2
    assert await cache.get("third") == 3
    assert await cache.size() == 2


@pytest.mark.anyio
async def test_overwrite_existing_key_does_not_grow() -> None:
    cache = TTLCache(default_ttl=60, max_entries=2, clock=FakeClock())
    await cache.set("a", 1)
    await cache.set("b", 2)
    await cache.set("a", 99)  # overwrite, should NOT evict "b"

    assert await cache.get("a") == 99
    assert await cache.get("b") == 2
    assert await cache.size() == 2
