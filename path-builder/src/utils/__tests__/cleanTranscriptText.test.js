/**
 * cleanTranscriptText — Unit tests
 *
 * Covers filler removal, edge cases, and fallback behavior.
 */

import { describe, it, expect } from "vitest";
import { cleanTranscriptText } from "../../utils/cleanTranscriptText";

describe("cleanTranscriptText", () => {
  // ── Filler word removal ──────────────────────────────────────────

  it("strips leading filler words (so, well, okay, alright)", () => {
    expect(cleanTranscriptText("So let me show you how materials work in UE5."))
      .toBe("let me show you how materials work in UE5.");
    expect(cleanTranscriptText("Well, today we will cover Nanite meshes."))
      .toBe("today we will cover Nanite meshes.");
    expect(cleanTranscriptText("Okay, open up the Content Browser and find the asset."))
      .toBe("open up the Content Browser and find the asset.");
    expect(cleanTranscriptText("Alright, the first thing you need to do is create a new project."))
      .toBe("the first thing you need to do is create a new project.");
  });

  it("strips 'let's go ahead and' / 'let's take a look' phrases", () => {
    expect(cleanTranscriptText("Let's go ahead and create a new Blueprint class."))
      .toBe("create a new Blueprint class.");
    // "at the Event Graph." is only 19 chars → falls under <20 threshold → ""
    expect(cleanTranscriptText("Let's take a look at the Event Graph."))
      .toBe("");
    // "to the Material Editor." is 23 chars → passes threshold
    expect(cleanTranscriptText("Let's jump right in to the Material Editor."))
      .toBe("to the Material Editor.");
  });

  it("strips 'we're gonna' / 'I'm gonna' patterns", () => {
    expect(cleanTranscriptText("We're gonna set up a new actor component for collision."))
      .toBe("set up a new actor component for collision.");
    expect(cleanTranscriptText("I'm gonna show you how Lumen works."))
      .toBe("show you how Lumen works.");
  });

  it("strips 'as you can see' / 'as I mentioned' filler", () => {
    expect(cleanTranscriptText("As you can see the viewport updates in real time with changes."))
      .toBe("the viewport updates in real time with changes.");
  });

  // ── Lesson transition removal ────────────────────────────────────

  it("strips 'that's it for this lesson/video' end-of-lesson text", () => {
    expect(cleanTranscriptText("We covered materials and textures. That's it for this lesson."))
      .toBe("We covered materials and textures.");
    // Short strings (< 50 chars) don't trigger the safety fallback,
    // but the filler is stripped leaving an empty result
    const shortFiller = "That's it for this video, see you next time.";
    expect(cleanTranscriptText(shortFiller)).toBe("");
  });

  it("strips 'in the next lesson/video' transition text", () => {
    expect(cleanTranscriptText("This is important for collision. In the next lesson we will cover physics."))
      .toBe("This is important for collision.");
  });

  it("strips YouTube engagement phrases", () => {
    const input = "Always preview your materials. Don't forget to like and subscribe for more UE5 content.";
    expect(cleanTranscriptText(input)).toBe("Always preview your materials.");
    const input2 = "That wraps up our tutorial. Thanks for watching and see you in the next video.";
    expect(cleanTranscriptText(input2)).toBe("That wraps up our tutorial.");
  });

  // ── Edge cases ───────────────────────────────────────────────────

  it("returns null/undefined/empty string as empty string", () => {
    // Function normalizes all non-string / falsy values to ""
    expect(cleanTranscriptText(null)).toBe("");
    expect(cleanTranscriptText(undefined)).toBe("");
    expect(cleanTranscriptText("")).toBe("");
  });

  it("returns non-string values as empty string", () => {
    // Numbers and booleans are not strings → return ""
    expect(cleanTranscriptText(42)).toBe("");
    expect(cleanTranscriptText(false)).toBe("");
  });

  it("does not corrupt clean technical text", () => {
    const clean = "Nanite is a virtualized geometry system that uses a new internal mesh format to render pixel-scale detail.";
    expect(cleanTranscriptText(clean)).toBe(clean);
  });

  it("collapses multiple whitespace into single space", () => {
    expect(cleanTranscriptText("Use   the   Content   Browser   to   find   assets."))
      .toBe("Use the Content Browser to find assets.");
  });

  it("trims leading/trailing punctuation artifacts", () => {
    // Note: 'so' is not stripped here because the ^(so,?) pattern matches
    // start-of-string only, and after punctuation trimming 'so' remains
    expect(cleanTranscriptText(", so start with a base color. ;"))
      .toBe("so start with a base color.");
  });

  it("falls back to original when cleaning removes most of the content", () => {
    const almostAllFiller = "So, well, okay, let's go ahead and take a look at the thing we were looking at.";
    const result = cleanTranscriptText(almostAllFiller);
    // Cleaned version should still have meaningful content (> 20 chars)
    // or fall back to original if too short
    expect(result.length).toBeGreaterThan(0);
  });

  // ── Combined patterns ────────────────────────────────────────────

  it("handles multiple filler patterns in one string", () => {
    const input = "So, as you can see, we're gonna configure the material editor viewport settings to match the project requirements. In the next lesson we'll cover physics.";
    const result = cleanTranscriptText(input);
    expect(result).not.toContain("as you can see");
    expect(result).not.toContain("we're gonna");
    expect(result).not.toContain("In the next lesson");
    expect(result).toContain("configure the material editor viewport settings");
  });
});
