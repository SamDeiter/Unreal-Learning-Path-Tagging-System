/**
 * Tests for triggerDemandScrape.js — authorization and GitHub API triggering.
 */

// Mock firebase-functions
jest.mock("firebase-functions/v2/https", () => ({
  onCall: (opts, handler) => {
    if (typeof opts === "function") return opts;
    return handler;
  },
  HttpsError: class HttpsError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  },
}));

jest.mock("firebase-functions", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock("../../utils/appCheckMiddleware", () => ({
  requireAppCheck: jest.fn(),
}));

// Mock the isAdmin helper
const mockIsAdmin = jest.fn();
jest.mock("../../pipeline/telemetry", () => ({
  isAdmin: mockIsAdmin,
}));

// Mock global fetch
global.fetch = jest.fn();

// Set up environment
process.env.GITHUB_PAT = "test-pat";

describe("triggerDemandScrape", () => {
  let triggerDemandScrape;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdmin.mockReturnValue(false);

    // We need to require the module after mocks are set up
    jest.isolateModules(() => {
      triggerDemandScrape = require("../triggerDemandScrape").triggerDemandScrape;
    });
  });

  test("throws permission-denied for non-admin users", async () => {
    mockIsAdmin.mockReturnValue(false);
    const request = { auth: { token: { email: "user@example.com" } }, data: {} };

    await expect(triggerDemandScrape(request)).rejects.toThrow(
      "Only admins can trigger a demand scrape."
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("proceeds and calls GitHub API for admin users", async () => {
    mockIsAdmin.mockReturnValue(true);
    global.fetch.mockResolvedValue({
      ok: true,
      status: 204,
    });

    const request = {
      auth: { token: { email: "admin@example.com" } },
      data: { engine: "UE5" }
    };

    const result = await triggerDemandScrape(request);

    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("dispatches"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-pat",
        }),
        body: expect.stringContaining('"engine":"UE5"'),
      })
    );
  });

  test("handles GitHub API errors gracefully", async () => {
    mockIsAdmin.mockReturnValue(true);
    global.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "Bad credentials",
    });

    const request = { auth: { token: { email: "admin@example.com" } }, data: {} };

    await expect(triggerDemandScrape(request)).rejects.toThrow(
      "GitHub API error: 401 — Unauthorized"
    );
  });

  test("throws internal error if GITHUB_PAT is missing", async () => {
    const originalPat = process.env.GITHUB_PAT;
    delete process.env.GITHUB_PAT;
    mockIsAdmin.mockReturnValue(true);

    const request = { auth: { token: { email: "admin@example.com" } }, data: {} };

    try {
        await expect(triggerDemandScrape(request)).rejects.toThrow(
          "GitHub token not configured."
        );
    } finally {
        process.env.GITHUB_PAT = originalPat;
    }
  });
});
