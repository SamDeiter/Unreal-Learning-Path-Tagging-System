/**
 * markdownToHtml — Security Tests
 *
 * Specifically tests for XSS, attribute injection, and dangerous
 * protocol handling.
 */

import { describe, it, expect } from "vitest";
import { markdownToHtml } from "../../utils/markdownToHtml";

describe("markdownToHtml Security", () => {
  // ── XSS and Injection ─────────────────────────────────────────────

  it("escapes double quotes to prevent attribute injection", () => {
    const input = 'Normal text " with quote';
    const result = markdownToHtml(input);
    expect(result).toContain("&quot;");
    expect(result).not.toContain('"');
  });

  it("escapes single quotes to prevent attribute injection", () => {
    const input = "Normal text ' with single quote";
    const result = markdownToHtml(input);
    expect(result).toContain("&#x27;");
    expect(result).not.toContain("'");
  });

  it("escapes tags in markdown content", () => {
    const input = 'Click <img src=x onerror=alert(1)> here';
    const result = markdownToHtml(input);
    expect(result).not.toContain("<img");
    expect(result).toContain("&lt;img");
  });

  // ── Link Protocol Safety ──────────────────────────────────────────

  it("blocks javascript: protocol in links", () => {
    const input = '[XSS](javascript:alert(1))';
    const result = markdownToHtml(input);
    expect(result).not.toContain('<a href="javascript:');
    expect(result).toBe('[XSS](javascript:alert(1))');
  });

  it("blocks data: protocol in links", () => {
    const input = '[XSS](data:text/html,<script>alert(1)</script>)';
    const result = markdownToHtml(input);
    expect(result).not.toContain('<a href="data:');
  });

  it("blocks vbscript: protocol in links", () => {
    const input = '[XSS](vbscript:msgbox("hello"))';
    const result = markdownToHtml(input);
    expect(result).not.toContain('<a href="vbscript:');
  });

  it("allows http: and https: protocols", () => {
    const result = markdownToHtml('[Epic](https://epicgames.com)');
    expect(result).toContain('<a href="https://epicgames.com"');
  });

  it("allows relative paths", () => {
    const result = markdownToHtml('[Home](/home)');
    expect(result).toContain('<a href="/home"');
  });

  it("allows anchor links", () => {
    const result = markdownToHtml('[Top](#top)');
    expect(result).toContain('<a href="#top"');
  });

  it("allows mailto: and tel: protocols", () => {
    const mail = markdownToHtml('[Contact](mailto:test@example.com)');
    expect(mail).toContain('<a href="mailto:test@example.com"');

    const tel = markdownToHtml('[Call](tel:+123456789)');
    expect(tel).toContain('<a href="tel:+123456789"');
  });
});
