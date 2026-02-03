const fs = require('fs');
const data = require('../path-builder/src/data/video_library_enriched.json');

const videoTagCounts = {};

data.courses.forEach(course => {
  const tags = [
    ...(course.ai_tags || []),
    ...(course.transcript_tags || [])
  ];
  tags.forEach(tag => {
    videoTagCounts[tag] = (videoTagCounts[tag] || 0) + 1;
  });
});

const sorted = Object.entries(videoTagCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 100);

const csv = 'Tag,Frequency\n' + sorted.map(([tag, count]) => `"${tag}",${count}`).join('\n');

fs.writeFileSync('exports/top_100_video_tags.csv', csv);
console.log(`Created top_100_video_tags.csv with ${sorted.length} tags`);
console.log('Total unique video tags:', Object.keys(videoTagCounts).length);
console.log('\nTop 10:');
sorted.slice(0, 10).forEach(([tag, count], i) => {
  console.log(`  ${i + 1}. ${tag}: ${count}`);
});
