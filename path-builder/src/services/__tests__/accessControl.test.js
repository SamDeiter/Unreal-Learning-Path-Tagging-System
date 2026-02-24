/**
 * Tests for the PURE (non-Firebase) functions in accessControl.js.
 *
 * Firebase-dependent functions (checkAllowlist, consumeInvite, etc.) are
 * intentionally excluded — they require Firestore mocks that add fragility
 * without meaningful value in a unit test context.
 */
import { describe, it, expect, vi } from "vitest";

// Mock firebaseConfig so the module-level getFirebaseApp() doesn't throw
vi.mock("../firebaseConfig", () => ({ getFirebaseApp: vi.fn(() => ({})) }));
vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  increment: vi.fn(),
  Timestamp: { now: vi.fn(), fromDate: vi.fn() },
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
}));

import { isAdmin, isEpicEmployee } from "../accessControl";

// ── isAdmin ─────────────────────────────────────────────────────────

describe("isAdmin", () => {
  it("returns true for sam.deiter@epicgames.com", () => {
    expect(isAdmin("sam.deiter@epicgames.com")).toBe(true);
  });

  it("returns true for samdeiter@gmail.com", () => {
    expect(isAdmin("samdeiter@gmail.com")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isAdmin("Sam.Deiter@EpicGames.com")).toBe(true);
  });

  it("returns false for a non-admin epic email", () => {
    expect(isAdmin("john.doe@epicgames.com")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isAdmin("")).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });
});

// ── isEpicEmployee ──────────────────────────────────────────────────

describe("isEpicEmployee", () => {
  it("returns true for any @epicgames.com email", () => {
    expect(isEpicEmployee("anyone@epicgames.com")).toBe(true);
  });

  it("returns true for admin emails even if not epicgames.com", () => {
    expect(isEpicEmployee("samdeiter@gmail.com")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isEpicEmployee("John.Doe@EpicGames.COM")).toBe(true);
  });

  it("returns false for non-epic, non-admin email", () => {
    expect(isEpicEmployee("user@gmail.com")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isEpicEmployee("")).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isEpicEmployee(null)).toBe(false);
    expect(isEpicEmployee(undefined)).toBe(false);
  });

  it("returns false for partial domain match", () => {
    expect(isEpicEmployee("user@notepicgames.com")).toBe(false);
  });
});
