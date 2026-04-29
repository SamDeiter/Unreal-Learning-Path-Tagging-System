import{g as S,h as k}from"./vendor-firebase-bQTC33XI.js";import{l as m,m as g,k as w}from"./index-BFTBlPTH.js";import{retryWithBackoff as b}from"./retryWithBackoff-ChyV6NkW.js";import{r as v}from"./tokenTracker-o5lEoLZH.js";import{p as M}from"./gapDetection-sGqKdlsh.js";import"./vendor-cytoscape-DkSHza4h.js";import"./vendor-export-WthTs8Cq.js";import"./data-courses-DS8fFyeH.js";import"./pathSearch-MFW30__-.js";const p=3,f=new Map;function T(t){const i=(t.title||"").toLowerCase(),r=(t.summary||"").toLowerCase(),e=`${i} ${r}`;return e.includes("advanced")||e.includes("optimization")||e.includes("subsystem")||e.includes("c++")?"Advanced":e.includes("beginner")||e.includes("introduction")||e.includes("getting started")||e.includes("basics")?"Beginner":"Intermediate"}function B(t){const i=!!t.video,r=(t.whatToDo||[]).length,e=T(t);if(i&&t.video?.durationSeconds){const u=Math.ceil(t.video.durationSeconds/60);return`${u}-${u+3} minutes (based on existing video)`}const l=(e==="Advanced"?10:e==="Beginner"?5:7)+r*2;return`${l}-${l+4} minutes`}async function $(t,i={}){const r=`${t.title||""}_${i.stepIndex||0}`;if(f.has(r))return f.get(r);const e=T(t),a=B(t),n={chapterTitle:i.chapterTitle||t.title||"Untitled",stepTitle:t.title||"Untitled Step",targetLength:a,skillLevel:e,position:`Step ${(i.stepIndex||0)+1} of ${i.totalSteps||"?"}`,pathTitle:i.pathTitle||"",learnerGoal:i.learnerGoal||"",whyThisMatters:t.whyThisMatters||"",whatToDo:t.whatToDo||[],commonMistake:t.commonMistake||"",takeaway:t.takeaway||"",existingResources:[],requiredDemonstrations:[],talkingPoints:[],requiredTerminology:[],editorSetup:[],scriptNotes:""};if(t.video&&n.existingResources.push({type:"video",title:t.video.title||t.title,url:t.video.url||"",duration:t.video.durationSeconds?`${Math.ceil(t.video.durationSeconds/60)}min`:"unknown",relevance:1}),t.goDeeper?.length)for(const l of t.goDeeper)n.existingResources.push({type:l.type||"docs",title:l.label||"",url:l.url||"",relevance:.7});try{const l=D(t,i,e),u=w(),o=S(u,"us-central1"),s=k(o,"classifySegments"),c=(await b(()=>s({prompt:l}),{maxRetries:1,baseDelayMs:2e3,label:"videoBrief"})).data?.text||"";v("videoBrief",Math.ceil(l.length/4),Math.ceil(c.length/4));const d=M(c);d&&(n.requiredDemonstrations=d.requiredDemonstrations||n.requiredDemonstrations,n.talkingPoints=d.talkingPoints||n.talkingPoints,n.requiredTerminology=d.requiredTerminology||n.requiredTerminology,n.editorSetup=d.editorSetup||n.editorSetup,n.scriptNotes=d.scriptNotes||n.scriptNotes)}catch(l){g("[VideoBrief] AI enrichment failed, using base data:",l.message),n.requiredDemonstrations=E(t),n.talkingPoints=R(t),n.requiredTerminology=N(t)}return f.set(r,n),n}function D(t,i,r){const e=(t.summary||t._bridgeText||"").slice(0,500),a=(t.whatToDo||[]).join(`
  - `);return`You are an Unreal Engine 5 video tutorial producer. Generate a RECORDING BRIEF for an instructor.

CONTEXT:
- Course: "${i.pathTitle||"UE5 Tutorial"}"
- Chapter: "${i.chapterTitle||t.title}"
- Learner Goal: "${i.learnerGoal||"Learn UE5"}"
- Skill Level: ${r}
- Position: Step ${(i.stepIndex||0)+1} of ${i.totalSteps||"?"}

STEP CONTENT:
- Title: "${t.title||""}"
- Summary: "${e}"
- Why It Matters: "${t.whyThisMatters||""}"
- Actions:
  - ${a||"Not specified"}
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
- Return valid JSON only, no markdown fences`}function E(t){const i=[];if(t.whatToDo?.length)for(const r of t.whatToDo.slice(0,5))i.push(`Demonstrate: ${r}`);return t.video?.url&&i.push("Show the referenced video segment as context"),i.length>0?i:[`Walk through the key concepts of "${t.title||"this topic"}"`]}function R(t){const i=[];return t.whyThisMatters&&i.push(`Explain: ${t.whyThisMatters}`),t.commonMistake&&i.push(`Warn about: ${t.commonMistake}`),t.takeaway&&i.push(`Summarize: ${t.takeaway}`),i.length>0?i:[`Explain why "${t.title}" matters in a real project`]}function N(t){const i=[],r=[...t.video?.tags||[],...t.tags||[]];for(const e of r.slice(0,5))typeof e=="string"&&e.length>2&&i.push(e);return i}async function q(t,{onProgress:i}={}){if(!t?.sections?.length)throw new Error("Invalid V2 path: no sections found");m(`[VideoBrief] Generating brief package for "${t.title}"`);const r=Date.now(),e=[],a=[];for(const o of t.sections)for(const s of o.steps||[])a.push({step:s,sectionTitle:o.title||o.phase||"Chapter"});const n=a.length;for(let o=0;o<a.length;o+=p){const s=a.slice(o,o+p),h=await Promise.allSettled(s.map(({step:c,sectionTitle:d},y)=>$(c,{pathTitle:t.title||"UE5 Learning Path",learnerGoal:t.query||"",stepIndex:o+y,totalSteps:n,chapterTitle:d})));for(const c of h)c.status==="fulfilled"?e.push(c.value):(g("[VideoBrief] Step brief failed:",c.reason?.message),e.push(null));i?.(Math.min(o+p,n),n),o+p<a.length&&await new Promise(c=>setTimeout(c,500))}const l={title:t.title||"Course Brief Package",generatedAt:new Date().toISOString(),totalSteps:a.length,briefsGenerated:e.filter(Boolean).length,generationTimeMs:Date.now()-r},u=C(t,e,l);return m(`[VideoBrief] Package complete: ${l.briefsGenerated}/${n} briefs (${l.generationTimeMs}ms)`),{markdown:u,briefs:e,metadata:l}}function C(t,i,r){const e=[];e.push(`# 🎬 Recording Brief: ${r.title}`),e.push(""),e.push(`> Generated: ${new Date(r.generatedAt).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}`),e.push(`> Steps: ${r.totalSteps} · Briefs generated: ${r.briefsGenerated}`),e.push(""),e.push("---"),e.push("");let a=0;for(const n of t.sections||[]){const l=n.title||n.phase||"Chapter";e.push(`## 📂 ${l}`),n.purpose&&e.push(`> ${n.purpose}`),e.push("");for(const u of n.steps||[]){const o=i[a];if(a++,!o){e.push(`### ❌ ${u.title||"Untitled"} — Brief generation failed`),e.push("");continue}if(e.push(`### 🎥 ${o.stepTitle}`),e.push(""),e.push("| Field | Value |"),e.push("|---|---|"),e.push(`| **Target Length** | ${o.targetLength} |`),e.push(`| **Skill Level** | ${o.skillLevel} |`),e.push(`| **Position** | ${o.position} |`),e.push(""),o.whyThisMatters&&(e.push(`**💡 Why This Matters:** ${o.whyThisMatters}`),e.push("")),o.editorSetup?.length){e.push("**🖥️ Editor Setup (before recording):**");for(const s of o.editorSetup)e.push(`- [ ] ${s}`);e.push("")}if(o.requiredDemonstrations?.length){e.push("**📹 Required Demonstrations:**");for(let s=0;s<o.requiredDemonstrations.length;s++)e.push(`${s+1}. ${o.requiredDemonstrations[s]}`);e.push("")}if(o.talkingPoints?.length){e.push("**🗣️ Talking Points:**");for(const s of o.talkingPoints)e.push(`- ${s}`);e.push("")}if(o.requiredTerminology?.length&&(e.push(`**📖 Required Terminology:** ${o.requiredTerminology.join(", ")}`),e.push("")),o.commonMistake&&(e.push(`**⚠️ Common Mistake to Address:** ${o.commonMistake}`),e.push("")),o.scriptNotes&&(e.push(`**📝 Script Notes:** ${o.scriptNotes}`),e.push("")),o.existingResources?.length){e.push("**📚 Existing Resources:**");for(const s of o.existingResources){const h=s.url?`[${s.title}](${s.url})`:s.title;e.push(`- ${s.type==="video"?"🎬":"📄"} ${h} ${s.duration?`(${s.duration})`:""}`)}e.push("")}e.push("---"),e.push("")}}return e.push("## 📊 Package Summary"),e.push(""),e.push(`- **Total steps:** ${r.totalSteps}`),e.push(`- **Briefs generated:** ${r.briefsGenerated}`),e.push(`- **Generation time:** ${(r.generationTimeMs/1e3).toFixed(1)}s`),e.push(`- **Generated at:** ${r.generatedAt}`),e.join(`
`)}function L(){f.clear()}function U(t,i="recording_brief.md"){const r=new Blob([t],{type:"text/markdown"}),e=URL.createObjectURL(r),a=document.createElement("a");a.href=e,a.download=i,document.body.appendChild(a),a.click(),document.body.removeChild(a),URL.revokeObjectURL(e)}const F={generateVideoBrief:$,generateCourseBriefPackage:q,clearBriefCache:L,downloadBriefAsMarkdown:U};export{L as clearBriefCache,F as default,U as downloadBriefAsMarkdown,q as generateCourseBriefPackage,$ as generateVideoBrief};
