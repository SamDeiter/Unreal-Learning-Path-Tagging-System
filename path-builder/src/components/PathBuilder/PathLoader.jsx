/**
 * PathLoader — Tiny helper that loads path data into PathContext.
 *
 * Lives inside <PathProvider> so it can call usePath().
 * When `pendingPath` changes, it loads the courses + intent
 * into context and calls `onLoaded()` to clear the pending state.
 */
import { useEffect, useRef } from "react";
import { usePath } from "../../context/PathContext";

export default function PathLoader({ pendingPath, onLoaded }) {
  const { loadPath, setLearningIntent, setActivePathId } = usePath();
  const lastLoadedId = useRef(null);

  useEffect(() => {
    if (!pendingPath || pendingPath.id === lastLoadedId.current) return;

    // Load courses into context
    if (Array.isArray(pendingPath.courses) && pendingPath.courses.length > 0) {
      loadPath(pendingPath.courses);
    }

    // Load learning intent if available
    if (pendingPath.learningIntent) {
      setLearningIntent(pendingPath.learningIntent);
    } else if (pendingPath.goal) {
      // PathDashboard stores goal/skillLevel/timeBudget at top level
      setLearningIntent({
        primaryGoal: pendingPath.goal || "",
        skillLevel: pendingPath.skillLevel || "",
        timeBudget: pendingPath.timeBudget || "",
      });
    }

    // Track which saved path we're editing
    if (pendingPath.id) {
      setActivePathId(pendingPath.id);
      localStorage.setItem("ue5_active_path_id", pendingPath.id);
    }

    lastLoadedId.current = pendingPath.id;
    onLoaded?.();
  }, [pendingPath, loadPath, setLearningIntent, setActivePathId, onLoaded]);

  return null; // Render nothing — this is a logic-only component
}
