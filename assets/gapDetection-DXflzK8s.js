import{t as B,v as G}from"./vendor-firebase-BklWSxN9.js";import{c as F,e as x,d as E}from"./index-CS3_mySO.js";import{r as z}from"./tokenTracker-Cay2F-c5.js";import{retryWithBackoff as H}from"./retryWithBackoff-DbYr_kje.js";import{M as j,a as Q}from"./pathSearch-NZSGMlGu.js";const X=[{pattern:/without\s+(?:any\s+)?code/gi,replacement:"without writing C++ or text-based code"},{pattern:/no\s+code\s+(?:is\s+)?(?:needed|required)/gi,replacement:"no C++ code is needed"},{pattern:/no\s+coding\s+(?:is\s+)?(?:needed|required)/gi,replacement:"no C++ coding is needed"},{pattern:/without\s+(?:any\s+)?programming/gi,replacement:"without text-based programming"},{pattern:/don['']t\s+need\s+(?:to\s+)?code/gi,replacement:"don't need to write C++ code"}];function Z(i,e=[]){if(!i||!Array.isArray(i))return{cleanedPath:i||[],warnings:["No path steps to validate"],autoFixes:[]};const r=[],u=[],c=new Set,h=[];for(const t of i){const n=t.segmentIndex??t.segment_index??t.index;if(n!=null&&c.has(n)){u.push(`Removed duplicate segment index ${n} (title: "${t.segment?.title||"unknown"}", category: ${t.category})`);continue}n!=null&&c.add(n),h.push(t)}for(const t of h)if(t.summary){let n=t.summary;for(const{pattern:p,replacement:f}of X)p.lastIndex=0,p.test(n)&&(p.lastIndex=0,n=n.replace(p,f),u.push(`Fixed phrasing in step "${t.segment?.title||"unknown"}": applied "${f}" correction`));t.summary=n}if(e.length>0){const t=e.map(p=>`${p.text||""} ${p.title||""} ${p.videoTitle||""}`).join(" ").toLowerCase(),n=["depth volume","wind volume","fog volume","weather volume","ai controller","behavior tree","blackboard","nanite","lumen","niagara","mass entity","world partition","control rig","metahuman","modeling mode","texture graph","chaos physics","pcg","procedural content generation"];for(const p of h){if(!p.summary)continue;const f=p.summary.toLowerCase();for(const y of n)f.includes(y)&&!t.includes(y)&&r.push(`⚠️ Potential hallucination: "${y}" found in summary for "${p.segment?.title||"unknown"}" but NOT in source text`)}}const o=new Set,s=[];for(const t of h){const n=(t.segment?.title||t.segment?.videoTitle||"").toLowerCase().trim();if(!n){s.push(t);continue}if(o.has(n)){u.push(`Removed duplicate titled step: "${n}" (category: ${t.category})`);continue}o.add(n),s.push(t)}return s.forEach((t,n)=>{t.order=n}),{cleanedPath:s,warnings:r,autoFixes:u}}const q=["foundation","diagnosis","fix","transfer"],ee=.25,te=new Set(["a","an","the","in","on","at","to","for","of","with","by","from","and","or","not","is","it","be","as","do","has","was","are","but","if","my","this","that","how","what","when","where","why","can","will","so","no","up","out","its","i","me","you","your","we","they","their","about","use","using","used","make","get","set","does","work","works","working","create","need","want","like","just","really","know","new","thing","things","way","going","able","look","help","try"]);function W(i,e){if(!i||!e)return 0;const r=o=>o.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(s=>s.length>2&&!te.has(s)),u=r(i);if(u.length===0)return 1;const c=new Set(r(e));return u.filter(o=>c.has(o)).length/u.length}async function pe(i,e,r=null){if(!e||e.length===0)return[];const u=e.map((o,s)=>{const t=o.type==="transcript"?`Video: ${o.videoTitle} (${o.startTimestamp||""})`:o.type==="epic_learning"?`Article: ${o.title}`:`Docs: ${o.title} > ${o.section}`;return`[${s}] ${t}
   ${o.text.slice(0,2e3)}`}).join(`

`);let c="";if(r){const{knows:o=[],gaps:s=[],level:t="beginner"}=r;c=`

ADAPTIVE DEPTH INSTRUCTIONS (IMPORTANT):
This learner completed a diagnostic quiz. Their assessed level is: ${t.toUpperCase()}
${o.length>0?`
Concepts they ALREADY KNOW (skim these — keep summaries brief, 1 sentence max):
${o.map(n=>`  - ${n.replace(/_/g," ")}`).join(`
`)}`:""}
${s.length>0?`
Knowledge GAPS to fill (go deep — write detailed 3-4 sentence summaries with specific steps):
${s.map(n=>`  - ${n.replace(/_/g," ")}`).join(`
`)}`:""}

Depth rules based on level:
${t==="beginner"?"- Start with absolute basics. Explain every concept. More foundation steps.":""}
${t==="intermediate"?"- Skip basic introductions. Focus on practical application and diagnosis.":""}
${t==="advanced"?"- Skip all basics. Go straight to advanced techniques, edge cases, and optimization.":""}
- Prioritize segments covering the GAP concepts over ones covering KNOWN concepts
- For KNOWN concepts, only include if absolutely essential for context (and mark relevance as "medium")
- For GAP concepts, always mark relevance as "high"`}const h=`You are a UE5 curriculum designer. A learner asked: "${i}"

Here are ${e.length} content segments found via semantic search:

${u}

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
- Max ${j} segments total
- Min ${Q} segments if enough are relevant
- Prefer transcript segments over docs for hands-on topics
- Each summary should be plain text only — no asterisks, no markdown, no code blocks${c}`;try{const o=F(),s=B(o,"us-central1"),t=G(s,"classifySegments"),n=await H(()=>t({prompt:h,grounded:!0}),{maxRetries:2,baseDelayMs:1500,label:"classifySegments"}),p=n.data?.text||"",f=n.data?.groundingMetadata||null,y=p.match(/\[[\s\S]*\]/);if(!y)return x("[BespokePath] Could not parse classification JSON, using fallback ordering"),J(e);const N=JSON.parse(y[0]);let $=0;for(const d of N){if(d.relevance==="low"||d.index<0||d.index>=e.length)continue;const m=`${d.summary||""} ${e[d.index]?.title||""} ${e[d.index]?.videoTitle||""} ${e[d.index]?.text?.slice(0,500)||""}`,l=W(i,m);l<ee?(x(`[BespokePath] Topical cross-check rejected: "${e[d.index]?.title||e[d.index]?.videoTitle||"(untitled)"}" (overlap: ${(l*100).toFixed(0)}%)`),d.relevance="low"):(/\bue\s*4\b/i.test(m)||/\bunreal\s+engine\s+4\b/i.test(m))&&(x(`[BespokePath] UE4 content rejected: "${e[d.index]?.title||e[d.index]?.videoTitle||"(untitled)"}"`),d.relevance="low",$++)}$>0&&E(`[BespokePath] Topical cross-check demoted ${$} step(s) to low relevance`);const v=[];for(const d of q){const m=N.filter(l=>l.category===d&&l.relevance!=="low").sort((l,a)=>l.relevance!==a.relevance?l.relevance==="high"?-1:1:(e[a.index]?.similarity||0)-(e[l.index]?.similarity||0));for(const l of m)if(l.index>=0&&l.index<e.length&&v.length<j){const a=[];if(f?.sources?.length>0){const g=(l.summary||e[l.index].text||"").toLowerCase();(f.supports||[]).forEach(w=>{const C=(w.text||"").toLowerCase();g.split(/\s+/).filter(S=>S.length>4).some(S=>C.includes(S))&&(w.sourceIndices||[]).forEach(S=>{if(f.sources[S]){const U=f.sources[S];a.some(T=>T.url===U.url)||a.push(U)}})})}const b={...e[l.index]};a.length>0&&(b.sources=a),v.push({segment:b,category:l.category,title:l.title||"",summary:l.summary||"",order:v.length})}}const I=v.findIndex(d=>{const m=(d.title||d.segment?.title||d.segment?.videoTitle||"").toLowerCase();return m.includes("introduction to unreal engine")||m.includes("introduction to unreal editor")||m.includes("intro to unreal")});if(I>0){const[d]=v.splice(I,1);d.category="foundation",v.unshift(d),v.forEach((m,l)=>{m.order=l}),E('[BespokePath] Pinned "Introduction to Unreal Engine" to position 0')}E(`[BespokePath] Sequenced ${v.length} segments into learning path`);const{cleanedPath:L,warnings:M,autoFixes:O}=Z(v,e);return O.length>0&&E(`[BespokePath] Quality gate applied ${O.length} auto-fix(es):`,O),M.length>0&&x("[BespokePath] Quality gate warnings:",M),z("sequencePath",Math.ceil(h.length/4),Math.ceil(p.length/4)),L}catch(o){return x("[BespokePath] sequencePath failed:",o.message),J(e)}}function J(i){return i.slice(0,j).map((r,u)=>({segment:r,category:q[Math.min(Math.floor(u/2),q.length-1)],order:u}))}const ne=8,oe=`Research-backed UE5 learning gap patterns:
- Top beginner roadblocks: C++ complexity, Blueprint debugging, material editor workflow, UI/UMG binding, physics/collision setup, animation state machines, networking/replication, packaging/deployment
- Cognitive load: tutorials > 6 minutes lose learner attention; chunk into 3-5 minute segments
- "Tutorial limbo" pattern: learners follow steps but can't apply concepts independently
- Missing "why" explanations: procedural knowledge without conceptual grounding creates fragile understanding
- Prerequisites are often assumed, not taught: editor navigation, project structure, asset pipeline, coordinate systems
- Bloom's taxonomy gaps: paths that stay at Remember/Understand without advancing to Apply/Analyze/Create leave learners unable to build independently
- Spaced practice: massed practice (all at once) decays quickly; interleaving topics with review checkpoints improves long-term retention
- Transfer gaps: learners who only see one context (e.g. materials in a cave scene) can't transfer skills to new contexts (e.g. materials for vehicles)
- Scaffolding removal: guided examples must progressively reduce support — paths that never remove scaffolds create dependency
- Assessment alignment: if a path teaches "Apply" level skills but only tests "Remember" level, the assessment gives false confidence`;function V(i){if(!i)return null;try{return JSON.parse(i)}catch{}const e=i.match(/[{[\s\S]*[}\]]/);if(!e)return null;let r=e[0].replace(/```json?\s*/gi,"").replace(/```\s*/g,"").replace(/[\u201C\u201D]/g,'"').replace(/[\u2018\u2019]/g,"'").replace(/,\s*([}\]])/g,"$1");try{return JSON.parse(r)}catch{r=r.replace(/'/g,'"');try{return JSON.parse(r)}catch{return null}}}function se(i,e){const r=new Set;e&&r.add(e.trim());for(const h of i){const o=h?.segment;if(!o)continue;const s=o.title||o.videoTitle||"";s&&s.length>3&&r.add(s.trim());const t=(h.summary||o.text||"").substring(0,150);if(t&&t.length>20){const n=t.split(/[.!?]/)[0]?.trim();n&&n.length>10&&r.add(n)}}const u=[],c=[...r];for(const h of c)u.some(s=>W(s,h)>.6)||u.push(h);return u.slice(0,ne)}async function ae(i){try{const e=F(),r=B(e,"us-central1"),u=G(r,"classifySegments"),c=`You are a UE5 curriculum expert. A learner wants to learn: "${i}"

List the 8-12 essential subtopics/skills that a comprehensive learning path for "${i}" MUST cover.
Think about:
- Core concepts directly related to the goal
- Common prerequisites that are often missed
- Practical skills needed (not just theory)
- Debugging/troubleshooting knowledge for this area

Return ONLY a JSON array of short topic strings (3-6 words each).
Example format: ["Blueprint Event Graphs", "Variable Types and Casting", "Debugging with Breakpoints"]

Return valid JSON only, no markdown fences, no explanation.`,o=(await H(()=>u({prompt:c}),{maxRetries:1,baseDelayMs:1500,label:"requiredSubtopics"})).data?.text||"";z("requiredSubtopics",Math.ceil(c.length/4),Math.ceil(o.length/4));const s=V(o);return Array.isArray(s)&&s.length>0?(E(`[GapAnalyzer] Generated ${s.length} required subtopics for "${i}"`),s.slice(0,12)):(x("[GapAnalyzer] Could not parse required subtopics, using fallback"),null)}catch(e){return x("[GapAnalyzer] generateRequiredSubtopics failed:",e.message),null}}async function he(i,e,r=null){const u={blindSpots:[],assumedKnowledge:[],suggestions:[],weaklyCovered:[],coverageScore:1,corpusStats:{subtopicsChecked:0,subtopicsCovered:0,avgSimilarity:0}};try{if(!e||e.length===0)return u;const c=await ae(i);if(!c||c.length===0)return x("[GapAnalyzer] Could not generate required subtopics, falling back"),u;E(`[GapAnalyzer] Required subtopics: ${c.join(", ")}`);const h=se(e,i);E(`[GapAnalyzer] Path covers: ${h.join(", ")}`);const o=[],s=[],t=[];let n=null;try{const a=await fetch("/Unreal-Learning-Path-Tagging-System/augmentation_summary.json");if(a.ok){const b=await a.json();n={};for(const g of b.videos||[])n[g.course]||(n[g.course]={totalScore:0,count:0}),n[g.course].totalScore+=g.score||0,n[g.course].count++}}catch{}const p=e.map(a=>{const b=a?.segment,g=b?.title||b?.videoTitle||"",w=a?.summary||b?.text||"";return`${g} ${w}`}).join(" ").toLowerCase();for(const a of c){const b=a.toLowerCase(),g=b.replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(T=>T.length>=2);let w=0,C="";for(const T of h){const k=W(a,T);k>w&&(w=k,C=T)}const R=p.includes(b)||g.length>=2&&p.includes(g.slice(0,3).join(" ")),_=g.filter(T=>p.includes(T)).length,S=g.length>0?_/g.length:0;if(w>.3||R||S>=.7){let T=!1,k=null,D=null;if(n&&C){const K=e.find(A=>{const Y=A?.segment;return(Y?.title||Y?.videoTitle||"").toLowerCase().includes(C.toLowerCase().slice(0,10))}),P=K?.segment?.courseSlug||K?.segment?.course||"";if(P&&n[P]){const A=Math.round(n[P].totalScore/n[P].count);D=A,k=A>=45?"A":A>=39?"B":A>=33?"C":A>=22?"D":"F",T=k==="D"||k==="F"}}T?t.push({topic:a,matchedTo:C||"(multiple courses)",confidence:Math.max(w,S,R?.8:0),augGrade:k,augScore:D,reason:`Covered by course material rated ${k} (${D}/55) — pedagogy needs augmentation`}):o.push({topic:a,matchedTo:C||"(multiple courses)",confidence:Math.max(w,S,R?.8:0)})}else s.push({topic:a,bestOverlap:w,bestMatch:C||null,wordCoverage:S})}const f=o.length+t.length*.5,y=c.length>0?f/c.length:1;if(E(`[GapAnalyzer] Coverage: ${o.length} strong + ${t.length} weak + ${s.length} gaps out of ${c.length} required topics (score: ${y.toFixed(2)})`),s.length===0&&t.length===0)return{...u,coverageScore:y,weaklyCovered:t,corpusStats:{subtopicsChecked:c.length,subtopicsCovered:o.length,avgSimilarity:0}};const N=r?.level?`The learner's assessed level is: ${r.level.toUpperCase()}.`:"Assume a beginner-level learner.",$=s.map(a=>`- "${a.topic}" (best path match: ${a.bestMatch?`"${a.bestMatch}" at ${a.bestOverlap.toFixed(2)} overlap`:"NONE"})`).join(`
`),v=o.map(a=>`- "${a.topic}" (matched to: "${a.matchedTo}")`).join(`
`),I=`You are a UE5 curriculum designer analyzing a learning path for the query: "${i}"

${N}

${oe}

TOPICS THE PATH COVERS WELL:
${v||"(none)"}

TOPICS THE PATH IS MISSING (these are the gaps):
${$}

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
- "high" severity = gap is directly related to the original query "${i}"
- "medium" severity = gap is a common prerequisite for this topic area
- "low" severity = gap is tangentially related but not blocking
- Keep responses concise — max 3 suggestions
- Return valid JSON only, no markdown fences`,L=F(),M=B(L,"us-central1"),O=G(M,"classifySegments"),m=(await H(()=>O({prompt:I}),{maxRetries:1,baseDelayMs:1500,label:"gapAnalysis"})).data?.text||"";z("gapAnalysis",Math.ceil(I.length/4),Math.ceil(m.length/4));const l=V(m);return l?{blindSpots:l.blindSpots||[],assumedKnowledge:l.assumedKnowledge||[],suggestions:(l.suggestions||[]).slice(0,3),weaklyCovered:t,coverageScore:y,corpusStats:{subtopicsChecked:c.length,subtopicsCovered:o.length,avgSimilarity:0}}:(x("[GapAnalyzer] Failed to parse Gemini gap analysis response"),{blindSpots:s.map(a=>({topic:a.topic,severity:a.bestOverlap<.1?"high":"medium",reason:"This required topic is not addressed by any course in the path",researchContext:""})),assumedKnowledge:[],suggestions:[],weaklyCovered:t,coverageScore:y,corpusStats:{subtopicsChecked:c.length,subtopicsCovered:o.length,avgSimilarity:0}})}catch(c){return x("[GapAnalyzer] analyzePathGaps failed:",c.message),u}}export{he as a,W as c,V as p,pe as s};
