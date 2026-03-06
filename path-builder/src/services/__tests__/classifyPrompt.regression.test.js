/**
 * classifyPrompt.regression.test.js — Prompt regression safeguards.
 *
 * Verifies that the classification prompt in bespokePathService.js
 * contains all required guardrails. If someone removes a guardrail,
 * these tests fail immediately in CI.
 *
 * These tests import the prompt-building logic indirectly by checking
 * the source file text, since the prompt is built inside an async function.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read the source file as text to check prompt contents
const SERVICE_PATH = resolve(__dirname, "../../services/bespokePathService.js");
const sourceText = readFileSync(SERVICE_PATH, "utf-8");

describe("Classification Prompt Guardrails", () => {
  it("contains anti-hallucination instruction", () => {
    expect(sourceText).toContain("ANTI-HALLUCINATION");
    expect(sourceText).toContain("ONLY reference UE5 tools");
    expect(sourceText).toContain("Do NOT invent or assume UE5 features");
  });

  it("contains Blueprint precision rule", () => {
    expect(sourceText).toContain("BLUEPRINT PRECISION");
    expect(sourceText).toContain("Blueprints ARE a form of programming");
    expect(sourceText).toContain("without writing C++");
  });

  it("contains deduplication rule", () => {
    expect(sourceText).toContain("DEDUPLICATION");
    expect(sourceText).toContain("Each segment index may appear at most once");
  });

  it("contains direct-teaching instruction (no 'This article...' starts)", () => {
    expect(sourceText).toContain("NEVER start a summary with");
    expect(sourceText).toContain("This article");
  });

  it("uses sufficient segment context (>= 2000 chars)", () => {
    // The slice call should use at least 2000 characters
    const sliceMatch = sourceText.match(/\.slice\(0,\s*(\d+)\)/);
    expect(sliceMatch).toBeTruthy();
    expect(parseInt(sliceMatch[1], 10)).toBeGreaterThanOrEqual(2000);
  });

  it("prioritizes Blueprint content over C++", () => {
    expect(sourceText).toContain("PRIORITIZE Blueprint-based content over C++");
  });
});
