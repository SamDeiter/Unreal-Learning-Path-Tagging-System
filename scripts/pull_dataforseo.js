const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const LOGIN = process.env.DATAFORSEO_LOGIN;
const PASSWORD = process.env.DATAFORSEO_PASSWORD;

if (!LOGIN || !PASSWORD) {
  console.error("❌ Missing DATAFORSEO_LOGIN or DATAFORSEO_PASSWORD in .env");
  process.exit(1);
}

// Extract taxonomy from the service file so we stay perfectly in sync
const servicePath = path.join(__dirname, '../path-builder/src/services/demandIntelligenceService.js');
const serviceContent = fs.readFileSync(servicePath, 'utf8');

const taxonomyMatch = serviceContent.match(/export const GRANULAR_TAXONOMY = ({[\s\S]*?});/);
const taxonomy = {};
if (taxonomyMatch && taxonomyMatch[1]) {
  Object.assign(taxonomy, eval(`(${taxonomyMatch[1]})`));
} else {
  console.error("❌ Could not parse GRANULAR_TAXONOMY from demandIntelligenceService.js");
  process.exit(1);
}

const uefnMatch = serviceContent.match(/export const UEFN_GRANULAR_TAXONOMY = ({[\s\S]*?});/);
const uefnTaxonomy = {};
if (uefnMatch && uefnMatch[1]) {
  Object.assign(uefnTaxonomy, eval(`(${uefnMatch[1]})`));
} else {
  console.error("⚠️ Could not parse UEFN_GRANULAR_TAXONOMY. Proceeding with UE5 only.");
}

const combinedTaxonomy = { ...taxonomy, ...uefnTaxonomy };

// Build keyword list
const keywords = [];
const keywordToSubtopic = new Map(); // Map "ue5 subtopic" back to "Subtopic"

for (const [category, subtopics] of Object.entries(combinedTaxonomy)) {
  for (const subtopic of subtopics) {
    // Prefix with "UE5 " or "UEFN " to get accurate context
    // DataForSEO API strictly rejects parentheses, so we must sanitize
    
    // Check if this subtopic belongs to UEFN taxonomy
    const isUefn = !!uefnTaxonomy[category] && uefnTaxonomy[category].includes(subtopic);
    const prefix = isUefn ? "uefn " : "ue5 ";
    
    const kw = `${prefix}${subtopic.toLowerCase()}`.replace(/[\\(\\)]/g, '');
    keywords.push(kw);
    keywordToSubtopic.set(kw, subtopic);
  }
}

console.log(`🔍 Preparing to pull SEO metrics for ${keywords.length} topics...`);

async function fetchSEOMetrics() {
  const postData = [{
    location_name: "United States",
    language_name: "English",
    keywords: keywords
  }];

  const authHeader = "Basic " + Buffer.from(`${LOGIN}:${PASSWORD}`).toString('base64');

  try {
    const response = await axios({
      method: "post",
      url: "https://api.dataforseo.com/v3/keywords_data/google/search_volume/live",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json"
      },
      data: postData
    });

    const task = response.data.tasks?.[0];
    if (task?.status_code && task.status_code > 20000) {
      throw new Error(`DataForSEO Internal Error ${task.status_code}: ${task.status_message}`);
    }

    const results = task?.result || [];
    const seoMetrics = {};

    results.forEach(item => {
      // DataForSEO may not return results for zero-volume or invalid keywords
      const subtopic = keywordToSubtopic.get(item.keyword.toLowerCase());
      if (subtopic) {
        // Boost MSV slightly to account for global non-US searches since we only queried US
        seoMetrics[subtopic] = {

          msv: (item.search_volume || 0) * 3, 
          kd: item.keyword_difficulty || 0
        };
      }
    });

    // Fill in any blanks with 0 to prevent UI undefined errors
    for (const subtopic of keywordToSubtopic.values()) {
      if (!seoMetrics[subtopic]) {
        seoMetrics[subtopic] = { msv: 0, kd: 0 };
      }
    }

    // Save to the data directory so the React app can import it natively
    const outputPath = path.join(__dirname, '../path-builder/src/data/seoMetrics.json');
    fs.writeFileSync(outputPath, JSON.stringify(seoMetrics, null, 2));

    console.log(`✅ Successfully saved SEO metrics for ${Object.keys(seoMetrics).length} subtopics to seoMetrics.json`);

  } catch (error) {
    console.error("❌ DataForSEO API Error:", error.response?.data || error.message);
    process.exit(1);
  }
}

fetchSEOMetrics();
