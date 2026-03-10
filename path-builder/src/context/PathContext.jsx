/**
 * PathContext - Manages the learning path assembly state
 *
 * This context provides:
 * - selectedCourses: Ordered array of courses in the path
 * - addCourse/removeCourse/reorderCourses: Path manipulation
 * - pathStats: Computed stats (total time, level range, etc.)
 */
import { createContext, useContext, useReducer, useMemo, useState, useEffect } from "react";
import { getCourseDurationMinutes } from "../utils/courseDuration";

const PathContext = createContext(null);

// Action types
const ACTIONS = {
  ADD_COURSE: "ADD_COURSE",
  REMOVE_COURSE: "REMOVE_COURSE",
  REORDER_COURSES: "REORDER_COURSES",
  UPDATE_COURSE_META: "UPDATE_COURSE_META",
  SET_LEARNING_INTENT: "SET_LEARNING_INTENT",
  CLEAR_PATH: "CLEAR_PATH",
  LOAD_PATH: "LOAD_PATH",
};

// Reducer for path state management
function pathReducer(state, action) {
  switch (action.type) {
    case ACTIONS.ADD_COURSE: {
      // Don't add duplicates
      if (state.courses.find((c) => c.code === action.payload.code)) {
        return state;
      }
      // Auto-categorize role from level if not explicitly set
      const autoRole = (() => {
        if (action.payload.role) return action.payload.role;
        const level = action.payload.tags?.level;
        if (level === "Beginner" || level === "Foundation") return "Prerequisite";
        if (level === "Advanced") return "Supplemental";
        return "Core";
      })();
      return {
        ...state,
        courses: [
          ...state.courses,
          {
            ...action.payload,
            role: autoRole,
            weight: action.payload.weight || "Medium",
            why: action.payload.why || "Selected from library",
          },
        ],
      };
    }

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

    case ACTIONS.UPDATE_COURSE_META:
      return {
        ...state,
        courses: state.courses.map((c) =>
          c.code === action.payload.code ? { ...c, ...action.payload.meta } : c
        ),
      };

    case ACTIONS.SET_LEARNING_INTENT:
      return {
        ...state,
        learningIntent: { ...state.learningIntent, ...action.payload },
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
  learningIntent: {
    primaryGoal: "",
    skillLevel: "",
    timeBudget: "",
  },
};

const DRAFT_KEY = "ue5-path-draft";

// Load draft from localStorage (for session restore)
function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const draft = JSON.parse(raw);
      return {
        courses: Array.isArray(draft.courses) ? draft.courses : [],
        learningIntent: draft.learningIntent || initialState.learningIntent,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function PathProvider({ children }) {
  const [state, dispatch] = useReducer(pathReducer, initialState, () => {
    // Initialize from draft if available
    return loadDraft() || initialState;
  });

  // Track which saved path is being edited (so we can update it in-place)
  const [activePathId, setActivePathId] = useState(
    () => localStorage.getItem("ue5_active_path_id") || null
  );

  // --- Auto-save draft to localStorage ---
  useEffect(() => {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          courses: state.courses,
          learningIntent: state.learningIntent,
        })
      );

      // Also update the named saved path if one is active
      if (activePathId) {
        const STORAGE_KEY = "ue5-saved-paths";
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const paths = JSON.parse(saved);
          const idx = paths.findIndex((p) => p.id === activePathId);
          if (idx !== -1) {
            paths[idx].courses = state.courses;
            paths[idx].learningIntent = state.learningIntent;
            paths[idx].courseCount = state.courses.length;
            paths[idx].savedAt = new Date().toISOString();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
          }
        }
      }
    } catch {
      /* localStorage full or unavailable */
    }
  }, [state.courses, state.learningIntent, activePathId]);

  // Persona state — persisted in localStorage
  const [activePersonaId, setActivePersonaIdState] = useState(
    () => localStorage.getItem("ue5_persona_id") || null
  );

  const setActivePersonaId = (id) => {
    setActivePersonaIdState(id);
    if (id) {
      localStorage.setItem("ue5_persona_id", id);
    } else {
      localStorage.removeItem("ue5_persona_id");
    }
  };

  // Computed path statistics
  const pathStats = useMemo(() => {
    const courses = state.courses;

    if (courses.length === 0) {
      return {
        courseCount: 0,
        estimatedHours: 0,
        levelRange: null,
        topics: [],
        distribution: { Core: 0, Supplemental: 0, Prerequisite: 0 },
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

    // Estimate time based on weight
    const weightMultipliers = { High: 1.2, Medium: 1.0, Low: 0.5 };
    const estimatedHours = courses.reduce((sum, c) => {
      const multiplier = weightMultipliers[c.weight || "Medium"] || 1.0;
      const totalMinutes = getCourseDurationMinutes(c);
      const baseTime = totalMinutes / 60;
      return sum + baseTime * multiplier;
    }, 0);

    // Distribution
    const distribution = courses.reduce(
      (acc, c) => {
        acc[c.role || "Core"] = (acc[c.role || "Core"] || 0) + 1;
        return acc;
      },
      { Core: 0, Supplemental: 0, Prerequisite: 0 }
    );

    return {
      courseCount: courses.length,
      estimatedHours: Math.round(estimatedHours),
      levelRange:
        minLevelIdx >= 0 && maxLevelIdx >= 0
          ? `${levels[minLevelIdx]} → ${levels[maxLevelIdx]}`
          : null,
      topics,
      distribution,
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

  const updateCourseMeta = (code, meta) => {
    dispatch({ type: ACTIONS.UPDATE_COURSE_META, payload: { code, meta } });
  };

  const setLearningIntent = (intent) => {
    dispatch({ type: ACTIONS.SET_LEARNING_INTENT, payload: intent });
  };

  const clearPath = () => {
    dispatch({ type: ACTIONS.CLEAR_PATH });
    setActivePathId(null);
    localStorage.removeItem("ue5_active_path_id");
    localStorage.removeItem(DRAFT_KEY);
  };

  const loadPath = (courses) => {
    dispatch({ type: ACTIONS.LOAD_PATH, payload: courses });
  };

  // --- localStorage Persistence ---
  const STORAGE_KEY = "ue5-saved-paths";

  const getSavedPaths = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Error loading saved paths:", e);
      return [];
    }
  };

  const savePath = (name) => {
    if (state.courses.length === 0) return false;

    const savedPaths = getSavedPaths();
    const newPath = {
      id: `path-${Date.now()}`,
      name: name || state.learningIntent.primaryGoal || "Untitled Path",
      courses: state.courses,
      learningIntent: state.learningIntent,
      savedAt: new Date().toISOString(),
      courseCount: state.courses.length,
    };

    savedPaths.unshift(newPath); // Add to front
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedPaths.slice(0, 20))); // Keep 20 max
    setActivePathId(newPath.id);
    localStorage.setItem("ue5_active_path_id", newPath.id);
    return true;
  };

  const loadSavedPath = (pathId) => {
    const savedPaths = getSavedPaths();
    const found = savedPaths.find((p) => p.id === pathId);
    if (found) {
      dispatch({ type: ACTIONS.LOAD_PATH, payload: found.courses });
      dispatch({ type: ACTIONS.SET_LEARNING_INTENT, payload: found.learningIntent });
      setActivePathId(pathId);
      localStorage.setItem("ue5_active_path_id", pathId);
      return true;
    }
    return false;
  };

  const deleteSavedPath = (pathId) => {
    const savedPaths = getSavedPaths().filter((p) => p.id !== pathId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedPaths));
  };

  const value = {
    courses: state.courses,
    learningIntent: state.learningIntent,
    pathStats,
    addCourse,
    removeCourse,
    reorderCourses,
    updateCourseMeta,
    setLearningIntent,
    clearPath,
    loadPath,
    // Persistence
    savePath,
    getSavedPaths,
    loadSavedPath,
    deleteSavedPath,
    // Persona
    activePersonaId,
    setActivePersonaId,
    // Active path tracking
    activePathId,
    setActivePathId,
  };

  return <PathContext.Provider value={value}>{children}</PathContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePath() {
  const context = useContext(PathContext);
  if (!context) {
    throw new Error("usePath must be used within a PathProvider");
  }
  return context;
}
