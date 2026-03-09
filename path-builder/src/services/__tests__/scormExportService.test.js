import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock JSZip — vi.mock is hoisted, so the class must be inside the factory
const mockFile = vi.fn();
const mockGenerateAsync = vi.fn().mockResolvedValue(new Blob(["test"]));

vi.mock("jszip", () => {
  return {
    default: class {
      constructor() {
        this.file = mockFile;
        this.generateAsync = mockGenerateAsync;
      }
    },
  };
});
// Mock cleanVideoTitle
vi.mock("../../utils/cleanVideoTitle", () => ({
  cleanVideoTitle: (t) => t,
}));

// Mock logger
vi.mock("../../utils/logger", () => ({
  devLog: vi.fn(),
}));

import { exportScormPackage } from "../scormExportService";

describe("scormExportService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock DOM methods for download
    const mockAnchor = { href: "", download: "", click: vi.fn() };
    vi.spyOn(document, "createElement").mockReturnValue(mockAnchor);
    vi.spyOn(document.body, "appendChild").mockImplementation(() => {});
    vi.spyOn(document.body, "removeChild").mockImplementation(() => {});
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  it("throws on empty path", async () => {
    await expect(exportScormPackage({})).rejects.toThrow("Cannot export empty path");
    await expect(exportScormPackage({ path: [] })).rejects.toThrow("Cannot export empty path");
  });

  it("generates correct number of SCO files", async () => {
    const pathResult = {
      query: "Blueprint variables",
      path: [
        { category: "foundation", segment: { title: "Step 1", text: "Intro" } },
        { category: "fix", segment: { title: "Step 2", text: "Core" } },
        { category: "transfer", segment: { title: "Step 3", text: "Practice" } },
      ],
      bridges: [{ text: "Bridge 1" }, { text: "Bridge 2" }],
    };

    await exportScormPackage(pathResult);

    // Should have: shared/scormapi.js, shared/style.css, 3 SCOs, quiz.html, imsmanifest.xml
    // = 7 file() calls
    expect(mockFile).toHaveBeenCalledTimes(7);

    // Check filenames
    const filenames = mockFile.mock.calls.map((c) => c[0]);
    expect(filenames).toContain("shared/scormapi.js");
    expect(filenames).toContain("shared/style.css");
    expect(filenames).toContain("sco_0.html");
    expect(filenames).toContain("sco_1.html");
    expect(filenames).toContain("sco_2.html");
    expect(filenames).toContain("quiz.html");
    expect(filenames).toContain("imsmanifest.xml");
  });

  it("skips quiz when includeQuiz=false", async () => {
    const pathResult = {
      query: "test",
      path: [
        { category: "fix", segment: { title: "Step 1" } },
        { category: "fix", segment: { title: "Step 2" } },
      ],
    };

    await exportScormPackage(pathResult, { includeQuiz: false });

    const filenames = mockFile.mock.calls.map((c) => c[0]);
    expect(filenames).not.toContain("quiz.html");
  });

  it("generates valid imsmanifest.xml content", async () => {
    const pathResult = {
      query: "Lumen lighting",
      path: [{ category: "fix", segment: { title: "Step 1" } }],
    };

    await exportScormPackage(pathResult);

    const manifestCall = mockFile.mock.calls.find((c) => c[0] === "imsmanifest.xml");
    expect(manifestCall).toBeDefined();

    const xml = manifestCall[1];
    expect(xml).toContain("schemaversion>1.2</schemaversion");
    expect(xml).toContain("ADL SCORM");
    expect(xml).toContain('adlcp:scormtype="sco"');
    expect(xml).toContain("UE5 Learning Path: Lumen lighting");
  });

  it("generates SCO HTML with step content", async () => {
    const pathResult = {
      query: "Niagara VFX",
      path: [
        {
          category: "foundation",
          segment: { title: "Intro to Niagara", text: "Learn the basics of Niagara" },
        },
      ],
      bridges: [{ text: "Let's start with fundamentals" }],
    };

    await exportScormPackage(pathResult, { includeQuiz: false });

    const scoCall = mockFile.mock.calls.find((c) => c[0] === "sco_0.html");
    expect(scoCall).toBeDefined();

    const html = scoCall[1];
    expect(html).toContain("Intro to Niagara");
    expect(html).toContain("Learn the basics of Niagara");
    expect(html).toContain("cat-foundation");
    expect(html).toContain("Mark Step Complete");
    expect(html).toContain("completeSCORM()");
  });

  it("triggers browser download", async () => {
    const pathResult = {
      query: "Test",
      path: [{ category: "fix", segment: { title: "S1" } }],
    };

    await exportScormPackage(pathResult, { includeQuiz: false });

    expect(mockGenerateAsync).toHaveBeenCalledWith({ type: "blob" });
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(document.createElement).toHaveBeenCalledWith("a");
  });

  it("skips quiz for single-step paths", async () => {
    const pathResult = {
      query: "test",
      path: [{ category: "fix", segment: { title: "Solo" } }],
    };

    await exportScormPackage(pathResult); // includeQuiz defaults to true

    const filenames = mockFile.mock.calls.map((c) => c[0]);
    // Only 1 step, so quiz is skipped (needs >= 2)
    expect(filenames).not.toContain("quiz.html");
  });
});
