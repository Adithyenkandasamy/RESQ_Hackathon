"""Simple async-compatible in-process TTL cache.

Limitations
-----------
* Entries disappear when the process restarts.
* Multiple backend instances do NOT share cache contents.
* Cached data can become stale before its TTL expires if the
  underlying data changes.
* **Never** use this cache as the authoritative store for emergency
  records, hospital assignments, or other critical state.

Implementation notes
--------------------
* Thread-safe within one process via ``asyncio.Lock``.
* Expired entries are cleaned lazily on access and periodically
  via ``_evict_expired()``.
* Maximum entry count prevents unbounded memory growth.
* An injectable ``clock`` function enables deterministic testing
  without ``time.sleep()``.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any


@dataclass
class _CacheEntry:
    value: Any
    expires_at: float


@dataclass
class TTLCache:
    """Async-compatible in-process TTL cache.

    Parameters
    ----------
    default_ttl:
        Default time-to-live in seconds for new entries.
    max_entries:
        Maximum number of entries. When exceeded the oldest entry
        (by insertion order) is evicted.
    clock:
        Callable returning the current time as a float (seconds).
        Defaults to ``time.monotonic``.  Inject a custom clock
        for deterministic tests.
    """

    default_ttl: float = 300.0
    max_entries: int = 1000
    clock: Callable[[], float] = field(default=time.monotonic, repr=False)

    _store: dict[str, _CacheEntry] = field(default_factory=dict, init=False)
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock, init=False)

    async def get(self, key: str) -> Any | None:
        """Return the cached value or ``None`` if missing / expired."""
        async with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            if self.clock() >= entry.expires_at:
                del self._store[key]
                return None
            return entry.value

    async def set(self, key: str, value: Any, ttl: float | None = None) -> None:
        """Store a value with a TTL.

        If the cache is full, the oldest entry is evicted first.
        """
        effective_ttl = ttl if ttl is not None else self.default_ttl
        async with self._lock:
            # If key already exists, delete first (to update order).
            self._store.pop(key, None)
            # Evict oldest if we are at capacity.
            if len(self._store) >= self.max_entries:
                oldest_key = next(iter(self._store))
                del self._store[oldest_key]
            self._store[key] = _CacheEntry(
                value=value,
                expires_at=self.clock() + effective_ttl,
            )

    async def delete(self, key: str) -> bool:
        """Remove a key.  Returns ``True`` if the key existed."""
        async with self._lock:
            return self._store.pop(key, None) is not None

    async def clear(self) -> None:
        """Remove all entries."""
        async with self._lock:
            self._store.clear()

    async def size(self) -> int:
        """Return the number of entries (including not-yet-evicted expired ones)."""
        async with self._lock:
            return len(self._store)

    async def evict_expired(self) -> int:
        """Remove all expired entries.  Returns the count removed."""
        async with self._lock:
            now = self.clock()
            expired_keys = [k for k, v in self._store.items() if now >= v.expires_at]
            for k in expired_keys:
                del self._store[k]
            return len(expired_keys)
