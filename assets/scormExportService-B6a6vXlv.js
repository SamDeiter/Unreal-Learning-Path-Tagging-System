import{c as Y}from"./cleanVideoTitle-DZxgGY6A.js";import{t as _,v as q}from"./vendor-firebase-CCJ1U6o_.js";import{c as N,e as T,d as v}from"./index-BX-1tCu4.js";import{a as V,M as se,f as H,S as ce}from"./pathSearch-BdeWze8M.js";import{f as le}from"./semanticSearchService-FUatYeZE.js";import{r as D}from"./retryWithBackoff-Ba9diV5s.js";import{r as U}from"./tokenTracker-CBHy_WuH.js";import{J as pe}from"./vendor-export-Cccetl6i.js";import{g as ue}from"./topicNameService-CvghqRQy.js";const Ve=["prerequisite","core","practice"],de={prerequisite:"📘 Understand",core:"📗 Implement",practice:"📙 Apply & Verify"},We={foundation:"prerequisite",diagnosis:"prerequisite",prerequisite:"prerequisite",fix:"core",core:"core",transfer:"practice",practice:"practice"};function Ye(e={}){return{schemaVersion:2,title:"",learnerGoal:"",quickAnswer:"",rootCause:"",whatYouWillLearn:[],quickWin:"",difficulty:"intermediate",estimatedMinutes:0,prerequisites:[],isAiGenerated:!1,generatedAt:new Date().toISOString(),sections:[],checkpoints:[],replanHistory:[],_sourceFormat:"",_originalQuery:"",...e}}function Qe(e,t=[]){return{id:`section-${e}`,title:de[e]||e,purpose:ge(e),phase:e,steps:t,outcome:"",verificationPrompt:"",exitCondition:"quiz"}}function ge(e){switch(e){case"prerequisite":return"Background concepts and context you need before diving in.";case"core":return"Step-by-step guidance to implement the solution.";case"practice":return"Apply what you learned and verify it works in your own project.";default:return""}}function Ke(e={}){return{id:e.id||`step-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,title:e.title||"Untitled Step",whyThisMatters:e.whyThisMatters||"",whatToDo:e.whatToDo||[],howToVerify:e.howToVerify||[],commonMistake:e.commonMistake||"",takeaway:e.takeaway||"",summary:e.summary||"",category:e.category||"core",completionType:e.completionType||"do",estimatedMinutes:e.estimatedMinutes||3,source:e.source||{},video:e.video||null,goDeeper:e.goDeeper||[],_originalSegment:e._originalSegment||null,_bridgeText:e._bridgeText||"",_editorialStatus:e._editorialStatus||"raw"}}function ie(e){if(!e||typeof e!="string")return"";let t=e.replace(/(?:Unreal Engine\s+\d+\.\d+\s*\\?n?\s*){3,}/gi," ");const a=[/^(well,?|okay,?|so,?|alright,?|hey,?|hi,?|now,?)\s+/gi,/\b(that's it for this (lesson|video|section|module|tutorial))\b.*$/gim,/\b(in the next (lesson|video|section|module))\b.*$/gim,/\b(let's (go ahead and|take a look|jump (in|right in)))\b/gi,/\b(we're gonna|we are going to|I'm gonna|I am going to)\b/gi,/\b(as you can see|as I mentioned|like I said)\b/gi,/\b(don't forget to|make sure you|remember to) (like|subscribe|hit the bell)\b.*$/gim,/\b(thanks for watching|see you in the next)\b.*$/gim];for(const n of a)t=t.replace(n,"");const i=[/Unreal Engine\s+\d+\.\d+(?: Documentation)?/gi,/Epic Developer Community/gi,/Table of Contents/gi,/##?\s*What's New\??/gi,/Ask questions and help your peers\s*Developer Forums/gi,/Write your own tutorials or read those from others\s*Learning Library/gi,/\|/g];for(const n of i)t=t.replace(n,"");return t=t.replace(/[.!?]\s+[A-Z][^.!?]{0,60}$/s,n=>n.slice(n.indexOf(" ")+1).length<40?n[0]:n),t=t.replace(/\\n/g," ").replace(/\s{2,}/g," ").replace(/^[\s,;.]+|[\s,;]+$/g,"").replace(/^\s+/gm,"").trim(),t.length<20?"":t}const me=[{pattern:/^\[?\d{1,2}:\d{2}/m,reason:"timestamp"},{pattern:/\b(um|uh|okay so)\b/i,reason:"filler_word"},{pattern:/^>>\s/m,reason:"speaker_label"},{pattern:/^[A-Z]{2,}:\s/m,reason:"speaker_prefix"},{pattern:/\bversion selector\b/i,reason:"epic_boilerplate"},{pattern:/\bclick here to\b/i,reason:"docs_boilerplate"},{pattern:/\btranscript\b.*\bgenerated\b/i,reason:"transcript_meta"}],he=[{pattern:/\b(I'm going to|I'm gonna|I was going to|I'll go ahead)\b/i,reason:"first_person_speech"},{pattern:/\b(we're going to|we're gonna|let's go ahead|let's go)\b/i,reason:"first_person_plural"},{pattern:/\b(so to start with|so we can|so what we)\b/i,reason:"verbal_transition"},{pattern:/\bgoing to come on to\b/i,reason:"verbal_direction"},{pattern:/\b(right no\b|right here|over here)\b/i,reason:"spatial_reference"},{pattern:/\.\s+(And|But|So|OK|Okay)\s+/g,reason:"run_on_speech"},{pattern:/\b(Maybe double check|make sure that's working)\b/i,reason:"verbal_hedging"},{pattern:/\bAll of this can be\b/i,reason:"verbal_demonstration"},{pattern:/\bwe set our\b.*\bto\b/i,reason:"verbal_walkthrough"},{pattern:/\bI'm going to call this\b/i,reason:"narrated_action"}],fe=30,ye={foundation:"foundational",diagnosis:"diagnostic",prerequisite:"prerequisite",fix:"implementation",core:"core",transfer:"transfer and application",practice:"practice"};function Je(e,t="this topic",a="core",i={}){let n=ie(e||"");if(!n||n.trim().length===0)return{text:G(t,a,i),wasReplaced:!0,reason:"empty_after_cleaning"};for(const{pattern:s,reason:r}of he)if(s.test(n))return{text:G(t,a,i),wasReplaced:!0,reason:`conversational_speech: ${r}`};const l=[];for(const{pattern:s,reason:r}of me)s.test(n)&&l.push(r);return l.length>=2?{text:G(t,a,i),wasReplaced:!0,reason:`transcript_artifacts: ${l.join(", ")}`}:n.trim().length<fe?{text:G(t,a,i),wasReplaced:!0,reason:"too_short"}:{text:n.trim(),wasReplaced:!1,reason:""}}function G(e,t,a={}){const i=e||"this topic";if(a.outcomes?.length>0){const r=a.outcomes[0];if(r.length>15&&r.length<300&&!/\b(um|uh|gonna)\b/i.test(r))return r.endsWith(".")?r:`${r}.`}if(a.tags?.length>=2){const r=a.tags.filter(o=>typeof o=="string"&&o.length>2).map(o=>o.split(".").pop().replace(/_/g," ")).slice(0,3);if(r.length>=2)return`Explore ${i}, covering ${r.join(", ")} within Unreal Engine 5.`}const n=ye[t]||"core",l=[`This ${n} lesson explores ${i} concepts and workflows in Unreal Engine 5.`,`Gain hands-on experience with ${i} through guided examples and practical exercises.`,`Build your understanding of ${i} — a ${n} part of this learning path.`];let s=0;for(let r=0;r<i.length;r++)s=(s<<5)-s+i.charCodeAt(r)|0;return l[Math.abs(s)%l.length]}function Xe(e,t=0){if(!e)return`Step ${t+1}`;const a=e.segment||{},i=e.title||a.title||a.videoTitle||"";if(!i)return`Step ${t+1}`;let n=Y(i);return n=n.replace(/\s*\((?:Bespoke|AI[- ]?Generated|Gap[- ]?Fill)\)\s*/gi,""),n=n.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#x27;/g,"'"),n||`Step ${t+1}`}const be=[{pattern:/without\s+(?:any\s+)?code/gi,replacement:"without writing C++ or text-based code"},{pattern:/no\s+code\s+(?:is\s+)?(?:needed|required)/gi,replacement:"no C++ code is needed"},{pattern:/no\s+coding\s+(?:is\s+)?(?:needed|required)/gi,replacement:"no C++ coding is needed"},{pattern:/without\s+(?:any\s+)?programming/gi,replacement:"without text-based programming"},{pattern:/don['']t\s+need\s+(?:to\s+)?code/gi,replacement:"don't need to write C++ code"}];function ve(e,t=[]){if(!e||!Array.isArray(e))return{cleanedPath:e||[],warnings:["No path steps to validate"],autoFixes:[]};const a=[],i=[],n=new Set,l=[];for(const o of e){const c=o.segmentIndex??o.segment_index??o.index;if(c!=null&&n.has(c)){i.push(`Removed duplicate segment index ${c} (title: "${o.segment?.title||"unknown"}", category: ${o.category})`);continue}c!=null&&n.add(c),l.push(o)}for(const o of l)if(o.summary){let c=o.summary;for(const{pattern:u,replacement:y}of be)u.lastIndex=0,u.test(c)&&(u.lastIndex=0,c=c.replace(u,y),i.push(`Fixed phrasing in step "${o.segment?.title||"unknown"}": applied "${y}" correction`));o.summary=c}if(t.length>0){const o=t.map(u=>`${u.text||""} ${u.title||""} ${u.videoTitle||""}`).join(" ").toLowerCase(),c=["depth volume","wind volume","fog volume","weather volume","ai controller","behavior tree","blackboard","nanite","lumen","niagara","mass entity","world partition","control rig","metahuman","modeling mode","texture graph","chaos physics","pcg","procedural content generation"];for(const u of l){if(!u.summary)continue;const y=u.summary.toLowerCase();for(const b of c)y.includes(b)&&!o.includes(b)&&a.push(`⚠️ Potential hallucination: "${b}" found in summary for "${u.segment?.title||"unknown"}" but NOT in source text`)}}const s=new Set,r=[];for(const o of l){const c=(o.segment?.title||o.segment?.videoTitle||"").toLowerCase().trim();if(!c){r.push(o);continue}if(s.has(c)){i.push(`Removed duplicate titled step: "${c}" (category: ${o.category})`);continue}s.add(c),r.push(o)}return r.forEach((o,c)=>{o.order=c}),{cleanedPath:r,warnings:a,autoFixes:i}}const W=["foundation","diagnosis","fix","transfer"],we=.25,Se=new Set(["a","an","the","in","on","at","to","for","of","with","by","from","and","or","not","is","it","be","as","do","has","was","are","but","if","my","this","that","how","what","when","where","why","can","will","so","no","up","out","its","i","me","you","your","we","they","their","about","use","using","used","make","get","set","does","work","works","working","create","need","want","like","just","really","know","new","thing","things","way","going","able","look","help","try"]);function Q(e,t){if(!e||!t)return 0;const a=s=>s.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(r=>r.length>2&&!Se.has(r)),i=a(e);if(i.length===0)return 1;const n=new Set(a(t));return i.filter(s=>n.has(s)).length/i.length}async function Ze(e,t,a=null){if(!t||t.length===0)return[];const i=t.map((s,r)=>{const o=s.type==="transcript"?`Video: ${s.videoTitle} (${s.startTimestamp||""})`:s.type==="epic_learning"?`Article: ${s.title}`:`Docs: ${s.title} > ${s.section}`;return`[${r}] ${o}
   ${s.text.slice(0,2e3)}`}).join(`

`);let n="";if(a){const{knows:s=[],gaps:r=[],level:o="beginner"}=a;n=`

ADAPTIVE DEPTH INSTRUCTIONS (IMPORTANT):
This learner completed a diagnostic quiz. Their assessed level is: ${o.toUpperCase()}
${s.length>0?`
Concepts they ALREADY KNOW (skim these — keep summaries brief, 1 sentence max):
${s.map(c=>`  - ${c.replace(/_/g," ")}`).join(`
`)}`:""}
${r.length>0?`
Knowledge GAPS to fill (go deep — write detailed 3-4 sentence summaries with specific steps):
${r.map(c=>`  - ${c.replace(/_/g," ")}`).join(`
`)}`:""}

Depth rules based on level:
${o==="beginner"?"- Start with absolute basics. Explain every concept. More foundation steps.":""}
${o==="intermediate"?"- Skip basic introductions. Focus on practical application and diagnosis.":""}
${o==="advanced"?"- Skip all basics. Go straight to advanced techniques, edge cases, and optimization.":""}
- Prioritize segments covering the GAP concepts over ones covering KNOWN concepts
- For KNOWN concepts, only include if absolutely essential for context (and mark relevance as "medium")
- For GAP concepts, always mark relevance as "high"`}const l=`You are a UE5 curriculum designer. A learner asked: "${e}"

Here are ${t.length} content segments found via semantic search:

${i}

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
- Min ${se} segments if enough are relevant
- Prefer transcript segments over docs for hands-on topics
- Each summary should be plain text only — no asterisks, no markdown, no code blocks${n}`;try{const s=N(),r=_(s,"us-central1"),o=q(r,"classifySegments"),c=await D(()=>o({prompt:l,grounded:!0}),{maxRetries:2,baseDelayMs:1500,label:"classifySegments"}),u=c.data?.text||"",y=c.data?.groundingMetadata||null,b=u.match(/\[[\s\S]*\]/);if(!b)return T("[BespokePath] Could not parse classification JSON, using fallback ordering"),ee(t);const k=JSON.parse(b[0]);let S=0;for(const m of k){if(m.relevance==="low"||m.index<0||m.index>=t.length)continue;const d=`${m.summary||""} ${t[m.index]?.title||""} ${t[m.index]?.videoTitle||""} ${t[m.index]?.text?.slice(0,500)||""}`,g=Q(e,d);g<we?(T(`[BespokePath] Topical cross-check rejected: "${t[m.index]?.title||t[m.index]?.videoTitle||"(untitled)"}" (overlap: ${(g*100).toFixed(0)}%)`),m.relevance="low"):(/\bue\s*4\b/i.test(d)||/\bunreal\s+engine\s+4\b/i.test(d))&&(T(`[BespokePath] UE4 content rejected: "${t[m.index]?.title||t[m.index]?.videoTitle||"(untitled)"}"`),m.relevance="low",S++)}S>0&&v(`[BespokePath] Topical cross-check demoted ${S} step(s) to low relevance`);const x=[];for(const m of W){const d=k.filter(g=>g.category===m&&g.relevance!=="low").sort((g,p)=>g.relevance!==p.relevance?g.relevance==="high"?-1:1:(t[p.index]?.similarity||0)-(t[g.index]?.similarity||0));for(const g of d)if(g.index>=0&&g.index<t.length&&x.length<V){const p=[];if(y?.sources?.length>0){const w=(g.summary||t[g.index].text||"").toLowerCase();(y.supports||[]).forEach(C=>{const O=(C.text||"").toLowerCase();w.split(/\s+/).filter(I=>I.length>4).some(I=>O.includes(I))&&(C.sourceIndices||[]).forEach(I=>{if(y.sources[I]){const B=y.sources[I];p.some(E=>E.url===B.url)||p.push(B)}})})}const $={...t[g.index]};p.length>0&&($.sources=p),x.push({segment:$,category:g.category,title:g.title||"",summary:g.summary||"",order:x.length})}}const M=x.findIndex(m=>{const d=(m.title||m.segment?.title||m.segment?.videoTitle||"").toLowerCase();return d.includes("introduction to unreal engine")||d.includes("introduction to unreal editor")||d.includes("intro to unreal")});if(M>0){const[m]=x.splice(M,1);m.category="foundation",x.unshift(m),x.forEach((d,g)=>{d.order=g}),v('[BespokePath] Pinned "Introduction to Unreal Engine" to position 0')}v(`[BespokePath] Sequenced ${x.length} segments into learning path`);const{cleanedPath:h,warnings:f,autoFixes:A}=ve(x,t);return A.length>0&&v(`[BespokePath] Quality gate applied ${A.length} auto-fix(es):`,A),f.length>0&&T("[BespokePath] Quality gate warnings:",f),U("sequencePath",Math.ceil(l.length/4),Math.ceil(u.length/4)),h}catch(s){return T("[BespokePath] sequencePath failed:",s.message),ee(t)}}function ee(e){return e.slice(0,V).map((a,i)=>({segment:a,category:W[Math.min(Math.floor(i/2),W.length-1)],order:i}))}const xe=8,$e=`Research-backed UE5 learning gap patterns:
- Top beginner roadblocks: C++ complexity, Blueprint debugging, material editor workflow, UI/UMG binding, physics/collision setup, animation state machines, networking/replication, packaging/deployment
- Cognitive load: tutorials > 6 minutes lose learner attention; chunk into 3-5 minute segments
- "Tutorial limbo" pattern: learners follow steps but can't apply concepts independently
- Missing "why" explanations: procedural knowledge without conceptual grounding creates fragile understanding
- Prerequisites are often assumed, not taught: editor navigation, project structure, asset pipeline, coordinate systems
- Bloom's taxonomy gaps: paths that stay at Remember/Understand without advancing to Apply/Analyze/Create leave learners unable to build independently
- Spaced practice: massed practice (all at once) decays quickly; interleaving topics with review checkpoints improves long-term retention
- Transfer gaps: learners who only see one context (e.g. materials in a cave scene) can't transfer skills to new contexts (e.g. materials for vehicles)
- Scaffolding removal: guided examples must progressively reduce support — paths that never remove scaffolds create dependency
- Assessment alignment: if a path teaches "Apply" level skills but only tests "Remember" level, the assessment gives false confidence`;function K(e){if(!e)return null;try{return JSON.parse(e)}catch{}const t=e.match(/[{[\s\S]*[}\]]/);if(!t)return null;let a=t[0].replace(/```json?\s*/gi,"").replace(/```\s*/g,"").replace(/[\u201C\u201D]/g,'"').replace(/[\u2018\u2019]/g,"'").replace(/,\s*([}\]])/g,"$1");try{return JSON.parse(a)}catch{a=a.replace(/'/g,'"');try{return JSON.parse(a)}catch{return null}}}function Te(e,t){const a=new Set;t&&a.add(t.trim());for(const l of e){const s=l?.segment;if(!s)continue;const r=s.title||s.videoTitle||"";r&&r.length>3&&a.add(r.trim());const o=(l.summary||s.text||"").substring(0,150);if(o&&o.length>20){const c=o.split(/[.!?]/)[0]?.trim();c&&c.length>10&&a.add(c)}}const i=[],n=[...a];for(const l of n)i.some(r=>Q(r,l)>.6)||i.push(l);return i.slice(0,xe)}async function ke(e){try{const t=N(),a=_(t,"us-central1"),i=q(a,"classifySegments"),n=`You are a UE5 curriculum expert. A learner wants to learn: "${e}"

List the 8-12 essential subtopics/skills that a comprehensive learning path for "${e}" MUST cover.
Think about:
- Core concepts directly related to the goal
- Common prerequisites that are often missed
- Practical skills needed (not just theory)
- Debugging/troubleshooting knowledge for this area

Return ONLY a JSON array of short topic strings (3-6 words each).
Example format: ["Blueprint Event Graphs", "Variable Types and Casting", "Debugging with Breakpoints"]

Return valid JSON only, no markdown fences, no explanation.`,s=(await D(()=>i({prompt:n}),{maxRetries:1,baseDelayMs:1500,label:"requiredSubtopics"})).data?.text||"";U("requiredSubtopics",Math.ceil(n.length/4),Math.ceil(s.length/4));const r=K(s);return Array.isArray(r)&&r.length>0?(v(`[GapAnalyzer] Generated ${r.length} required subtopics for "${e}"`),r.slice(0,12)):(T("[GapAnalyzer] Could not parse required subtopics, using fallback"),null)}catch(t){return T("[GapAnalyzer] generateRequiredSubtopics failed:",t.message),null}}async function et(e,t,a=null){const i={blindSpots:[],assumedKnowledge:[],suggestions:[],weaklyCovered:[],coverageScore:1,corpusStats:{subtopicsChecked:0,subtopicsCovered:0,avgSimilarity:0}};try{if(!t||t.length===0)return i;const n=await ke(e);if(!n||n.length===0)return T("[GapAnalyzer] Could not generate required subtopics, falling back"),i;v(`[GapAnalyzer] Required subtopics: ${n.join(", ")}`);const l=Te(t,e);v(`[GapAnalyzer] Path covers: ${l.join(", ")}`);const s=[],r=[],o=[];let c=null;try{const p=await fetch("/Unreal-Learning-Path-Tagging-System/augmentation_summary.json");if(p.ok){const $=await p.json();c={};for(const w of $.videos||[])c[w.course]||(c[w.course]={totalScore:0,count:0}),c[w.course].totalScore+=w.score||0,c[w.course].count++}}catch{}const u=t.map(p=>{const $=p?.segment,w=$?.title||$?.videoTitle||"",C=p?.summary||$?.text||"";return`${w} ${C}`}).join(" ").toLowerCase();for(const p of n){const $=p.toLowerCase(),w=$.replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(E=>E.length>=2);let C=0,O="";for(const E of l){const R=Q(p,E);R>C&&(C=R,O=E)}const z=u.includes($)||w.length>=2&&u.includes(w.slice(0,3).join(" ")),J=w.filter(E=>u.includes(E)).length,I=w.length>0?J/w.length:0;if(C>.3||z||I>=.7){let E=!1,R=null,j=null;if(c&&O){const X=t.find(L=>{const Z=L?.segment;return(Z?.title||Z?.videoTitle||"").toLowerCase().includes(O.toLowerCase().slice(0,10))}),F=X?.segment?.courseSlug||X?.segment?.course||"";if(F&&c[F]){const L=Math.round(c[F].totalScore/c[F].count);j=L,R=L>=45?"A":L>=39?"B":L>=33?"C":L>=22?"D":"F",E=R==="D"||R==="F"}}E?o.push({topic:p,matchedTo:O||"(multiple courses)",confidence:Math.max(C,I,z?.8:0),augGrade:R,augScore:j,reason:`Covered by course material rated ${R} (${j}/55) — pedagogy needs augmentation`}):s.push({topic:p,matchedTo:O||"(multiple courses)",confidence:Math.max(C,I,z?.8:0)})}else r.push({topic:p,bestOverlap:C,bestMatch:O||null,wordCoverage:I})}const y=s.length+o.length*.5,b=n.length>0?y/n.length:1;if(v(`[GapAnalyzer] Coverage: ${s.length} strong + ${o.length} weak + ${r.length} gaps out of ${n.length} required topics (score: ${b.toFixed(2)})`),r.length===0&&o.length===0)return{...i,coverageScore:b,weaklyCovered:o,corpusStats:{subtopicsChecked:n.length,subtopicsCovered:s.length,avgSimilarity:0}};const k=a?.level?`The learner's assessed level is: ${a.level.toUpperCase()}.`:"Assume a beginner-level learner.",S=r.map(p=>`- "${p.topic}" (best path match: ${p.bestMatch?`"${p.bestMatch}" at ${p.bestOverlap.toFixed(2)} overlap`:"NONE"})`).join(`
`),x=s.map(p=>`- "${p.topic}" (matched to: "${p.matchedTo}")`).join(`
`),M=`You are a UE5 curriculum designer analyzing a learning path for the query: "${e}"

${k}

${$e}

TOPICS THE PATH COVERS WELL:
${x||"(none)"}

TOPICS THE PATH IS MISSING (these are the gaps):
${S}

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
- Return valid JSON only, no markdown fences`,h=N(),f=_(h,"us-central1"),A=q(f,"classifySegments"),d=(await D(()=>A({prompt:M}),{maxRetries:1,baseDelayMs:1500,label:"gapAnalysis"})).data?.text||"";U("gapAnalysis",Math.ceil(M.length/4),Math.ceil(d.length/4));const g=K(d);return g?{blindSpots:g.blindSpots||[],assumedKnowledge:g.assumedKnowledge||[],suggestions:(g.suggestions||[]).slice(0,3),weaklyCovered:o,coverageScore:b,corpusStats:{subtopicsChecked:n.length,subtopicsCovered:s.length,avgSimilarity:0}}:(T("[GapAnalyzer] Failed to parse Gemini gap analysis response"),{blindSpots:r.map(p=>({topic:p.topic,severity:p.bestOverlap<.1?"high":"medium",reason:"This required topic is not addressed by any course in the path",researchContext:""})),assumedKnowledge:[],suggestions:[],weaklyCovered:o,coverageScore:b,corpusStats:{subtopicsChecked:n.length,subtopicsCovered:s.length,avgSimilarity:0}})}catch(n){return T("[GapAnalyzer] analyzePathGaps failed:",n.message),i}}const Ae=3,te=.55,ne=.5,re=3;async function tt(e,t,a,i=[]){try{v(`[GapFill] 3-tier fill for gap: "${e}"`);const n=new Set(i);try{const h=N(),f=_(h,"us-central1"),d=(await q(f,"embedQuery")({text:e})).data?.embedding;if(d){const p=(await le(d,8)).filter($=>$.similarity>=te&&!n.has($.code)).sort(($,w)=>w.similarity-$.similarity).slice(0,re);if(p.length>0)return v(`[GapFill] Tier 1 HIT — ${p.length} library courses for "${e}"`),{source:"library",matchedCourses:p};v(`[GapFill] Tier 1 MISS — no library matches above ${te} for "${e}"`)}}catch(h){T(`[GapFill] Tier 1 failed, falling through: ${h.message}`)}try{const{segments:h}=await H(e,8),f=h.filter(d=>(d.similarity||0)>=ne),A=new Map;for(const d of f){const g=d.videoTitle||d.videoUrl||d.title||"unknown",p=A.get(g);(!p||(d.similarity||0)>(p.similarity||0))&&A.set(g,d)}const m=[...A.values()].sort((d,g)=>(g.similarity||0)-(d.similarity||0)).slice(0,re);if(m.length>0)return v(`[GapFill] Tier 2 HIT — ${m.length} segments (deduped from ${f.length}) for "${e}"`),{source:"bespoke",segments:m.map(d=>({title:d.title||d.videoTitle||"Untitled",text:(d.text||"").substring(0,300),videoTitle:d.videoTitle||"",videoUrl:d.videoUrl||"",similarity:d.similarity||0}))};v(`[GapFill] Tier 2 MISS — no segments above ${ne} for "${e}"`)}catch(h){T(`[GapFill] Tier 2 failed, falling through: ${h.message}`)}v(`[GapFill] Tier 3 — generating AI step for "${e}"`);let l="";try{const{segments:h}=await H(e,Ae);h.length>0&&(l=`
Related content from our corpus:
${h.slice(0,2).map(f=>`- "${f.title||f.videoTitle}": ${(f.text||"").substring(0,200)}`).join(`
`)}`)}catch{}const s=a.map(h=>h.segment?.title||h.segment?.videoTitle||"").filter(Boolean).join(", "),r=`You are a UE5 curriculum designer. A learning path for "${t}" has a gap in: "${e}"

Existing steps cover: ${s}
${l}

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
- Return valid JSON only, no markdown fences`,o=N(),c=_(o,"us-central1"),u=q(c,"classifySegments"),y=await D(()=>u({prompt:r,grounded:!0}),{maxRetries:1,baseDelayMs:1500,label:"gapFillStep"}),b=y.data?.text||y.data?.response||"",k=y.data?.groundingMetadata||null;if(U("gapFillStep",Math.ceil(r.length/4),Math.ceil(b.length/4)),!b)return T("[GapFill] Empty AI response"),{source:"ai",step:{segment:{title:`Learn: ${e}`,text:`Study ${e} in context of ${t}.`},category:"core",isGapFill:!0}};let S=K(b);(!S||!S.title)&&(S={title:`Understanding ${e}`,summary:b.replace(/```json?|```/gi,"").trim().slice(0,500),category:"core"});const x=[];k?.sources?.length>0&&(k.supports||[]).forEach(h=>{(h.sourceIndices||[]).forEach(f=>{if(k.sources[f]){const A=k.sources[f];x.some(m=>m.url===A.url)||x.push(A)}})});const M={segment:{id:`gap-fill-${Date.now()}`,type:"ai_generated",title:S.title,text:S.summary,source:"ai_generated",sources:x.length>0?x:void 0,corpusVerified:!1},category:S.category||"core",summary:S.summary,order:a.length,isGapFill:!0};try{const{segments:h}=await H(S.summary||S.title,1);if(h.length>0&&h[0].similarity>=ce){const f=h[0];M.segment.corpusVerified=!0,M.segment.corpusMatch={videoTitle:f.videoTitle||f.title||"",videoUrl:f.videoUrl||f.url||"",similarity:f.similarity}}}catch{}return v(`[GapFill] Tier 3 AI step: "${S.title}" [${M.category}]`),{source:"ai",step:M}}catch(n){return T("[GapFill] generateGapFillStep failed:",n.message),null}}function nt(e,t){const a=t[0];return{code:`bespoke-${Date.now()}`,title:e,description:`This lesson covers ${e} using key concepts from Unreal Engine 5.`,type:"bespoke_segment",role:"core",duration_seconds:t.length*300,tags:{level:"Intermediate",industry:"General"},isBespoke:!0,isGapFill:!0,sourceSegments:t.map(i=>({title:i.title,videoTitle:i.videoTitle,videoUrl:i.videoUrl,similarity:i.similarity})),videoTitle:a?.videoTitle||"",videoUrl:a?.videoUrl||""}}async function Ce(e,t,a=3){if(!e?.segment?.text&&!e?.summary)return[];const i=(e.summary||e.segment?.text||"").slice(0,1500);try{const n=N(),l=_(n,"us-central1"),r=await q(l,"generateAudioBriefing")({mode:"quiz",query:t,stepContent:i,stepCategory:e.category||"learning",quizCount:a});return r.data?.questions&&Array.isArray(r.data.questions)?(v(`[Quiz] Generated ${r.data.questions.length} questions for ${e.category} step`),U("quizGeneration",Math.ceil(i.length/4),Math.ceil(JSON.stringify(r.data.questions).length/4)),r.data.questions):oe(e)}catch(n){return T("[Quiz] AI quiz generation failed:",n.message),oe(e)}}async function rt(e,t,a=5){if(!e||e.length===0||a<=0)return new Map;const i=Math.floor(a/e.length);let n=a%e.length;const l=await Promise.allSettled(e.map(r=>{let o=i;return n>0&&(o++,n--),o===0?Promise.resolve([]):Ce(r,t,o)})),s=new Map;return l.forEach((r,o)=>{r.status==="fulfilled"&&r.value.length>0&&s.set(o,r.value)}),v(`[Quiz] Generated quizzes for ${s.size}/${e.length} steps`),s}function ot(e,t){return{isCorrect:t===e.correct,correctAnswer:e.correct,explanation:e.explanation||""}}function oe(e){const t={foundation:{stem:"Based on the content you just read, what is the fundamental concept being explained?",choices:{A:"A performance optimization technique",B:"A core architectural pattern in UE5",C:"A debugging methodology",D:"A deployment configuration"},correct:"B",explanation:"Foundation content typically covers core architectural patterns and concepts."},diagnosis:{stem:"What is the key indicator that helps identify this type of problem?",choices:{A:"Compile-time errors in the build log",B:"Visual artifacts or unexpected behavior at runtime",C:"Missing asset references in the content browser",D:"Network timeout errors in the output log"},correct:"B",explanation:"Diagnosis content focuses on identifying symptoms and root causes at runtime."},fix:{stem:"What is the recommended first step when applying this fix?",choices:{A:"Restart the editor immediately",B:"Back up the project and verify the issue is reproducible",C:"Delete all derived data caches",D:"Update to the latest engine version"},correct:"B",explanation:"Always back up and verify reproducibility before applying fixes."},transfer:{stem:"How can this knowledge be applied to other areas of UE5 development?",choices:{A:"It only applies to this specific use case",B:"The underlying pattern is reusable across similar systems",C:"It requires a completely different approach in other contexts",D:"It's only relevant for legacy projects"},correct:"B",explanation:"Transfer knowledge emphasizes reusable patterns across different contexts."}};return[t[e.category]||t.foundation]}function Ie(e){if(!e||typeof e!="string")return e;let t=e;return t=t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),t=t.replace(/^### (.+)$/gm,'<h3 style="color: var(--accent-orange, #d29922); font-size: 1rem; margin: 16px 0 8px;">$1</h3>'),t=t.replace(/^## (.+)$/gm,'<h2 style="color: var(--accent-green, #3fb950); font-size: 1.1rem; margin: 20px 0 10px;">$1</h2>'),t=t.replace(/^# (.+)$/gm,'<h1 style="color: var(--accent, #58a6ff); font-size: 1.3rem; margin: 24px 0 12px;">$1</h1>'),t=t.replace(/\*\*\*(.+?)\*\*\*/g,"<strong><em>$1</em></strong>"),t=t.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>"),t=t.replace(/\*(.+?)\*/g,"<em>$1</em>"),t=t.replace(/`([^`]+)`/g,'<code style="background: rgba(88,166,255,0.1); padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 0.85em;">$1</code>'),t=t.replace(/^- (.+)$/gm,'<li style="margin: 4px 0; margin-left: 20px;">$1</li>'),t=t.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g,'<ul style="list-style: disc; padding-left: 20px; margin: 8px 0;">$1</ul>'),t=t.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer" style="color: var(--accent, #58a6ff);">$1</a>'),t=t.replace(/\n\n/g,'</p><p style="margin-bottom: 12px; color: var(--text-secondary, #8b949e);">'),t=t.replace(/\n/g,"<br>"),t}const Ee=`
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
`,Me=`
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
`;function Pe(e){return e.replace(/[^a-zA-Z0-9_-]/g,"_").substring(0,50)}function ae(e){return(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;")}function P(e){return(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function Oe(e){const t=e.toLowerCase();return t.includes("foundation")?"cat-foundation":t.includes("fix")||t.includes("core")?"cat-fix":t.includes("transfer")||t.includes("practice")?"cat-transfer":""}function Re(e,t,a,i,n){const l=ue(e)||Y(e.segment?.title||e.title||`Step ${t+1}`),s=e.summary||e.segment?.text||e.segment?.summary||"",r=ie(s),o=e.category||"core",c=Oe(o),u=e.segment?.source||e.segment?.type||"",y=t>0?`<a class="nav-link" href="sco_${t-1}.html">← Previous</a>`:"<span></span>",b=t<a-1?`<a class="nav-link" href="sco_${t+1}.html">Next →</a>`:"<span></span>",k=i?.text?`<div class="bridge-box"><strong>Connection:</strong> ${P(i.text)}</div>`:"";return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${P(l)}</title>
  <link rel="stylesheet" href="shared/style.css">
  <script src="shared/scormapi.js"><\/script>
</head>
<body>
  <p style="font-size:0.8rem;color:var(--text-secondary)">
    ${P(n)} — Step ${t+1} of ${a}
  </p>
  <h1>${P(l)}</h1>
  <div class="step-card">
    <div class="step-meta">
      <span class="category-badge ${c}">${P(o)}</span>
      ${u?`<span>Source: ${P(u)}</span>`:""}
    </div>
    <div class="step-summary">${Ie(r)}</div>
  </div>
  ${k}
  <button class="complete-btn" id="mark-complete" onclick="this.disabled=true;this.textContent='✅ Completed';completeSCORM();">
    Mark Step Complete
  </button>
  <div class="nav-row">
    ${y}
    ${b}
  </div>
</body>
</html>`}function Le(e,t){const a=e.slice(0,10).map((n,l)=>{const s=Y(n.segment?.title||n.title||`Step ${l+1}`);return{question:`What is the main topic covered in "${s}"?`,stepTitle:s}}),i=a.map((n,l)=>`
    <div class="quiz-q">
      <p><strong>Q${l+1}:</strong> ${P(n.question)}</p>
      <label><input type="radio" name="q${l}" value="correct"> ${P(n.stepTitle)}</label>
      <label><input type="radio" name="q${l}" value="wrong1"> Unrelated Topic A</label>
      <label><input type="radio" name="q${l}" value="wrong2"> Unrelated Topic B</label>
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
  <p>Review your understanding of the concepts from "${P(t)}".</p>
  <form id="quiz-form">
    ${i}
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
</html>`}function _e(e,t,a){const i="ORG-001",n="MANIFEST-UE5-"+Date.now(),l=t.map((c,u)=>`
    <resource identifier="RES-${u}" type="webcontent" adlcp:scormtype="sco" href="${c}">
      <file href="${c}"/>
      <file href="shared/scormapi.js"/>
      <file href="shared/style.css"/>
    </resource>`).join(`
`),s=a?`
    <resource identifier="RES-QUIZ" type="webcontent" adlcp:scormtype="sco" href="quiz.html">
      <file href="quiz.html"/>
      <file href="shared/scormapi.js"/>
      <file href="shared/style.css"/>
    </resource>`:"",r=t.map((c,u)=>`
      <item identifier="ITEM-${u}" identifierref="RES-${u}">
        <title>${ae(`Step ${u+1}`)}</title>
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
  <organizations default="${i}">
    <organization identifier="${i}">
      <title>${ae(e)}</title>
      ${r}
      ${o}
    </organization>
  </organizations>
  <resources>
    ${l}
    ${s}
  </resources>
</manifest>`}async function at(e,t={}){const{includeQuiz:a=!0}=t;if(!e?.path?.length)throw new Error("Cannot export empty path");const i=e.query?`UE5 Learning Path: ${e.query.substring(0,60)}`:"UE5 Learning Path",n=new pe;n.file("shared/scormapi.js",Ee),n.file("shared/style.css",Me);const l=[];e.path.forEach((c,u)=>{const y=`sco_${u}.html`,b=e.bridges?.[u]||null,k=Re(c,u,e.path.length,b,i);n.file(y,k),l.push(y)}),a&&e.path.length>=2&&n.file("quiz.html",Le(e.path,i)),n.file("imsmanifest.xml",_e(i,l,a&&e.path.length>=2));const s=await n.generateAsync({type:"blob"}),r=`scorm_${Pe(e.query||"path")}_${Date.now()}.zip`,o=document.createElement("a");o.href=URL.createObjectURL(s),o.download=r,document.body.appendChild(o),o.click(),document.body.removeChild(o),URL.revokeObjectURL(o.href),v(`[SCORM] Package downloaded: ${r} (${l.length} SCOs)`)}export{We as C,de as S,et as a,tt as b,ie as c,nt as d,Je as e,at as f,rt as g,Q as h,Ye as i,Ke as j,Ve as k,Qe as l,Ie as m,Ce as n,ot as o,K as p,Xe as r,Ze as s};
