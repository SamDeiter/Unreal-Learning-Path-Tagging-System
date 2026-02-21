import{f as A,g as R,u as D,j as i}from"./index-TeJ6iJX4.js";import{a as d}from"./vendor-cytoscape-hdah7_Xt.js";import{g as F,a as z,b as I}from"./generationEngine-s0xAMXIK.js";import{a as B}from"./data-courses-Cfgu6N5t.js";import{n as Y,a as q,p as J}from"./vendor-firebase-BEnYNivV.js";import{g as U,a as X,d as V}from"./PersonaService-D9aA7hNj.js";import"./TagGraphService-DUJV4Gip.js";const H=e=>{if(!e||e.length===0)return[];const t=new Set;e.forEach(r=>{r.tags?.topic&&t.add(r.tags.topic),r.topic&&t.add(r.topic)});const n=[],l=new Set;return t.forEach(r=>{B[r]&&B[r].forEach(a=>{l.has(a.url)||(l.add(a.url),n.push({...a,topic:r}))})}),n};function _(e){return Array.isArray(e?.tags)?e.tags:Array.isArray(e?.extracted_tags)?e.extracted_tags:[]}let w=null,E=null,P=null;function W(){if(w)return!0;if(!A.apiKey||A.apiKey==="undefined")return!1;try{return w=R(),E=q(w),P=J(w,"us-central1"),!0}catch(e){return console.error("Firebase initialization failed:",e),!1}}function O(){return W()?!!E?.currentUser:!1}async function K(e,t){if(!t||t.length===0)return k(e,t);const n=t.map((a,s)=>{const m=_(a).slice(0,5).join(", "),x=a.role||"Core";return`${s+1}. "${a.title}" [${x}] - Tags: ${m||"General UE5"}`}).join(`
`),l=`You are an expert instructional designer specializing in Unreal Engine 5 training.
Create specific, actionable learning blueprints that are relevant to the actual course content.
Avoid generic phrases like "Master concepts in X" - be specific about WHAT skills will be learned.`,r=`Create a Learning Blueprint for this learning path:

**Learning Intent:**
- Primary Goal: ${e.primaryGoal||"UE5 Development"}
- Skill Level: ${e.skillLevel||"Intermediate"}
- Time Available: ${e.timeBudget||"Flexible"}

**Selected Courses (${t.length} total):**
${n}

Generate a JSON response with:

1. "outline": Array of section objects, each with:
   - "title": Section title (e.g., "Foundational Prerequisites", "Core Curriculum: Niagara VFX")
   - "items": Array of specific learning activities (NOT just course titles!)
     Each item has: "text" (specific skill/activity), "courseIndex" (1-based)

2. "objectives": Array of 4-6 MEASURABLE learning objectives using Bloom's taxonomy verbs
   Each has: "text" (specific, measurable objective)

3. "goals": Array of 3 outcome goals with:
   - "text": Concrete achievement statement
   - "metric": How to measure completion

Be SPECIFIC to the actual tags and content. Reference real UE5 concepts like Niagara, Blueprints, Materials, etc.

Respond with ONLY valid JSON, no markdown.`;if(!O())return k(e,t);try{const s=await Y(P,"generateCourseMetadata")({systemPrompt:l,userPrompt:r,temperature:.4,model:"gemini-1.5-flash"});if(!s.data.success)throw new Error(s.data.error||"Blueprint generation failed");const x=s.data.textResponse.match(/\{[\s\S]*\}/);if(x)return JSON.parse(x[0]);throw new Error("No JSON found in response")}catch(a){return console.error("Learning Blueprint generation error:",a),k(e,t)}}function k(e,t){const n=t.flatMap(a=>_(a)),l=[...new Set(n)].slice(0,5),r=l[0]||"UE5";return{outline:[{title:"Core Curriculum: "+(e.primaryGoal||r),items:t.slice(0,5).map((a,s)=>({text:`Learn ${_(a)[0]||"core"} techniques from ${a.title?.split(" ")[0]||"lesson"}`,courseIndex:s+1}))}],objectives:[{text:`Apply ${r} techniques in project workflows`},{text:`Troubleshoot common ${r} issues independently`},{text:`Implement ${r} best practices in production`}],goals:[{text:`Build proficiency in ${l.slice(0,3).join(", ")}`,metric:`Complete ${t.length} modules`},{text:"Create a portfolio piece",metric:"Finished project using skills"},{text:"Apply skills in real work",metric:"Use in production project"}]}}function L(e){const t=e.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,""),n=Date.now().toString(36);return`lp-${t}-${n}`}function S(e){if(!e)return"Unknown";const t=Math.floor(e/60),n=e%60;return t===0?`${n} min`:n===0?`${t}h`:`${t}h ${n}m`}function Q(e,t){const n=L(e.primaryGoal||"learning-path"),l=t.reduce((a,s)=>a+(s.duration_minutes||0),0);return{id:n,title:e.primaryGoal||"Untitled Learning Path",description:`A curated learning path covering ${t.length} topics.`,requiredTags:t.flatMap(a=>a.gemini_system_tags||[]).slice(0,10),estimatedDuration:S(l),steps:t.map((a,s)=>({order:s+1,title:a.title,description:a.topic||"",resourceUrl:a.video_url||a.url||"",resourceType:"video",duration:S(a.duration_minutes||0),courseCode:a.code}))}}function Z(e,t){const n=["Order","Title","Course Code","Duration","Topic","Level","URL"],l=t.map((r,a)=>[a+1,`"${r.title.replace(/"/g,'""')}"`,r.code||"",S(r.duration_minutes||0),r.topic||"",r.tags?.level||"",r.video_url||r.url||""]);return[n.join(","),...l.map(r=>r.join(","))].join(`
`)}function ee(e,t){const n=L(e.primaryGoal||"learning-path"),l=e.primaryGoal||"Learning Path",r=t.map((s,m)=>`
    <item identifier="item_${m+1}" identifierref="resource_${m+1}">
      <title>${T(s.title)}</title>
    </item>`).join(""),a=t.map((s,m)=>`
    <resource identifier="resource_${m+1}" type="webcontent" href="content/step${m+1}.html">
      <file href="content/step${m+1}.html"/>
    </resource>`).join("");return`<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${n}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="org_1">
    <organization identifier="org_1">
      <title>${T(l)}</title>
      ${r}
    </organization>
  </organizations>
  <resources>
    ${a}
  </resources>
</manifest>`}function te(e,t,n=0){const l=t[n],r=L(e.primaryGoal||"learning-path");return{actor:{mbox:"mailto:learner@example.com",name:"Learner Name"},verb:{id:"http://adlnet.gov/expapi/verbs/completed",display:{"en-US":"completed"}},object:{id:`https://unrealengine.com/learning/path/${r}/step/${n+1}`,definition:{name:{"en-US":l?.title||`Step ${n+1}`},description:{"en-US":l?.topic||""},type:"http://adlnet.gov/expapi/activities/lesson"}},context:{contextActivities:{parent:[{id:`https://unrealengine.com/learning/path/${r}`,definition:{name:{"en-US":e.primaryGoal||"Learning Path"},type:"http://adlnet.gov/expapi/activities/course"}}]}}}}function T(e){return e?e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;"):""}function C(e,t,n="application/json"){const l=new Blob([typeof e=="string"?e:JSON.stringify(e,null,2)],{type:n}),r=URL.createObjectURL(l),a=document.createElement("a");a.href=r,a.download=t,document.body.appendChild(a),a.click(),document.body.removeChild(a),URL.revokeObjectURL(r)}const ie={animation:{animator_alex:"This builds the real-time animation skills you need to stop waiting for offline renders.",rigger_regina:"Understanding animation workflows helps you build rigs that animators actually want to use."},sequencer:{animator_alex:"Sequencer replaces your render queue — preview cinematic shots in real-time.",designer_cpg:"Sequencer lets you create product turntables and reveal animations without After Effects."},lighting:{animator_alex:"Lumen gives you instant lighting feedback — no more bake times.",architect_amy:"Real-time lighting is what makes your archviz walkthroughs feel photorealistic to clients.",designer_cpg:"Studio lighting presets help you match the product photography your brand team expects.",automotive_andy:"Accurate lighting is critical for paint and material evaluation in configurators."},materials:{designer_cpg:"Material Editor lets you match physical product materials without a photography studio.",architect_amy:"PBR materials make your interior renders indistinguishable from photos.",automotive_andy:"Automotive paint and trim materials need to match the real car — this shows you how.",vfx_victor:"Shader networks in UE5 replace your compositing lookdev pipeline."},blueprint:{indie_isaac:"Blueprints let you prototype gameplay mechanics without writing a line of C++.",logic_liam:"Understanding Blueprint patterns helps you decide when to port critical systems to C++.",simulation_sam:"Blueprint scripting is how you wire up interactive training scenarios."},niagara:{vfx_victor:"Niagara replaces your particle pipeline — real-time VFX iteration at 60fps."},"control rig":{rigger_regina:"Control Rig is UE5's native rigging system — no more Maya rig export headaches."},retarget:{rigger_regina:"Retargeting lets you share rigs across characters without rebuilding from scratch.",animator_alex:"Retargeting means your mocap data works on any character skeleton."},packaging:{indie_isaac:"Packaging is the last mile — this ensures your game actually ships.",logic_liam:"Build configuration matters for performance profiling on target hardware."},profiling:{logic_liam:"Profiling separates a working prototype from a shippable product."},"digital twin":{simulation_sam:"Digital twins are how you mirror real-world training environments in UE5."},vehicle:{automotive_andy:"Vehicle configurators are UE5's fastest-growing enterprise use case."}};function ne(e,t){if(!e||!t)return{hasContext:!1,message:"",topic:"",personaName:""};const n=U(e);if(!n)return{hasContext:!1,message:"",topic:"",personaName:""};const l=(t.title||"").toLowerCase(),r=[...t.canonical_tags||[],...t.ai_tags||[],...t.gemini_system_tags||[],...t.transcript_tags||[],...t.extracted_tags||[]].map(s=>typeof s=="string"?s.toLowerCase():""),a=`${l} ${r.join(" ")}`;for(const[s,m]of Object.entries(ie))if(a.includes(s)&&m[e])return{hasContext:!0,message:m[e],topic:s,personaName:n.name||n.id};return{hasContext:!1,message:"",topic:"",personaName:n.name||n.id}}function ae(e,t=[]){return!e||t.length===0?[]:t.map(n=>({courseCode:n.code,...ne(e,n)}))}function re(e){const t=U(e);if(!t)return{greeting:"Here's your personalized learning path:",painPoints:[],icon:"📚"};const n=X(t);return{greeting:{animator_alex:"🎬 Your animation-focused path is ready:",rigger_regina:"🦴 Your rigging-focused path is ready:",indie_isaac:"🎮 Your game dev path is ready:",logic_liam:"⚙️ Your systems engineering path is ready:",designer_cpg:"🎨 Your product visualization path is ready:",architect_amy:"🏛️ Your architectural visualization path is ready:",simulation_sam:"🏭 Your simulation & training path is ready:",vfx_victor:"✨ Your VFX production path is ready:",automotive_andy:"🚗 Your automotive visualization path is ready:"}[e]||`Your personalized path for ${t.name||e} is ready:`,painPoints:n,icon:t.icon||"📚"}}function de(){const{learningIntent:e,courses:t}=D(),[n,l]=d.useState("outline"),[r,a]=d.useState(!1),[s,m]=d.useState(null),[x,b]=d.useState(!1),h=d.useMemo(()=>H(t),[t]),y=d.useMemo(()=>{const o=e?.primaryGoal;return o&&V(o)?.id||null},[e]),j=d.useMemo(()=>re(y),[y]),G=d.useMemo(()=>ae(y,t),[y,t]),v=d.useMemo(()=>({outline:I(e,t),objectives:z(e,t),goals:F(e,t)}),[e,t]),g=d.useMemo(()=>s?{outline:s.outline||v.outline,objectives:s.objectives||v.objectives,goals:s.goals||v.goals}:v,[s,v]),M=d.useCallback(async()=>{if(!(t.length===0||!e.primaryGoal)&&O()){a(!0);try{const o=await K(e,t);m(o)}catch(o){console.error("AI Blueprint generation failed:",o)}finally{a(!1)}}},[t,e]);d.useEffect(()=>{if(t.length>0&&e.primaryGoal){const o=setTimeout(M,1500);return()=>clearTimeout(o)}},[t,e,M]);const $=t.length>0&&e.primaryGoal;return i.jsxs("div",{className:"output-panel",children:[i.jsxs("div",{className:"output-header",children:[i.jsxs("h3",{className:"output-title",children:["Learning Blueprint",r&&i.jsx("span",{className:"ai-badge generating",children:"✨ AI"}),s&&!r&&i.jsx("span",{className:"ai-badge",children:"✨"})]}),$&&i.jsx("button",{className:"btn btn-secondary btn-sm copy-blueprint-btn",title:"Copy the entire blueprint as markdown to your clipboard",onClick:()=>{const o=`
# Learning Blueprint

## Outline
${g.outline.map(c=>`### ${c.title}
${c.items.map(p=>`- ${p.text}`).join(`
`)}`).join(`

`)}

## Objectives
${g.objectives.map(c=>`- ${c.text}`).join(`
`)}

## Goals
${g.goals.map(c=>`- ${c.text}${c.metric?` (Metric: ${c.metric})`:""}`).join(`
`)}

## Documentation Links
${h.length>0?h.map(c=>`- ${c.title}: ${c.url}`).join(`
`):"No official documentation links available."}
              `.trim();navigator.clipboard.writeText(o);const u=document.querySelector(".copy-blueprint-btn"),f=u.textContent;u.textContent="✓ Copied!",setTimeout(()=>u.textContent=f,2e3)},children:"📋 Copy"}),$&&i.jsx("button",{className:"btn btn-secondary btn-sm download-blueprint-btn",title:"Download the blueprint as a markdown file",onClick:()=>{const o=`# Learning Blueprint: ${e.primaryGoal||"My Learning Path"}

Generated: ${new Date().toLocaleDateString()}

## Learning Intent
- **Primary Goal:** ${e.primaryGoal||"Not specified"}
- **Skill Level:** ${e.skillLevel||"Not specified"}
- **Time Budget:** ${e.timeBudget?`~${e.timeBudget} hours`:"No limit"}

## Outline
${g.outline.map(p=>`### ${p.title}
${p.items.map(N=>`- ${N.text}`).join(`
`)}`).join(`

`)}

## Learning Objectives
${g.objectives.map(p=>`- ${p.text}`).join(`
`)}

## Goals & Milestones
${g.goals.map(p=>`- ${p.text}${p.metric?` (Metric: ${p.metric})`:""}`).join(`
`)}

## Documentation Links
${h.length>0?h.map(p=>`- [${p.title}](${p.url})`).join(`
`):"No official documentation links available."}
`,u=new Blob([o],{type:"text/markdown"}),f=URL.createObjectURL(u),c=document.createElement("a");c.href=f,c.download=`learning-blueprint-${(e.primaryGoal||"path").toLowerCase().replace(/\s+/g,"-")}.md`,document.body.appendChild(c),c.click(),document.body.removeChild(c),URL.revokeObjectURL(f)},children:"⬇️ Download"}),$&&i.jsxs("div",{className:"export-dropdown-container",children:[i.jsx("button",{className:"btn btn-primary btn-sm export-lms-btn",title:"Export path for LMS integration",onClick:()=>b(!x),children:"📤 Export for LMS ▾"}),x&&i.jsxs("div",{className:"export-dropdown-menu",children:[i.jsx("button",{onClick:()=>{const o=Q(e,t);C(o,`${o.id}.json`,"application/json"),b(!1)},children:"📋 JSON (LMS Import)"}),i.jsx("button",{onClick:()=>{const o=Z(e,t);C(o,`learning-path-${Date.now()}.csv`,"text/csv"),b(!1)},children:"📊 CSV (Spreadsheet)"}),i.jsx("button",{onClick:()=>{const o=ee(e,t);C(o,"imsmanifest.xml","application/xml"),b(!1)},children:"📦 SCORM Manifest"}),i.jsx("button",{onClick:()=>{const o=te(e,t,0);C(o,`xapi-template-${Date.now()}.json`,"application/json"),b(!1)},children:"🔗 xAPI Template"})]})]}),i.jsxs("div",{className:"output-tabs",children:[i.jsx("button",{className:`output-tab ${n==="outline"?"active":""}`,onClick:()=>l("outline"),title:"Structured course outline with sections",children:"📄 Outline"}),i.jsx("button",{className:`output-tab ${n==="objectives"?"active":""}`,onClick:()=>l("objectives"),title:"Specific learning outcomes students will achieve",children:"🎯 Objectives"}),i.jsx("button",{className:`output-tab ${n==="goals"?"active":""}`,onClick:()=>l("goals"),title:"High-level milestones and time estimates",children:"🚀 Goals"}),i.jsxs("button",{className:`output-tab ${n==="docs"?"active":""}`,onClick:()=>l("docs"),title:"Links to official Unreal Engine documentation",children:["📚 Docs ",h.length>0&&i.jsxs("span",{className:"tab-count",children:["(",h.length,")"]})]})]})]}),i.jsx("div",{className:"output-content",children:$?i.jsxs(i.Fragment,{children:[n==="outline"&&i.jsxs("div",{className:"gen-view",children:[y&&j.greeting&&i.jsxs("div",{className:"persona-welcome",children:[i.jsx("strong",{children:j.greeting}),j.painPoints.length>0&&i.jsx("ul",{className:"persona-pain-points",children:j.painPoints.slice(0,3).map((o,u)=>i.jsx("li",{children:o},u))})]}),g.outline.map((o,u)=>i.jsxs("div",{className:"gen-section",children:[i.jsx("h4",{className:"gen-section-title",children:o.title}),i.jsx("ul",{className:"gen-list",children:o.items.map((f,c)=>{const p=G.find(N=>N.courseCode===f.relatedCourse);return i.jsxs("li",{className:"gen-item outline",children:[f.text,p&&p.hasContext&&i.jsxs("div",{className:"persona-context",children:["💡 ",i.jsx("em",{children:p.message})]})]},f.id||`item-${u}-${c}`)})})]},o.id||`section-${u}`))]}),n==="objectives"&&i.jsx("div",{className:"gen-view",children:i.jsx("ul",{className:"gen-list",children:g.objectives.map((o,u)=>i.jsx("li",{className:"gen-item objective",children:o.text},o.id||`obj-${u}`))})}),n==="goals"&&i.jsx("div",{className:"gen-view",children:i.jsx("ul",{className:"gen-list",children:g.goals.map((o,u)=>i.jsxs("li",{className:"gen-item goal",children:[o.text,o.metric&&i.jsxs("span",{className:"goal-metric",children:["→ ",o.metric]})]},o.id||`goal-${u}`))})}),n==="docs"&&i.jsx("div",{className:"gen-view docs-view",children:h.length===0?i.jsx("div",{className:"empty-docs",children:"No official documentation links available for selected courses."}):i.jsx("ul",{className:"docs-list",children:h.map((o,u)=>i.jsx("li",{className:"doc-item",children:i.jsxs("a",{href:o.url,target:"_blank",rel:"noopener noreferrer",children:[o.title,i.jsxs("span",{className:"doc-topic",children:["(",o.topic,")"]})]})},u))})})]}):i.jsx("div",{className:"empty-output",children:e.primaryGoal?"Add courses to generate a blueprint.":"Set your learning intent to generate a blueprint."})})]})}export{de as default};
