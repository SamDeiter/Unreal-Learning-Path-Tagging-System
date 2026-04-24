import{g as B,h as z}from"./vendor-firebase-bQTC33XI.js";import{k as G,m as S,l as k}from"./index-rW68heNe.js";import{r as F}from"./tokenTracker-Bkizj7bA.js";import{retryWithBackoff as _}from"./retryWithBackoff-ChyV6NkW.js";import{M as D,a as V}from"./pathSearch-C1I0K9QY.js";const X=[{pattern:/without\s+(?:any\s+)?code/gi,replacement:"without writing C++ or text-based code"},{pattern:/no\s+code\s+(?:is\s+)?(?:needed|required)/gi,replacement:"no C++ code is needed"},{pattern:/no\s+coding\s+(?:is\s+)?(?:needed|required)/gi,replacement:"no C++ coding is needed"},{pattern:/without\s+(?:any\s+)?programming/gi,replacement:"without text-based programming"},{pattern:/don['']t\s+need\s+(?:to\s+)?code/gi,replacement:"don't need to write C++ code"}];function Z(c,e=[]){if(!c||!Array.isArray(c))return{cleanedPath:c||[],warnings:["No path steps to validate"],autoFixes:[]};const l=[],d=[],u=new Set,g=[];for(const t of c){const n=t.segmentIndex??t.segment_index??t.index;if(n!=null&&u.has(n)){d.push(`Removed duplicate segment index ${n} (title: "${t.segment?.title||"unknown"}", category: ${t.category})`);continue}n!=null&&u.add(n),g.push(t)}for(const t of g)if(t.summary){let n=t.summary;for(const{pattern:h,replacement:f}of X)h.lastIndex=0,h.test(n)&&(h.lastIndex=0,n=n.replace(h,f),d.push(`Fixed phrasing in step "${t.segment?.title||"unknown"}": applied "${f}" correction`));t.summary=n}if(e.length>0){const t=e.map(h=>`${h.text||""} ${h.title||""} ${h.videoTitle||""}`).join(" ").toLowerCase(),n=["depth volume","wind volume","fog volume","weather volume","ai controller","behavior tree","blackboard","nanite","lumen","niagara","mass entity","world partition","control rig","metahuman","modeling mode","texture graph","chaos physics","pcg","procedural content generation"];for(const h of g){if(!h.summary)continue;const f=h.summary.toLowerCase();for(const y of n)f.includes(y)&&!t.includes(y)&&l.push(`⚠️ Potential hallucination: "${y}" found in summary for "${h.segment?.title||"unknown"}" but NOT in source text`)}}const s=new Set,i=[];for(const t of g){const n=(t.segment?.title||t.segment?.videoTitle||"").toLowerCase().trim();if(!n){i.push(t);continue}if(s.has(n)){d.push(`Removed duplicate titled step: "${n}" (category: ${t.category})`);continue}s.add(n),i.push(t)}return i.forEach((t,n)=>{t.order=n}),{cleanedPath:i,warnings:l,autoFixes:d}}const j=["foundation","diagnosis","fix","transfer"],ee=.25,te=new Set(["a","an","the","in","on","at","to","for","of","with","by","from","and","or","not","is","it","be","as","do","has","was","are","but","if","my","this","that","how","what","when","where","why","can","will","so","no","up","out","its","i","me","you","your","we","they","their","about","use","using","used","make","get","set","does","work","works","working","create","need","want","like","just","really","know","new","thing","things","way","going","able","look","help","try"]);function H(c,e){if(!c||!e)return 0;const l=s=>s.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(i=>i.length>2&&!te.has(i)),d=l(c);if(d.length===0)return 1;const u=new Set(l(e));return d.filter(s=>u.has(s)).length/d.length}async function pe(c,e,l=null){if(!e||e.length===0)return[];const d=e.map((s,i)=>{const t=s.type==="transcript"?`Video: ${s.videoTitle} (${s.startTimestamp||""})`:s.type==="epic_learning"?`Article: ${s.title}`:`Docs: ${s.title} > ${s.section}`;return`[${i}] ${t}
   ${s.text.slice(0,2e3)}`}).join(`

`);let u="";if(l){const{knows:s=[],gaps:i=[],level:t="beginner"}=l;u=`

ADAPTIVE DEPTH INSTRUCTIONS (IMPORTANT):
This learner completed a diagnostic quiz. Their assessed level is: ${t.toUpperCase()}
${s.length>0?`
Concepts they ALREADY KNOW (skim these — keep summaries brief, 1 sentence max):
${s.map(n=>`  - ${n.replace(/_/g," ")}`).join(`
`)}`:""}
${i.length>0?`
Knowledge GAPS to fill (go deep — write detailed 3-4 sentence summaries with specific steps):
${i.map(n=>`  - ${n.replace(/_/g," ")}`).join(`
`)}`:""}

Depth rules based on level:
${t==="beginner"?"- Start with absolute basics. Explain every concept. More foundation steps.":""}
${t==="intermediate"?"- Skip basic introductions. Focus on practical application and diagnosis.":""}
${t==="advanced"?"- Skip all basics. Go straight to advanced techniques, edge cases, and optimization.":""}
- Prioritize segments covering the GAP concepts over ones covering KNOWN concepts
- For KNOWN concepts, only include if absolutely essential for context (and mark relevance as "medium")
- For GAP concepts, always mark relevance as "high"`}const g=`You are a UE5 curriculum designer. A learner asked: "${c}"

Here are ${e.length} content segments found via semantic search:

${d}

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
- Max ${D} segments total
- Min ${V} segments if enough are relevant
- Prefer transcript segments over docs for hands-on topics
- Each summary should be plain text only — no asterisks, no markdown, no code blocks
- NEVER frame a step as a quiz, test, or assessment. Titles must not start with "Quiz:", "Test:", "Assessment:", "Check:", or similar. Summaries must not say "Test your understanding", "Answer questions", "This quiz will", "solidify your knowledge", or otherwise prompt the learner to be assessed. Every step is a direct mini-lesson that teaches a concept — quizzes are handled separately by the system.${u}`;try{const s=G(),i=B(s,"us-central1"),t=z(i,"classifySegments"),n=await _(()=>t({prompt:g,grounded:!0}),{maxRetries:2,baseDelayMs:1500,label:"classifySegments"}),h=n.data?.text||"",f=n.data?.groundingMetadata||null,y=h.match(/\[[\s\S]*\]/);if(!y)return S("[BespokePath] Could not parse classification JSON, using fallback ordering"),Y(e);const $=JSON.parse(y[0]),R=/^\s*(quiz|test|assessment|check|knowledge check)\s*[:\-–—]\s*/i,P=[/\btest your (?:understanding|knowledge)\b/i,/\bthis quiz\b/i,/\banswer questions? about\b/i,/\bsolidify your (?:knowledge|understanding)\b/i,/\bhelp you (?:solidify|assess|test)\b/i];for(const o of $)typeof o.title=="string"&&(o.title=o.title.replace(R,"").trim()),typeof o.summary=="string"&&P.some(a=>a.test(o.summary))&&(S(`[BespokePath] Quiz-framed summary rejected for "${o.title||`segment ${o.index}`}" — falling back to quality gate`),o.summary="");let C=0;for(const o of $){if(o.relevance==="low"||o.index<0||o.index>=e.length)continue;const a=`${o.summary||""} ${e[o.index]?.title||""} ${e[o.index]?.videoTitle||""} ${e[o.index]?.text?.slice(0,500)||""}`,r=H(c,a);r<ee?(S(`[BespokePath] Topical cross-check rejected: "${e[o.index]?.title||e[o.index]?.videoTitle||"(untitled)"}" (overlap: ${(r*100).toFixed(0)}%)`),o.relevance="low"):(/\bue\s*4\b/i.test(a)||/\bunreal\s+engine\s+4\b/i.test(a))&&(S(`[BespokePath] UE4 content rejected: "${e[o.index]?.title||e[o.index]?.videoTitle||"(untitled)"}"`),o.relevance="low",C++)}C>0&&k(`[BespokePath] Topical cross-check demoted ${C} step(s) to low relevance`);const b=[];for(const o of j){const a=$.filter(r=>r.category===o&&r.relevance!=="low").sort((r,p)=>r.relevance!==p.relevance?r.relevance==="high"?-1:1:(e[p.index]?.similarity||0)-(e[r.index]?.similarity||0));for(const r of a)if(r.index>=0&&r.index<e.length&&b.length<D){const p=[];if(f?.sources?.length>0){const T=(r.summary||e[r.index].text||"").toLowerCase();(f.supports||[]).forEach(A=>{const U=(A.text||"").toLowerCase();T.split(/\s+/).filter(m=>m.length>4).some(m=>U.includes(m))&&(A.sourceIndices||[]).forEach(m=>{if(f.sources[m]){const w=f.sources[m];p.some(O=>O.url===w.url)||p.push(w)}})})}const v={...e[r.index]};p.length>0&&(v.sources=p),b.push({segment:v,category:r.category,title:r.title||"",summary:r.summary||"",order:b.length})}}const N=b.findIndex(o=>{const a=(o.title||o.segment?.title||o.segment?.videoTitle||"").toLowerCase();return a.includes("introduction to unreal engine")||a.includes("introduction to unreal editor")||a.includes("intro to unreal")});if(N>0){const[o]=b.splice(N,1);o.category="foundation",b.unshift(o),b.forEach((a,r)=>{a.order=r}),k('[BespokePath] Pinned "Introduction to Unreal Engine" to position 0')}k(`[BespokePath] Sequenced ${b.length} segments into learning path`);const{cleanedPath:L,warnings:q,autoFixes:E}=Z(b,e);return E.length>0&&k(`[BespokePath] Quality gate applied ${E.length} auto-fix(es):`,E),q.length>0&&S("[BespokePath] Quality gate warnings:",q),F("sequencePath",Math.ceil(g.length/4),Math.ceil(h.length/4)),L}catch(s){return S("[BespokePath] sequencePath failed:",s.message),Y(e)}}function Y(c){return c.slice(0,D).map((l,d)=>({segment:l,category:j[Math.min(Math.floor(d/2),j.length-1)],order:d}))}const ne=8,se=`Research-backed UE5 learning gap patterns:
- Top beginner roadblocks: C++ complexity, Blueprint debugging, material editor workflow, UI/UMG binding, physics/collision setup, animation state machines, networking/replication, packaging/deployment
- Cognitive load: tutorials > 6 minutes lose learner attention; chunk into 3-5 minute segments
- "Tutorial limbo" pattern: learners follow steps but can't apply concepts independently
- Missing "why" explanations: procedural knowledge without conceptual grounding creates fragile understanding
- Prerequisites are often assumed, not taught: editor navigation, project structure, asset pipeline, coordinate systems
- Bloom's taxonomy gaps: paths that stay at Remember/Understand without advancing to Apply/Analyze/Create leave learners unable to build independently
- Spaced practice: massed practice (all at once) decays quickly; interleaving topics with review checkpoints improves long-term retention
- Transfer gaps: learners who only see one context (e.g. materials in a cave scene) can't transfer skills to new contexts (e.g. materials for vehicles)
- Scaffolding removal: guided examples must progressively reduce support — paths that never remove scaffolds create dependency
- Assessment alignment: if a path teaches "Apply" level skills but only tests "Remember" level, the assessment gives false confidence`;function J(c){if(!c)return null;try{return JSON.parse(c)}catch{}const e=c.match(/[{[\s\S]*[}\]]/);if(!e)return null;let l=e[0].replace(/```json?\s*/gi,"").replace(/```\s*/g,"").replace(/[\u201C\u201D]/g,'"').replace(/[\u2018\u2019]/g,"'").replace(/,\s*([}\]])/g,"$1");try{return JSON.parse(l)}catch{l=l.replace(/'/g,'"');try{return JSON.parse(l)}catch{return null}}}function oe(c,e){const l=new Set;e&&l.add(e.trim());for(const g of c){const s=g?.segment;if(!s)continue;const i=s.title||s.videoTitle||"";i&&i.length>3&&l.add(i.trim());const t=(g.summary||s.text||"").substring(0,150);if(t&&t.length>20){const n=t.split(/[.!?]/)[0]?.trim();n&&n.length>10&&l.add(n)}}const d=[],u=[...l];for(const g of u)d.some(i=>H(i,g)>.6)||d.push(g);return d.slice(0,ne)}async function ae(c){try{const e=G(),l=B(e,"us-central1"),d=z(l,"classifySegments"),u=`You are a UE5 curriculum expert. A learner wants to learn: "${c}"

List the 8-12 essential subtopics/skills that a comprehensive learning path for "${c}" MUST cover.
Think about:
- Core concepts directly related to the goal
- Common prerequisites that are often missed
- Practical skills needed (not just theory)
- Debugging/troubleshooting knowledge for this area

Return ONLY a JSON array of short topic strings (3-6 words each).
Example format: ["Blueprint Event Graphs", "Variable Types and Casting", "Debugging with Breakpoints"]

Return valid JSON only, no markdown fences, no explanation.`,s=(await _(()=>d({prompt:u}),{maxRetries:1,baseDelayMs:1500,label:"requiredSubtopics"})).data?.text||"";F("requiredSubtopics",Math.ceil(u.length/4),Math.ceil(s.length/4));const i=J(s);return Array.isArray(i)&&i.length>0?(k(`[GapAnalyzer] Generated ${i.length} required subtopics for "${c}"`),i.slice(0,12)):(S("[GapAnalyzer] Could not parse required subtopics, using fallback"),null)}catch(e){return S("[GapAnalyzer] generateRequiredSubtopics failed:",e.message),null}}async function he(c,e,l=null){const d={blindSpots:[],assumedKnowledge:[],suggestions:[],weaklyCovered:[],coverageScore:1,corpusStats:{subtopicsChecked:0,subtopicsCovered:0,avgSimilarity:0}};try{if(!e||e.length===0)return d;const u=await ae(c);if(!u||u.length===0)return S("[GapAnalyzer] Could not generate required subtopics, falling back"),d;k(`[GapAnalyzer] Required subtopics: ${u.join(", ")}`);const g=oe(e,c);k(`[GapAnalyzer] Path covers: ${g.join(", ")}`);const s=[],i=[],t=[];let n=null;try{const a=await fetch("/Unreal-Learning-Path-Tagging-System/augmentation_summary.json");if(a.ok){const r=await a.json();n={};for(const p of r.videos||[])n[p.course]||(n[p.course]={totalScore:0,count:0}),n[p.course].totalScore+=p.score||0,n[p.course].count++}}catch{}const h=e.map(a=>{const r=a?.segment,p=r?.title||r?.videoTitle||"",v=a?.summary||r?.text||"";return`${p} ${v}`}).join(" ").toLowerCase();for(const a of u){const r=a.toLowerCase(),p=r.replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(m=>m.length>=2);let v=0,T="";for(const m of g){const w=H(a,m);w>v&&(v=w,T=m)}const A=h.includes(r)||p.length>=2&&h.includes(p.slice(0,3).join(" ")),U=p.filter(m=>h.includes(m)).length,I=p.length>0?U/p.length:0;if(v>.3||A||I>=.7){let m=!1,w=null,O=null;if(n&&T){const W=e.find(x=>{const K=x?.segment;return(K?.title||K?.videoTitle||"").toLowerCase().includes(T.toLowerCase().slice(0,10))}),M=W?.segment?.courseSlug||W?.segment?.course||"";if(M&&n[M]){const x=Math.round(n[M].totalScore/n[M].count);O=x,w=x>=45?"A":x>=39?"B":x>=33?"C":x>=22?"D":"F",m=w==="D"||w==="F"}}m?t.push({topic:a,matchedTo:T||"(multiple courses)",confidence:Math.max(v,I,A?.8:0),augGrade:w,augScore:O,reason:`Covered by course material rated ${w} (${O}/55) — pedagogy needs augmentation`}):s.push({topic:a,matchedTo:T||"(multiple courses)",confidence:Math.max(v,I,A?.8:0)})}else i.push({topic:a,bestOverlap:v,bestMatch:T||null,wordCoverage:I})}const f=s.length+t.length*.5,y=u.length>0?f/u.length:1;if(k(`[GapAnalyzer] Coverage: ${s.length} strong + ${t.length} weak + ${i.length} gaps out of ${u.length} required topics (score: ${y.toFixed(2)})`),i.length===0&&t.length===0)return{...d,coverageScore:y,weaklyCovered:t,corpusStats:{subtopicsChecked:u.length,subtopicsCovered:s.length,avgSimilarity:0}};const $=l?.level?`The learner's assessed level is: ${l.level.toUpperCase()}.`:"Assume a beginner-level learner.",R=i.map(a=>`- "${a.topic}" (best path match: ${a.bestMatch?`"${a.bestMatch}" at ${a.bestOverlap.toFixed(2)} overlap`:"NONE"})`).join(`
`),P=s.map(a=>`- "${a.topic}" (matched to: "${a.matchedTo}")`).join(`
`),C=`You are a UE5 curriculum designer analyzing a learning path for the query: "${c}"

${$}

${se}

TOPICS THE PATH COVERS WELL:
${P||"(none)"}

TOPICS THE PATH IS MISSING (these are the gaps):
${R}

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
- "high" severity = gap is directly related to the original query "${c}"
- "medium" severity = gap is a common prerequisite for this topic area
- "low" severity = gap is tangentially related but not blocking
- Keep responses concise — max 3 suggestions
- Return valid JSON only, no markdown fences`,b=G(),N=B(b,"us-central1"),L=z(N,"classifySegments"),E=(await _(()=>L({prompt:C}),{maxRetries:1,baseDelayMs:1500,label:"gapAnalysis"})).data?.text||"";F("gapAnalysis",Math.ceil(C.length/4),Math.ceil(E.length/4));const o=J(E);return o?{blindSpots:o.blindSpots||[],assumedKnowledge:o.assumedKnowledge||[],suggestions:(o.suggestions||[]).slice(0,3),weaklyCovered:t,coverageScore:y,corpusStats:{subtopicsChecked:u.length,subtopicsCovered:s.length,avgSimilarity:0}}:(S("[GapAnalyzer] Failed to parse Gemini gap analysis response"),{blindSpots:i.map(a=>({topic:a.topic,severity:a.bestOverlap<.1?"high":"medium",reason:"This required topic is not addressed by any course in the path",researchContext:""})),assumedKnowledge:[],suggestions:[],weaklyCovered:t,coverageScore:y,corpusStats:{subtopicsChecked:u.length,subtopicsCovered:s.length,avgSimilarity:0}})}catch(u){return S("[GapAnalyzer] analyzePathGaps failed:",u.message),d}}export{he as a,H as c,J as p,pe as s};
