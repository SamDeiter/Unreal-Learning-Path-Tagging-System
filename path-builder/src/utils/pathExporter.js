/**
 * Path Exporter Utility
 * Exports learning paths to LMS-compatible formats
 */

/**
 * Generate a unique path ID
 */
function generatePathId(title) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const timestamp = Date.now().toString(36);
  return `lp-${slug}-${timestamp}`;
}

/**
 * Format duration from minutes to human-readable string
 */
function formatDuration(minutes) {
  if (!minutes) return 'Unknown';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Export to JSON (schema-compliant with learning_paths/schema.json)
 */
export function exportToJSON(learningIntent, courses) {
  const pathId = generatePathId(learningIntent.primaryGoal || 'learning-path');
  const totalMinutes = courses.reduce((sum, c) => sum + (c.duration_minutes || 0), 0);

  const path = {
    id: pathId,
    title: learningIntent.primaryGoal || 'Untitled Learning Path',
    description: `A curated learning path covering ${courses.length} topics.`,
    requiredTags: courses.flatMap(c => c.gemini_system_tags || []).slice(0, 10),
    estimatedDuration: formatDuration(totalMinutes),
    steps: courses.map((course, idx) => ({
      order: idx + 1,
      title: course.title,
      description: course.topic || '',
      resourceUrl: course.video_url || course.url || '',
      resourceType: 'video',
      duration: formatDuration(course.duration_minutes || 0),
      courseCode: course.code
    }))
  };

  return path;
}

/**
 * Export to CSV format
 */
export function exportToCSV(learningIntent, courses) {
  const headers = ['Order', 'Title', 'Course Code', 'Duration', 'Topic', 'Level', 'URL'];
  const rows = courses.map((course, idx) => [
    idx + 1,
    `"${course.title.replace(/"/g, '""')}"`,
    course.code || '',
    formatDuration(course.duration_minutes || 0),
    course.topic || '',
    course.tags?.level || '',
    course.video_url || course.url || ''
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

/**
 * Generate SCORM manifest XML
 */
export function generateSCORMManifest(learningIntent, courses) {
  const pathId = generatePathId(learningIntent.primaryGoal || 'learning-path');
  const title = learningIntent.primaryGoal || 'Learning Path';
  
  const items = courses.map((course, idx) => `
    <item identifier="item_${idx + 1}" identifierref="resource_${idx + 1}">
      <title>${escapeXML(course.title)}</title>
    </item>`).join('');

  const resources = courses.map((course, idx) => `
    <resource identifier="resource_${idx + 1}" type="webcontent" href="content/step${idx + 1}.html">
      <file href="content/step${idx + 1}.html"/>
    </resource>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${pathId}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="org_1">
    <organization identifier="org_1">
      <title>${escapeXML(title)}</title>
      ${items}
    </organization>
  </organizations>
  <resources>
    ${resources}
  </resources>
</manifest>`;
}

/**
 * Generate xAPI statement template
 */
export function generateXAPITemplate(learningIntent, courses, stepIndex = 0) {
  const course = courses[stepIndex];
  const pathId = generatePathId(learningIntent.primaryGoal || 'learning-path');
  
  return {
    actor: {
      mbox: "mailto:learner@example.com",
      name: "Learner Name"
    },
    verb: {
      id: "http://adlnet.gov/expapi/verbs/completed",
      display: { "en-US": "completed" }
    },
    object: {
      id: `https://unrealengine.com/learning/path/${pathId}/step/${stepIndex + 1}`,
      definition: {
        name: { "en-US": course?.title || `Step ${stepIndex + 1}` },
        description: { "en-US": course?.topic || "" },
        type: "http://adlnet.gov/expapi/activities/lesson"
      }
    },
    context: {
      contextActivities: {
        parent: [{
          id: `https://unrealengine.com/learning/path/${pathId}`,
          definition: {
            name: { "en-US": learningIntent.primaryGoal || "Learning Path" },
            type: "http://adlnet.gov/expapi/activities/course"
          }
        }]
      }
    }
  };
}

/**
 * Helper: Escape XML special characters
 */
function escapeXML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Download helper - triggers browser download
 */
export function downloadFile(content, filename, type = 'application/json') {
  const blob = new Blob([typeof content === 'string' ? content : JSON.stringify(content, null, 2)], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
