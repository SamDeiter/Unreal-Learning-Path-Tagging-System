
import { describe, it, expect } from "vitest";
import { markdownToHtml } from "../markdownToHtml";

describe("markdownToHtml XSS", () => {
  it("vulnerability: double quote in link URL", () => {
    const maliciousLink = '[click me](" onmouseover="alert(1))';
    const result = markdownToHtml(maliciousLink);
    console.log("Result:", result);
    // Should be escaped so it's not a separate attribute
    expect(result).toContain('href="&quot; onmouseover=&quot;');
    // It should not have a raw onmouseover attribute
    expect(result).not.toContain('onmouseover="');
  });

  it("vulnerability: javascript protocol in link URL", () => {
    const maliciousLink = '[click me](javascript:alert(1))';
    const result = markdownToHtml(maliciousLink);
    console.log("Result:", result);
    expect(result).not.toContain('href="javascript:');
  });
});
