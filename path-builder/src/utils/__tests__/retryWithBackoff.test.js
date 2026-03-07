import { describe, it, expect, vi, beforeEach } from "vitest";
import { retryWithBackoff, isRetryableError } from "../retryWithBackoff";

describe("retryWithBackoff", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it("returns result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await retryWithBackoff(fn, { maxRetries: 3 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on resource-exhausted and succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ code: "resource-exhausted", message: "rate limit" })
      .mockResolvedValue("ok");

    const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 10 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on 429 error message and succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("HTTP 429 Too Many Requests"))
      .mockResolvedValue("ok");

    const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 10 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after max retries exhausted", async () => {
    const err = { code: "unavailable", message: "service down" };
    const fn = vi.fn().mockRejectedValue(err);

    await expect(retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 10 })).rejects.toEqual(err);
    // 1 initial + 2 retries = 3 calls
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry non-retryable errors", async () => {
    const err = new Error("invalid-argument: bad input");
    err.code = "invalid-argument";
    const fn = vi.fn().mockRejectedValue(err);

    await expect(retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 10 })).rejects.toThrow(
      "invalid-argument"
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on network failure", async () => {
    const networkErr = new TypeError("Failed to fetch");
    const fn = vi.fn().mockRejectedValueOnce(networkErr).mockResolvedValue("ok");

    const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 10 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("isRetryableError", () => {
  it("recognizes Firebase resource-exhausted", () => {
    expect(isRetryableError({ code: "resource-exhausted", message: "" })).toBe(true);
  });

  it("recognizes Firebase unavailable", () => {
    expect(isRetryableError({ code: "unavailable", message: "" })).toBe(true);
  });

  it("recognizes functions/ prefixed codes", () => {
    expect(isRetryableError({ code: "functions/resource-exhausted", message: "" })).toBe(true);
  });

  it("recognizes 429 in message", () => {
    expect(isRetryableError(new Error("got 429 from server"))).toBe(true);
  });

  it("recognizes 503 in message", () => {
    expect(isRetryableError(new Error("503 Service Unavailable"))).toBe(true);
  });

  it("rejects non-retryable errors", () => {
    expect(isRetryableError(new Error("invalid-argument"))).toBe(false);
    expect(isRetryableError({ code: "permission-denied", message: "" })).toBe(false);
  });
});
