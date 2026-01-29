/**
 * PathContext - Manages the learning path assembly state
 *
 * This context provides:
 * - selectedCourses: Ordered array of courses in the path
 * - addCourse/removeCourse/reorderCourses: Path manipulation
 * - pathStats: Computed stats (total time, level range, etc.)
 */
import { createContext, useContext, useReducer, useMemo } from "react";

const PathContext = createContext(null);

// Action types
const ACTIONS = {
  ADD_COURSE: "ADD_COURSE",
  REMOVE_COURSE: "REMOVE_COURSE",
  REORDER_COURSES: "REORDER_COURSES",
  CLEAR_PATH: "CLEAR_PATH",
  LOAD_PATH: "LOAD_PATH",
};

// Reducer for path state management
function pathReducer(state, action) {
  switch (action.type) {
    case ACTIONS.ADD_COURSE:
      // Don't add duplicates
      if (state.courses.find((c) => c.code === action.payload.code)) {
        return state;
      }
      return {
        ...state,
        courses: [...state.courses, action.payload],
      };

    case ACTIONS.REMOVE_COURSE:
      return {
        ...state,
        courses: state.courses.filter((c) => c.code !== action.payload),
      };

    case ACTIONS.REORDER_COURSES:
      return {
        ...state,
        courses: action.payload,
      };

    case ACTIONS.CLEAR_PATH:
      return {
        ...state,
        courses: [],
      };

    case ACTIONS.LOAD_PATH:
      return {
        ...state,
        courses: action.payload,
      };

    default:
      return state;
  }
}

// Initial state
const initialState = {
  courses: [],
};

export function PathProvider({ children }) {
  const [state, dispatch] = useReducer(pathReducer, initialState);

  // Computed path statistics
  const pathStats = useMemo(() => {
    const courses = state.courses;

    if (courses.length === 0) {
      return {
        courseCount: 0,
        estimatedHours: 0,
        levelRange: null,
        topics: [],
      };
    }

    // Calculate stats
    const levels = ["Beginner", "Intermediate", "Advanced"];
    const courseLevels = courses.map((c) => c.tags?.level).filter(Boolean);
    const minLevelIdx = Math.min(
      ...courseLevels.map((l) => levels.indexOf(l)).filter((i) => i >= 0)
    );
    const maxLevelIdx = Math.max(
      ...courseLevels.map((l) => levels.indexOf(l)).filter((i) => i >= 0)
    );

    const topics = [...new Set(courses.map((c) => c.tags?.topic).filter(Boolean))];

    // Estimate ~2 hours per course (rough approximation)
    const estimatedHours = courses.reduce((sum, c) => sum + (c.video_count || 1) * 0.5, 0);

    return {
      courseCount: courses.length,
      estimatedHours: Math.round(estimatedHours),
      levelRange:
        minLevelIdx >= 0 && maxLevelIdx >= 0
          ? `${levels[minLevelIdx]} → ${levels[maxLevelIdx]}`
          : null,
      topics,
    };
  }, [state.courses]);

  // Action creators
  const addCourse = (course) => {
    dispatch({ type: ACTIONS.ADD_COURSE, payload: course });
  };

  const removeCourse = (courseCode) => {
    dispatch({ type: ACTIONS.REMOVE_COURSE, payload: courseCode });
  };

  const reorderCourses = (newOrder) => {
    dispatch({ type: ACTIONS.REORDER_COURSES, payload: newOrder });
  };

  const clearPath = () => {
    dispatch({ type: ACTIONS.CLEAR_PATH });
  };

  const loadPath = (courses) => {
    dispatch({ type: ACTIONS.LOAD_PATH, payload: courses });
  };

  const value = {
    courses: state.courses,
    pathStats,
    addCourse,
    removeCourse,
    reorderCourses,
    clearPath,
    loadPath,
  };

  return <PathContext.Provider value={value}>{children}</PathContext.Provider>;
}

export function usePath() {
  const context = useContext(PathContext);
  if (!context) {
    throw new Error("usePath must be used within a PathProvider");
  }
  return context;
}
