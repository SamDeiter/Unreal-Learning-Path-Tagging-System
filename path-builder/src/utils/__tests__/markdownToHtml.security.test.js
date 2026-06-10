import { describe, it, expect } from "vitest";
import { markdownToHtml } from "../markdownToHtml";

describe("markdownToHtml XSS reproduction", () => {
  it("vulnerable to javascript: protocol in links", () => {
    const result = markdownToHtml("[click me](javascript:alert('XSS'))");
    // Currently this will pass and contain the javascript: link
    expect(result).not.toContain('href="javascript:');
  });

  it("vulnerable to attribute injection in links", () => {
    const result = markdownToHtml('[click me](https://google.com" onmouseover="alert(1))');
    // The double quote should be escaped, preventing the injection of a real onmouseover attribute.
    // It should all be contained within the href attribute value.
    expect(result).toContain('href="https://google.com&quot; onmouseover=&quot;alert(1"');
  });
});
