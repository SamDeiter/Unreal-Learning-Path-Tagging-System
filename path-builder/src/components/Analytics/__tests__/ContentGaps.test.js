/**
 * ContentGaps.test.js — Smoke test for the Content Gaps dashboard.
 * Verifies the component renders without crashing and shows expected UI.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ContentGaps from "../ContentGaps";

// Mock Firebase
vi.mock("../../../services/firebaseConfig", () => ({
  getFirebaseApp: vi.fn(() => ({})),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
}));

vi.mock("../../../utils/logger", () => ({
  devWarn: vi.fn(),
}));

describe("ContentGaps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the dashboard title", async () => {
    render(<ContentGaps />);
    expect(screen.getByText(/Content Gaps Dashboard/)).toBeTruthy();
  });

  it("shows loading state initially", () => {
    render(<ContentGaps />);
    expect(screen.getByText(/Loading analytics data/)).toBeTruthy();
  });
});
