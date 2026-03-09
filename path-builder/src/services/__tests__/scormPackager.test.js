/**
 * scormPackager — Unit tests
 *
 * Tests manifest generation, SCO HTML generation,
 * and XML escaping.
 */

import { describe, it, expect } from "vitest";
import { generateManifest, generateScoHtml } from "../../services/scormPackager";

describe("scormPackager", () => {
  describe("generateManifest", () => {
    it("generates valid XML manifest", () => {
      const config = {
        title: "Test Course",
        identifier: "PKG_TEST",
        scos: [
          { title: "Module 1", href: "sco_0.html", files: ["sco_0.html"] },
          { title: "Module 2", href: "sco_1.html", files: ["sco_1.html"] },
        ],
      };
      const xml = generateManifest(config);
      expect(xml).toContain('<?xml version="1.0"');
      expect(xml).toContain("Test Course");
      expect(xml).toContain("Module 1");
      expect(xml).toContain("Module 2");
      expect(xml).toContain('identifier="PKG_TEST"');
      expect(xml).toContain("ADL SCORM");
      expect(xml).toContain("schemaversion");
    });

    it("includes organization and resources", () => {
      const config = {
        title: "My Course",
        identifier: "PKG_1",
        scos: [{ title: "SCO 1", href: "sco_0.html" }],
      };
      const xml = generateManifest(config);
      expect(xml).toContain("<organizations");
      expect(xml).toContain("<resources");
      expect(xml).toContain('scormtype="sco"');
    });

    it("escapes XML special characters in title", () => {
      const config = {
        title: "Course <with> & 'special' \"chars\"",
        identifier: "PKG_ESC",
        scos: [],
      };
      const xml = generateManifest(config);
      expect(xml).toContain("&lt;with&gt;");
      expect(xml).toContain("&amp;");
    });

    it("includes description when provided", () => {
      const config = {
        title: "Test",
        identifier: "PKG_DESC",
        scos: [],
        description: "A test course description",
      };
      const xml = generateManifest(config);
      expect(xml).toContain("A test course description");
    });
  });

  describe("generateScoHtml", () => {
    it("generates complete HTML page", () => {
      const html = generateScoHtml({
        title: "Test Module",
        content: "<p>Hello world</p>",
      });
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Test Module");
      expect(html).toContain("<p>Hello world</p>");
    });

    it("includes SCORM API integration", () => {
      const html = generateScoHtml({
        title: "Test",
        content: "Content",
      });
      expect(html).toContain("LMSInitialize");
      expect(html).toContain("LMSSetValue");
      expect(html).toContain("LMSFinish");
      expect(html).toContain("cmi.core.lesson_status");
    });

    it("includes navigation buttons", () => {
      const html = generateScoHtml({
        title: "Test",
        content: "Content",
      });
      expect(html).toContain("markComplete");
      expect(html).toContain("goBack");
      expect(html).toContain("Complete & Continue");
    });

    it("escapes XSS in title", () => {
      const html = generateScoHtml({
        title: '<script>alert("xss")</script>',
        content: "Safe content",
      });
      expect(html).not.toContain('<script>alert("xss")</script>');
      expect(html).toContain("&lt;script&gt;");
    });
  });
});
