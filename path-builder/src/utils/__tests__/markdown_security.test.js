import { describe, it, expect } from "vitest";
import { markdownToHtml } from "../markdownToHtml";

describe("markdownToHtml security", () => {
  it("prevents javascript: protocol in links", () => {
    const result = markdownToHtml("[click me](javascript:alert('XSS'))");
    expect(result).not.toContain('href="javascript:');
    // It should just return the text
    expect(result).toContain('click me');
    expect(result).not.toContain('<a');
  });

  it("escapes double quotes in URLs to prevent attribute injection", () => {
    const result = markdownToHtml('[click me](https://example.com" onmouseover="alert(\'XSS\'))');
    // If vulnerable: <a href="https://example.com" onmouseover="alert('XSS')" ...
    expect(result).not.toContain('" onmouseover="');
    // It should contain the escaped version
    expect(result).toContain('href="https://example.com&quot; onmouseover=&quot;alert(&#39;XSS&#39;"');
  });
});
