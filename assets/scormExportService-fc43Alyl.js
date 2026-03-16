import{c as Y}from"./cleanVideoTitle-DZxgGY6A.js";import{t as _,v as q}from"./vendor-firebase-CCJ1U6o_.js";import{c as U,e as A,d as $}from"./index-DS7Wxa5Z.js";import{a as V,M as ge,f as H,S as he}from"./pathSearch-CXYXRdW5.js";import{f as fe}from"./semanticSearchService-ClCqsjAr.js";import{r as G}from"./retryWithBackoff-Ba9diV5s.js";import{r as N}from"./tokenTracker-sRCagNhZ.js";import{J as ie}from"./vendor-export-Cccetl6i.js";import{g as ye}from"./topicNameService-CvghqRQy.js";const Ke=["prerequisite","core","practice"],be={prerequisite:"📘 Understand",core:"📗 Implement",practice:"📙 Apply & Verify"},Je={foundation:"prerequisite",diagnosis:"prerequisite",prerequisite:"prerequisite",fix:"core",core:"core",transfer:"practice",practice:"practice"};function Xe(e={}){return{schemaVersion:2,title:"",learnerGoal:"",quickAnswer:"",rootCause:"",whatYouWillLearn:[],quickWin:"",difficulty:"intermediate",estimatedMinutes:0,prerequisites:[],isAiGenerated:!1,generatedAt:new Date().toISOString(),sections:[],checkpoints:[],replanHistory:[],_sourceFormat:"",_originalQuery:"",...e}}function Ze(e,t=[]){return{id:`section-${e}`,title:be[e]||e,purpose:ve(e),phase:e,steps:t,outcome:"",verificationPrompt:"",exitCondition:"quiz"}}function ve(e){switch(e){case"prerequisite":return"Background concepts and context you need before diving in.";case"core":return"Step-by-step guidance to implement the solution.";case"practice":return"Apply what you learned and verify it works in your own project.";default:return""}}function et(e={}){return{id:e.id||`step-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,title:e.title||"Untitled Step",whyThisMatters:e.whyThisMatters||"",whatToDo:e.whatToDo||[],howToVerify:e.howToVerify||[],commonMistake:e.commonMistake||"",takeaway:e.takeaway||"",summary:e.summary||"",category:e.category||"core",completionType:e.completionType||"do",estimatedMinutes:e.estimatedMinutes||3,source:e.source||{},video:e.video||null,goDeeper:e.goDeeper||[],_originalSegment:e._originalSegment||null,_bridgeText:e._bridgeText||"",_editorialStatus:e._editorialStatus||"raw"}}function se(e){if(!e||typeof e!="string")return"";let t=e.replace(/(?:Unreal Engine\s+\d+\.\d+\s*\\?n?\s*){3,}/gi," ");const a=[/^(well,?|okay,?|so,?|alright,?|hey,?|hi,?|now,?)\s+/gi,/\b(that's it for this (lesson|video|section|module|tutorial))\b.*$/gim,/\b(in the next (lesson|video|section|module))\b.*$/gim,/\b(let's (go ahead and|take a look|jump (in|right in)))\b/gi,/\b(we're gonna|we are going to|I'm gonna|I am going to)\b/gi,/\b(as you can see|as I mentioned|like I said)\b/gi,/\b(don't forget to|make sure you|remember to) (like|subscribe|hit the bell)\b.*$/gim,/\b(thanks for watching|see you in the next)\b.*$/gim];for(const n of a)t=t.replace(n,"");const s=[/Unreal Engine\s+\d+\.\d+(?: Documentation)?/gi,/Epic Developer Community/gi,/Table of Contents/gi,/##?\s*What's New\??/gi,/Ask questions and help your peers\s*Developer Forums/gi,/Write your own tutorials or read those from others\s*Learning Library/gi,/\|/g];for(const n of s)t=t.replace(n,"");return t=t.replace(/[.!?]\s+[A-Z][^.!?]{0,60}$/s,n=>n.slice(n.indexOf(" ")+1).length<40?n[0]:n),t=t.replace(/\\n/g," ").replace(/\s{2,}/g," ").replace(/^[\s,;.]+|[\s,;]+$/g,"").replace(/^\s+/gm,"").trim(),t.length<20?"":t}const we=[{pattern:/^\[?\d{1,2}:\d{2}/m,reason:"timestamp"},{pattern:/\b(um|uh|okay so)\b/i,reason:"filler_word"},{pattern:/^>>\s/m,reason:"speaker_label"},{pattern:/^[A-Z]{2,}:\s/m,reason:"speaker_prefix"},{pattern:/\bversion selector\b/i,reason:"epic_boilerplate"},{pattern:/\bclick here to\b/i,reason:"docs_boilerplate"},{pattern:/\btranscript\b.*\bgenerated\b/i,reason:"transcript_meta"}],Se=[{pattern:/\b(I'm going to|I'm gonna|I was going to|I'll go ahead)\b/i,reason:"first_person_speech"},{pattern:/\b(we're going to|we're gonna|let's go ahead|let's go)\b/i,reason:"first_person_plural"},{pattern:/\b(so to start with|so we can|so what we)\b/i,reason:"verbal_transition"},{pattern:/\bgoing to come on to\b/i,reason:"verbal_direction"},{pattern:/\b(right no\b|right here|over here)\b/i,reason:"spatial_reference"},{pattern:/\.\s+(And|But|So|OK|Okay)\s+/g,reason:"run_on_speech"},{pattern:/\b(Maybe double check|make sure that's working)\b/i,reason:"verbal_hedging"},{pattern:/\bAll of this can be\b/i,reason:"verbal_demonstration"},{pattern:/\bwe set our\b.*\bto\b/i,reason:"verbal_walkthrough"},{pattern:/\bI'm going to call this\b/i,reason:"narrated_action"}],xe=30,$e={foundation:"foundational",diagnosis:"diagnostic",prerequisite:"prerequisite",fix:"implementation",core:"core",transfer:"transfer and application",practice:"practice"};function tt(e,t="this topic",a="core",s={}){let n=se(e||"");if(!n||n.trim().length===0)return{text:D(t,a,s),wasReplaced:!0,reason:"empty_after_cleaning"};for(const{pattern:i,reason:r}of Se)if(i.test(n))return{text:D(t,a,s),wasReplaced:!0,reason:`conversational_speech: ${r}`};const c=[];for(const{pattern:i,reason:r}of we)i.test(n)&&c.push(r);return c.length>=2?{text:D(t,a,s),wasReplaced:!0,reason:`transcript_artifacts: ${c.join(", ")}`}:n.trim().length<xe?{text:D(t,a,s),wasReplaced:!0,reason:"too_short"}:{text:n.trim(),wasReplaced:!1,reason:""}}function D(e,t,a={}){const s=e||"this topic";if(a.outcomes?.length>0){const r=a.outcomes[0];if(r.length>15&&r.length<300&&!/\b(um|uh|gonna)\b/i.test(r))return r.endsWith(".")?r:`${r}.`}if(a.tags?.length>=2){const r=a.tags.filter(o=>typeof o=="string"&&o.length>2).map(o=>o.split(".").pop().replace(/_/g," ")).slice(0,3);if(r.length>=2)return`Explore ${s}, covering ${r.join(", ")} within Unreal Engine 5.`}const n=$e[t]||"core",c=[`This ${n} lesson explores ${s} concepts and workflows in Unreal Engine 5.`,`Gain hands-on experience with ${s} through guided examples and practical exercises.`,`Build your understanding of ${s} — a ${n} part of this learning path.`];let i=0;for(let r=0;r<s.length;r++)i=(i<<5)-i+s.charCodeAt(r)|0;return c[Math.abs(i)%c.length]}function nt(e,t=0){if(!e)return`Step ${t+1}`;const a=e.segment||{},s=e.title||a.title||a.videoTitle||"";if(!s)return`Step ${t+1}`;let n=Y(s);return n=n.replace(/\s*\((?:Bespoke|AI[- ]?Generated|Gap[- ]?Fill)\)\s*/gi,""),n=n.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#x27;/g,"'"),n||`Step ${t+1}`}const ke=[{pattern:/without\s+(?:any\s+)?code/gi,replacement:"without writing C++ or text-based code"},{pattern:/no\s+code\s+(?:is\s+)?(?:needed|required)/gi,replacement:"no C++ code is needed"},{pattern:/no\s+coding\s+(?:is\s+)?(?:needed|required)/gi,replacement:"no C++ coding is needed"},{pattern:/without\s+(?:any\s+)?programming/gi,replacement:"without text-based programming"},{pattern:/don['']t\s+need\s+(?:to\s+)?code/gi,replacement:"don't need to write C++ code"}];function Te(e,t=[]){if(!e||!Array.isArray(e))return{cleanedPath:e||[],warnings:["No path steps to validate"],autoFixes:[]};const a=[],s=[],n=new Set,c=[];for(const o of e){const l=o.segmentIndex??o.segment_index??o.index;if(l!=null&&n.has(l)){s.push(`Removed duplicate segment index ${l} (title: "${o.segment?.title||"unknown"}", category: ${o.category})`);continue}l!=null&&n.add(l),c.push(o)}for(const o of c)if(o.summary){let l=o.summary;for(const{pattern:p,replacement:v}of ke)p.lastIndex=0,p.test(l)&&(p.lastIndex=0,l=l.replace(p,v),s.push(`Fixed phrasing in step "${o.segment?.title||"unknown"}": applied "${v}" correction`));o.summary=l}if(t.length>0){const o=t.map(p=>`${p.text||""} ${p.title||""} ${p.videoTitle||""}`).join(" ").toLowerCase(),l=["depth volume","wind volume","fog volume","weather volume","ai controller","behavior tree","blackboard","nanite","lumen","niagara","mass entity","world partition","control rig","metahuman","modeling mode","texture graph","chaos physics","pcg","procedural content generation"];for(const p of c){if(!p.summary)continue;const v=p.summary.toLowerCase();for(const h of l)v.includes(h)&&!o.includes(h)&&a.push(`⚠️ Potential hallucination: "${h}" found in summary for "${p.segment?.title||"unknown"}" but NOT in source text`)}}const i=new Set,r=[];for(const o of c){const l=(o.segment?.title||o.segment?.videoTitle||"").toLowerCase().trim();if(!l){r.push(o);continue}if(i.has(l)){s.push(`Removed duplicate titled step: "${l}" (category: ${o.category})`);continue}i.add(l),r.push(o)}return r.forEach((o,l)=>{o.order=l}),{cleanedPath:r,warnings:a,autoFixes:s}}const W=["foundation","diagnosis","fix","transfer"],Ce=.25,Ae=new Set(["a","an","the","in","on","at","to","for","of","with","by","from","and","or","not","is","it","be","as","do","has","was","are","but","if","my","this","that","how","what","when","where","why","can","will","so","no","up","out","its","i","me","you","your","we","they","their","about","use","using","used","make","get","set","does","work","works","working","create","need","want","like","just","really","know","new","thing","things","way","going","able","look","help","try"]);function Q(e,t){if(!e||!t)return 0;const a=i=>i.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(r=>r.length>2&&!Ae.has(r)),s=a(e);if(s.length===0)return 1;const n=new Set(a(t));return s.filter(i=>n.has(i)).length/s.length}async function rt(e,t,a=null){if(!t||t.length===0)return[];const s=t.map((i,r)=>{const o=i.type==="transcript"?`Video: ${i.videoTitle} (${i.startTimestamp||""})`:i.type==="epic_learning"?`Article: ${i.title}`:`Docs: ${i.title} > ${i.section}`;return`[${r}] ${o}
   ${i.text.slice(0,2e3)}`}).join(`

`);let n="";if(a){const{knows:i=[],gaps:r=[],level:o="beginner"}=a;n=`

ADAPTIVE DEPTH INSTRUCTIONS (IMPORTANT):
This learner completed a diagnostic quiz. Their assessed level is: ${o.toUpperCase()}
${i.length>0?`
Concepts they ALREADY KNOW (skim these — keep summaries brief, 1 sentence max):
${i.map(l=>`  - ${l.replace(/_/g," ")}`).join(`
`)}`:""}
${r.length>0?`
Knowledge GAPS to fill (go deep — write detailed 3-4 sentence summaries with specific steps):
${r.map(l=>`  - ${l.replace(/_/g," ")}`).join(`
`)}`:""}

Depth rules based on level:
${o==="beginner"?"- Start with absolute basics. Explain every concept. More foundation steps.":""}
${o==="intermediate"?"- Skip basic introductions. Focus on practical application and diagnosis.":""}
${o==="advanced"?"- Skip all basics. Go straight to advanced techniques, edge cases, and optimization.":""}
- Prioritize segments covering the GAP concepts over ones covering KNOWN concepts
- For KNOWN concepts, only include if absolutely essential for context (and mark relevance as "medium")
- For GAP concepts, always mark relevance as "high"`}const c=`You are a UE5 curriculum designer. A learner asked: "${e}"

Here are ${t.length} content segments found via semantic search:

${s}

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
- Max ${V} segments total
- Min ${ge} segments if enough are relevant
- Prefer transcript segments over docs for hands-on topics
- Each summary should be plain text only — no asterisks, no markdown, no code blocks${n}`;try{const i=U(),r=_(i,"us-central1"),o=q(r,"classifySegments"),l=await G(()=>o({prompt:c,grounded:!0}),{maxRetries:2,baseDelayMs:1500,label:"classifySegments"}),p=l.data?.text||"",v=l.data?.groundingMetadata||null,h=p.match(/\[[\s\S]*\]/);if(!h)return A("[BespokePath] Could not parse classification JSON, using fallback ordering"),ee(t);const S=JSON.parse(h[0]);let f=0;for(const g of S){if(g.relevance==="low"||g.index<0||g.index>=t.length)continue;const u=`${g.summary||""} ${t[g.index]?.title||""} ${t[g.index]?.videoTitle||""} ${t[g.index]?.text?.slice(0,500)||""}`,m=Q(e,u);m<Ce?(A(`[BespokePath] Topical cross-check rejected: "${t[g.index]?.title||t[g.index]?.videoTitle||"(untitled)"}" (overlap: ${(m*100).toFixed(0)}%)`),g.relevance="low"):(/\bue\s*4\b/i.test(u)||/\bunreal\s+engine\s+4\b/i.test(u))&&(A(`[BespokePath] UE4 content rejected: "${t[g.index]?.title||t[g.index]?.videoTitle||"(untitled)"}"`),g.relevance="low",f++)}f>0&&$(`[BespokePath] Topical cross-check demoted ${f} step(s) to low relevance`);const x=[];for(const g of W){const u=S.filter(m=>m.category===g&&m.relevance!=="low").sort((m,d)=>m.relevance!==d.relevance?m.relevance==="high"?-1:1:(t[d.index]?.similarity||0)-(t[m.index]?.similarity||0));for(const m of u)if(m.index>=0&&m.index<t.length&&x.length<V){const d=[];if(v?.sources?.length>0){const k=(m.summary||t[m.index].text||"").toLowerCase();(v.supports||[]).forEach(I=>{const P=(I.text||"").toLowerCase();k.split(/\s+/).filter(M=>M.length>4).some(M=>P.includes(M))&&(I.sourceIndices||[]).forEach(M=>{if(v.sources[M]){const j=v.sources[M];d.some(O=>O.url===j.url)||d.push(j)}})})}const T={...t[m.index]};d.length>0&&(T.sources=d),x.push({segment:T,category:m.category,title:m.title||"",summary:m.summary||"",order:x.length})}}const E=x.findIndex(g=>{const u=(g.title||g.segment?.title||g.segment?.videoTitle||"").toLowerCase();return u.includes("introduction to unreal engine")||u.includes("introduction to unreal editor")||u.includes("intro to unreal")});if(E>0){const[g]=x.splice(E,1);g.category="foundation",x.unshift(g),x.forEach((u,m)=>{u.order=m}),$('[BespokePath] Pinned "Introduction to Unreal Engine" to position 0')}$(`[BespokePath] Sequenced ${x.length} segments into learning path`);const{cleanedPath:y,warnings:b,autoFixes:C}=Te(x,t);return C.length>0&&$(`[BespokePath] Quality gate applied ${C.length} auto-fix(es):`,C),b.length>0&&A("[BespokePath] Quality gate warnings:",b),N("sequencePath",Math.ceil(c.length/4),Math.ceil(p.length/4)),y}catch(i){return A("[BespokePath] sequencePath failed:",i.message),ee(t)}}function ee(e){return e.slice(0,V).map((a,s)=>({segment:a,category:W[Math.min(Math.floor(s/2),W.length-1)],order:s}))}const Ee=8,Ie=`Research-backed UE5 learning gap patterns:
- Top beginner roadblocks: C++ complexity, Blueprint debugging, material editor workflow, UI/UMG binding, physics/collision setup, animation state machines, networking/replication, packaging/deployment
- Cognitive load: tutorials > 6 minutes lose learner attention; chunk into 3-5 minute segments
- "Tutorial limbo" pattern: learners follow steps but can't apply concepts independently
- Missing "why" explanations: procedural knowledge without conceptual grounding creates fragile understanding
- Prerequisites are often assumed, not taught: editor navigation, project structure, asset pipeline, coordinate systems
- Bloom's taxonomy gaps: paths that stay at Remember/Understand without advancing to Apply/Analyze/Create leave learners unable to build independently
- Spaced practice: massed practice (all at once) decays quickly; interleaving topics with review checkpoints improves long-term retention
- Transfer gaps: learners who only see one context (e.g. materials in a cave scene) can't transfer skills to new contexts (e.g. materials for vehicles)
- Scaffolding removal: guided examples must progressively reduce support — paths that never remove scaffolds create dependency
- Assessment alignment: if a path teaches "Apply" level skills but only tests "Remember" level, the assessment gives false confidence`;function K(e){if(!e)return null;try{return JSON.parse(e)}catch{}const t=e.match(/[{[\s\S]*[}\]]/);if(!t)return null;let a=t[0].replace(/```json?\s*/gi,"").replace(/```\s*/g,"").replace(/[\u201C\u201D]/g,'"').replace(/[\u2018\u2019]/g,"'").replace(/,\s*([}\]])/g,"$1");try{return JSON.parse(a)}catch{a=a.replace(/'/g,'"');try{return JSON.parse(a)}catch{return null}}}function Me(e,t){const a=new Set;t&&a.add(t.trim());for(const c of e){const i=c?.segment;if(!i)continue;const r=i.title||i.videoTitle||"";r&&r.length>3&&a.add(r.trim());const o=(c.summary||i.text||"").substring(0,150);if(o&&o.length>20){const l=o.split(/[.!?]/)[0]?.trim();l&&l.length>10&&a.add(l)}}const s=[],n=[...a];for(const c of n)s.some(r=>Q(r,c)>.6)||s.push(c);return s.slice(0,Ee)}async function Oe(e){try{const t=U(),a=_(t,"us-central1"),s=q(a,"classifySegments"),n=`You are a UE5 curriculum expert. A learner wants to learn: "${e}"

List the 8-12 essential subtopics/skills that a comprehensive learning path for "${e}" MUST cover.
Think about:
- Core concepts directly related to the goal
- Common prerequisites that are often missed
- Practical skills needed (not just theory)
- Debugging/troubleshooting knowledge for this area

Return ONLY a JSON array of short topic strings (3-6 words each).
Example format: ["Blueprint Event Graphs", "Variable Types and Casting", "Debugging with Breakpoints"]

Return valid JSON only, no markdown fences, no explanation.`,i=(await G(()=>s({prompt:n}),{maxRetries:1,baseDelayMs:1500,label:"requiredSubtopics"})).data?.text||"";N("requiredSubtopics",Math.ceil(n.length/4),Math.ceil(i.length/4));const r=K(i);return Array.isArray(r)&&r.length>0?($(`[GapAnalyzer] Generated ${r.length} required subtopics for "${e}"`),r.slice(0,12)):(A("[GapAnalyzer] Could not parse required subtopics, using fallback"),null)}catch(t){return A("[GapAnalyzer] generateRequiredSubtopics failed:",t.message),null}}async function ot(e,t,a=null){const s={blindSpots:[],assumedKnowledge:[],suggestions:[],weaklyCovered:[],coverageScore:1,corpusStats:{subtopicsChecked:0,subtopicsCovered:0,avgSimilarity:0}};try{if(!t||t.length===0)return s;const n=await Oe(e);if(!n||n.length===0)return A("[GapAnalyzer] Could not generate required subtopics, falling back"),s;$(`[GapAnalyzer] Required subtopics: ${n.join(", ")}`);const c=Me(t,e);$(`[GapAnalyzer] Path covers: ${c.join(", ")}`);const i=[],r=[],o=[];let l=null;try{const d=await fetch("/Unreal-Learning-Path-Tagging-System/augmentation_summary.json");if(d.ok){const T=await d.json();l={};for(const k of T.videos||[])l[k.course]||(l[k.course]={totalScore:0,count:0}),l[k.course].totalScore+=k.score||0,l[k.course].count++}}catch{}const p=t.map(d=>{const T=d?.segment,k=T?.title||T?.videoTitle||"",I=d?.summary||T?.text||"";return`${k} ${I}`}).join(" ").toLowerCase();for(const d of n){const T=d.toLowerCase(),k=T.replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(O=>O.length>=2);let I=0,P="";for(const O of c){const L=Q(d,O);L>I&&(I=L,P=O)}const z=p.includes(T)||k.length>=2&&p.includes(k.slice(0,3).join(" ")),J=k.filter(O=>p.includes(O)).length,M=k.length>0?J/k.length:0;if(I>.3||z||M>=.7){let O=!1,L=null,B=null;if(l&&P){const X=t.find(R=>{const Z=R?.segment;return(Z?.title||Z?.videoTitle||"").toLowerCase().includes(P.toLowerCase().slice(0,10))}),F=X?.segment?.courseSlug||X?.segment?.course||"";if(F&&l[F]){const R=Math.round(l[F].totalScore/l[F].count);B=R,L=R>=45?"A":R>=39?"B":R>=33?"C":R>=22?"D":"F",O=L==="D"||L==="F"}}O?o.push({topic:d,matchedTo:P||"(multiple courses)",confidence:Math.max(I,M,z?.8:0),augGrade:L,augScore:B,reason:`Covered by course material rated ${L} (${B}/55) — pedagogy needs augmentation`}):i.push({topic:d,matchedTo:P||"(multiple courses)",confidence:Math.max(I,M,z?.8:0)})}else r.push({topic:d,bestOverlap:I,bestMatch:P||null,wordCoverage:M})}const v=i.length+o.length*.5,h=n.length>0?v/n.length:1;if($(`[GapAnalyzer] Coverage: ${i.length} strong + ${o.length} weak + ${r.length} gaps out of ${n.length} required topics (score: ${h.toFixed(2)})`),r.length===0&&o.length===0)return{...s,coverageScore:h,weaklyCovered:o,corpusStats:{subtopicsChecked:n.length,subtopicsCovered:i.length,avgSimilarity:0}};const S=a?.level?`The learner's assessed level is: ${a.level.toUpperCase()}.`:"Assume a beginner-level learner.",f=r.map(d=>`- "${d.topic}" (best path match: ${d.bestMatch?`"${d.bestMatch}" at ${d.bestOverlap.toFixed(2)} overlap`:"NONE"})`).join(`
`),x=i.map(d=>`- "${d.topic}" (matched to: "${d.matchedTo}")`).join(`
`),E=`You are a UE5 curriculum designer analyzing a learning path for the query: "${e}"

${S}

${Ie}

TOPICS THE PATH COVERS WELL:
${x||"(none)"}

TOPICS THE PATH IS MISSING (these are the gaps):
${f}

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
- "high" severity = gap is directly related to the original query "${e}"
- "medium" severity = gap is a common prerequisite for this topic area
- "low" severity = gap is tangentially related but not blocking
- Keep responses concise — max 3 suggestions
- Return valid JSON only, no markdown fences`,y=U(),b=_(y,"us-central1"),C=q(b,"classifySegments"),u=(await G(()=>C({prompt:E}),{maxRetries:1,baseDelayMs:1500,label:"gapAnalysis"})).data?.text||"";N("gapAnalysis",Math.ceil(E.length/4),Math.ceil(u.length/4));const m=K(u);return m?{blindSpots:m.blindSpots||[],assumedKnowledge:m.assumedKnowledge||[],suggestions:(m.suggestions||[]).slice(0,3),weaklyCovered:o,coverageScore:h,corpusStats:{subtopicsChecked:n.length,subtopicsCovered:i.length,avgSimilarity:0}}:(A("[GapAnalyzer] Failed to parse Gemini gap analysis response"),{blindSpots:r.map(d=>({topic:d.topic,severity:d.bestOverlap<.1?"high":"medium",reason:"This required topic is not addressed by any course in the path",researchContext:""})),assumedKnowledge:[],suggestions:[],weaklyCovered:o,coverageScore:h,corpusStats:{subtopicsChecked:n.length,subtopicsCovered:i.length,avgSimilarity:0}})}catch(n){return A("[GapAnalyzer] analyzePathGaps failed:",n.message),s}}const Pe=3,te=.55,ne=.5,re=3;async function at(e,t,a,s=[]){try{$(`[GapFill] 3-tier fill for gap: "${e}"`);const n=new Set(s);try{const y=U(),b=_(y,"us-central1"),u=(await q(b,"embedQuery")({text:e})).data?.embedding;if(u){const d=(await fe(u,8)).filter(T=>T.similarity>=te&&!n.has(T.code)).sort((T,k)=>k.similarity-T.similarity).slice(0,re);if(d.length>0)return $(`[GapFill] Tier 1 HIT — ${d.length} library courses for "${e}"`),{source:"library",matchedCourses:d};$(`[GapFill] Tier 1 MISS — no library matches above ${te} for "${e}"`)}}catch(y){A(`[GapFill] Tier 1 failed, falling through: ${y.message}`)}try{const{segments:y}=await H(e,8),b=y.filter(u=>(u.similarity||0)>=ne),C=new Map;for(const u of b){const m=u.videoTitle||u.videoUrl||u.title||"unknown",d=C.get(m);(!d||(u.similarity||0)>(d.similarity||0))&&C.set(m,u)}const g=[...C.values()].sort((u,m)=>(m.similarity||0)-(u.similarity||0)).slice(0,re);if(g.length>0)return $(`[GapFill] Tier 2 HIT — ${g.length} segments (deduped from ${b.length}) for "${e}"`),{source:"bespoke",segments:g.map(u=>({title:u.title||u.videoTitle||"Untitled",text:(u.text||"").substring(0,300),videoTitle:u.videoTitle||"",videoUrl:u.videoUrl||"",similarity:u.similarity||0}))};$(`[GapFill] Tier 2 MISS — no segments above ${ne} for "${e}"`)}catch(y){A(`[GapFill] Tier 2 failed, falling through: ${y.message}`)}$(`[GapFill] Tier 3 — generating AI step for "${e}"`);let c="";try{const{segments:y}=await H(e,Pe);y.length>0&&(c=`
Related content from our corpus:
${y.slice(0,2).map(b=>`- "${b.title||b.videoTitle}": ${(b.text||"").substring(0,200)}`).join(`
`)}`)}catch{}const i=a.map(y=>y.segment?.title||y.segment?.videoTitle||"").filter(Boolean).join(", "),r=`You are a UE5 curriculum designer. A learning path for "${t}" has a gap in: "${e}"

Existing steps cover: ${i}
${c}

Generate a SINGLE learning step to fill this gap. Return a JSON object:
{
  "title": "Short descriptive title (3-6 words, gerund format like 'Understanding Blueprint Variables')",
  "category": "prerequisite" or "core" or "practice",
  "summary": "3-5 sentences teaching this concept directly. Plain text, no markdown. Include specific UE5 menu paths, property names, and node names where relevant."
}

RULES:
- The step must directly address "${e}" in the context of "${t}"
- Do NOT repeat content already in the path
- Be specific to UE5 (not UE4)
- PRIORITIZE Blueprint-based approaches unless the topic is specifically about C++
- Return valid JSON only, no markdown fences`,o=U(),l=_(o,"us-central1"),p=q(l,"classifySegments"),v=await G(()=>p({prompt:r,grounded:!0}),{maxRetries:1,baseDelayMs:1500,label:"gapFillStep"}),h=v.data?.text||v.data?.response||"",S=v.data?.groundingMetadata||null;if(N("gapFillStep",Math.ceil(r.length/4),Math.ceil(h.length/4)),!h)return A("[GapFill] Empty AI response"),{source:"ai",step:{segment:{title:`Learn: ${e}`,text:`Study ${e} in context of ${t}.`},category:"core",isGapFill:!0}};let f=K(h);(!f||!f.title)&&(f={title:`Understanding ${e}`,summary:h.replace(/```json?|```/gi,"").trim().slice(0,500),category:"core"});const x=[];S?.sources?.length>0&&(S.supports||[]).forEach(y=>{(y.sourceIndices||[]).forEach(b=>{if(S.sources[b]){const C=S.sources[b];x.some(g=>g.url===C.url)||x.push(C)}})});const E={segment:{id:`gap-fill-${Date.now()}`,type:"ai_generated",title:f.title,text:f.summary,source:"ai_generated",sources:x.length>0?x:void 0,corpusVerified:!1},category:f.category||"core",summary:f.summary,order:a.length,isGapFill:!0};try{const{segments:y}=await H(f.summary||f.title,1);if(y.length>0&&y[0].similarity>=he){const b=y[0];E.segment.corpusVerified=!0,E.segment.corpusMatch={videoTitle:b.videoTitle||b.title||"",videoUrl:b.videoUrl||b.url||"",similarity:b.similarity}}}catch{}return $(`[GapFill] Tier 3 AI step: "${f.title}" [${E.category}]`),{source:"ai",step:E}}catch(n){return A("[GapFill] generateGapFillStep failed:",n.message),null}}function it(e,t){const a=t[0];return{code:`bespoke-${Date.now()}`,title:e,description:`This lesson covers ${e} using key concepts from Unreal Engine 5.`,type:"bespoke_segment",role:"core",duration_seconds:t.length*300,tags:{level:"Intermediate",industry:"General"},isBespoke:!0,isGapFill:!0,sourceSegments:t.map(s=>({title:s.title,videoTitle:s.videoTitle,videoUrl:s.videoUrl,similarity:s.similarity})),videoTitle:a?.videoTitle||"",videoUrl:a?.videoUrl||""}}async function Le(e,t,a=3){if(!e?.segment?.text&&!e?.summary)return[];const s=(e.summary||e.segment?.text||"").slice(0,1500);try{const n=U(),c=_(n,"us-central1"),r=await q(c,"generateAudioBriefing")({mode:"quiz",query:t,stepContent:s,stepCategory:e.category||"learning",quizCount:a});return r.data?.questions&&Array.isArray(r.data.questions)?($(`[Quiz] Generated ${r.data.questions.length} questions for ${e.category} step`),N("quizGeneration",Math.ceil(s.length/4),Math.ceil(JSON.stringify(r.data.questions).length/4)),r.data.questions):oe(e)}catch(n){return A("[Quiz] AI quiz generation failed:",n.message),oe(e)}}async function st(e,t,a=5){if(!e||e.length===0||a<=0)return new Map;const s=Math.floor(a/e.length);let n=a%e.length;const c=await Promise.allSettled(e.map(r=>{let o=s;return n>0&&(o++,n--),o===0?Promise.resolve([]):Le(r,t,o)})),i=new Map;return c.forEach((r,o)=>{r.status==="fulfilled"&&r.value.length>0&&i.set(o,r.value)}),$(`[Quiz] Generated quizzes for ${i.size}/${e.length} steps`),i}function ct(e,t){return{isCorrect:t===e.correct,correctAnswer:e.correct,explanation:e.explanation||""}}function oe(e){const t={foundation:{stem:"Based on the content you just read, what is the fundamental concept being explained?",choices:{A:"A performance optimization technique",B:"A core architectural pattern in UE5",C:"A debugging methodology",D:"A deployment configuration"},correct:"B",explanation:"Foundation content typically covers core architectural patterns and concepts."},diagnosis:{stem:"What is the key indicator that helps identify this type of problem?",choices:{A:"Compile-time errors in the build log",B:"Visual artifacts or unexpected behavior at runtime",C:"Missing asset references in the content browser",D:"Network timeout errors in the output log"},correct:"B",explanation:"Diagnosis content focuses on identifying symptoms and root causes at runtime."},fix:{stem:"What is the recommended first step when applying this fix?",choices:{A:"Restart the editor immediately",B:"Back up the project and verify the issue is reproducible",C:"Delete all derived data caches",D:"Update to the latest engine version"},correct:"B",explanation:"Always back up and verify reproducibility before applying fixes."},transfer:{stem:"How can this knowledge be applied to other areas of UE5 development?",choices:{A:"It only applies to this specific use case",B:"The underlying pattern is reusable across similar systems",C:"It requires a completely different approach in other contexts",D:"It's only relevant for legacy projects"},correct:"B",explanation:"Transfer knowledge emphasizes reusable patterns across different contexts."}};return[t[e.category]||t.foundation]}function ce(e){if(!e||typeof e!="string")return e;let t=e;return t=t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),t=t.replace(/^### (.+)$/gm,'<h3 style="color: var(--accent-orange, #d29922); font-size: 1rem; margin: 16px 0 8px;">$1</h3>'),t=t.replace(/^## (.+)$/gm,'<h2 style="color: var(--accent-green, #3fb950); font-size: 1.1rem; margin: 20px 0 10px;">$1</h2>'),t=t.replace(/^# (.+)$/gm,'<h1 style="color: var(--accent, #58a6ff); font-size: 1.3rem; margin: 24px 0 12px;">$1</h1>'),t=t.replace(/\*\*\*(.+?)\*\*\*/g,"<strong><em>$1</em></strong>"),t=t.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>"),t=t.replace(/\*(.+?)\*/g,"<em>$1</em>"),t=t.replace(/`([^`]+)`/g,'<code style="background: rgba(88,166,255,0.1); padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 0.85em;">$1</code>'),t=t.replace(/^- (.+)$/gm,'<li style="margin: 4px 0; margin-left: 20px;">$1</li>'),t=t.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g,'<ul style="list-style: disc; padding-left: 20px; margin: 8px 0;">$1</ul>'),t=t.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer" style="color: var(--accent, #58a6ff);">$1</a>'),t=t.replace(/\n\n/g,'</p><p style="margin-bottom: 12px; color: var(--text-secondary, #8b949e);">'),t=t.replace(/\n/g,"<br>"),t}const le=`
// Minimal SCORM 1.2 RTE API Wrapper
// Finds the SCORM API in the opener/parent chain and wraps it.
var API = null;

function findAPI(win) {
  var attempts = 0;
  while (!win.API && win.parent && win.parent !== win && attempts < 10) {
    win = win.parent;
    attempts++;
  }
  return win.API || null;
}

function initSCORM() {
  API = findAPI(window);
  if (!API && window.opener) API = findAPI(window.opener);
  if (API) {
    API.LMSInitialize("");
    API.LMSSetValue("cmi.core.lesson_status", "incomplete");
    API.LMSCommit("");
  }
}

function completeSCORM() {
  if (API) {
    API.LMSSetValue("cmi.core.lesson_status", "completed");
    API.LMSCommit("");
  }
}

function finishSCORM() {
  if (API) {
    API.LMSFinish("");
  }
}

function setScore(score, max) {
  if (API) {
    API.LMSSetValue("cmi.core.score.raw", String(score));
    API.LMSSetValue("cmi.core.score.max", String(max));
    API.LMSSetValue("cmi.core.score.min", "0");
    API.LMSSetValue("cmi.core.lesson_status", score >= max * 0.7 ? "passed" : "failed");
    API.LMSCommit("");
  }
}

window.addEventListener("load", initSCORM);
window.addEventListener("beforeunload", finishSCORM);
`,pe=`
:root {
  --bg: #0d1117;
  --card-bg: #161b22;
  --text: #e6edf3;
  --text-secondary: #8b949e;
  --accent: #58a6ff;
  --accent-green: #3fb950;
  --accent-orange: #d29922;
  --border: #30363d;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  padding: 40px;
  max-width: 900px;
  margin: 0 auto;
}
h1 { font-size: 1.8rem; margin-bottom: 8px; color: var(--accent); }
h2 { font-size: 1.3rem; margin: 24px 0 12px; color: var(--accent-green); }
h3 { font-size: 1.1rem; margin: 16px 0 8px; color: var(--accent-orange); }
p { margin-bottom: 12px; color: var(--text-secondary); }
.step-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
}
.step-meta { font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 16px; }
.step-meta span { margin-right: 16px; }
.category-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}
.cat-foundation { background: rgba(88, 166, 255, 0.15); color: #58a6ff; }
.cat-fix, .cat-core { background: rgba(63, 185, 80, 0.15); color: #3fb950; }
.cat-transfer, .cat-practice { background: rgba(210, 153, 34, 0.15); color: #d29922; }
.bridge-box {
  background: rgba(88, 166, 255, 0.05);
  border-left: 3px solid var(--accent);
  padding: 12px 16px;
  margin: 16px 0;
  border-radius: 0 8px 8px 0;
  font-style: italic;
  color: var(--text-secondary);
}
.complete-btn {
  display: block;
  margin: 32px auto;
  padding: 12px 32px;
  background: var(--accent-green);
  color: #000;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}
.complete-btn:hover { opacity: 0.9; }
.complete-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.nav-row { display: flex; justify-content: space-between; margin-top: 24px; }
.nav-link {
  color: var(--accent);
  text-decoration: none;
  font-size: 0.9rem;
}
.nav-link:hover { text-decoration: underline; }
.quiz-q { margin-bottom: 20px; }
.quiz-q label { display: block; padding: 6px 0; cursor: pointer; }
.quiz-q input[type="radio"] { margin-right: 8px; }
`;function de(e){return e.replace(/[^a-zA-Z0-9_-]/g,"_").substring(0,50)}function ae(e){return(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;")}function w(e){return(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function Re(e){const t=e.toLowerCase();return t.includes("foundation")?"cat-foundation":t.includes("fix")||t.includes("core")?"cat-fix":t.includes("transfer")||t.includes("practice")?"cat-transfer":""}function _e(e,t,a,s,n){const c=ye(e)||Y(e.segment?.title||e.title||`Step ${t+1}`),i=e.summary||e.segment?.text||e.segment?.summary||"",r=se(i),o=e.category||"core",l=Re(o),p=e.segment?.source||e.segment?.type||"",v=t>0?`<a class="nav-link" href="sco_${t-1}.html">← Previous</a>`:"<span></span>",h=t<a-1?`<a class="nav-link" href="sco_${t+1}.html">Next →</a>`:"<span></span>",S=s?.text?`<div class="bridge-box"><strong>Connection:</strong> ${w(s.text)}</div>`:"";return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${w(c)}</title>
  <link rel="stylesheet" href="shared/style.css">
  <script src="shared/scormapi.js"><\/script>
</head>
<body>
  <p style="font-size:0.8rem;color:var(--text-secondary)">
    ${w(n)} — Step ${t+1} of ${a}
  </p>
  <h1>${w(c)}</h1>
  <div class="step-card">
    <div class="step-meta">
      <span class="category-badge ${l}">${w(o)}</span>
      ${p?`<span>Source: ${w(p)}</span>`:""}
    </div>
    <div class="step-summary">${ce(r)}</div>
  </div>
  ${S}
  <button class="complete-btn" id="mark-complete" onclick="this.disabled=true;this.textContent='✅ Completed';completeSCORM();">
    Mark Step Complete
  </button>
  <div class="nav-row">
    ${v}
    ${h}
  </div>
</body>
</html>`}function ue(e,t){const a=e.slice(0,10).map((n,c)=>{const i=Y(n.segment?.title||n.title||`Step ${c+1}`);return{question:`What is the main topic covered in "${i}"?`,stepTitle:i}}),s=a.map((n,c)=>`
    <div class="quiz-q">
      <p><strong>Q${c+1}:</strong> ${w(n.question)}</p>
      <label><input type="radio" name="q${c}" value="correct"> ${w(n.stepTitle)}</label>
      <label><input type="radio" name="q${c}" value="wrong1"> Unrelated Topic A</label>
      <label><input type="radio" name="q${c}" value="wrong2"> Unrelated Topic B</label>
    </div>
  `).join(`
`);return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Knowledge Check</title>
  <link rel="stylesheet" href="shared/style.css">
  <script src="shared/scormapi.js"><\/script>
</head>
<body>
  <h1>Knowledge Check</h1>
  <p>Review your understanding of the concepts from "${w(t)}".</p>
  <form id="quiz-form">
    ${s}
    <button type="submit" class="complete-btn">Submit Answers</button>
  </form>
  <div id="result" style="display:none;text-align:center;margin-top:24px;"></div>
  <script>
    document.getElementById('quiz-form').addEventListener('submit', function(e) {
      e.preventDefault();
      var total = ${a.length};
      var correct = 0;
      for (var i = 0; i < total; i++) {
        var sel = document.querySelector('input[name="q' + i + '"]:checked');
        if (sel && sel.value === 'correct') correct++;
      }
      var pct = Math.round((correct / total) * 100);
      document.getElementById('result').style.display = 'block';
      document.getElementById('result').innerHTML =
        '<h2>Score: ' + correct + '/' + total + ' (' + pct + '%)</h2>' +
        '<p>' + (pct >= 70 ? '✅ Passed!' : '❌ Try again — 70% required to pass.') + '</p>';
      setScore(correct, total);
      this.querySelector('button').disabled = true;
    });
  <\/script>
</body>
</html>`}function me(e,t,a){const s="ORG-001",n="MANIFEST-UE5-"+Date.now(),c=t.map((l,p)=>`
    <resource identifier="RES-${p}" type="webcontent" adlcp:scormtype="sco" href="${l}">
      <file href="${l}"/>
      <file href="shared/scormapi.js"/>
      <file href="shared/style.css"/>
    </resource>`).join(`
`),i=a?`
    <resource identifier="RES-QUIZ" type="webcontent" adlcp:scormtype="sco" href="quiz.html">
      <file href="quiz.html"/>
      <file href="shared/scormapi.js"/>
      <file href="shared/style.css"/>
    </resource>`:"",r=t.map((l,p)=>`
      <item identifier="ITEM-${p}" identifierref="RES-${p}">
        <title>${ae(`Step ${p+1}`)}</title>
      </item>`).join(`
`),o=a?`
      <item identifier="ITEM-QUIZ" identifierref="RES-QUIZ">
        <title>Knowledge Check</title>
      </item>`:"";return`<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${n}"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                       http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="${s}">
    <organization identifier="${s}">
      <title>${ae(e)}</title>
      ${r}
      ${o}
    </organization>
  </organizations>
  <resources>
    ${c}
    ${i}
  </resources>
</manifest>`}async function lt(e,t={}){const{includeQuiz:a=!0}=t;if(e?.v2Path)return ze(e.v2Path,{includeQuiz:a,query:e.query});if(!e?.path?.length)throw new Error("Cannot export empty path");const s=e.query?`UE5 Learning Path: ${e.query.substring(0,60)}`:"UE5 Learning Path",n=new ie;n.file("shared/scormapi.js",le),n.file("shared/style.css",pe);const c=[];e.path.forEach((l,p)=>{const v=`sco_${p}.html`,h=e.bridges?.[p]||null,S=_e(l,p,e.path.length,h,s);n.file(v,S),c.push(v)}),a&&e.path.length>=2&&n.file("quiz.html",ue(e.path,s)),n.file("imsmanifest.xml",me(s,c,a&&e.path.length>=2));const i=await n.generateAsync({type:"blob"}),r=`scorm_${de(e.query||"path")}_${Date.now()}.zip`,o=document.createElement("a");o.href=URL.createObjectURL(i),o.download=r,document.body.appendChild(o),o.click(),document.body.removeChild(o),URL.revokeObjectURL(o.href),$(`[SCORM] Package downloaded: ${r} (${c.length} SCOs)`)}function qe(e,t,a,s,n){const c=e.title||`Step ${t+1}`,i=e.completionType||"watch",r={watch:"📺 Watch",do:"🔧 Do",apply:"🎯 Apply",check:"✅ Check"}[i]||"✅ Complete";let o="";if(e.whyThisMatters&&(o+=`<div class="v2-section v2-why"><h3>💡 Why This Matters</h3><p>${w(e.whyThisMatters)}</p></div>`),e.whatToDo?.length){const v=e.whatToDo.map(h=>`<li>${w(h)}</li>`).join("");o+=`<div class="v2-section v2-do"><h3>🔧 What To Do</h3><ol>${v}</ol></div>`}e.howToVerify&&(o+=`<div class="v2-section v2-verify"><h3>✅ How To Verify</h3><p>${w(e.howToVerify)}</p></div>`),e.commonMistake&&(o+=`<div class="v2-section v2-mistake"><h3>⚠️ Common Mistake</h3><p>${w(e.commonMistake)}</p></div>`),e.takeaway&&(o+=`<div class="v2-section v2-takeaway"><h3>🎯 Key Takeaway</h3><p>${w(e.takeaway)}</p></div>`),!o&&e.summary&&(o=`<div class="step-summary">${ce(e.summary)}</div>`);const l=t>0?`<a class="nav-link" href="sco_${t-1}.html">← Previous</a>`:"<span></span>",p=t<a-1?`<a class="nav-link" href="sco_${t+1}.html">Next →</a>`:"<span></span>";return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${w(c)}</title>
  <link rel="stylesheet" href="shared/style.css">
  <script src="shared/scormapi.js"><\/script>
</head>
<body>
  <p style="font-size:0.8rem;color:var(--text-secondary)">
    ${w(n)} — ${w(s)} — Step ${t+1} of ${a}
  </p>
  <h1>${w(c)}</h1>
  <div class="step-meta">
    <span class="category-badge cat-${w(i)}">${r}</span>
  </div>
  ${o}
  <button class="complete-btn" id="mark-complete" onclick="this.disabled=true;this.textContent='✅ Completed';completeSCORM();">
    Mark Step Complete
  </button>
  <div class="nav-row">
    ${l}
    ${p}
  </div>
</body>
</html>`}function Ue(e,t,a,s){const n=e.title||e.phase||`Section ${t+1}`,c=e.purpose||"",i=e.steps?.length||0;return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${w(n)}</title>
  <link rel="stylesheet" href="shared/style.css">
  <script src="shared/scormapi.js"><\/script>
</head>
<body>
  <p style="font-size:0.8rem;color:var(--text-secondary)">
    ${w(s)} — Section ${t+1} of ${a}
  </p>
  <h1>${w(n)}</h1>
  ${c?`<p style="font-size:1.05rem;color:var(--text);margin:16px 0;">${w(c)}</p>`:""}
  <div class="step-card">
    <p>This section contains <strong>${i}</strong> step${i!==1?"s":""}.</p>
    <p>Click "Continue" to begin.</p>
  </div>
  <button class="complete-btn" onclick="this.disabled=true;this.textContent='✅ Ready';completeSCORM();">
    Continue →
  </button>
</body>
</html>`}const Ne=`
.v2-section {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px 20px;
  margin: 12px 0;
  border-left: 4px solid var(--border);
}
.v2-section h3 { font-size: 1rem; margin: 0 0 8px; }
.v2-section p { margin: 0; line-height: 1.6; }
.v2-section ol { padding-left: 1.5rem; margin: 8px 0 0; }
.v2-section li { margin-bottom: 6px; color: var(--text); }
.v2-why { border-left-color: var(--accent); }
.v2-why h3 { color: var(--accent); }
.v2-do { border-left-color: var(--accent-green); }
.v2-do h3 { color: var(--accent-green); }
.v2-verify { border-left-color: #8b5cf6; }
.v2-verify h3 { color: #8b5cf6; }
.v2-mistake { border-left-color: var(--accent-orange); background: rgba(210,153,34,0.04); }
.v2-mistake h3 { color: var(--accent-orange); }
.v2-takeaway { border-left-color: #f97583; }
.v2-takeaway h3 { color: #f97583; }
.cat-watch { background: rgba(88,166,255,0.15); color: #58a6ff; }
.cat-do { background: rgba(63,185,80,0.15); color: #3fb950; }
.cat-apply { background: rgba(139,92,246,0.15); color: #8b5cf6; }
.cat-check { background: rgba(210,153,34,0.15); color: #d29922; }
`;async function ze(e,t={}){const{includeQuiz:a=!0,query:s=""}=t;if(!e?.sections?.length)throw new Error("Cannot export empty V2 path");const n=e.title||(s?`UE5 Learning Path: ${s.substring(0,60)}`:"UE5 Learning Path"),c=new ie;c.file("shared/scormapi.js",le),c.file("shared/style.css",pe+Ne);const i=[];let r=0;const o=e.sections.length,l=e.sections.reduce((f,x)=>f+(x.steps?.length||0),0)+o;e.sections.forEach((f,x)=>{const E=`sco_${r}.html`;c.file(E,Ue(f,x,o,n)),i.push(E),r++,(f.steps||[]).forEach(y=>{const b=`sco_${r}.html`,C=f.title||f.phase||"";c.file(b,qe(y,r,l,C,n)),i.push(b),r++})});const p=e.sections.flatMap(f=>f.steps||[]);a&&p.length>=2&&c.file("quiz.html",ue(p,n)),c.file("imsmanifest.xml",me(n,i,a&&p.length>=2));const v=await c.generateAsync({type:"blob"}),h=`scorm_v2_${de(s||e.title||"path")}_${Date.now()}.zip`,S=document.createElement("a");S.href=URL.createObjectURL(v),S.download=h,document.body.appendChild(S),S.click(),document.body.removeChild(S),URL.revokeObjectURL(S.href),$(`[SCORM V2] Package downloaded: ${h} (${i.length} SCOs)`)}export{Je as C,be as S,ot as a,at as b,se as c,it as d,tt as e,lt as f,st as g,Q as h,Xe as i,et as j,Ke as k,Ze as l,ce as m,Le as n,ct as o,K as p,nt as r,rt as s};
