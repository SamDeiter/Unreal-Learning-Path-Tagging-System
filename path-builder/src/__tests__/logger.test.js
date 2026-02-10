import { describe, it, expect, vi } from "vitest";
import { devLog, devWarn } from "../utils/logger";

describe("logger", () => {
  it("devLog calls console.log (test env = DEV)", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    devLog("test message", { data: 1 });
    expect(spy).toHaveBeenCalledWith("test message", { data: 1 });
    spy.mockRestore();
  });

  it("devWarn calls console.warn (test env = DEV)", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    devWarn("warn message");
    expect(spy).toHaveBeenCalledWith("warn message");
    spy.mockRestore();
  });

  it("devLog passes through multiple arguments", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    devLog("a", "b", "c");
    expect(spy).toHaveBeenCalledWith("a", "b", "c");
    spy.mockRestore();
  });

  it("devWarn passes through multiple arguments", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    devWarn("x", 42);
    expect(spy).toHaveBeenCalledWith("x", 42);
    spy.mockRestore();
  });
});
