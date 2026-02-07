/**
 * TagDataContext - Manages tag data and cross-view selection state
 *
 * This context provides:
 * - tags: Array of all tags with counts
 * - edges: Array of tag connections with weights
 * - derivedData: Pre-computed stats (degree, total weight, etc.)
 * - selectedTagId: Currently selected tag (synced across views)
 *
 * All views derive their data from this single source of truth.
 */
import { createContext, useContext, useState, useMemo } from "react";

const TagDataContext = createContext(null);

/**
 * Validate and normalize a course, applying defaults for missing fields
 */
function validateCourse(course) {
  const validated = { ...course };
  
  // Apply defaults for missing required fields
  if (!validated.duration_minutes) {
    validated.duration_minutes = 15; // Default 15 min
    validated._durationEstimated = true;
  }
  
  if (!validated.topic) {
    validated.topic = "General";
    validated._topicInferred = true;
  }
  
  if (!validated.video_url && !validated.url) {
    // Try to construct from code if possible
    validated._missingUrl = true;
  }
  
  // Track completeness
  const missingFields = [];
  if (!course.duration_minutes) missingFields.push("duration");
  if (!course.topic) missingFields.push("topic");
  if (!course.video_url && !course.url) missingFields.push("url");
  
  validated._isComplete = missingFields.length === 0;
  validated._missingFields = missingFields;
  
  return validated;
}

export function TagDataProvider({ children, tags = [], edges = [], courses = [] }) {
  // Validate all courses on mount
  const validatedCourses = useMemo(() => {
    return courses.map(validateCourse);
  }, [courses]);
  
  // Selection state - synced across all tag views
  const [selectedTagId, setSelectedTagId] = useState(null);

  // Pre-compute derived data for performance
  const derivedData = useMemo(() => {
    // Build adjacency map for quick lookups
    const adjacencyMap = new Map();

    edges.forEach((edge) => {
      // Add forward edge
      if (!adjacencyMap.has(edge.sourceTagId)) {
        adjacencyMap.set(edge.sourceTagId, []);
      }
      adjacencyMap.get(edge.sourceTagId).push({
        targetId: edge.targetTagId,
        weight: edge.weight,
      });

      // Add reverse edge (bidirectional)
      if (!adjacencyMap.has(edge.targetTagId)) {
        adjacencyMap.set(edge.targetTagId, []);
      }
      adjacencyMap.get(edge.targetTagId).push({
        targetId: edge.sourceTagId,
        weight: edge.weight,
      });
    });

    // Compute tag stats
    const tagStats = new Map();

    tags.forEach((tag) => {
      const connections = adjacencyMap.get(tag.id) || [];
      const degree = connections.length;
      const totalWeight = connections.reduce((sum, c) => sum + c.weight, 0);

      tagStats.set(tag.id, {
        ...tag,
        degree,
        totalWeight,
        connections,
      });
    });

    // Find max values for normalization
    const maxCount = Math.max(...tags.map((t) => t.count), 1);
    const maxDegree = Math.max(...[...tagStats.values()].map((t) => t.degree), 1);
    const maxWeight = Math.max(...[...tagStats.values()].map((t) => t.totalWeight), 1);

    return {
      adjacencyMap,
      tagStats,
      maxCount,
      maxDegree,
      maxWeight,
    };
  }, [tags, edges]);

  // Get enriched tags with computed stats
  const enrichedTags = useMemo(() => {
    return tags.map((tag) => ({
      ...tag,
      ...(derivedData.tagStats.get(tag.id) || {}),
    }));
  }, [tags, derivedData]);

  // Get connections for a specific tag
  const getTagConnections = (tagId) => {
    return derivedData.adjacencyMap.get(tagId) || [];
  };

  // Get related tags sorted by weight
  const getRelatedTags = (tagId, limit = 20) => {
    const connections = getTagConnections(tagId);
    return connections
      .sort((a, b) => b.weight - a.weight)
      .slice(0, limit)
      .map((conn) => ({
        ...derivedData.tagStats.get(conn.targetId),
        connectionWeight: conn.weight,
      }))
      .filter(Boolean);
  };

  const value = {
    tags,
    edges,
    courses: validatedCourses,
    enrichedTags,
    selectedTagId,
    setSelectedTagId,
    derivedData,
    getTagConnections,
    getRelatedTags,
  };

  return <TagDataContext.Provider value={value}>{children}</TagDataContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTagData() {
  const context = useContext(TagDataContext);
  if (!context) {
    throw new Error("useTagData must be used within a TagDataProvider");
  }
  return context;
}
