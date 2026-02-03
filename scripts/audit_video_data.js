/**
 * Data Audit Script
 * Scans video_library_enriched.json for missing/incomplete fields
 * Outputs: exports/data_audit_report.csv
 */

const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../path-builder/src/data/video_library_enriched.json');
const outputPath = path.join(__dirname, '../exports/data_audit_report.csv');

console.log('Loading data...');
const data = require(dataPath);

const courses = data.courses || data;

// Fields to audit
const requiredFields = ['title', 'code', 'duration_minutes', 'video_url', 'topic'];
const tagFields = ['tags', 'gemini_system_tags', 'ai_tags', 'transcript_tags'];

// Audit results
const results = {
  total: 0,
  missing: {
    title: 0,
    code: 0,
    duration_minutes: 0,
    video_url: 0,
    topic: 0,
    allTags: 0 // No tags from any source
  },
  incomplete: [], // Courses with issues
  tagStats: {
    withBaseTags: 0,
    withAITags: 0,
    withVideoTags: 0,
    avgTagsPerCourse: 0
  }
};

let totalTags = 0;

courses.forEach((course, idx) => {
  results.total++;
  const issues = [];
  
  // Check required fields
  requiredFields.forEach(field => {
    if (!course[field]) {
      results.missing[field]++;
      issues.push(`missing_${field}`);
    }
  });
  
  // Check tags
  const hasTags = course.tags && Object.keys(course.tags).length > 0;
  const hasGeminiTags = course.gemini_system_tags && course.gemini_system_tags.length > 0;
  const hasAITags = course.ai_tags && course.ai_tags.length > 0;
  const hasTranscriptTags = course.transcript_tags && course.transcript_tags.length > 0;
  
  if (hasTags) results.tagStats.withBaseTags++;
  if (hasGeminiTags || hasAITags) results.tagStats.withAITags++;
  if (hasTranscriptTags) results.tagStats.withVideoTags++;
  
  // Count total tags
  if (hasTags) totalTags += Object.keys(course.tags).length;
  if (hasGeminiTags) totalTags += course.gemini_system_tags.length;
  if (hasAITags) totalTags += course.ai_tags.length;
  if (hasTranscriptTags) totalTags += course.transcript_tags.length;
  
  if (!hasTags && !hasGeminiTags && !hasAITags && !hasTranscriptTags) {
    results.missing.allTags++;
    issues.push('no_tags');
  }
  
  // Track incomplete courses
  if (issues.length > 0) {
    results.incomplete.push({
      index: idx,
      code: course.code || 'NO_CODE',
      title: (course.title || 'NO_TITLE').substring(0, 50),
      issues: issues.join(';')
    });
  }
});

results.tagStats.avgTagsPerCourse = Math.round(totalTags / results.total);

// Console summary
console.log('\n=== DATA AUDIT REPORT ===\n');
console.log(`Total courses: ${results.total}`);
console.log('\nMissing Fields:');
Object.entries(results.missing).forEach(([field, count]) => {
  const pct = ((count / results.total) * 100).toFixed(1);
  console.log(`  ${field}: ${count} (${pct}%)`);
});

console.log('\nTag Coverage:');
console.log(`  With BASE tags: ${results.tagStats.withBaseTags} (${((results.tagStats.withBaseTags / results.total) * 100).toFixed(1)}%)`);
console.log(`  With AI tags: ${results.tagStats.withAITags} (${((results.tagStats.withAITags / results.total) * 100).toFixed(1)}%)`);
console.log(`  With VIDEO tags: ${results.tagStats.withVideoTags} (${((results.tagStats.withVideoTags / results.total) * 100).toFixed(1)}%)`);
console.log(`  Avg tags/course: ${results.tagStats.avgTagsPerCourse}`);

console.log(`\nIncomplete courses: ${results.incomplete.length}`);

// Write CSV
const csvHeader = 'Index,Code,Title,Issues\n';
const csvRows = results.incomplete.map(c => 
  `${c.index},"${c.code}","${c.title}","${c.issues}"`
).join('\n');

fs.writeFileSync(outputPath, csvHeader + csvRows);
console.log(`\nReport saved to: ${outputPath}`);

// Summary JSON
const summaryPath = path.join(__dirname, '../exports/data_audit_summary.json');
fs.writeFileSync(summaryPath, JSON.stringify({
  auditDate: new Date().toISOString(),
  total: results.total,
  missing: results.missing,
  tagStats: results.tagStats,
  incompleteCount: results.incomplete.length,
  completenessScore: (((results.total - results.incomplete.length) / results.total) * 100).toFixed(1) + '%'
}, null, 2));
console.log(`Summary saved to: ${summaryPath}`);
