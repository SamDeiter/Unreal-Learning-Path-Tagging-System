import { describe, it, expect } from "vitest";
import { float16ToFloat32, decodeFloat16Vector } from "../utils/float16";

describe("float16ToFloat32", () => {
  it("converts positive zero", () => {
    // 0x0000 = +0.0
    expect(float16ToFloat32(0x0000)).toBe(0);
  });

  it("converts negative zero", () => {
    // 0x8000 = -0.0
    expect(float16ToFloat32(0x8000)).toBe(-0);
  });

  it("converts 1.0", () => {
    // 0x3C00 = 1.0 in float16
    expect(float16ToFloat32(0x3c00)).toBeCloseTo(1.0, 5);
  });

  it("converts -1.0", () => {
    // 0xBC00 = -1.0 in float16
    expect(float16ToFloat32(0xbc00)).toBeCloseTo(-1.0, 5);
  });

  it("converts 0.5", () => {
    // 0x3800 = 0.5 in float16
    expect(float16ToFloat32(0x3800)).toBeCloseTo(0.5, 5);
  });

  it("converts positive infinity", () => {
    // 0x7C00 = +Inf in float16
    expect(float16ToFloat32(0x7c00)).toBe(Infinity);
  });

  it("converts negative infinity", () => {
    // 0xFC00 = -Inf in float16
    expect(float16ToFloat32(0xfc00)).toBe(-Infinity);
  });

  it("converts NaN", () => {
    // 0x7C01 = NaN in float16
    expect(float16ToFloat32(0x7c01)).toBeNaN();
  });

  it("converts denormalized values", () => {
    // 0x0001 = smallest denorm = 2^-14 * (1/1024) ≈ 5.96e-8
    const result = float16ToFloat32(0x0001);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1e-6);
  });
});

describe("decodeFloat16Vector", () => {
  it("decodes a base64-encoded float16 vector", () => {
    // Create a known float16 vector: [1.0, 0.5, -1.0]
    // 1.0 = 0x3C00, 0.5 = 0x3800, -1.0 = 0xBC00
    // In little-endian bytes: [0x00, 0x3C, 0x00, 0x38, 0x00, 0xBC]
    const bytes = new Uint8Array([0x00, 0x3c, 0x00, 0x38, 0x00, 0xbc]);
    const b64 = btoa(String.fromCharCode(...bytes));

    const result = decodeFloat16Vector(b64, 3);
    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(3);
    expect(result[0]).toBeCloseTo(1.0, 5);
    expect(result[1]).toBeCloseTo(0.5, 5);
    expect(result[2]).toBeCloseTo(-1.0, 5);
  });

  it("uses default dimension of 768", () => {
    // Create a vector of 768 zeros (all bytes 0x00)
    const bytes = new Uint8Array(768 * 2); // 2 bytes per float16
    const b64 = btoa(String.fromCharCode(...bytes));

    const result = decodeFloat16Vector(b64);
    expect(result.length).toBe(768);
    expect(result[0]).toBe(0);
    expect(result[767]).toBe(0);
  });
});
