/**
 * markdown_security.test.js — Security regression tests for markdownToHtml
 */

import { describe, it, expect } from "vitest";
import { markdownToHtml } from "../markdownToHtml";

describe("markdownToHtml security", () => {
  it("blocks javascript: protocol in links", () => {
    const input = '[Click Me](javascript:alert("XSS"))';
    const result = markdownToHtml(input);
    // Ideally it should strip the href or use a safe placeholder
    expect(result).not.toContain('href="javascript:');
  });

  it("blocks data: protocol in links", () => {
    const input = '[Click Me](data:text/html,<script>alert(1)</script>)';
    const result = markdownToHtml(input);
    expect(result).not.toContain('href="data:');
  });

  it("blocks vbscript: protocol in links", () => {
    const input = '[Click Me](vbscript:msgbox("XSS"))';
    const result = markdownToHtml(input);
    expect(result).not.toContain('href="vbscript:');
  });

  it("prevents attribute injection via double quotes in link URL", () => {
    const input = '[Click Me](https://example.com" onmouseover="alert(1))';
    const result = markdownToHtml(input);
    // If it doesn't escape quotes properly, it would create a separate onmouseover attribute.
    // We check that the onmouseover part is escaped and thus part of the href value.
    expect(result).toContain('onmouseover=&quot;');
    expect(result).not.toContain(' onmouseover="');
  });

  it("allows safe protocols (http, https, mailto, tel)", () => {
    const safeInputs = [
      '[HTTP](http://example.com)',
      '[HTTPS](https://example.com)',
      '[Mail](mailto:test@example.com)',
      '[Tel](tel:+123456789)'
    ];
    safeInputs.forEach(input => {
      const result = markdownToHtml(input);
      expect(result).toContain('href="');
    });
  });

  it("allows relative paths", () => {
    const relativeInputs = [
      '[Local](/path/to/page)',
      '[Anchor](#section-1)'
    ];
    relativeInputs.forEach(input => {
      const result = markdownToHtml(input);
      expect(result).toContain('href="');
    });
  });
});
