import{b as L,h as F}from"./vendor-firebase-CkCPdMz0.js";import{h as U,m as w,k as b}from"./index-D60Rk8Y5.js";import{a as _,M as ne,f as z,S as se}from"./pathSearch-DhRVi_7h.js";import{f as ie}from"./semanticSearchService-DThKcS8e.js";import{r as q}from"./retryWithBackoff-Ba9diV5s.js";import{r as G}from"./tokenTracker-Btoxomw7.js";const oe=[{pattern:/without\s+(?:any\s+)?code/gi,replacement:"without writing C++ or text-based code"},{pattern:/no\s+code\s+(?:is\s+)?(?:needed|required)/gi,replacement:"no C++ code is needed"},{pattern:/no\s+coding\s+(?:is\s+)?(?:needed|required)/gi,replacement:"no C++ coding is needed"},{pattern:/without\s+(?:any\s+)?programming/gi,replacement:"without text-based programming"},{pattern:/don['']t\s+need\s+(?:to\s+)?code/gi,replacement:"don't need to write C++ code"}];function ae(t,e=[]){if(!t||!Array.isArray(t))return{cleanedPath:t||[],warnings:["No path steps to validate"],autoFixes:[]};const a=[],c=[],s=new Set,d=[];for(const n of t){const i=n.segmentIndex??n.segment_index??n.index;if(i!=null&&s.has(i)){c.push(`Removed duplicate segment index ${i} (title: "${n.segment?.title||"unknown"}", category: ${n.category})`);continue}i!=null&&s.add(i),d.push(n)}for(const n of d)if(n.summary){let i=n.summary;for(const{pattern:l,replacement:T}of oe)l.lastIndex=0,l.test(i)&&(l.lastIndex=0,i=i.replace(l,T),c.push(`Fixed phrasing in step "${n.segment?.title||"unknown"}": applied "${T}" correction`));n.summary=i}if(e.length>0){const n=e.map(l=>`${l.text||""} ${l.title||""} ${l.videoTitle||""}`).join(" ").toLowerCase(),i=["depth volume","wind volume","fog volume","weather volume","ai controller","behavior tree","blackboard","nanite","lumen","niagara","mass entity","world partition","control rig","metahuman","modeling mode","texture graph","chaos physics","pcg","procedural content generation"];for(const l of d){if(!l.summary)continue;const T=l.summary.toLowerCase();for(const S of i)T.includes(S)&&!n.includes(S)&&a.push(`⚠️ Potential hallucination: "${S}" found in summary for "${l.segment?.title||"unknown"}" but NOT in source text`)}}const o=new Map;for(const n of d){const i=(n.segment?.title||n.segment?.videoTitle||"").toLowerCase().trim();i&&(o.has(i)||o.set(i,[]),o.get(i).push(n.category))}for(const[n,i]of o)i.length>1&&a.push(`⚠️ Title "${n}" appears in ${i.length} categories: [${i.join(", ")}]`);return{cleanedPath:d,warnings:a,autoFixes:c}}const H=["foundation","diagnosis","fix","transfer"],re=.25,le=new Set(["a","an","the","in","on","at","to","for","of","with","by","from","and","or","not","is","it","be","as","do","has","was","are","but","if","my","this","that","how","what","when","where","why","can","will","so","no","up","out","its","i","me","you","your","we","they","their","about","use","using","used","make","get","set","does","work","works","working","create","need","want","like","just","really","know","new","thing","things","way","going","able","look","help","try"]);function W(t,e){if(!t||!e)return 0;const a=o=>o.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(n=>n.length>2&&!le.has(n)),c=a(t);if(c.length===0)return 1;const s=new Set(a(e));return c.filter(o=>s.has(o)).length/c.length}async function Te(t,e,a=null){if(!e||e.length===0)return[];const c=e.map((o,n)=>{const i=o.type==="transcript"?`Video: ${o.videoTitle} (${o.startTimestamp||""})`:o.type==="epic_learning"?`Article: ${o.title}`:`Docs: ${o.title} > ${o.section}`;return`[${n}] ${i}
   ${o.text.slice(0,2e3)}`}).join(`

`);let s="";if(a){const{knows:o=[],gaps:n=[],level:i="beginner"}=a;s=`

ADAPTIVE DEPTH INSTRUCTIONS (IMPORTANT):
This learner completed a diagnostic quiz. Their assessed level is: ${i.toUpperCase()}
${o.length>0?`
Concepts they ALREADY KNOW (skim these — keep summaries brief, 1 sentence max):
${o.map(l=>`  - ${l.replace(/_/g," ")}`).join(`
`)}`:""}
${n.length>0?`
Knowledge GAPS to fill (go deep — write detailed 3-4 sentence summaries with specific steps):
${n.map(l=>`  - ${l.replace(/_/g," ")}`).join(`
`)}`:""}

Depth rules based on level:
${i==="beginner"?"- Start with absolute basics. Explain every concept. More foundation steps.":""}
${i==="intermediate"?"- Skip basic introductions. Focus on practical application and diagnosis.":""}
${i==="advanced"?"- Skip all basics. Go straight to advanced techniques, edge cases, and optimization.":""}
- Prioritize segments covering the GAP concepts over ones covering KNOWN concepts
- For KNOWN concepts, only include if absolutely essential for context (and mark relevance as "medium")
- For GAP concepts, always mark relevance as "high"`}const d=`You are a UE5 curriculum designer. A learner asked: "${t}"

Here are ${e.length} content segments found via semantic search:

${c}

Classify each segment and write a DIRECT TEACHING SUMMARY for each. Do NOT describe the article or video — TEACH the concept yourself using the source material.

Categories:
- foundation: Background concepts the learner needs first
- diagnosis: How to identify the specific problem or concept
- fix: Step-by-step solution or implementation
- transfer: How this knowledge applies to other contexts

Return a JSON array of objects with this format:
[{"index": 0, "category": "foundation", "relevance": "high|medium|low", "title": "A short descriptive title (3-6 words) that accurately describes this step's content. Must relate to the learner's query.", "summary": "A direct mini-lesson that teaches the concept. Extract the actual knowledge from the source and present it as clear instruction — explain what it is, how it works, and what the learner should do. Write 3-5 sentences in second person (you/your). No markdown formatting."}]

Rules:
- WORKFLOW INTENT MATCHING (CRITICAL): Before classifying, determine the learner's IMPLIED WORKFLOW from their query.
  ASSET ASSUMPTION: Assume learners already have a Static Mesh from FAB (Unreal Marketplace) or a Skeletal Mesh they imported. "Create/make [object]" means setting up and using an existing asset in a project, NOT modeling from scratch or generating 2D shapes.
  Common intent→workflow mappings:
  "create/make [3D object]" → Import FBX from FAB, Static Mesh setup, Materials, Blueprint actor, collision
  "customize appearance" → Materials, Material Editor, texture parameters
  "animate [object]" → Skeletal Mesh, Animation Blueprint, Sequencer
  "add interaction" → Blueprint, Collision, Overlap Events
  If a segment teaches a DIFFERENT tool than the implied workflow, mark it "low" relevance even if semantically similar. Mismatches to reject:
  - Texture Graph for 3D object creation (Texture Graph makes 2D procedural patterns, not 3D mesh setup)
  - Customizable Objects for basic item setup (advanced runtime customization system, not beginner workflow)
  - Control Rig for simple animation playback
  - Niagara for non-particle-related queries
  - Modeling Mode unless the query specifically asks about modeling/sculpting geometry
- TOPICAL RELEVANCE CROSS-CHECK (CRITICAL): Before marking a segment "high" or "medium", verify it teaches the SAME CONCEPT the user asked about — not just a related concept.
  Semantically similar ≠ topically relevant. Examples of FALSE MATCHES to reject as "low":
  - Query: "time dilation" → Segment about Delay nodes (pausing execution ≠ slowing world time)
  - Query: "physics simulation" → Segment about animation physics (ragdoll ≠ rigid body sim)
  - Query: "networking" → Segment about Blueprint communication (actor messaging ≠ multiplayer replication)
  - Query: "LOD" → Segment about Nanite (automatic virtualized geometry ≠ manual LOD setup)
  If the segment's PRIMARY topic is a different UE5 system/concept than what the user asked about, mark it "low" even if it shares vocabulary.
- PRIORITIZE Blueprint-based content over C++ content unless the query explicitly asks about C++. When teaching concepts, explain using Blueprint nodes, property panels, and editor UI rather than code syntax.
- UE5 ONLY (CRITICAL): This platform is exclusively for Unreal Engine 5. NEVER reference UE4 or Unreal Engine 4. If a segment is about UE4, mark it "low" relevance. All instructions, menu paths, and features must be UE5-specific.
- BLUEPRINT PRECISION: Blueprints ARE a form of programming (visual scripting). NEVER say 'without code' or 'no code needed'. Instead say 'without writing C++ or text-based code'. Blueprints are visual code.
- NEVER start a summary with 'This article...' or 'This video...' or 'This segment...' — teach the concept directly
- Write as if YOU are the instructor explaining the concept, not describing someone else's content
- Include specific technical details, property names, menu paths, or code patterns from the source
- ANTI-HALLUCINATION (CRITICAL):
  - ONLY reference UE5 tools, properties, nodes, volumes, and menu items that are EXPLICITLY mentioned in the source text above
  - Do NOT invent or assume UE5 features. If a concept is not in the source text, do NOT mention it
  - Do NOT fabricate volume types, component names, or editor features that are not in the provided segments
  - When in doubt, be LESS specific rather than inventing details
  - Every UE5-specific term in your summary must trace back to a word in the source segments
- DEDUPLICATION: Do NOT assign the same segment to more than one category. Each segment index may appear at most once in your output. If a segment could fit multiple categories, assign it to the BEST-fitting one only.
- Include only segments with "high" or "medium" relevance
- Order: foundation → diagnosis → fix → transfer
- You MUST include at least ONE segment of each category (foundation, diagnosis, fix, transfer)
- If no segment perfectly fits "transfer", pick the one that best teaches prevention or broader application
- Max ${_} segments total
- Min ${ne} segments if enough are relevant
- Prefer transcript segments over docs for hands-on topics
- Each summary should be plain text only — no asterisks, no markdown, no code blocks${s}`;try{const o=U(),n=L(o,"us-central1"),i=F(n,"classifySegments"),l=await q(()=>i({prompt:d,grounded:!0}),{maxRetries:2,baseDelayMs:1500,label:"classifySegments"}),T=l.data?.text||"",S=l.data?.groundingMetadata||null,k=T.match(/\[[\s\S]*\]/);if(!k)return w("[BespokePath] Could not parse classification JSON, using fallback ordering"),Q(e);const E=JSON.parse(k[0]);let y=0;for(const p of E){if(p.relevance==="low"||p.index<0||p.index>=e.length)continue;const x=`${p.summary||""} ${e[p.index]?.title||""} ${e[p.index]?.videoTitle||""} ${e[p.index]?.text?.slice(0,500)||""}`,r=W(t,x);r<re?(w(`[BespokePath] Topical cross-check rejected: "${e[p.index]?.title||e[p.index]?.videoTitle||"(untitled)"}" (overlap: ${(r*100).toFixed(0)}%)`),p.relevance="low"):(/\bue\s*4\b/i.test(x)||/\bunreal\s+engine\s+4\b/i.test(x))&&(w(`[BespokePath] UE4 content rejected: "${e[p.index]?.title||e[p.index]?.videoTitle||"(untitled)"}"`),p.relevance="low",y++)}y>0&&b(`[BespokePath] Topical cross-check demoted ${y} step(s) to low relevance`);const $=[];for(const p of H){const x=E.filter(r=>r.category===p&&r.relevance!=="low").sort((r,m)=>r.relevance!==m.relevance?r.relevance==="high"?-1:1:(e[m.index]?.similarity||0)-(e[r.index]?.similarity||0));for(const r of x)if(r.index>=0&&r.index<e.length&&$.length<_){const m=[];if(S?.sources?.length>0){const v=(r.summary||e[r.index].text||"").toLowerCase();(S.supports||[]).forEach(f=>{const C=(f.text||"").toLowerCase();v.split(/\s+/).filter(M=>M.length>4).some(M=>C.includes(M))&&(f.sourceIndices||[]).forEach(M=>{if(S.sources[M]){const N=S.sources[M];m.some(Y=>Y.url===N.url)||m.push(N)}})})}const u={...e[r.index]};m.length>0&&(u.sources=m),$.push({segment:u,category:r.category,title:r.title||"",summary:r.summary||"",order:$.length})}}b(`[BespokePath] Sequenced ${$.length} segments into learning path`);const{cleanedPath:A,warnings:g,autoFixes:h}=ae($,e);return h.length>0&&b(`[BespokePath] Quality gate applied ${h.length} auto-fix(es):`,h),g.length>0&&w("[BespokePath] Quality gate warnings:",g),G("sequencePath",Math.ceil(d.length/4),Math.ceil(T.length/4)),A}catch(o){return w("[BespokePath] sequencePath failed:",o.message),Q(e)}}function Q(t){return t.slice(0,_).map((a,c)=>({segment:a,category:H[Math.min(Math.floor(c/2),H.length-1)],order:c}))}const ce=8,ue=`Research-backed UE5 learning gap patterns:
- Top beginner roadblocks: C++ complexity, Blueprint debugging, material editor workflow, UI/UMG binding, physics/collision setup, animation state machines, networking/replication, packaging/deployment
- Cognitive load: tutorials > 6 minutes lose learner attention; chunk into 3-5 minute segments
- "Tutorial limbo" pattern: learners follow steps but can't apply concepts independently
- Missing "why" explanations: procedural knowledge without conceptual grounding creates fragile understanding
- Prerequisites are often assumed, not taught: editor navigation, project structure, asset pipeline, coordinate systems
- Bloom's taxonomy gaps: paths that stay at Remember/Understand without advancing to Apply/Analyze/Create leave learners unable to build independently
- Spaced practice: massed practice (all at once) decays quickly; interleaving topics with review checkpoints improves long-term retention
- Transfer gaps: learners who only see one context (e.g. materials in a cave scene) can't transfer skills to new contexts (e.g. materials for vehicles)
- Scaffolding removal: guided examples must progressively reduce support — paths that never remove scaffolds create dependency
- Assessment alignment: if a path teaches "Apply" level skills but only tests "Remember" level, the assessment gives false confidence`;function K(t){if(!t)return null;try{return JSON.parse(t)}catch{}const e=t.match(/[{[\s\S]*[}\]]/);if(!e)return null;let a=e[0].replace(/```json?\s*/gi,"").replace(/```\s*/g,"").replace(/[\u201C\u201D]/g,'"').replace(/[\u2018\u2019]/g,"'").replace(/,\s*([}\]])/g,"$1");try{return JSON.parse(a)}catch{a=a.replace(/'/g,'"');try{return JSON.parse(a)}catch{return null}}}function de(t,e){const a=new Set;e&&a.add(e.trim());for(const d of t){const o=d?.segment;if(!o)continue;const n=o.title||o.videoTitle||"";n&&n.length>3&&a.add(n.trim());const i=(d.summary||o.text||"").substring(0,150);if(i&&i.length>20){const l=i.split(/[.!?]/)[0]?.trim();l&&l.length>10&&a.add(l)}}const c=[],s=[...a];for(const d of s)c.some(n=>W(n,d)>.6)||c.push(d);return c.slice(0,ce)}async function pe(t){try{const e=U(),a=L(e,"us-central1"),c=F(a,"classifySegments"),s=`You are a UE5 curriculum expert. A learner wants to learn: "${t}"

List the 8-12 essential subtopics/skills that a comprehensive learning path for "${t}" MUST cover.
Think about:
- Core concepts directly related to the goal
- Common prerequisites that are often missed
- Practical skills needed (not just theory)
- Debugging/troubleshooting knowledge for this area

Return ONLY a JSON array of short topic strings (3-6 words each).
Example format: ["Blueprint Event Graphs", "Variable Types and Casting", "Debugging with Breakpoints"]

Return valid JSON only, no markdown fences, no explanation.`,o=(await q(()=>c({prompt:s}),{maxRetries:1,baseDelayMs:1500,label:"requiredSubtopics"})).data?.text||"";G("requiredSubtopics",Math.ceil(s.length/4),Math.ceil(o.length/4));const n=K(o);return Array.isArray(n)&&n.length>0?(b(`[GapAnalyzer] Generated ${n.length} required subtopics for "${t}"`),n.slice(0,12)):(w("[GapAnalyzer] Could not parse required subtopics, using fallback"),null)}catch(e){return w("[GapAnalyzer] generateRequiredSubtopics failed:",e.message),null}}async function xe(t,e,a=null){const c={blindSpots:[],assumedKnowledge:[],suggestions:[],weaklyCovered:[],coverageScore:1,corpusStats:{subtopicsChecked:0,subtopicsCovered:0,avgSimilarity:0}};try{if(!e||e.length===0)return c;const s=await pe(t);if(!s||s.length===0)return w("[GapAnalyzer] Could not generate required subtopics, falling back"),c;b(`[GapAnalyzer] Required subtopics: ${s.join(", ")}`);const d=de(e,t);b(`[GapAnalyzer] Path covers: ${d.join(", ")}`);const o=[],n=[],i=[];let l=null;try{const u=await fetch("/Unreal-Learning-Path-Tagging-System/augmentation_summary.json");if(u.ok){const v=await u.json();l={};for(const f of v.videos||[])l[f.course]||(l[f.course]={totalScore:0,count:0}),l[f.course].totalScore+=f.score||0,l[f.course].count++}}catch{}const T=e.map(u=>{const v=u?.segment,f=v?.title||v?.videoTitle||"",C=u?.summary||v?.text||"";return`${f} ${C}`}).join(" ").toLowerCase();for(const u of s){const v=u.toLowerCase(),f=v.replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(I=>I.length>=2);let C=0,R="";for(const I of d){const O=W(u,I);O>C&&(C=O,R=I)}const B=T.includes(v)||f.length>=2&&T.includes(f.slice(0,3).join(" ")),M=f.filter(I=>T.includes(I)).length,N=f.length>0?M/f.length:0;if(C>.3||B||N>=.7){let I=!1,O=null,j=null;if(l&&R){const J=e.find(P=>{const V=P?.segment;return(V?.title||V?.videoTitle||"").toLowerCase().includes(R.toLowerCase().slice(0,10))}),D=J?.segment?.courseSlug||J?.segment?.course||"";if(D&&l[D]){const P=Math.round(l[D].totalScore/l[D].count);j=P,O=P>=45?"A":P>=39?"B":P>=33?"C":P>=22?"D":"F",I=O==="D"||O==="F"}}I?i.push({topic:u,matchedTo:R||"(multiple courses)",confidence:Math.max(C,N,B?.8:0),augGrade:O,augScore:j,reason:`Covered by course material rated ${O} (${j}/55) — pedagogy needs augmentation`}):o.push({topic:u,matchedTo:R||"(multiple courses)",confidence:Math.max(C,N,B?.8:0)})}else n.push({topic:u,bestOverlap:C,bestMatch:R||null,wordCoverage:N})}const S=o.length+i.length*.5,k=s.length>0?S/s.length:1;if(b(`[GapAnalyzer] Coverage: ${o.length} strong + ${i.length} weak + ${n.length} gaps out of ${s.length} required topics (score: ${k.toFixed(2)})`),n.length===0&&i.length===0)return{...c,coverageScore:k,weaklyCovered:i,corpusStats:{subtopicsChecked:s.length,subtopicsCovered:o.length,avgSimilarity:0}};const E=a?.level?`The learner's assessed level is: ${a.level.toUpperCase()}.`:"Assume a beginner-level learner.",y=n.map(u=>`- "${u.topic}" (best path match: ${u.bestMatch?`"${u.bestMatch}" at ${u.bestOverlap.toFixed(2)} overlap`:"NONE"})`).join(`
`),$=o.map(u=>`- "${u.topic}" (matched to: "${u.matchedTo}")`).join(`
`),A=`You are a UE5 curriculum designer analyzing a learning path for the query: "${t}"

${E}

${ue}

TOPICS THE PATH COVERS WELL:
${$||"(none)"}

TOPICS THE PATH IS MISSING (these are the gaps):
${y}

Analyze these gaps and return a JSON object with:
1. "blindSpots": Array of objects for each gap topic:
   - "topic": The gap topic string
   - "severity": "high" (critical for the query), "medium" (helpful), or "low" (nice to have)
   - "reason": Why this gap matters for the learner (1 sentence)
   - "researchContext": Which research finding makes this important (1 sentence, reference the patterns above)
2. "assumedKnowledge": Array of strings — prerequisites the path assumes but never teaches
3. "suggestions": Array of objects:
   - "topic": Suggested addition
   - "priority": "high", "medium", or "low"
   - "rationale": Why this should be added (1 sentence)

RULES:
- Only classify gaps that were identified above — do NOT invent new gaps
- "high" severity = gap is directly related to the original query "${t}"
- "medium" severity = gap is a common prerequisite for this topic area
- "low" severity = gap is tangentially related but not blocking
- Keep responses concise — max 3 suggestions
- Return valid JSON only, no markdown fences`,g=U(),h=L(g,"us-central1"),p=F(h,"classifySegments"),r=(await q(()=>p({prompt:A}),{maxRetries:1,baseDelayMs:1500,label:"gapAnalysis"})).data?.text||"";G("gapAnalysis",Math.ceil(A.length/4),Math.ceil(r.length/4));const m=K(r);return m?{blindSpots:m.blindSpots||[],assumedKnowledge:m.assumedKnowledge||[],suggestions:(m.suggestions||[]).slice(0,3),weaklyCovered:i,coverageScore:k,corpusStats:{subtopicsChecked:s.length,subtopicsCovered:o.length,avgSimilarity:0}}:(w("[GapAnalyzer] Failed to parse Gemini gap analysis response"),{blindSpots:n.map(u=>({topic:u.topic,severity:u.bestOverlap<.1?"high":"medium",reason:"This required topic is not addressed by any course in the path",researchContext:""})),assumedKnowledge:[],suggestions:[],weaklyCovered:i,coverageScore:k,corpusStats:{subtopicsChecked:s.length,subtopicsCovered:o.length,avgSimilarity:0}})}catch(s){return w("[GapAnalyzer] analyzePathGaps failed:",s.message),c}}const ge=3,X=.55,Z=.5,ee=3;async function ke(t,e,a,c=[]){try{b(`[GapFill] 3-tier fill for gap: "${t}"`);const s=new Set(c);try{const g=U(),h=L(g,"us-central1"),r=(await F(h,"embedQuery")({text:t})).data?.embedding;if(r){const u=(await ie(r,8)).filter(v=>v.similarity>=X&&!s.has(v.code)).sort((v,f)=>f.similarity-v.similarity).slice(0,ee);if(u.length>0)return b(`[GapFill] Tier 1 HIT — ${u.length} library courses for "${t}"`),{source:"library",matchedCourses:u};b(`[GapFill] Tier 1 MISS — no library matches above ${X} for "${t}"`)}}catch(g){w(`[GapFill] Tier 1 failed, falling through: ${g.message}`)}try{const{segments:g}=await z(t,8),h=g.filter(r=>(r.similarity||0)>=Z),p=new Map;for(const r of h){const m=r.videoTitle||r.videoUrl||r.title||"unknown",u=p.get(m);(!u||(r.similarity||0)>(u.similarity||0))&&p.set(m,r)}const x=[...p.values()].sort((r,m)=>(m.similarity||0)-(r.similarity||0)).slice(0,ee);if(x.length>0)return b(`[GapFill] Tier 2 HIT — ${x.length} segments (deduped from ${h.length}) for "${t}"`),{source:"bespoke",segments:x.map(r=>({title:r.title||r.videoTitle||"Untitled",text:(r.text||"").substring(0,300),videoTitle:r.videoTitle||"",videoUrl:r.videoUrl||"",similarity:r.similarity||0}))};b(`[GapFill] Tier 2 MISS — no segments above ${Z} for "${t}"`)}catch(g){w(`[GapFill] Tier 2 failed, falling through: ${g.message}`)}b(`[GapFill] Tier 3 — generating AI step for "${t}"`);let d="";try{const{segments:g}=await z(t,ge);g.length>0&&(d=`
Related content from our corpus:
${g.slice(0,2).map(h=>`- "${h.title||h.videoTitle}": ${(h.text||"").substring(0,200)}`).join(`
`)}`)}catch{}const o=a.map(g=>g.segment?.title||g.segment?.videoTitle||"").filter(Boolean).join(", "),n=`You are a UE5 curriculum designer. A learning path for "${e}" has a gap in: "${t}"

Existing steps cover: ${o}
${d}

Generate a SINGLE learning step to fill this gap. Return a JSON object:
{
  "title": "Short descriptive title (3-6 words, gerund format like 'Understanding Blueprint Variables')",
  "category": "prerequisite" or "core" or "practice",
  "summary": "3-5 sentences teaching this concept directly. Plain text, no markdown. Include specific UE5 menu paths, property names, and node names where relevant."
}

RULES:
- The step must directly address "${t}" in the context of "${e}"
- Do NOT repeat content already in the path
- Be specific to UE5 (not UE4)
- PRIORITIZE Blueprint-based approaches unless the topic is specifically about C++
- Return valid JSON only, no markdown fences`,i=U(),l=L(i,"us-central1"),T=F(l,"classifySegments"),S=await q(()=>T({prompt:n,grounded:!0}),{maxRetries:1,baseDelayMs:1500,label:"gapFillStep"}),k=S.data?.text||S.data?.response||"",E=S.data?.groundingMetadata||null;if(G("gapFillStep",Math.ceil(n.length/4),Math.ceil(k.length/4)),!k)return w("[GapFill] Empty AI response"),{source:"ai",step:{segment:{title:`Learn: ${t}`,text:`Study ${t} in context of ${e}.`},category:"core",isGapFill:!0}};let y=K(k);(!y||!y.title)&&(y={title:`Understanding ${t}`,summary:k.replace(/```json?|```/gi,"").trim().slice(0,500),category:"core"});const $=[];E?.sources?.length>0&&(E.supports||[]).forEach(g=>{(g.sourceIndices||[]).forEach(h=>{if(E.sources[h]){const p=E.sources[h];$.some(x=>x.url===p.url)||$.push(p)}})});const A={segment:{id:`gap-fill-${Date.now()}`,type:"ai_generated",title:y.title,text:y.summary,source:"ai_generated",sources:$.length>0?$:void 0,corpusVerified:!1},category:y.category||"core",summary:y.summary,order:a.length,isGapFill:!0};try{const{segments:g}=await z(y.summary||y.title,1);if(g.length>0&&g[0].similarity>=se){const h=g[0];A.segment.corpusVerified=!0,A.segment.corpusMatch={videoTitle:h.videoTitle||h.title||"",videoUrl:h.videoUrl||h.url||"",similarity:h.similarity}}}catch{}return b(`[GapFill] Tier 3 AI step: "${y.title}" [${A.category}]`),{source:"ai",step:A}}catch(s){return w("[GapFill] generateGapFillStep failed:",s.message),null}}function $e(t,e){const a=e[0],c=e.slice(0,3).map(s=>s.text||"").filter(Boolean).join(`

`);return{code:`bespoke-${Date.now()}`,title:`${t} (Bespoke)`,description:c.substring(0,500)||`Bespoke step covering ${t}`,type:"bespoke_segment",role:"core",duration_seconds:e.length*300,tags:{level:"Intermediate",industry:"General"},isBespoke:!0,isGapFill:!0,sourceSegments:e.map(s=>({title:s.title,videoTitle:s.videoTitle,videoUrl:s.videoUrl,similarity:s.similarity})),videoTitle:a?.videoTitle||"",videoUrl:a?.videoUrl||""}}async function he(t,e,a=3){if(!t?.segment?.text&&!t?.summary)return[];const c=(t.summary||t.segment?.text||"").slice(0,1500);try{const s=U(),d=L(s,"us-central1"),n=await F(d,"generateAudioBriefing")({mode:"quiz",query:e,stepContent:c,stepCategory:t.category||"learning",quizCount:a});return n.data?.questions&&Array.isArray(n.data.questions)?(b(`[Quiz] Generated ${n.data.questions.length} questions for ${t.category} step`),G("quizGeneration",Math.ceil(c.length/4),Math.ceil(JSON.stringify(n.data.questions).length/4)),n.data.questions):te(t)}catch(s){return w("[Quiz] AI quiz generation failed:",s.message),te(t)}}async function Ce(t,e,a=5){if(!t||t.length===0||a<=0)return new Map;const c=Math.floor(a/t.length);let s=a%t.length;const d=await Promise.allSettled(t.map(n=>{let i=c;return s>0&&(i++,s--),i===0?Promise.resolve([]):he(n,e,i)})),o=new Map;return d.forEach((n,i)=>{n.status==="fulfilled"&&n.value.length>0&&o.set(i,n.value)}),b(`[Quiz] Generated quizzes for ${o.size}/${t.length} steps`),o}function Ee(t,e){return{isCorrect:e===t.correct,correctAnswer:t.correct,explanation:t.explanation||""}}function te(t){const e={foundation:{stem:"Based on the content you just read, what is the fundamental concept being explained?",choices:{A:"A performance optimization technique",B:"A core architectural pattern in UE5",C:"A debugging methodology",D:"A deployment configuration"},correct:"B",explanation:"Foundation content typically covers core architectural patterns and concepts."},diagnosis:{stem:"What is the key indicator that helps identify this type of problem?",choices:{A:"Compile-time errors in the build log",B:"Visual artifacts or unexpected behavior at runtime",C:"Missing asset references in the content browser",D:"Network timeout errors in the output log"},correct:"B",explanation:"Diagnosis content focuses on identifying symptoms and root causes at runtime."},fix:{stem:"What is the recommended first step when applying this fix?",choices:{A:"Restart the editor immediately",B:"Back up the project and verify the issue is reproducible",C:"Delete all derived data caches",D:"Update to the latest engine version"},correct:"B",explanation:"Always back up and verify reproducibility before applying fixes."},transfer:{stem:"How can this knowledge be applied to other areas of UE5 development?",choices:{A:"It only applies to this specific use case",B:"The underlying pattern is reusable across similar systems",C:"It requires a completely different approach in other contexts",D:"It's only relevant for legacy projects"},correct:"B",explanation:"Transfer knowledge emphasizes reusable patterns across different contexts."}};return[e[t.category]||e.foundation]}function Ae(t){if(!t||typeof t!="string")return"";let e=t.replace(/(?:Unreal Engine\s+\d+\.\d+\s*\\?n?\s*){3,}/gi," ");const a=[/^(well,?|okay,?|so,?|alright,?|hey,?|hi,?|now,?)\s+/gi,/\b(that's it for this (lesson|video|section|module|tutorial))\b.*$/gim,/\b(in the next (lesson|video|section|module))\b.*$/gim,/\b(let's (go ahead and|take a look|jump (in|right in)))\b/gi,/\b(we're gonna|we are going to|I'm gonna|I am going to)\b/gi,/\b(as you can see|as I mentioned|like I said)\b/gi,/\b(don't forget to|make sure you|remember to) (like|subscribe|hit the bell)\b.*$/gim,/\b(thanks for watching|see you in the next)\b.*$/gim];for(const s of a)e=e.replace(s,"");const c=[/Unreal Engine\s+\d+\.\d+(?: Documentation)?/gi,/Epic Developer Community/gi,/Table of Contents/gi,/##?\s*What's New\??/gi,/Ask questions and help your peers\s*Developer Forums/gi,/Write your own tutorials or read those from others\s*Learning Library/gi,/\|/g];for(const s of c)e=e.replace(s,"");return e=e.replace(/[.!?]\s+[A-Z][^.!?]{0,60}$/s,s=>s.slice(s.indexOf(" ")+1).length<40?s[0]:s),e=e.replace(/\\n/g," ").replace(/\s{2,}/g," ").replace(/^[\s,;.]+|[\s,;]+$/g,"").replace(/^\s+/gm,"").trim(),e.length<20?"":e}export{xe as a,ke as b,Ae as c,$e as d,W as e,he as f,Ce as g,Ee as h,K as p,Te as s};
