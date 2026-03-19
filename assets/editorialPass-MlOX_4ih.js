import{t as b,v as $}from"./vendor-firebase-CCJ1U6o_.js";import{c as S,d as p,e as w}from"./index-DgV1sEUL.js";import{r as M}from"./tokenTracker-D3g2StvI.js";import{r as k}from"./retryWithBackoff-Ba9diV5s.js";import"./vendor-cytoscape-C50ZqMJi.js";import"./vendor-export-Cccetl6i.js";import"./data-courses-r31IfvSM.js";const g=5,E=300;function q(e){if(e.video)return"watch";const i=(e.category||"").toLowerCase(),a=(e.title||"").toLowerCase();return i.includes("practice")||i.includes("transfer")||a.includes("apply")?"apply":i.includes("diagnosis")||a.includes("verify")||a.includes("test")?"verify":i.includes("foundation")||i.includes("prerequisite")?"read":"do"}function D(e){if(e.video?.durationSeconds)return Math.ceil(e.video.durationSeconds/60);const i=(e.summary||"").length+(e._bridgeText||"").length;return i>1e3?8:i>500?5:3}function L(e){const i=[],a=e._originalSegment||{};return e.video?.url&&i.push({label:e.video.title||"Watch the video",url:e.video.url,type:"video"}),(a.doc_url||a.url)&&i.push({label:"Official documentation",url:a.doc_url||a.url,type:"docs"}),i}function T(e){const i=e.title||"this topic";return{whyThisMatters:e.whyThisMatters||`Understanding ${i} is essential for working effectively in Unreal Engine 5.`,whatToDo:e.whatToDo?.length?e.whatToDo:[`Review the material on ${i}.`,"Follow along with the provided example."],howToVerify:e.howToVerify?.length?e.howToVerify:[`You can explain ${i} in your own words.`,"Your project compiles and runs without errors."],commonMistake:e.commonMistake||`Skipping the verification step and moving on before confirming ${i} works in your project.`,takeaway:e.takeaway||`${i} — now part of your UE5 toolkit.`,completionType:e.completionType||q(e),estimatedMinutes:e.estimatedMinutes||D(e),goDeeper:e.goDeeper?.length?e.goDeeper:L(e)}}function O(e,i,a){const u=e.map((o,s)=>{const t=(o.summary||o._bridgeText||"").slice(0,E);return`Step ${s+1}: "${o.title}" (${o.category})
Summary: ${t}`}).join(`

`);return`You are a senior UE5 instructor writing a structured learning path.

Path: "${i}"
Learner goal: "${a}"

For each step below, generate structured teaching content.
Write in second person ("you"), be concise, and stay factually grounded.

${u}

Return a JSON array (one object per step, in order):
[
  {
    "whyThisMatters": "1-2 sentences connecting to the learner's goal",
    "whatToDo": ["action 1", "action 2", "action 3"],
    "howToVerify": ["check 1", "check 2"],
    "commonMistake": "One specific pitfall to avoid",
    "takeaway": "One sentence memory anchor"
  }
]

Rules:
- whatToDo should be specific UE5 actions, not "read about it"
- howToVerify should be observable outcomes, not subjective feelings
- commonMistake should be a real UE5 gotcha, not generic advice
- takeaway should be memorable and concise (under 15 words)
- Return ONLY the JSON array, no markdown fences or commentary`}function v(e,i,a){return`You are a senior UE5 instructor writing the introduction for a learning path.

Path: "${e}"
Learner's question/goal: "${i}"

Steps in this path:
${a.map((u,o)=>`${o+1}. ${u}`).join(`
`)}

Generate a learner-friendly introduction. Return JSON:
{
  "quickAnswer": "One sentence direct answer to what the learner asked",
  "rootCause": "One sentence: the most likely reason this problem happens",
  "whatYouWillLearn": ["outcome 1", "outcome 2", "outcome 3"],
  "quickWin": "One concrete thing to try right now before starting the full path",
  "difficulty": "beginner" | "intermediate" | "advanced",
  "prerequisites": ["prerequisite 1", "prerequisite 2"],
  "estimatedMinutes": <total minutes as integer>
}

Rules:
- quickAnswer should directly address the learner's question
- quickWin should be actionable in under 2 minutes
- prerequisites should be specific UE5 knowledge, not generic
- Return ONLY the JSON object, no markdown fences`}async function V(e){if(!e||!e.sections)return e;const i=S(),a=b(i,"us-central1"),u=$(a,"classifySegments",{timeout:12e4}),o={...e},s=[];for(const t of o.sections)for(const n of t.steps)s.push(n);p(`[EditorialPass] Enriching ${s.length} steps in batches of ${g}`);for(let t=0;t<s.length;t+=g){const n=s.slice(t,t+g);try{const m=O(n,e.title||"Learning Path",e.learnerGoal||e._originalQuery||""),f=(await k(()=>u({prompt:m}),{maxRetries:2,baseDelayMs:1500,label:"editorialPass"})).data?.text||"",r=f.match(/\[[\s\S]*\]/);if(r){const d=JSON.parse(r[0]);M("editorialPass",Math.ceil(m.length/4),Math.ceil(f.length/4));for(let y=0;y<n.length&&y<d.length;y++){const l=d[y],c=n[y];c.whyThisMatters=l.whyThisMatters||c.whyThisMatters,c.whatToDo=Array.isArray(l.whatToDo)?l.whatToDo:c.whatToDo,c.howToVerify=Array.isArray(l.howToVerify)?l.howToVerify:c.howToVerify,c.commonMistake=l.commonMistake||c.commonMistake,c.takeaway=l.takeaway||c.takeaway,c._editorialStatus="enriched"}p(`[EditorialPass] Batch ${Math.floor(t/g)+1}: enriched ${d.length} steps`)}else w("[EditorialPass] LLM returned no valid JSON, using deterministic fill for batch"),n.forEach(d=>Object.assign(d,T(d)))}catch(m){w(`[EditorialPass] Batch failed: ${m.message}, using deterministic fill`),n.forEach(h=>Object.assign(h,T(h)))}}for(const t of s){const n=T(t);t.whyThisMatters||(t.whyThisMatters=n.whyThisMatters),t.whatToDo?.length||(t.whatToDo=n.whatToDo),t.howToVerify?.length||(t.howToVerify=n.howToVerify),t.commonMistake||(t.commonMistake=n.commonMistake),t.takeaway||(t.takeaway=n.takeaway),t.completionType=t.completionType||n.completionType,t.estimatedMinutes=t.estimatedMinutes||n.estimatedMinutes,t.goDeeper?.length||(t.goDeeper=n.goDeeper)}try{const t=s.map(r=>r.title),n=v(e.title||"Learning Path",e.learnerGoal||e._originalQuery||"",t),h=(await k(()=>u({prompt:n}),{maxRetries:2,baseDelayMs:1500,label:"editorialPassIntro"})).data?.text||"",f=h.match(/\{[\s\S]*\}/);if(f){const r=JSON.parse(f[0]);o.quickAnswer=r.quickAnswer||o.quickAnswer,o.rootCause=r.rootCause||o.rootCause,o.whatYouWillLearn=Array.isArray(r.whatYouWillLearn)?r.whatYouWillLearn:o.whatYouWillLearn,o.quickWin=r.quickWin||o.quickWin,o.difficulty=r.difficulty||o.difficulty,o.prerequisites=Array.isArray(r.prerequisites)?r.prerequisites:o.prerequisites,r.estimatedMinutes&&(o.estimatedMinutes=r.estimatedMinutes),M("editorialPassIntro",Math.ceil(n.length/4),Math.ceil(h.length/4)),p("[EditorialPass] Path intro enriched via LLM")}}catch(t){w(`[EditorialPass] Intro enrichment failed: ${t.message}`)}return o.estimatedMinutes||(o.estimatedMinutes=s.reduce((t,n)=>t+(n.estimatedMinutes||3),0)),p(`[EditorialPass] Complete: ${s.filter(t=>t._editorialStatus==="enriched").length}/${s.length} steps enriched via LLM`),o}export{V as runEditorialPass};
