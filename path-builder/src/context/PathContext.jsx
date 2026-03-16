/**
 * PathContext - Manages the learning path assembly state
 *
 * This context provides:
 * - selectedCourses: Ordered array of courses in the path
 * - addCourse/removeCourse/reorderCourses: Path manipulation
 * - pathStats: Computed stats (total time, level range, etc.)
 */
import { createContext, useContext, useReducer, useMemo, useCallback, useState, useEffect } from "react";
import { getCourseDurationMinutes } from "../utils/courseDuration";

const PathContext = createContext(null);

// Workflow stages (Curate+Arrange merged into "build")
const WORKFLOW_STAGES = ["build", "review", "export"];

// Action types
const ACTIONS = {
  ADD_COURSE: "ADD_COURSE",
  REMOVE_COURSE: "REMOVE_COURSE",
  REORDER_COURSES: "REORDER_COURSES",
  UPDATE_COURSE_META: "UPDATE_COURSE_META",
  SET_LEARNING_INTENT: "SET_LEARNING_INTENT",
  CLEAR_PATH: "CLEAR_PATH",
  LOAD_PATH: "LOAD_PATH",
  SET_WORKFLOW_STAGE: "SET_WORKFLOW_STAGE",
  // Milestone modules
  ADD_MODULE: "ADD_MODULE",
  RENAME_MODULE: "RENAME_MODULE",
  REMOVE_MODULE: "REMOVE_MODULE",
  MOVE_COURSE_TO_MODULE: "MOVE_COURSE_TO_MODULE",
  REORDER_MODULES: "REORDER_MODULES",
  SET_MODULE_VERIFICATION: "SET_MODULE_VERIFICATION",
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

    case ACTIONS.REMOVE_COURSE: {
      const removedCode = action.payload;
      // Also remove from any module's courseIds
      const cleanedModules = state.modules.map((m) => ({
        ...m,
        courseIds: m.courseIds.filter((id) => id !== removedCode),
      }));
      return {
        ...state,
        courses: state.courses.filter((c) => c.code !== removedCode),
        modules: cleanedModules,
      };
    }

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
        modules: [],
        learningIntent: initialState.learningIntent,
      };

    case ACTIONS.LOAD_PATH:
      return {
        ...state,
        courses: action.payload.courses || action.payload,
        modules: action.payload.modules || [],
      };

    case ACTIONS.SET_WORKFLOW_STAGE:
      return {
        ...state,
        workflowStage: action.payload,
      };

    // ── Milestone Module Actions ────────────────────────────────────────
    case ACTIONS.ADD_MODULE:
      return {
        ...state,
        modules: [
          ...state.modules,
          {
            id: `mod-${Date.now()}`,
            title: action.payload.title || `Milestone ${state.modules.length + 1}`,
            outcome: action.payload.outcome || "",
            courseIds: action.payload.courseIds || [],
            kstEnabled: false,
            bktEnabled: false,
            verificationPrompt: action.payload.verificationPrompt || "",
            exitCondition: action.payload.exitCondition || "quiz",
          },
        ],
      };

    case ACTIONS.RENAME_MODULE:
      return {
        ...state,
        modules: state.modules.map((m) =>
          m.id === action.payload.moduleId
            ? { ...m, title: action.payload.title ?? m.title, outcome: action.payload.outcome ?? m.outcome }
            : m
        ),
      };

    case ACTIONS.SET_MODULE_VERIFICATION:
      return {
        ...state,
        modules: state.modules.map((m) =>
          m.id === action.payload.moduleId
            ? {
                ...m,
                verificationPrompt: action.payload.verificationPrompt ?? m.verificationPrompt,
                exitCondition: action.payload.exitCondition ?? m.exitCondition,
              }
            : m
        ),
      };

    case ACTIONS.TOGGLE_MODULE_FLAG:
      return {
        ...state,
        modules: state.modules.map((m) =>
          m.id === action.payload.moduleId
            ? { ...m, [action.payload.flag]: !m[action.payload.flag] }
            : m
        ),
      };

    case ACTIONS.REMOVE_MODULE:
      return {
        ...state,
        modules: state.modules.filter((m) => m.id !== action.payload),
      };

    case ACTIONS.MOVE_COURSE_TO_MODULE: {
      const { courseCode, targetModuleId } = action.payload;
      // Remove course from all modules first, then add to target
      const updatedModules = state.modules.map((m) => ({
        ...m,
        courseIds: m.courseIds.filter((id) => id !== courseCode),
      }));
      // If targetModuleId is null, course becomes ungrouped
      if (targetModuleId) {
        const targetIdx = updatedModules.findIndex((m) => m.id === targetModuleId);
        if (targetIdx !== -1) {
          updatedModules[targetIdx] = {
            ...updatedModules[targetIdx],
            courseIds: [...updatedModules[targetIdx].courseIds, courseCode],
          };
        }
      }
      return { ...state, modules: updatedModules };
    }

    case ACTIONS.REORDER_MODULES:
      return {
        ...state,
        modules: action.payload,
      };

    default:
      return state;
  }
}

// Initial state
const initialState = {
  courses: [],
  modules: [], // Milestone grouping: [{ id, title, outcome, courseIds }]
  learningIntent: {
    primaryGoal: "",
    skillLevel: "",
    timeBudget: "",
  },
  workflowStage: "build",
};

const DRAFT_KEY = "ue5-path-draft";



// Load draft from localStorage (for session restore)
function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const draft = JSON.parse(raw);
      // Migrate legacy stage names
      let stage = draft.workflowStage || "build";
      if (stage === "curate" || stage === "arrange") stage = "build";
      const courses = Array.isArray(draft.courses) ? draft.courses : [];
      // Only load modules that were explicitly created by the user
      const modules = Array.isArray(draft.modules) ? draft.modules : [];
      return {
        courses,
        modules,
        learningIntent: draft.learningIntent || initialState.learningIntent,
        workflowStage: stage,
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
          modules: state.modules,
          learningIntent: state.learningIntent,
          workflowStage: state.workflowStage,
        })
      );

      // Also update the named saved path if one is active
      if (activePathId) {
        const STORAGE_KEY = "ue5_saved_paths";
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const paths = JSON.parse(saved);
          const idx = paths.findIndex((p) => p.id === activePathId);
          if (idx !== -1) {
            paths[idx].courses = state.courses;
            paths[idx].modules = state.modules;
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
  }, [state.courses, state.modules, state.learningIntent, state.workflowStage, activePathId]);

  // Persona state — persisted in localStorage
  const [activePersonaId, setActivePersonaIdState] = useState(
    () => localStorage.getItem("ue5_persona_id") || null
  );

  const setActivePersonaId = useCallback((id) => {
    setActivePersonaIdState(id);
    if (id) {
      localStorage.setItem("ue5_persona_id", id);
    } else {
      localStorage.removeItem("ue5_persona_id");
    }
  }, []);

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

  // Verification stats — how many steps have been verified/rejected
  const verificationStats = useMemo(() => {
    const courses = state.courses;
    const verified = courses.filter(c => c.verified === 'verified').length;
    const rejected = courses.filter(c => c.verified === 'rejected').length;
    const unverified = courses.length - verified - rejected;
    return { verified, rejected, unverified, total: courses.length };
  }, [state.courses]);

  // Action creators — wrapped in useCallback for referential stability
  const addCourse = useCallback((course) => {
    dispatch({ type: ACTIONS.ADD_COURSE, payload: course });
  }, [dispatch]);

  const removeCourse = useCallback((courseCode) => {
    dispatch({ type: ACTIONS.REMOVE_COURSE, payload: courseCode });
  }, [dispatch]);

  const reorderCourses = useCallback((newOrder) => {
    dispatch({ type: ACTIONS.REORDER_COURSES, payload: newOrder });
  }, [dispatch]);

  const updateCourseMeta = useCallback((code, meta) => {
    dispatch({ type: ACTIONS.UPDATE_COURSE_META, payload: { code, meta } });
  }, [dispatch]);

  const setLearningIntent = useCallback((intent) => {
    dispatch({ type: ACTIONS.SET_LEARNING_INTENT, payload: intent });
  }, [dispatch]);

  const clearPath = useCallback(() => {
    dispatch({ type: ACTIONS.CLEAR_PATH });
    dispatch({ type: ACTIONS.SET_WORKFLOW_STAGE, payload: "build" });
    setActivePathId(null);
    localStorage.removeItem("ue5_active_path_id");
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem("ue5_wizard_intent");
  }, [dispatch, setActivePathId]);

  const loadPath = useCallback((coursesOrPayload) => {
    // Accept either a plain array (legacy) or { courses, modules } object
    if (Array.isArray(coursesOrPayload)) {
      dispatch({ type: ACTIONS.LOAD_PATH, payload: { courses: coursesOrPayload, modules: [] } });
    } else {
      dispatch({ type: ACTIONS.LOAD_PATH, payload: coursesOrPayload });
    }
  }, [dispatch]);

  const setWorkflowStage = useCallback((stage) => {
    if (WORKFLOW_STAGES.includes(stage)) {
      dispatch({ type: ACTIONS.SET_WORKFLOW_STAGE, payload: stage });
    }
  }, [dispatch]);

  // --- localStorage Persistence ---
  const STORAGE_KEY = "ue5_saved_paths";

  const getSavedPaths = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Error loading saved paths:", e);
      return [];
    }
  }, []);

  const savePath = useCallback((name) => {
    if (state.courses.length === 0) return false;

    const savedPaths = getSavedPaths();
    const newPath = {
      id: `path-${Date.now()}`,
      name: name || state.learningIntent.primaryGoal || "Untitled Path",
      courses: state.courses,
      modules: state.modules,
      learningIntent: state.learningIntent,
      savedAt: new Date().toISOString(),
      courseCount: state.courses.length,
    };

    savedPaths.unshift(newPath); // Add to front
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedPaths.slice(0, 20))); // Keep 20 max
    setActivePathId(newPath.id);
    localStorage.setItem("ue5_active_path_id", newPath.id);
    return true;
  }, [state.courses, state.modules, state.learningIntent, getSavedPaths, setActivePathId]);

  const loadSavedPath = useCallback((pathId) => {
    const savedPaths = getSavedPaths();
    const found = savedPaths.find((p) => p.id === pathId);
    if (found) {
      dispatch({ type: ACTIONS.LOAD_PATH, payload: { courses: found.courses, modules: found.modules || [] } });
      if (found.learningIntent) {
        dispatch({ type: ACTIONS.SET_LEARNING_INTENT, payload: found.learningIntent });
      }
      setActivePathId(pathId);
      localStorage.setItem("ue5_active_path_id", pathId);
      return true;
    }
    return false;
  }, [dispatch, getSavedPaths, setActivePathId]);

  const deleteSavedPath = useCallback((pathId) => {
    const savedPaths = getSavedPaths().filter((p) => p.id !== pathId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedPaths));
    // If the deleted path was the active one, clear the current path state
    if (activePathId === pathId) {
      clearPath();
    }
  }, [activePathId, clearPath, getSavedPaths]);

  // ── Module action creators ─────────────────────────────────────────────
  const addModule = useCallback((title, outcome = "", courseIds = []) => {
    dispatch({ type: ACTIONS.ADD_MODULE, payload: { title, outcome, courseIds } });
  }, [dispatch]);

  const renameModule = useCallback((moduleId, title, outcome) => {
    dispatch({ type: ACTIONS.RENAME_MODULE, payload: { moduleId, title, outcome } });
  }, [dispatch]);

  const removeModule = useCallback((moduleId) => {
    dispatch({ type: ACTIONS.REMOVE_MODULE, payload: moduleId });
  }, [dispatch]);

  const moveCourseToModule = useCallback((courseCode, targetModuleId) => {
    dispatch({ type: ACTIONS.MOVE_COURSE_TO_MODULE, payload: { courseCode, targetModuleId } });
  }, [dispatch]);

  const reorderModules = useCallback((newModules) => {
    dispatch({ type: ACTIONS.REORDER_MODULES, payload: newModules });
  }, [dispatch]);

  const toggleModuleFlag = useCallback((moduleId, flag) => {
    dispatch({ type: ACTIONS.TOGGLE_MODULE_FLAG, payload: { moduleId, flag } });
  }, [dispatch]);
  
  const addAssessment = useCallback((moduleId = null) => {
    const id = `assess-${Date.now()}`;
    const assessment = {
      code: id,
      title: "Practical Assessment",
      type: "assessment",
      tags: { level: "Core", topics: ["Testing"], duration: 30 },
      duration: "30 mins",
      outcome: "Verify practical skills via Unreal Automation Framework",
      role: "Core",
      weight: "High",
      why: "Evaluate learner mastery of module objectives.",
      ueTestPath: ""
    };
    
    dispatch({ type: ACTIONS.ADD_COURSE, payload: assessment });
    
    if (moduleId) {
      // Need a slight timeout to ensure the course is added before moving it
      // but in useReducer it's synchronous so we can't dispatch twice back-to-back cleanly
      // within the same tick if state depends on previous state. Wait, we can.
      dispatch({ type: ACTIONS.MOVE_COURSE_TO_MODULE, payload: { courseCode: id, targetModuleId: moduleId } });
    }
  }, [dispatch]);

  const addTransition = useCallback((moduleId = null) => {
    const id = `transition-${Date.now()}`;
    const transition = {
      code: id,
      title: "AI Narrative Transition",
      type: "ai_generation",
      tags: { level: "Core", topics: ["Transition"], duration: 5 },
      duration: "5 mins",
      outcome: "Tie topics together conceptually",
      role: "Transition",
      weight: "Medium",
      source: "ai",
      why: "Generated narrative to connect prior learning with upcoming concepts.",
      description: "This is an AI-generated transitional element to bridge the gap between concepts."
    };
    
    dispatch({ type: ACTIONS.ADD_COURSE, payload: transition });
    
    if (moduleId) {
      dispatch({ type: ACTIONS.MOVE_COURSE_TO_MODULE, payload: { courseCode: id, targetModuleId: moduleId } });
    }
  }, [dispatch]);

  const setModuleVerification = useCallback((moduleId, { verificationPrompt, exitCondition }) => {
    dispatch({
      type: ACTIONS.SET_MODULE_VERIFICATION,
      payload: { moduleId, verificationPrompt, exitCondition },
    });
  }, [dispatch]);

  // Computed: courses not assigned to any module
  const ungroupedCourses = useMemo(() => {
    const assignedCodes = new Set(state.modules.flatMap((m) => m.courseIds));
    return state.courses.filter((c) => !assignedCodes.has(c.code));
  }, [state.courses, state.modules]);

  const value = useMemo(() => ({
    courses: state.courses,
    modules: state.modules,
    ungroupedCourses,
    learningIntent: state.learningIntent,
    pathStats,
    verificationStats,
    addCourse,
    removeCourse,
    reorderCourses,
    updateCourseMeta,
    setLearningIntent,
    clearPath,
    loadPath,
    // Module actions
    addModule,
    renameModule,
    removeModule,
    moveCourseToModule,
    reorderModules,
    toggleModuleFlag,
    addAssessment,
    addTransition,
    setModuleVerification,
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
    // Workflow
    workflowStage: state.workflowStage,
    setWorkflowStage,
    WORKFLOW_STAGES,
  }), [
    state.courses, state.modules, state.learningIntent, state.workflowStage,
    ungroupedCourses, pathStats, verificationStats,
    addCourse, removeCourse, reorderCourses, updateCourseMeta, setLearningIntent,
    clearPath, loadPath, addModule, renameModule, removeModule,
    moveCourseToModule, reorderModules, toggleModuleFlag, addAssessment, addTransition, setModuleVerification, savePath, getSavedPaths, loadSavedPath,
    deleteSavedPath, activePersonaId, setActivePersonaId, activePathId,
    setActivePathId, setWorkflowStage,
  ]);

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
