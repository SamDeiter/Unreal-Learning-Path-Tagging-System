import{f as L,g as B,u as E,j as n}from"./index-4sGzRS9-.js";import{a as g}from"./vendor-cytoscape-hdah7_Xt.js";import{g as D,a as R,b as _}from"./generationEngine-DimdR5B_.js";import{a as A}from"./data-courses-CmDFBIif.js";import{m as I,a as P,n as F}from"./vendor-firebase-DNc0QRT5.js";import"./TagGraphService-DNfLa_kD.js";const z=e=>{if(!e||e.length===0)return[];const t=new Set;e.forEach(a=>{a.tags?.topic&&t.add(a.tags.topic),a.topic&&t.add(a.topic)});const o=[],s=new Set;return t.forEach(a=>{A[a]&&A[a].forEach(i=>{s.has(i.url)||(s.add(i.url),o.push({...i,topic:a}))})}),o};function N(e){return Array.isArray(e?.tags)?e.tags:Array.isArray(e?.extracted_tags)?e.extracted_tags:[]}let $=null,U=null,M=null;function J(){if($)return!0;if(!L.apiKey||L.apiKey==="undefined")return!1;try{return $=B(),U=P($),M=F($,"us-central1"),!0}catch(e){return console.error("Firebase initialization failed:",e),!1}}function O(){return J()?!!U?.currentUser:!1}async function q(e,t){if(!t||t.length===0)return w(e,t);const o=t.map((i,l)=>{const m=N(i).slice(0,5).join(", "),f=i.role||"Core";return`${l+1}. "${i.title}" [${f}] - Tags: ${m||"General UE5"}`}).join(`
`),s=`You are an expert instructional designer specializing in Unreal Engine 5 training.
Create specific, actionable learning blueprints that are relevant to the actual course content.
Avoid generic phrases like "Master concepts in X" - be specific about WHAT skills will be learned.`,a=`Create a Learning Blueprint for this learning path:

**Learning Intent:**
- Primary Goal: ${e.primaryGoal||"UE5 Development"}
- Skill Level: ${e.skillLevel||"Intermediate"}
- Time Available: ${e.timeBudget||"Flexible"}

**Selected Courses (${t.length} total):**
${o}

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

Respond with ONLY valid JSON, no markdown.`;if(!O())return w(e,t);try{const l=await I(M,"generateCourseMetadata")({systemPrompt:s,userPrompt:a,temperature:.4,model:"gemini-1.5-flash"});if(!l.data.success)throw new Error(l.data.error||"Blueprint generation failed");const f=l.data.textResponse.match(/\{[\s\S]*\}/);if(f)return JSON.parse(f[0]);throw new Error("No JSON found in response")}catch(i){return console.error("Learning Blueprint generation error:",i),w(e,t)}}function w(e,t){const o=t.flatMap(i=>N(i)),s=[...new Set(o)].slice(0,5),a=s[0]||"UE5";return{outline:[{title:"Core Curriculum: "+(e.primaryGoal||a),items:t.slice(0,5).map((i,l)=>({text:`Learn ${N(i)[0]||"core"} techniques from ${i.title?.split(" ")[0]||"lesson"}`,courseIndex:l+1}))}],objectives:[{text:`Apply ${a} techniques in project workflows`},{text:`Troubleshoot common ${a} issues independently`},{text:`Implement ${a} best practices in production`}],goals:[{text:`Build proficiency in ${s.slice(0,3).join(", ")}`,metric:`Complete ${t.length} modules`},{text:"Create a portfolio piece",metric:"Finished project using skills"},{text:"Apply skills in real work",metric:"Use in production project"}]}}function S(e){const t=e.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,""),o=Date.now().toString(36);return`lp-${t}-${o}`}function C(e){if(!e)return"Unknown";const t=Math.floor(e/60),o=e%60;return t===0?`${o} min`:o===0?`${t}h`:`${t}h ${o}m`}function X(e,t){const o=S(e.primaryGoal||"learning-path"),s=t.reduce((i,l)=>i+(l.duration_minutes||0),0);return{id:o,title:e.primaryGoal||"Untitled Learning Path",description:`A curated learning path covering ${t.length} topics.`,requiredTags:t.flatMap(i=>i.gemini_system_tags||[]).slice(0,10),estimatedDuration:C(s),steps:t.map((i,l)=>({order:l+1,title:i.title,description:i.topic||"",resourceUrl:i.video_url||i.url||"",resourceType:"video",duration:C(i.duration_minutes||0),courseCode:i.code}))}}function H(e,t){const o=["Order","Title","Course Code","Duration","Topic","Level","URL"],s=t.map((a,i)=>[i+1,`"${a.title.replace(/"/g,'""')}"`,a.code||"",C(a.duration_minutes||0),a.topic||"",a.tags?.level||"",a.video_url||a.url||""]);return[o.join(","),...s.map(a=>a.join(","))].join(`
`)}function V(e,t){const o=S(e.primaryGoal||"learning-path"),s=e.primaryGoal||"Learning Path",a=t.map((l,m)=>`
    <item identifier="item_${m+1}" identifierref="resource_${m+1}">
      <title>${T(l.title)}</title>
    </item>`).join(""),i=t.map((l,m)=>`
    <resource identifier="resource_${m+1}" type="webcontent" href="content/step${m+1}.html">
      <file href="content/step${m+1}.html"/>
    </resource>`).join("");return`<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${o}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="org_1">
    <organization identifier="org_1">
      <title>${T(s)}</title>
      ${a}
    </organization>
  </organizations>
  <resources>
    ${i}
  </resources>
</manifest>`}function K(e,t,o=0){const s=t[o],a=S(e.primaryGoal||"learning-path");return{actor:{mbox:"mailto:learner@example.com",name:"Learner Name"},verb:{id:"http://adlnet.gov/expapi/verbs/completed",display:{"en-US":"completed"}},object:{id:`https://unrealengine.com/learning/path/${a}/step/${o+1}`,definition:{name:{"en-US":s?.title||`Step ${o+1}`},description:{"en-US":s?.topic||""},type:"http://adlnet.gov/expapi/activities/lesson"}},context:{contextActivities:{parent:[{id:`https://unrealengine.com/learning/path/${a}`,definition:{name:{"en-US":e.primaryGoal||"Learning Path"},type:"http://adlnet.gov/expapi/activities/course"}}]}}}}function T(e){return e?e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;"):""}function y(e,t,o="application/json"){const s=new Blob([typeof e=="string"?e:JSON.stringify(e,null,2)],{type:o}),a=URL.createObjectURL(s),i=document.createElement("a");i.href=a,i.download=t,document.body.appendChild(i),i.click(),document.body.removeChild(i),URL.revokeObjectURL(a)}function ne(){const{learningIntent:e,courses:t}=E(),[o,s]=g.useState("outline"),[a,i]=g.useState(!1),[l,m]=g.useState(null),[f,x]=g.useState(!1),h=g.useMemo(()=>z(t),[t]),j=g.useMemo(()=>({outline:_(e,t),objectives:R(e,t),goals:D(e,t)}),[e,t]),d=g.useMemo(()=>l?{outline:l.outline||j.outline,objectives:l.objectives||j.objectives,goals:l.goals||j.goals}:j,[l,j]),k=g.useCallback(async()=>{if(!(t.length===0||!e.primaryGoal)&&O()){i(!0);try{const r=await q(e,t);m(r)}catch(r){console.error("AI Blueprint generation failed:",r)}finally{i(!1)}}},[t,e]);g.useEffect(()=>{if(t.length>0&&e.primaryGoal){const r=setTimeout(k,1500);return()=>clearTimeout(r)}},[t,e,k]);const v=t.length>0&&e.primaryGoal;return n.jsxs("div",{className:"output-panel",children:[n.jsxs("div",{className:"output-header",children:[n.jsxs("h3",{className:"output-title",children:["Learning Blueprint",a&&n.jsx("span",{className:"ai-badge generating",children:"✨ AI"}),l&&!a&&n.jsx("span",{className:"ai-badge",children:"✨"})]}),v&&n.jsx("button",{className:"btn btn-secondary btn-sm copy-blueprint-btn",title:"Copy the entire blueprint as markdown to your clipboard",onClick:()=>{const r=`
# Learning Blueprint

## Outline
${d.outline.map(c=>`### ${c.title}
${c.items.map(u=>`- ${u.text}`).join(`
`)}`).join(`

`)}

## Objectives
${d.objectives.map(c=>`- ${c.text}`).join(`
`)}

## Goals
${d.goals.map(c=>`- ${c.text}${c.metric?` (Metric: ${c.metric})`:""}`).join(`
`)}

## Documentation Links
${h.length>0?h.map(c=>`- ${c.title}: ${c.url}`).join(`
`):"No official documentation links available."}
              `.trim();navigator.clipboard.writeText(r);const p=document.querySelector(".copy-blueprint-btn"),b=p.textContent;p.textContent="✓ Copied!",setTimeout(()=>p.textContent=b,2e3)},children:"📋 Copy"}),v&&n.jsx("button",{className:"btn btn-secondary btn-sm download-blueprint-btn",title:"Download the blueprint as a markdown file",onClick:()=>{const r=`# Learning Blueprint: ${e.primaryGoal||"My Learning Path"}

Generated: ${new Date().toLocaleDateString()}

## Learning Intent
- **Primary Goal:** ${e.primaryGoal||"Not specified"}
- **Skill Level:** ${e.skillLevel||"Not specified"}
- **Time Budget:** ${e.timeBudget?`~${e.timeBudget} hours`:"No limit"}

## Outline
${d.outline.map(u=>`### ${u.title}
${u.items.map(G=>`- ${G.text}`).join(`
`)}`).join(`

`)}

## Learning Objectives
${d.objectives.map(u=>`- ${u.text}`).join(`
`)}

## Goals & Milestones
${d.goals.map(u=>`- ${u.text}${u.metric?` (Metric: ${u.metric})`:""}`).join(`
`)}

## Documentation Links
${h.length>0?h.map(u=>`- [${u.title}](${u.url})`).join(`
`):"No official documentation links available."}
`,p=new Blob([r],{type:"text/markdown"}),b=URL.createObjectURL(p),c=document.createElement("a");c.href=b,c.download=`learning-blueprint-${(e.primaryGoal||"path").toLowerCase().replace(/\s+/g,"-")}.md`,document.body.appendChild(c),c.click(),document.body.removeChild(c),URL.revokeObjectURL(b)},children:"⬇️ Download"}),v&&n.jsxs("div",{className:"export-dropdown-container",children:[n.jsx("button",{className:"btn btn-primary btn-sm export-lms-btn",title:"Export path for LMS integration",onClick:()=>x(!f),children:"📤 Export for LMS ▾"}),f&&n.jsxs("div",{className:"export-dropdown-menu",children:[n.jsx("button",{onClick:()=>{const r=X(e,t);y(r,`${r.id}.json`,"application/json"),x(!1)},children:"📋 JSON (LMS Import)"}),n.jsx("button",{onClick:()=>{const r=H(e,t);y(r,`learning-path-${Date.now()}.csv`,"text/csv"),x(!1)},children:"📊 CSV (Spreadsheet)"}),n.jsx("button",{onClick:()=>{const r=V(e,t);y(r,"imsmanifest.xml","application/xml"),x(!1)},children:"📦 SCORM Manifest"}),n.jsx("button",{onClick:()=>{const r=K(e,t,0);y(r,`xapi-template-${Date.now()}.json`,"application/json"),x(!1)},children:"🔗 xAPI Template"})]})]}),n.jsxs("div",{className:"output-tabs",children:[n.jsx("button",{className:`output-tab ${o==="outline"?"active":""}`,onClick:()=>s("outline"),title:"Structured course outline with sections",children:"📄 Outline"}),n.jsx("button",{className:`output-tab ${o==="objectives"?"active":""}`,onClick:()=>s("objectives"),title:"Specific learning outcomes students will achieve",children:"🎯 Objectives"}),n.jsx("button",{className:`output-tab ${o==="goals"?"active":""}`,onClick:()=>s("goals"),title:"High-level milestones and time estimates",children:"🚀 Goals"}),n.jsxs("button",{className:`output-tab ${o==="docs"?"active":""}`,onClick:()=>s("docs"),title:"Links to official Unreal Engine documentation",children:["📚 Docs ",h.length>0&&n.jsxs("span",{className:"tab-count",children:["(",h.length,")"]})]})]})]}),n.jsx("div",{className:"output-content",children:v?n.jsxs(n.Fragment,{children:[o==="outline"&&n.jsx("div",{className:"gen-view",children:d.outline.map((r,p)=>n.jsxs("div",{className:"gen-section",children:[n.jsx("h4",{className:"gen-section-title",children:r.title}),n.jsx("ul",{className:"gen-list",children:r.items.map((b,c)=>n.jsx("li",{className:"gen-item outline",children:b.text},b.id||`item-${p}-${c}`))})]},r.id||`section-${p}`))}),o==="objectives"&&n.jsx("div",{className:"gen-view",children:n.jsx("ul",{className:"gen-list",children:d.objectives.map((r,p)=>n.jsx("li",{className:"gen-item objective",children:r.text},r.id||`obj-${p}`))})}),o==="goals"&&n.jsx("div",{className:"gen-view",children:n.jsx("ul",{className:"gen-list",children:d.goals.map((r,p)=>n.jsxs("li",{className:"gen-item goal",children:[r.text,r.metric&&n.jsxs("span",{className:"goal-metric",children:["→ ",r.metric]})]},r.id||`goal-${p}`))})}),o==="docs"&&n.jsx("div",{className:"gen-view docs-view",children:h.length===0?n.jsx("div",{className:"empty-docs",children:"No official documentation links available for selected courses."}):n.jsx("ul",{className:"docs-list",children:h.map((r,p)=>n.jsx("li",{className:"doc-item",children:n.jsxs("a",{href:r.url,target:"_blank",rel:"noopener noreferrer",children:[r.title,n.jsxs("span",{className:"doc-topic",children:["(",r.topic,")"]})]})},p))})})]}):n.jsx("div",{className:"empty-output",children:e.primaryGoal?"Add courses to generate a blueprint.":"Set your learning intent to generate a blueprint."})})]})}export{ne as default};
