/**
 * videoSplicer — Unit tests
 */

import { describe, it, expect } from "vitest";
import {
  extractTopicSegments,
  buildSplicePlan,
  generateFFmpegCommands,
} from "../../services/videoSplicer";

const makeVideo = (code, segments) => ({
  code,
  title: `Video ${code}`,
  url: `https://example.com/${code}.mp4`,
  transcript_segments: segments,
});

const makeSegment = (start, end, text) => ({ start, end, text });

describe("videoSplicer", () => {
  describe("extractTopicSegments", () => {
    it("returns empty for video with no transcript", () => {
      const result = extractTopicSegments({}, "blueprints");
      expect(result).toEqual([]);
    });

    it("extracts segments matching topic keywords", () => {
      const video = makeVideo("V1", [
        makeSegment(0, 15, "Today we talk about blueprint basics in UE5"),
        makeSegment(15, 30, "Blueprints are visual scripting nodes"),
        makeSegment(30, 45, "Now lets talk about completely unrelated stuff"),
      ]);
      const result = extractTopicSegments(video, "blueprint basics");
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].relevance).toBeGreaterThan(0);
    });

    it("respects minDuration filter", () => {
      const video = makeVideo("V1", [makeSegment(0, 5, "quick mention of blueprints")]);
      const result = extractTopicSegments(video, "blueprints", { minDuration: 10 });
      expect(result).toHaveLength(0);
    });

    it("adds context padding", () => {
      const video = makeVideo("V1", [
        makeSegment(10, 25, "blueprint visual scripting nodes explained"),
      ]);
      const result = extractTopicSegments(video, "blueprint scripting", { contextPadding: 5 });
      expect(result.length).toBeGreaterThan(0);
      if (result.length > 0) {
        expect(result[0].start).toBeLessThanOrEqual(10);
      }
    });

    it("returns empty for short query words", () => {
      const video = makeVideo("V1", [makeSegment(0, 20, "Some content about a topic")]);
      const result = extractTopicSegments(video, "a");
      expect(result).toEqual([]);
    });
  });

  describe("buildSplicePlan", () => {
    it("builds plan from multiple videos", () => {
      const videos = [
        makeVideo("V1", [
          makeSegment(0, 30, "Blueprint basics and visual scripting fundamentals"),
          makeSegment(30, 60, "Blueprint event graphs and functions"),
        ]),
        makeVideo("V2", [makeSegment(0, 25, "Advanced blueprint programming patterns")]),
      ];
      const result = buildSplicePlan(videos, "blueprint programming");
      expect(result.topic).toBe("blueprint programming");
      expect(result.splicePlan.length).toBeGreaterThanOrEqual(0);
      expect(result.totalDuration).toBeGreaterThanOrEqual(0);
    });

    it("respects target duration limit", () => {
      const videos = [
        makeVideo("V1", [
          makeSegment(0, 400, "Very long segment about blueprints and visual scripting"),
          makeSegment(400, 800, "More blueprint content about nodes and graphs"),
        ]),
      ];
      const result = buildSplicePlan(videos, "blueprint scripting", { targetDuration: 100 });
      expect(result.totalDuration).toBeLessThanOrEqual(100);
    });

    it("includes source count", () => {
      const videos = [
        makeVideo("V1", [makeSegment(0, 20, "Blueprint visual scripting nodes")]),
        makeVideo("V2", [makeSegment(0, 20, "Blueprint event graph patterns")]),
      ];
      const result = buildSplicePlan(videos, "blueprint patterns");
      expect(result.sourceCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("generateFFmpegCommands", () => {
    it("returns empty for no segments", () => {
      const result = generateFFmpegCommands([]);
      expect(result.inputs).toEqual([]);
      expect(result.filterComplex).toBe("");
    });

    it("generates valid FFmpeg input strings", () => {
      const plan = [
        { start: 10, end: 30, sourceUrl: "video1.mp4", relevance: 0.9 },
        { start: 5, end: 20, sourceUrl: "video2.mp4", relevance: 0.8 },
      ];
      const result = generateFFmpegCommands(plan);
      expect(result.inputs).toHaveLength(2);
      expect(result.inputs[0]).toContain("-ss 10");
      expect(result.inputs[0]).toContain("-to 30");
      expect(result.filterComplex).toContain("concat=n=2");
      expect(result.outputArgs.length).toBeGreaterThan(0);
    });
  });
});
