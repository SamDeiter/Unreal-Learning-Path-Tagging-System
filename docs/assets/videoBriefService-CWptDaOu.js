import{v as y,x as S}from"./vendor-firebase-BCFISzbC.js";import{d as m,e as g,c as k}from"./index-BMUDfB1M.js";import{retryWithBackoff as w}from"./retryWithBackoff-DbYr_kje.js";import{r as b}from"./tokenTracker-DhoK2FX4.js";import{p as v}from"./gapDetection-CvaxPu49.js";import"./vendor-cytoscape-C50ZqMJi.js";import"./vendor-export-Cccetl6i.js";import"./data-courses-DG2TQK2b.js";import"./pathSearch-DylFKyqL.js";const p=3,f=new Map;function T(t){const o=(t.title||"").toLowerCase(),s=(t.summary||"").toLowerCase(),e=`${o} ${s}`;return e.includes("advanced")||e.includes("optimization")||e.includes("subsystem")||e.includes("c++")?"Advanced":e.includes("beginner")||e.includes("introduction")||e.includes("getting started")||e.includes("basics")?"Beginner":"Intermediate"}function M(t){const o=!!t.video,s=(t.whatToDo||[]).length,e=T(t);if(o&&t.video?.durationSeconds){const c=Math.ceil(t.video.durationSeconds/60);return`${c}-${c+3} minutes (based on existing video)`}const a=(e==="Advanced"?10:e==="Beginner"?5:7)+s*2;return`${a}-${a+4} minutes`}async function B(t,o={}){const s=`${t.title||""}_${o.stepIndex||0}`;if(f.has(s))return f.get(s);const e=T(t),l=M(t),n={chapterTitle:o.chapterTitle||t.title||"Untitled",stepTitle:t.title||"Untitled Step",targetLength:l,skillLevel:e,position:`Step ${(o.stepIndex||0)+1} of ${o.totalSteps||"?"}`,pathTitle:o.pathTitle||"",learnerGoal:o.learnerGoal||"",whyThisMatters:t.whyThisMatters||"",whatToDo:t.whatToDo||[],commonMistake:t.commonMistake||"",takeaway:t.takeaway||"",existingResources:[],requiredDemonstrations:[],talkingPoints:[],requiredTerminology:[],editorSetup:[],scriptNotes:""};if(t.video&&n.existingResources.push({type:"video",title:t.video.title||t.title,url:t.video.url||"",duration:t.video.durationSeconds?`${Math.ceil(t.video.durationSeconds/60)}min`:"unknown",relevance:1}),t.goDeeper?.length)for(const a of t.goDeeper)n.existingResources.push({type:a.type||"docs",title:a.label||"",url:a.url||"",relevance:.7});try{const a=D(t,o,e),c=k(),i=y(c,"us-central1"),r=S(i,"classifySegments"),u=(await w(()=>r({prompt:a}),{maxRetries:1,baseDelayMs:2e3,label:"videoBrief"})).data?.text||"";b("videoBrief",Math.ceil(a.length/4),Math.ceil(u.length/4));const h=v(u);h&&(n.requiredDemonstrations=h.requiredDemonstrations||n.requiredDemonstrations,n.talkingPoints=h.talkingPoints||n.talkingPoints,n.requiredTerminology=h.requiredTerminology||n.requiredTerminology,n.editorSetup=h.editorSetup||n.editorSetup,n.scriptNotes=h.scriptNotes||n.scriptNotes)}catch(a){g("[VideoBrief] AI enrichment failed, using base data:",a.message),n.requiredDemonstrations=E(t),n.talkingPoints=N(t),n.requiredTerminology=q(t)}return f.set(s,n),n}function D(t,o,s){const e=(t.summary||t._bridgeText||"").slice(0,500),l=(t.whatToDo||[]).join(`
  - `);return`You are an Unreal Engine 5 video tutorial producer. Generate a RECORDING BRIEF for an instructor.

CONTEXT:
- Course: "${o.pathTitle||"UE5 Tutorial"}"
- Chapter: "${o.chapterTitle||t.title}"
- Learner Goal: "${o.learnerGoal||"Learn UE5"}"
- Skill Level: ${s}
- Position: Step ${(o.stepIndex||0)+1} of ${o.totalSteps||"?"}

STEP CONTENT:
- Title: "${t.title||""}"
- Summary: "${e}"
- Why It Matters: "${t.whyThisMatters||""}"
- Actions:
  - ${l||"Not specified"}
- Common Mistake: "${t.commonMistake||""}"

Generate a JSON object with these RECORDING INSTRUCTIONS:

{
  "requiredDemonstrations": [
    "Specific on-screen actions the instructor MUST show (e.g., 'Open Place Actors panel → drag NavMesh Bounds Volume into viewport')"
  ],
  "talkingPoints": [
    "Key teaching points to verbalize while demonstrating (e.g., 'Explain WHY NavMesh needs to cover the entire playable area')"
  ],
  "requiredTerminology": [
    "UE5 terms the instructor must define or use correctly (e.g., 'NavMesh Bounds Volume')"
  ],
  "editorSetup": [
    "Editor state needed before recording starts (e.g., 'Have a level with at least one AI character placed')"
  ],
  "scriptNotes": "Brief callout for the instructor — pacing tip, common confusion point to address, etc."
}

RULES:
- requiredDemonstrations: 3-6 specific, actionable on-screen steps
- talkingPoints: 2-4 teaching moments (WHY, not just WHAT)
- requiredTerminology: 2-5 UE5-specific terms
- editorSetup: 1-3 items the editor needs before pressing Record
- scriptNotes: 1-2 sentences max
- Be specific to UE5.4/5.5 — use actual menu paths and panel names
- Return valid JSON only, no markdown fences`}function E(t){const o=[];if(t.whatToDo?.length)for(const s of t.whatToDo.slice(0,5))o.push(`Demonstrate: ${s}`);return t.video?.url&&o.push("Show the referenced video segment as context"),o.length>0?o:[`Walk through the key concepts of "${t.title||"this topic"}"`]}function N(t){const o=[];return t.whyThisMatters&&o.push(`Explain: ${t.whyThisMatters}`),t.commonMistake&&o.push(`Warn about: ${t.commonMistake}`),t.takeaway&&o.push(`Summarize: ${t.takeaway}`),o.length>0?o:[`Explain why "${t.title}" matters in a real project`]}function q(t){const o=[],s=[...t.video?.tags||[],...t.tags||[]];for(const e of s.slice(0,5))typeof e=="string"&&e.length>2&&o.push(e);return o}async function V(t,{onProgress:o}={}){if(!t?.sections?.length)throw new Error("Invalid V2 path: no sections found");m(`[VideoBrief] Generating brief package for "${t.title}"`);const s=Date.now(),e=[],l=[];for(const i of t.sections)for(const r of i.steps||[])l.push({step:r,sectionTitle:i.title||i.phase||"Chapter"});const n=l.length;for(let i=0;i<l.length;i+=p){const r=l.slice(i,i+p),d=await Promise.allSettled(r.map(({step:u,sectionTitle:h},$)=>B(u,{pathTitle:t.title||"UE5 Learning Path",learnerGoal:t.query||"",stepIndex:i+$,totalSteps:n,chapterTitle:h})));for(const u of d)u.status==="fulfilled"?e.push(u.value):(g("[VideoBrief] Step brief failed:",u.reason?.message),e.push(null));o?.(Math.min(i+p,n),n),i+p<l.length&&await new Promise(u=>setTimeout(u,500))}const a={title:t.title||"Course Brief Package",generatedAt:new Date().toISOString(),totalSteps:l.length,briefsGenerated:e.filter(Boolean).length,generationTimeMs:Date.now()-s},c=R(t,e,a);return m(`[VideoBrief] Package complete: ${a.briefsGenerated}/${n} briefs (${a.generationTimeMs}ms)`),{markdown:c,briefs:e,metadata:a}}function R(t,o,s){const e=[];e.push(`# 🎬 Recording Brief: ${s.title}`),e.push(""),e.push(`> Generated: ${new Date(s.generatedAt).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}`),e.push(`> Steps: ${s.totalSteps} · Briefs generated: ${s.briefsGenerated}`),e.push(""),e.push("---"),e.push("");let l=0;for(const n of t.sections||[]){const a=n.title||n.phase||"Chapter";e.push(`## 📂 ${a}`),n.purpose&&e.push(`> ${n.purpose}`),e.push("");for(const c of n.steps||[]){const i=o[l];if(l++,!i){e.push(`### ❌ ${c.title||"Untitled"} — Brief generation failed`),e.push("");continue}if(e.push(`### 🎥 ${i.stepTitle}`),e.push(""),e.push("| Field | Value |"),e.push("|---|---|"),e.push(`| **Target Length** | ${i.targetLength} |`),e.push(`| **Skill Level** | ${i.skillLevel} |`),e.push(`| **Position** | ${i.position} |`),e.push(""),i.whyThisMatters&&(e.push(`**💡 Why This Matters:** ${i.whyThisMatters}`),e.push("")),i.editorSetup?.length){e.push("**🖥️ Editor Setup (before recording):**");for(const r of i.editorSetup)e.push(`- [ ] ${r}`);e.push("")}if(i.requiredDemonstrations?.length){e.push("**📹 Required Demonstrations:**");for(let r=0;r<i.requiredDemonstrations.length;r++)e.push(`${r+1}. ${i.requiredDemonstrations[r]}`);e.push("")}if(i.talkingPoints?.length){e.push("**🗣️ Talking Points:**");for(const r of i.talkingPoints)e.push(`- ${r}`);e.push("")}if(i.requiredTerminology?.length&&(e.push(`**📖 Required Terminology:** ${i.requiredTerminology.join(", ")}`),e.push("")),i.commonMistake&&(e.push(`**⚠️ Common Mistake to Address:** ${i.commonMistake}`),e.push("")),i.scriptNotes&&(e.push(`**📝 Script Notes:** ${i.scriptNotes}`),e.push("")),i.existingResources?.length){e.push("**📚 Existing Resources:**");for(const r of i.existingResources){const d=r.url?`[${r.title}](${r.url})`:r.title;e.push(`- ${r.type==="video"?"🎬":"📄"} ${d} ${r.duration?`(${r.duration})`:""}`)}e.push("")}e.push("---"),e.push("")}}return e.push("## 📊 Package Summary"),e.push(""),e.push(`- **Total steps:** ${s.totalSteps}`),e.push(`- **Briefs generated:** ${s.briefsGenerated}`),e.push(`- **Generation time:** ${(s.generationTimeMs/1e3).toFixed(1)}s`),e.push(`- **Generated at:** ${s.generatedAt}`),e.join(`
`)}export{V as generateCourseBriefPackage,B as generateVideoBrief};
