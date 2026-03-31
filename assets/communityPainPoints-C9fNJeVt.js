import{t as P,v as E}from"./vendor-firebase-BklWSxN9.js";import{d as p,c as F,e as u}from"./index-Dubecrcj.js";import{retryWithBackoff as U}from"./retryWithBackoff-ChyV6NkW.js";import{r as b}from"./tokenTracker-CRyEMG_k.js";import{p as A}from"./gapDetection-42TjnmVL.js";const g=5;async function C(t,o="UE5"){try{p(`[GapAnalyzer] Searching community pain points for: "${t}"`);const i=`Search for the most common struggles, confusion points, and pain points that ${o==="UEFN"?"Unreal Editor for Fortnite (UEFN) and Verse programming":"Unreal Engine 5"} learners experience with: "${t}"

SEARCH PRIORITY:
1. forums.unrealengine.com (Epic's official forums)
2. Reddit r/unrealengine
3. Epic Developer Community
4. YouTube comments on ${o==="UEFN"?"UEFN":"UE5"} tutorials

Return a JSON array of the top ${g} pain points:
[{
  "painPoint": "One-sentence description of the struggle",
  "relevance": "high" or "medium" or "low"
}]

RULES:
- Focus on LEARNER confusion, not engine bugs
- Prioritize problems that affect beginners and intermediates
- Each pain point should be a specific, actionable insight (not vague like "it's hard")
- Return valid JSON only, no markdown fences`,d=F(),f=P(d,"us-central1"),h=E(f,"classifySegments"),r=await U(()=>h({prompt:i,grounded:!0}),{maxRetries:1,baseDelayMs:1500,label:"communityPainPoints"}),s=r.data?.text||"",y=r.data?.groundingMetadata||null;b("communityPainPoints",Math.ceil(i.length/4),Math.ceil(s.length/4));const n=A(s);if(!n||!Array.isArray(n))return u("[GapAnalyzer] Failed to parse community pain points response"),[];const c=y?.sources||[],m=n.slice(0,g).map((e,l)=>({painPoint:e.painPoint||e.pain_point||"",sourceUrl:c[l]?.url||"",sourceTitle:c[l]?.title||"",relevance:e.relevance||"medium"}));return p(`[GapAnalyzer] Found ${m.length} community pain points`),m}catch(a){return u("[GapAnalyzer] searchCommunityPainPoints failed:",a.message),[]}}export{C as s};
