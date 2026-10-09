/**
 * Tests: token storage — session restoration and clear.
 * Does NOT use fake production data.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { setToken, getToken, clearSession, hasStoredSession } from "../auth/tokenStorage";

describe("tokenStorage", () => {
  beforeEach(() => {
    clearSession();
    sessionStorage.clear();
  });

  it("stores and retrieves a token from memory", () => {
    setToken("test-token");
    expect(getToken()).toBe("test-token");
  });

  it("persists to sessionStorage", () => {
    setToken("stored-token");
    // Simulate memory wipe by accessing getToken after clearing _memoryToken via module reset
    // Since we can't reset the module here easily, test sessionStorage directly
    expect(sessionStorage.getItem("resq_access_token")).toBe("stored-token");
  });

  it("returns null when no token set", () => {
    expect(getToken()).toBeNull();
  });

  it("clearSession removes from both memory and sessionStorage", () => {
    setToken("some-token");
    clearSession();
    expect(getToken()).toBeNull();
    expect(sessionStorage.getItem("resq_access_token")).toBeNull();
  });

  it("hasStoredSession returns false when cleared", () => {
    clearSession();
    expect(hasStoredSession()).toBe(false);
  });

  it("hasStoredSession returns true after setting token", () => {
    setToken("another-token");
    expect(hasStoredSession()).toBe(true);
  });
});
