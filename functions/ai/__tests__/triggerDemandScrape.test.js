/**
 * Tests for triggerDemandScrape.js — permission checking, input routing,
 * secret validation, and GitHub API dispatching.
 */

const mockOnCall = jest.fn();

jest.mock("firebase-functions/v2/https", () => ({
  onCall: (opts, handler) => {
    mockOnCall.mockImplementation(handler);
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
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../../utils/appCheckMiddleware", () => ({
  requireAppCheck: jest.fn(),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const { triggerDemandScrape } = require("../triggerDemandScrape");

describe("triggerDemandScrape callable", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.GITHUB_PAT = "fake-github-pat";
    mockFetch.mockReset();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function makeRequest({ auth = null, data = {} } = {}) {
    return {
      auth,
      data,
      app: {},
    };
  }

  test("rejects unauthenticated calls with unauthenticated error", async () => {
    const request = makeRequest({ auth: null });
    await expect(triggerDemandScrape(request)).rejects.toMatchObject({
      code: "unauthenticated",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("rejects authenticated non-admin calls with permission-denied error", async () => {
    const request = makeRequest({
      auth: {
        uid: "user-123",
        token: { email: "regular.user@example.com", admin: false },
      },
    });
    await expect(triggerDemandScrape(request)).rejects.toMatchObject({
      code: "permission-denied",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("allows bootstrap admins and dispatches request to GitHub", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => "OK",
    });

    const request = makeRequest({
      auth: {
        uid: "bootstrap-admin",
        token: { email: "sam.deiter@epicgames.com" }, // bootstrap email, admin field omitted/falsy
      },
      data: { engine: "UE5" },
    });

    const result = await triggerDemandScrape(request);

    expect(result.success).toBe(true);
    expect(result.triggeredBy).toBe("sam.deiter@epicgames.com");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [calledUrl, calledInit] = mockFetch.mock.calls[0];
    expect(calledUrl).toContain("api.github.com");
    expect(calledUrl).toContain("scrape-demand-intel.yml/dispatches");
    expect(calledInit.headers["Authorization"]).toBe("Bearer fake-github-pat");
    expect(JSON.parse(calledInit.body)).toEqual({
      ref: "master",
      inputs: { engine: "UE5" },
    });
  });

  test("allows users with admin custom claims and dispatches", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => "OK",
    });

    const request = makeRequest({
      auth: {
        uid: "real-admin",
        token: { email: "some.admin@epicgames.com", admin: true },
      },
      data: { engine: "UEFN" },
    });

    const result = await triggerDemandScrape(request);

    expect(result.success).toBe(true);
    expect(result.triggeredBy).toBe("some.admin@epicgames.com");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [, calledInit] = mockFetch.mock.calls[0];
    expect(JSON.parse(calledInit.body)).toEqual({
      ref: "master",
      inputs: { engine: "UEFN" },
    });
  });

  test("rejects if GITHUB_PAT secret is missing", async () => {
    delete process.env.GITHUB_PAT;

    const request = makeRequest({
      auth: {
        uid: "real-admin",
        token: { email: "some.admin@epicgames.com", admin: true },
      },
    });

    await expect(triggerDemandScrape(request)).rejects.toMatchObject({
      code: "internal",
      message: "GitHub token not configured.",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("handles GitHub API non-ok response status", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "Bad credentials",
    });

    const request = makeRequest({
      auth: {
        uid: "real-admin",
        token: { email: "some.admin@epicgames.com", admin: true },
      },
    });

    await expect(triggerDemandScrape(request)).rejects.toMatchObject({
      code: "internal",
      message: "GitHub API error: 401 — Unauthorized",
    });
  });
});
