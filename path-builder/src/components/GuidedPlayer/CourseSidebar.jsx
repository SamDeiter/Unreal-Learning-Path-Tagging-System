/**
 * CourseSidebar — Side panel listing all courses in the path with progress indicators.
 */
import PropTypes from "prop-types";
import { cleanVideoTitle } from "../../utils/cleanVideoTitle";
import coursePrerequisites from "../../data/course_prerequisites.json";

export default function CourseSidebar({ courses, currentIndex, onSkipTo }) {
  const pathCodes = courses.map((c) => c.code);

  return (
    <div className="course-sidebar">
      <h4>Your Path</h4>
      <div className="sidebar-courses">
        {courses.map((course, i) => {
          const prereqData = coursePrerequisites[course.code];
          const missingPrereqs =
            prereqData?.prerequisites?.filter((p) => !pathCodes.includes(p)) || [];
          return (
            <button
              key={course.code || i}
              className={`sidebar-course ${i === currentIndex ? "active" : ""} ${i < currentIndex ? "completed" : ""}`}
              onClick={() => onSkipTo(i)}
              title={cleanVideoTitle(course.videos?.[0]?.title || course.title || course.name)}
            >
              <span className="index">{i < currentIndex ? "✓" : i + 1}</span>
              <span className="title">
                {cleanVideoTitle(course.videos?.[0]?.title || course.title || course.name)}
              </span>
              {prereqData?.difficulty && (
                <span className={`difficulty-tag ${prereqData.difficulty}`}>
                  {prereqData.difficulty}
                </span>
              )}
              {missingPrereqs.length > 0 && (
                <span
                  className="prereq-warning"
                  title={`Recommended: ${missingPrereqs.join(", ")} first`}
                >
                  ⚠️
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

CourseSidebar.propTypes = {
  courses: PropTypes.array.isRequired,
  currentIndex: PropTypes.number.isRequired,
  onSkipTo: PropTypes.func.isRequired,
};
