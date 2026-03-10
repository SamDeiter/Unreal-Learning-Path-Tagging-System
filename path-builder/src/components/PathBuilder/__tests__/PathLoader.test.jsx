/**
 * PathLoader.test.jsx — Unit tests for the PathLoader logic-only component
 *
 * PathLoader renders null and drives side effects via usePath() context:
 *   - loadPath(courses) when pendingPath has courses
 *   - setLearningIntent() for intent or goal/skillLevel/timeBudget
 *   - setActivePathId() + localStorage for tracking
 *   - onLoaded() callback to clear pending state
 *   - skip when pendingPath is null or same id
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import PathLoader from "../PathLoader";

// Mock usePath context
const mockLoadPath = vi.fn();
const mockSetLearningIntent = vi.fn();
const mockSetActivePathId = vi.fn();

vi.mock("../../../context/PathContext", () => ({
  usePath: () => ({
    loadPath: mockLoadPath,
    setLearningIntent: mockSetLearningIntent,
    setActivePathId: mockSetActivePathId,
  }),
}));

describe("PathLoader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    cleanup();
  });

  it("calls loadPath when pendingPath has courses", () => {
    const courses = [{ code: "c1", title: "Course 1" }];
    render(<PathLoader pendingPath={{ id: "p1", courses }} onLoaded={vi.fn()} />);
    expect(mockLoadPath).toHaveBeenCalledWith(courses);
  });

  it("calls setLearningIntent when pendingPath has learningIntent", () => {
    const intent = { primaryGoal: "Learn blueprints", skillLevel: "beginner", timeBudget: "2h" };
    render(
      <PathLoader
        pendingPath={{ id: "p2", courses: [{ code: "c1" }], learningIntent: intent }}
        onLoaded={vi.fn()}
      />
    );
    expect(mockSetLearningIntent).toHaveBeenCalledWith(intent);
  });

  it("falls back to goal/skillLevel/timeBudget when learningIntent is absent", () => {
    render(
      <PathLoader
        pendingPath={{
          id: "p3",
          courses: [{ code: "c1" }],
          goal: "Master materials",
          skillLevel: "intermediate",
          timeBudget: "4h",
        }}
        onLoaded={vi.fn()}
      />
    );
    expect(mockSetLearningIntent).toHaveBeenCalledWith({
      primaryGoal: "Master materials",
      skillLevel: "intermediate",
      timeBudget: "4h",
    });
  });

  it("sets activePathId and writes to localStorage", () => {
    render(
      <PathLoader
        pendingPath={{ id: "test-id-42", courses: [{ code: "c1" }] }}
        onLoaded={vi.fn()}
      />
    );
    expect(mockSetActivePathId).toHaveBeenCalledWith("test-id-42");
    expect(localStorage.getItem("ue5_active_path_id")).toBe("test-id-42");
  });

  it("renders nothing (returns null)", () => {
    const { container } = render(
      <PathLoader pendingPath={{ id: "p4", courses: [{ code: "c1" }] }} onLoaded={vi.fn()} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("skips loading when pendingPath is null", () => {
    render(<PathLoader pendingPath={null} onLoaded={vi.fn()} />);
    expect(mockLoadPath).not.toHaveBeenCalled();
    expect(mockSetLearningIntent).not.toHaveBeenCalled();
    expect(mockSetActivePathId).not.toHaveBeenCalled();
  });

  it("calls onLoaded callback after loading", () => {
    const onLoaded = vi.fn();
    render(
      <PathLoader
        pendingPath={{ id: "p5", courses: [{ code: "c1" }] }}
        onLoaded={onLoaded}
      />
    );
    expect(onLoaded).toHaveBeenCalled();
  });
});
