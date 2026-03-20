import{t as h,v as y}from"./vendor-firebase-CCJ1U6o_.js";import{d as l,c as P,e as m}from"./index-C1jULBQk.js";import{r as b}from"./retryWithBackoff-Ba9diV5s.js";import{r as A}from"./tokenTracker-DZAvAUtO.js";import{p as R}from"./gapDetection-DfC9ICP0.js";const p=5;async function I(a){try{l(`[GapAnalyzer] Searching community pain points for: "${a}"`);const n=`Search for the most common struggles, confusion points, and pain points that Unreal Engine 5 learners experience with: "${a}"

SEARCH PRIORITY:
1. forums.unrealengine.com (Epic's official forums)
2. Reddit r/unrealengine
3. Epic Developer Community
4. YouTube comments on UE5 tutorials

Return a JSON array of the top ${p} pain points:
[{
  "painPoint": "One-sentence description of the struggle",
  "relevance": "high" or "medium" or "low"
}]

RULES:
- Focus on LEARNER confusion, not engine bugs
- Prioritize problems that affect beginners and intermediates
- Each pain point should be a specific, actionable insight (not vague like "it's hard")
- Return valid JSON only, no markdown fences`,u=P(),d=h(u,"us-central1"),g=y(d,"classifySegments"),o=await b(()=>g({prompt:n,grounded:!0}),{maxRetries:1,baseDelayMs:1500,label:"communityPainPoints"}),i=o.data?.text||"",f=o.data?.groundingMetadata||null;A("communityPainPoints",Math.ceil(n.length/4),Math.ceil(i.length/4));const e=R(i);if(!e||!Array.isArray(e))return m("[GapAnalyzer] Failed to parse community pain points response"),[];const r=f?.sources||[],s=e.slice(0,p).map((t,c)=>({painPoint:t.painPoint||t.pain_point||"",sourceUrl:r[c]?.url||"",sourceTitle:r[c]?.title||"",relevance:t.relevance||"medium"}));return l(`[GapAnalyzer] Found ${s.length} community pain points`),s}catch(n){return m("[GapAnalyzer] searchCommunityPainPoints failed:",n.message),[]}}export{I as s};
