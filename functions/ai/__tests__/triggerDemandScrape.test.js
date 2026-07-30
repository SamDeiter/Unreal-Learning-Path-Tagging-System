/**
 * triggerDemandScrape.test.js — unit tests for triggerDemandScrape callable.
 */

const { triggerDemandScrape } = require("../triggerDemandScrape");

// Mock firebase-admin
jest.mock("firebase-admin", () => ({
  firestore: jest.fn(() => ({})),
}));

// Mock firebase-functions
jest.mock("firebase-functions", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  config: jest.fn(() => ({})),
}));

// Mock firebase-functions/v2/https
jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((_opts, fn) => fn),
  HttpsError: class extends Error {
    constructor(code, msg) {
      super(msg);
      this.code = code;
    }
  },
}));

// Mock appCheckMiddleware
jest.mock("../../utils/appCheckMiddleware", () => ({
  requireAppCheck: jest.fn(),
}));

describe("triggerDemandScrape callable", () => {
  let originalFetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GITHUB_PAT = "mock-github-pat";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(""),
    });
  });

  it("rejects unauthenticated calls", async () => {
    const request = {
      auth: null,
      data: { engine: "UE5" },
    };

    await expect(triggerDemandScrape(request)).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("rejects authenticated non-admin calls", async () => {
    const request = {
      auth: {
        uid: "user-123",
        token: {
          email: "regular.user@example.com",
        },
      },
      data: { engine: "UE5" },
    };

    await expect(triggerDemandScrape(request)).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("accepts authenticated admin calls via custom claim", async () => {
    const request = {
      auth: {
        uid: "admin-123",
        token: {
          email: "admin@example.com",
          admin: true,
        },
      },
      data: { engine: "UE5" },
    };

    const response = await triggerDemandScrape(request);
    expect(response.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("accepts authenticated admin calls via bootstrap email", async () => {
    const request = {
      auth: {
        uid: "sam-123",
        token: {
          email: "sam.deiter@epicgames.com",
        },
      },
      data: { engine: "UE5" },
    };

    const response = await triggerDemandScrape(request);
    expect(response.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("throws internal error if GITHUB_PAT is missing", async () => {
    delete process.env.GITHUB_PAT;

    const request = {
      auth: {
        uid: "admin-123",
        token: {
          email: "admin@example.com",
          admin: true,
        },
      },
      data: { engine: "UE5" },
    };

    await expect(triggerDemandScrape(request)).rejects.toMatchObject({
      code: "internal",
    });
  });

  it("handles GitHub API errors gracefully", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: jest.fn().mockResolvedValue("Bad credentials"),
    });

    const request = {
      auth: {
        uid: "admin-123",
        token: {
          email: "admin@example.com",
          admin: true,
        },
      },
      data: { engine: "UE5" },
    };

    await expect(triggerDemandScrape(request)).rejects.toMatchObject({
      code: "internal",
    });
  });
});
