/**
 * scormExportService.v2.test.js — Unit tests for V2 SCORM package generation
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock JSZip before import
const mockFile = vi.fn();
const mockGenerateAsync = vi.fn().mockResolvedValue(new Blob(["test"], { type: "application/zip" }));

vi.mock("jszip", () => {
  return {
    default: function JSZip() {
      this.file = mockFile;
      this.generateAsync = mockGenerateAsync;
    },
  };
});

// Mock DOM methods used by the download flow
beforeEach(() => {
  mockFile.mockClear();
  mockGenerateAsync.mockClear();

  // Mock document.createElement for download anchor
  const mockAnchor = { href: "", download: "", click: vi.fn() };
  vi.spyOn(document, "createElement").mockReturnValue(mockAnchor);
  vi.spyOn(document.body, "appendChild").mockImplementation(() => {});
  vi.spyOn(document.body, "removeChild").mockImplementation(() => {});
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});

// Now import after mocks are set up
const { exportV2ScormPackage } = await import("../scormExportService.js");

// ── Test Data ──

const MOCK_V2_PATH = {
  title: "Blueprint Communication Patterns",
  sections: [
    {
      title: "Prerequisites",
      phase: "Prerequisites",
      purpose: "Build a solid foundation before diving into advanced topics.",
      steps: [
        {
          title: "Understanding Actor Components",
          completionType: "watch",
          whyThisMatters: "Components are the building blocks of UE5 gameplay.",
          whatToDo: ["Create a new Actor class", "Add a StaticMeshComponent"],
          howToVerify: "Your actor should appear in the viewport with a mesh.",
          commonMistake: "Forgetting to set the root component in the constructor.",
          takeaway: "Always set the root component first.",
          summary: "Learn the basics of Actor Components in UE5.",
        },
      ],
    },
    {
      title: "Core Steps",
      phase: "Core Steps",
      steps: [
        {
          title: "Event Dispatchers",
          completionType: "do",
          whyThisMatters: "Event dispatchers decouple communication between actors.",
          whatToDo: [
            "Create an Event Dispatcher in the sender Blueprint",
            "Bind it in the receiver Blueprint",
            "Call the dispatcher on action",
          ],
          howToVerify: "The receiver prints a message when the sender fires the event.",
        },
        {
          title: "Blueprint Interfaces",
          completionType: "apply",
          whyThisMatters: "Interfaces provide a contract for communication without tight coupling.",
          summary: "Implement a Blueprint Interface for Actor communication.",
        },
      ],
    },
  ],
};

// ── Tests ──

describe("exportV2ScormPackage", () => {
  it("throws when given an empty path", async () => {
    await expect(exportV2ScormPackage({ sections: [] })).rejects.toThrow(
      "Cannot export empty V2 path"
    );
  });

  it("throws when given null/undefined", async () => {
    await expect(exportV2ScormPackage(null)).rejects.toThrow();
    await expect(exportV2ScormPackage(undefined)).rejects.toThrow();
  });

  it("generates the correct number of SCO files", async () => {
    await exportV2ScormPackage(MOCK_V2_PATH, { includeQuiz: false });

    // 2 section headers + 3 steps = 5 SCO files
    const scoFiles = mockFile.mock.calls.filter(
      ([name]) => name.startsWith("sco_") && name.endsWith(".html")
    );
    expect(scoFiles).toHaveLength(5);
  });

  it("creates shared resources", async () => {
    await exportV2ScormPackage(MOCK_V2_PATH, { includeQuiz: false });

    const files = mockFile.mock.calls.map(([name]) => name);
    expect(files).toContain("shared/scormapi.js");
    expect(files).toContain("shared/style.css");
    expect(files).toContain("imsmanifest.xml");
  });

  it("includes V2 CSS extensions in the stylesheet", async () => {
    await exportV2ScormPackage(MOCK_V2_PATH, { includeQuiz: false });

    const cssCall = mockFile.mock.calls.find(([name]) => name === "shared/style.css");
    expect(cssCall).toBeDefined();
    const cssContent = cssCall[1];
    expect(cssContent).toContain(".v2-section");
    expect(cssContent).toContain(".v2-why");
    expect(cssContent).toContain(".v2-do");
    expect(cssContent).toContain(".v2-mistake");
    expect(cssContent).toContain(".cat-watch");
    expect(cssContent).toContain(".cat-do");
    expect(cssContent).toContain(".cat-apply");
  });

  it("includes quiz SCO when includeQuiz is true (default)", async () => {
    await exportV2ScormPackage(MOCK_V2_PATH);

    const files = mockFile.mock.calls.map(([name]) => name);
    expect(files).toContain("quiz.html");
  });

  it("excludes quiz SCO when includeQuiz is false", async () => {
    await exportV2ScormPackage(MOCK_V2_PATH, { includeQuiz: false });

    const files = mockFile.mock.calls.map(([name]) => name);
    expect(files).not.toContain("quiz.html");
  });

  it("renders V2 rich fields in step SCO HTML", async () => {
    await exportV2ScormPackage(MOCK_V2_PATH, { includeQuiz: false });

    // sco_1.html should be the first step (after section header sco_0.html)
    const stepCall = mockFile.mock.calls.find(([name]) => name === "sco_1.html");
    expect(stepCall).toBeDefined();
    const html = stepCall[1];

    // Rich fields should be present
    expect(html).toContain("Why This Matters");
    expect(html).toContain("Components are the building blocks");
    expect(html).toContain("What To Do");
    expect(html).toContain("Create a new Actor class");
    expect(html).toContain("How To Verify");
    expect(html).toContain("Common Mistake");
    expect(html).toContain("Key Takeaway");
  });

  it("renders section header SCOs with section title and step count", async () => {
    await exportV2ScormPackage(MOCK_V2_PATH, { includeQuiz: false });

    // sco_0.html = first section header
    const headerCall = mockFile.mock.calls.find(([name]) => name === "sco_0.html");
    expect(headerCall).toBeDefined();
    const html = headerCall[1];

    expect(html).toContain("Prerequisites");
    expect(html).toContain("<strong>1</strong> step");
    expect(html).toContain("Build a solid foundation");
  });

  it("uses path title from v2Path.title", async () => {
    await exportV2ScormPackage(MOCK_V2_PATH, { includeQuiz: false });

    const manifestCall = mockFile.mock.calls.find(([name]) => name === "imsmanifest.xml");
    expect(manifestCall).toBeDefined();
    expect(manifestCall[1]).toContain("Blueprint Communication Patterns");
  });

  it("uses query for title when v2Path.title is missing", async () => {
    const pathNoTitle = { ...MOCK_V2_PATH, title: undefined };
    await exportV2ScormPackage(pathNoTitle, { query: "character movement", includeQuiz: false });

    const manifestCall = mockFile.mock.calls.find(([name]) => name === "imsmanifest.xml");
    expect(manifestCall[1]).toContain("UE5 Learning Path: character movement");
  });

  it("renders completionType badges in step HTML", async () => {
    await exportV2ScormPackage(MOCK_V2_PATH, { includeQuiz: false });

    // First step is "watch" type
    const step1 = mockFile.mock.calls.find(([name]) => name === "sco_1.html");
    expect(step1[1]).toContain("cat-watch");

    // Third step (sco_3.html) is Event Dispatchers with "do" type
    const step3 = mockFile.mock.calls.find(([name]) => name === "sco_3.html");
    expect(step3[1]).toContain("cat-do");
  });

  it("falls back to summary when no rich fields present", async () => {
    const minimalPath = {
      title: "Minimal Path",
      sections: [
        {
          title: "Section 1",
          steps: [{ title: "Step 1", summary: "This is the only content." }],
        },
      ],
    };
    await exportV2ScormPackage(minimalPath, { includeQuiz: false });

    const stepCall = mockFile.mock.calls.find(([name]) => name === "sco_1.html");
    expect(stepCall[1]).toContain("This is the only content");
  });

  it("triggers browser download", async () => {
    await exportV2ScormPackage(MOCK_V2_PATH, { includeQuiz: false });

    expect(mockGenerateAsync).toHaveBeenCalledWith({ type: "blob" });
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(document.createElement).toHaveBeenCalledWith("a");
  });
});
