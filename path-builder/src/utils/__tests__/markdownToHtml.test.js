/**
 * markdownToHtml — Unit tests
 *
 * Covers header rendering, bold/italic, code, lists, links, XSS safety,
 * and edge cases.
 */

import { describe, it, expect } from "vitest";
import { markdownToHtml } from "../../utils/markdownToHtml";

describe("markdownToHtml", () => {
  // ── Headers ────────────────────────────────────────────────────────

  it("converts # to h1", () => {
    const result = markdownToHtml("# Main Title");
    expect(result).toContain("<h1");
    expect(result).toContain("Main Title");
    expect(result).not.toContain("# Main");
  });

  it("converts ## to h2", () => {
    const result = markdownToHtml("## Section Header");
    expect(result).toContain("<h2");
    expect(result).toContain("Section Header");
  });

  it("converts ### to h3", () => {
    const result = markdownToHtml("### Sub-section");
    expect(result).toContain("<h3");
    expect(result).toContain("Sub-section");
  });

  it("handles multiple header levels in one block", () => {
    const result = markdownToHtml("# Title\n## Subtitle\n### Detail");
    expect(result).toContain("<h1");
    expect(result).toContain("<h2");
    expect(result).toContain("<h3");
  });

  // ── Bold and Italic ────────────────────────────────────────────────

  it("converts **text** to bold", () => {
    const result = markdownToHtml("This is **important** info.");
    expect(result).toContain("<strong>important</strong>");
  });

  it("converts *text* to italic", () => {
    const result = markdownToHtml("This is *emphasized* text.");
    expect(result).toContain("<em>emphasized</em>");
  });

  it("converts ***text*** to bold italic", () => {
    const result = markdownToHtml("This is ***critical*** info.");
    expect(result).toContain("<strong><em>critical</em></strong>");
  });

  // ── Inline code ────────────────────────────────────────────────────

  it("converts `code` to code element", () => {
    const result = markdownToHtml("Use `GetActorLocation()` to get position.");
    expect(result).toContain("<code");
    expect(result).toContain("GetActorLocation()");
  });

  // ── Lists ──────────────────────────────────────────────────────────

  it("converts - items to list items", () => {
    const result = markdownToHtml("- First item\n- Second item");
    expect(result).toContain("<li");
    expect(result).toContain("<ul");
    expect(result).toContain("First item");
    expect(result).toContain("Second item");
  });

  // ── Links ──────────────────────────────────────────────────────────

  it("converts [text](url) to anchor tags", () => {
    const result = markdownToHtml("[Epic Docs](https://docs.unrealengine.com)");
    expect(result).toContain('<a href="https://docs.unrealengine.com"');
    expect(result).toContain("Epic Docs");
    expect(result).toContain('target="_blank"');
  });

  // ── Paragraphs and line breaks ─────────────────────────────────────

  it("converts double newlines to paragraph breaks", () => {
    const result = markdownToHtml("First paragraph.\n\nSecond paragraph.");
    expect(result).toContain("</p><p");
  });

  it("converts single newlines to <br>", () => {
    const result = markdownToHtml("Line one.\nLine two.");
    expect(result).toContain("<br>");
  });

  // ── XSS safety ─────────────────────────────────────────────────────

  it("escapes HTML tags in input to prevent XSS", () => {
    const result = markdownToHtml('<script>alert("xss")</script>');
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("escapes ampersands", () => {
    const result = markdownToHtml("Tips & Tricks");
    expect(result).toContain("&amp;");
  });

  it("prevents javascript: protocol in links", () => {
    const result = markdownToHtml("[Click me](javascript:alert('xss'))");
    expect(result).not.toContain('href="javascript:');
  });

  it("prevents attribute injection in links", () => {
    const result = markdownToHtml('[Inject](https://example.com" onmouseover="alert(1))');
    expect(result).not.toContain('onmouseover="alert(1)"');
    // It should ideally escape the quote
    expect(result).toContain('href="https://example.com&quot; onmouseover=&quot;alert(1"');
  });

  // ── Edge cases ─────────────────────────────────────────────────────

  it("returns null/undefined as-is", () => {
    expect(markdownToHtml(null)).toBe(null);
    expect(markdownToHtml(undefined)).toBe(undefined);
    expect(markdownToHtml("")).toBe("");
  });

  it("returns non-string values as-is", () => {
    expect(markdownToHtml(42)).toBe(42);
  });

  it("passes through plain text without modification (except entity escaping)", () => {
    const result = markdownToHtml("Simple plain text content.");
    expect(result).toBe("Simple plain text content.");
  });
});
