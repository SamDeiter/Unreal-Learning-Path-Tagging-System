
import { describe, it, expect } from "vitest";
import { markdownToHtml } from "../markdownToHtml";

describe("markdownToHtml XSS repro", () => {
  it("vulnerable to javascript: protocol", () => {
    const result = markdownToHtml("[click](javascript:alert(1))");
    console.log('Result for javascript:', result);
    expect(result).not.toContain('href="javascript:');
  });

  it("vulnerable to attribute breakout", () => {
    const result = markdownToHtml('[click](https://example.com" onmouseover="alert(1))');
    console.log('Result for breakout:', result);
    // It should not contain 'onmouseover' as an attribute because quotes are escaped
    expect(result).toContain('href="https://example.com&quot; onmouseover=&quot;alert(1"');
    expect(result).not.toContain('" onmouseover="');
  });
});
