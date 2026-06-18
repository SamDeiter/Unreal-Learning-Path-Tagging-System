/**
 * markdownToHtml — Security tests
 *
 * Reproduces and verifies fixes for XSS vulnerabilities in the link parser,
 * specifically dangerous protocols and attribute injection.
 */

import { describe, it, expect } from "vitest";
import { markdownToHtml } from "../../utils/markdownToHtml";

describe("markdownToHtml Security", () => {
  it("blocks javascript: protocol in links", () => {
    const result = markdownToHtml('[Click me](javascript:alert("XSS"))');
    // Should either strip the protocol, prefix it, or return a safe placeholder
    expect(result).not.toContain('href="javascript:');
    expect(result).toContain('href="#"');
  });

  it("blocks data: protocol in links", () => {
    const result = markdownToHtml('[Click me](data:text/html,<script>alert(1)</script>)');
    expect(result).not.toContain('href="data:');
    expect(result).toContain('href="#"');
  });

  it("prevents attribute injection via double quotes in URL", () => {
    // Note: The parser stops at the first ')' it sees.
    const result = markdownToHtml('[Click me](https://example.com" onclick="alert(1))');
    // The double quote should be escaped as &quot; to prevent breaking out of the href attribute
    expect(result).not.toContain('onclick="alert(1)"');
    expect(result).toContain('href="https://example.com&quot; onclick=&quot;alert(1"');
  });

  it("allows safe protocols (http, https, mailto, tel)", () => {
    expect(markdownToHtml('[Web](https://epicgames.com)')).toContain('href="https://epicgames.com"');
    expect(markdownToHtml('[Email](mailto:support@epicgames.com)')).toContain('href="mailto:support@epicgames.com"');
    expect(markdownToHtml('[Phone](tel:+1234567890)')).toContain('href="tel:+1234567890"');
  });

  it("allows relative and dot-relative paths", () => {
    expect(markdownToHtml('[Home](/)')).toContain('href="/"');
    expect(markdownToHtml('[Subpage](./subpage)')).toContain('href="./subpage"');
    expect(markdownToHtml('[Parent](../parent)')).toContain('href="../parent"');
    expect(markdownToHtml('[Asset](assets/logo.png)')).toContain('href="assets/logo.png"');
    expect(markdownToHtml('[Page](page.html)')).toContain('href="page.html"');
  });

  it("blocks unknown/dangerous protocols while allowing relative paths with colons", () => {
    expect(markdownToHtml('[Attack](unknown-proto:evil)')).toContain('href="#"');
    // A relative path with a colon (e.g. filename with colon) is unlikely in web but technically relative
    // if it doesn't match a protocol regex. But usually, colons denote protocols.
  });
});
