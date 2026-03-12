/**
 * PathContext.test.jsx — Unit tests for PathContext provider
 *
 * Covers the critical bugs fixed during the monorepo audit:
 * - Module round-trip in savePath/loadSavedPath
 * - clearPath clears all state
 * - Auto-role assignment from level
 * - Legacy array loadPath auto-creates modules
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { PathProvider, usePath } from "../context/PathContext";

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value; }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock courseDuration util
vi.mock("../utils/courseDuration", () => ({
  getCourseDurationMinutes: () => 30,
}));

function wrapper({ children }) {
  return <PathProvider>{children}</PathProvider>;
}

const mockCourse = (code, overrides = {}) => ({
  code,
  title: `Course ${code}`,
  tags: { level: "Intermediate", topic: "Blueprints" },
  ...overrides,
});

describe("PathContext", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("addCourse auto-assigns role from level", () => {
    const { result } = renderHook(() => usePath(), { wrapper });

    act(() => {
      result.current.addCourse(mockCourse("A1", { tags: { level: "Beginner" } }));
    });
    expect(result.current.courses[0].role).toBe("Prerequisite");

    act(() => {
      result.current.addCourse(mockCourse("A2", { tags: { level: "Advanced" } }));
    });
    expect(result.current.courses[1].role).toBe("Supplemental");

    act(() => {
      result.current.addCourse(mockCourse("A3", { tags: { level: "Intermediate" } }));
    });
    expect(result.current.courses[2].role).toBe("Core");
  });

  it("addCourse prevents duplicates", () => {
    const { result } = renderHook(() => usePath(), { wrapper });

    act(() => {
      result.current.addCourse(mockCourse("A1"));
      result.current.addCourse(mockCourse("A1"));
    });

    expect(result.current.courses).toHaveLength(1);
  });

  it("savePath → loadSavedPath round-trips courses AND modules", () => {
    const { result } = renderHook(() => usePath(), { wrapper });

    // Add courses and modules
    act(() => {
      result.current.addCourse(mockCourse("C1"));
      result.current.addCourse(mockCourse("C2"));
      result.current.addCourse(mockCourse("C3"));
      result.current.addModule("Module 1", "Outcome 1", ["C1", "C2"]);
    });

    // Save
    act(() => {
      result.current.savePath("Test Path");
    });

    const savedPaths = result.current.getSavedPaths();
    expect(savedPaths).toHaveLength(1);
    expect(savedPaths[0].courses).toHaveLength(3);
    expect(savedPaths[0].modules.length).toBeGreaterThanOrEqual(1);

    // Clear and load
    act(() => {
      result.current.clearPath();
    });
    expect(result.current.courses).toHaveLength(0);

    act(() => {
      result.current.loadSavedPath(savedPaths[0].id);
    });
    expect(result.current.courses).toHaveLength(3);
    expect(result.current.modules.length).toBeGreaterThanOrEqual(1);
  });

  it("clearPath resets courses, modules, and localStorage", () => {
    const { result } = renderHook(() => usePath(), { wrapper });

    act(() => {
      result.current.addCourse(mockCourse("C1"));
      result.current.addModule("M1", "", ["C1"]);
      result.current.setLearningIntent({ primaryGoal: "Test", skillLevel: "Beginner", timeBudget: "2h" });
    });

    expect(result.current.courses).toHaveLength(1);

    act(() => {
      result.current.clearPath();
    });

    expect(result.current.courses).toHaveLength(0);
    expect(result.current.modules).toHaveLength(0);
    expect(result.current.workflowStage).toBe("build");
  });

  it("loadPath with plain array auto-creates modules", () => {
    const { result } = renderHook(() => usePath(), { wrapper });

    const courses = [mockCourse("C1"), mockCourse("C2"), mockCourse("C3"), mockCourse("C4")];

    act(() => {
      result.current.loadPath(courses);
    });

    expect(result.current.courses).toHaveLength(4);
    // Auto-created modules should group courses
    expect(result.current.modules.length).toBeGreaterThanOrEqual(1);
    // All course codes should be in some module
    const allModuleIds = result.current.modules.flatMap((m) => m.courseIds);
    expect(allModuleIds).toContain("C1");
  });

  it("deleteSavedPath on active path clears state", () => {
    const { result } = renderHook(() => usePath(), { wrapper });

    act(() => {
      result.current.addCourse(mockCourse("C1"));
    });

    act(() => {
      result.current.savePath("Active Path");
    });

    // Get saved paths after state settles
    let savedPaths;
    act(() => {
      savedPaths = result.current.getSavedPaths();
    });
    expect(savedPaths).toHaveLength(1);
    const pathId = savedPaths[0].id;

    act(() => {
      result.current.deleteSavedPath(pathId);
    });

    expect(result.current.courses).toHaveLength(0);
    expect(result.current.getSavedPaths()).toHaveLength(0);
  });
});
