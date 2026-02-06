/**
 * AdaptiveLearningCart - Cart with fix-specific and transferable objectives
 * The anti-tutorial-hell learning experience
 */
import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { formatDuration, getCourseThumbnail } from "../../utils/videoUtils";
import "./ProblemFirst.css";

export default function AdaptiveLearningCart({
  objectives,
  courses,
  validation,
  onCourseClick,
  onAddToCart,
  isCourseInCart,
}) {
  // Separate courses by relevance to objectives
  const { fixCourses, learnCourses } = useMemo(() => {
    if (!courses || courses.length === 0) {
      return { fixCourses: [], learnCourses: [] };
    }

    // For now, split courses evenly; in production this would be smarter
    const mid = Math.ceil(courses.length / 2);
    return {
      fixCourses: courses.slice(0, mid),
      learnCourses: courses.slice(mid),
    };
  }, [courses]);

  const validationStatus = useMemo(() => {
    if (!validation) return null;
    return {
      approved: validation.approved,
      reason: validation.reason,
      hasIssues: validation.issues?.length > 0,
    };
  }, [validation]);

  return (
    <div className="adaptive-cart">
      {/* Validation Status Banner */}
      {validationStatus && !validationStatus.approved && (
        <div className="validation-warning">
          <span className="icon">⚠️</span>
          <div className="content">
            <strong>Quality Check:</strong> {validationStatus.reason}
            {validation.suggestions?.length > 0 && (
              <ul className="suggestions">
                {validation.suggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Fix Now Section */}
      <section className="cart-section fix-now">
        <div className="section-header">
          <h3>
            <span className="icon">🔧</span>
            Fix Now
          </h3>
          <p className="description">These solve your immediate problem:</p>
        </div>

        <div className="objectives-list">
          {(objectives?.fix_specific || []).map((objective, index) => (
            <div key={index} className="objective-item fix">
              <span className="number">{index + 1}</span>
              <span className="text">{objective}</span>
            </div>
          ))}
        </div>

        {fixCourses.length > 0 && (
          <div className="course-list">
            {fixCourses.map((course) => (
              <CourseCard
                key={course.id || course.code}
                course={course}
                type="fix"
                onClick={() => onCourseClick?.(course)}
                onAddToCart={onAddToCart}
                isInCart={isCourseInCart?.(course)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Learn Forever Section - CRITICAL for anti-tutorial-hell */}
      <section className="cart-section learn-forever">
        <div className="section-header">
          <h3>
            <span className="icon">🎓</span>
            Learn Forever
          </h3>
          <p className="description">These help you diagnose similar issues in the future:</p>
        </div>

        <div className="objectives-list transferable">
          {(objectives?.transferable || []).map((objective, index) => (
            <div key={index} className="objective-item transferable">
              <span className="number">{index + 1}</span>
              <span className="text">{objective}</span>
              <span className="badge">Transferable</span>
            </div>
          ))}
        </div>

        {objectives?.transferable?.length === 0 && (
          <div className="empty-warning">
            ⚠️ No transferable objectives generated. This path may not teach reusable skills.
          </div>
        )}

        {learnCourses.length > 0 && (
          <div className="course-list">
            {learnCourses.map((course) => (
              <CourseCard
                key={course.id || course.code}
                course={course}
                type="learn"
                onClick={() => onCourseClick?.(course)}
                onAddToCart={onAddToCart}
                isInCart={isCourseInCart?.(course)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Cart Summary */}
      <div className="cart-summary">
        <div className="stat">
          <span className="value">{objectives?.fix_specific?.length || 0}</span>
          <span className="label">Fix Objectives</span>
        </div>
        <div className="stat highlight">
          <span className="value">{objectives?.transferable?.length || 0}</span>
          <span className="label">Transferable Skills</span>
        </div>
        <div className="stat">
          <span className="value">{courses?.length || 0}</span>
          <span className="label">Recommended Courses</span>
        </div>
      </div>
    </div>
  );
}

/**
 * CourseCard - Individual course with thumbnail, objectives, and Add button
 */
function CourseCard({ course, type, onClick, onAddToCart, isInCart }) {
  const [imgError, setImgError] = useState(false);

  const duration = useMemo(() => {
    if (course.duration) return course.duration;
    if (course.duration_minutes) return `${course.duration_minutes} min`;
    if (course.durationMinutes) return `${course.durationMinutes} min`;
    // Calculate from videos if available
    if (course.videos?.length) {
      const totalSec = course.videos.reduce((sum, v) => sum + (v.duration_seconds || 0), 0);
      return totalSec > 0 ? formatDuration(totalSec) : null;
    }
    return null;
  }, [course]);

  // Convert numeric difficulty (1-5) to labels
  const difficultyLabel = useMemo(() => {
    if (typeof course.difficulty === "string") return course.difficulty;
    if (typeof course.difficulty === "number") {
      const labels = ["Beginner", "Beginner", "Intermediate", "Intermediate", "Advanced", "Expert"];
      return labels[course.difficulty] || "Intermediate";
    }
    if (course.gemini_skill_level) return course.gemini_skill_level;
    return null;
  }, [course]);

  // Get thumbnail URL
  const thumbnailUrl = useMemo(() => getCourseThumbnail(course), [course]);

  // Get video count
  const videoCount = course.video_count || course.videos?.length || null;

  // Handle Add to Cart click
  const handleAddClick = (e) => {
    e.stopPropagation();
    onAddToCart?.(course);
  };

  return (
    <div
      className={`course-card ${type} ${isInCart ? "in-cart" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
    >
      {/* Thumbnail */}
      {thumbnailUrl && !imgError && (
        <div className="course-thumbnail">
          <img
            src={thumbnailUrl}
            alt={course.title}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        </div>
      )}

      <div className="course-info">
        <h4 className="title">{course.title || course.name}</h4>

        {/* Learning Objective */}
        {course.gemini_outcomes?.[0] && (
          <p className="description">{course.gemini_outcomes[0].slice(0, 100)}...</p>
        )}

        <div className="meta">
          {duration && <span className="duration">⏱️ {duration}</span>}
          {videoCount && <span className="video-count">🎬 {videoCount} videos</span>}
          {difficultyLabel && (
            <span className={`difficulty ${difficultyLabel.toLowerCase()}`}>{difficultyLabel}</span>
          )}
        </div>
      </div>

      {/* Add/Added Button */}
      <div className="course-action">
        {onAddToCart ? (
          <button
            className={`add-btn ${isInCart ? "added" : ""}`}
            onClick={handleAddClick}
            aria-label={isInCart ? "Added to path" : "Add to path"}
          >
            {isInCart ? "✓ Added" : "+ Add"}
          </button>
        ) : (
          <span className="arrow">→</span>
        )}
      </div>
    </div>
  );
}

CourseCard.propTypes = {
  course: PropTypes.shape({
    id: PropTypes.string,
    code: PropTypes.string,
    title: PropTypes.string,
    name: PropTypes.string,
    description: PropTypes.string,
    duration: PropTypes.string,
    durationMinutes: PropTypes.number,
    difficulty: PropTypes.string,
  }).isRequired,
  type: PropTypes.oneOf(["fix", "learn"]),
  onClick: PropTypes.func,
};

CourseCard.defaultProps = {
  type: "fix",
  onClick: null,
};

AdaptiveLearningCart.propTypes = {
  objectives: PropTypes.shape({
    fix_specific: PropTypes.arrayOf(PropTypes.string),
    transferable: PropTypes.arrayOf(PropTypes.string),
  }),
  courses: PropTypes.arrayOf(PropTypes.object),
  validation: PropTypes.shape({
    approved: PropTypes.bool,
    reason: PropTypes.string,
    issues: PropTypes.arrayOf(PropTypes.string),
    suggestions: PropTypes.arrayOf(PropTypes.string),
  }),
  onCourseClick: PropTypes.func,
};

AdaptiveLearningCart.defaultProps = {
  objectives: null,
  courses: [],
  validation: null,
  onCourseClick: null,
};
