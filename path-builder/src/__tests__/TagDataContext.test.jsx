/**
 * TagDataContext.test.jsx — Unit tests for TagDataContext provider
 *
 * Covers the critical bug fixed during the monorepo audit:
 * - getRelatedTags must NOT mutate the adjacency map
 * - Calling getRelatedTags twice returns consistent results
 * - derivedData computes correct stats
 */
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { TagDataProvider, useTagData } from "../context/TagDataContext";

const sampleTags = [
  { id: "tag-1", name: "Blueprints", count: 10 },
  { id: "tag-2", name: "C++", count: 8 },
  { id: "tag-3", name: "Materials", count: 5 },
];

const sampleEdges = [
  { sourceTagId: "tag-1", targetTagId: "tag-2", weight: 7 },
  { sourceTagId: "tag-1", targetTagId: "tag-3", weight: 3 },
  { sourceTagId: "tag-2", targetTagId: "tag-3", weight: 2 },
];

function wrapper({ children }) {
  return (
    <TagDataProvider tags={sampleTags} edges={sampleEdges}>
      {children}
    </TagDataProvider>
  );
}

describe("TagDataContext", () => {
  it("getRelatedTags does NOT mutate the adjacency map", () => {
    const { result } = renderHook(() => useTagData(), { wrapper });

    // Get related tags twice — the order should be consistent
    const first = result.current.getRelatedTags("tag-1");
    const second = result.current.getRelatedTags("tag-1");

    expect(first).toEqual(second);
    expect(first).toHaveLength(2);

    // Verify the underlying adjacency map is unchanged (not sorted in-place)
    const rawConnections = result.current.derivedData.adjacencyMap.get("tag-1");
    // Raw connections should still be in insertion order (tag-2, tag-3)
    expect(rawConnections[0].targetId).toBe("tag-2");
    expect(rawConnections[1].targetId).toBe("tag-3");
  });

  it("getRelatedTags returns sorted by weight descending", () => {
    const { result } = renderHook(() => useTagData(), { wrapper });

    const related = result.current.getRelatedTags("tag-1");
    expect(related[0].connectionWeight).toBeGreaterThanOrEqual(related[1].connectionWeight);
  });

  it("derivedData computes correct tag stats", () => {
    const { result } = renderHook(() => useTagData(), { wrapper });

    const { tagStats } = result.current.derivedData;
    // tag-1 connects to tag-2 and tag-3 → degree 2
    expect(tagStats.get("tag-1").degree).toBe(2);
    expect(tagStats.get("tag-1").totalWeight).toBe(10); // 7 + 3
    // tag-3 connects to tag-1 and tag-2 → degree 2
    expect(tagStats.get("tag-3").degree).toBe(2);
    expect(tagStats.get("tag-3").totalWeight).toBe(5); // 3 + 2
  });

  it("enrichedTags includes computed stats", () => {
    const { result } = renderHook(() => useTagData(), { wrapper });

    const blueprints = result.current.enrichedTags.find((t) => t.id === "tag-1");
    expect(blueprints).toBeDefined();
    expect(blueprints.degree).toBe(2);
    expect(blueprints.totalWeight).toBe(10);
  });

  it("getTagConnections returns correct connections", () => {
    const { result } = renderHook(() => useTagData(), { wrapper });

    const connections = result.current.getTagConnections("tag-2");
    // tag-2 connects to tag-1 (via source) and tag-3 (via source)
    // Plus tag-1 (via reverse of edge 1)
    expect(connections.length).toBe(2);
  });
});
