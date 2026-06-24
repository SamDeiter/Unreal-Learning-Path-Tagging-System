import { describe, it, expect } from "vitest";
import { markdownToHtml } from "../markdownToHtml";

describe("Security: markdownToHtml", () => {
  it("blocks javascript: protocol in links", () => {
    const input = "[XSS](javascript:alert('XSS'))";
    const result = markdownToHtml(input);
    expect(result).not.toContain('href="javascript:');
    expect(result).toContain('href="#"');
  });

  it("blocks data: protocol in links", () => {
    const input = "[XSS](data:text/html,<script>alert('XSS')</script>)";
    const result = markdownToHtml(input);
    expect(result).not.toContain('href="data:');
    expect(result).toContain('href="#"');
  });

  it("escapes double quotes in link URLs to prevent attribute breakout", () => {
    const input = '[XSS](https://example.com"onclick="alert(1))';
    const result = markdownToHtml(input);
    // If it's not escaped, it will contain "onclick="
    expect(result).not.toContain('"onclick=');
    // It should have escaped the "
    // Note: the current regex stops at the first ')', so the URL captured is 'https://example.com"onclick="alert(1'
    expect(result).toContain('href="https://example.com&quot;onclick=&quot;alert(1"');
  });
});
