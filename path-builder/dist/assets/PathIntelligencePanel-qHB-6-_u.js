import{k as Ae,j as e,u as Pe,d as Le}from"./index-D60Rk8Y5.js";import{a as m,P as X}from"./vendor-cytoscape-DVAcN8kS.js";import{c as ae,g as ve,a as Me,b as Ee,d as Re}from"./cleanTranscriptText-DQXGiXsU.js";import"./vendor-firebase-CkCPdMz0.js";import{g as be,u as Be}from"./topicNameService-C7FdsdpO.js";import{c as Ge,g as Oe}from"./bloomClassifier-C9dOAqHg.js";import{J as Ue}from"./vendor-export-Cccetl6i.js";import{c as ye}from"./cleanVideoTitle-DZxgGY6A.js";import{e as we,P as Fe}from"./PathWizard-C4B92hf_.js";import"./data-courses-Cg58MTqc.js";import"./pathSearch-DhRVi_7h.js";import"./tokenTracker-Btoxomw7.js";import"./retryWithBackoff-Ba9diV5s.js";import"./semanticSearchService-DThKcS8e.js";function De(t){const a=new Set,i=t.map(l=>{const h=l.tags?.topic||"General";a.add(h);const d=l.gemini_enriched?.one_sentence_summary||l.description||`${l.tags?.level||"Intermediate"} course on ${h} using ${l.tags?.product||"Unreal Engine"}`;let y=l.gemini_enriched?.learning_outcomes||[];return y.length===0&&(y=(l.ai_tags||l.canonical_tags||[]).slice(0,3).map(w=>`Understand ${typeof w=="string"?w.replace(/[._]/g," "):String(w)} concepts in ${h}`)),{code:l.code,title:l.title||"Untitled",topic:h,level:l.tags?.level||"Intermediate",summary:d,outcomes:y,videoCount:l.videos?.length||0}}),o=t.reduce((l,h)=>l+(h.duration||0),0);return{courses:i,topics:[...a],totalDuration:Math.round(o*10)/10}}function Qe(t){if(!t.sections)return t;const a=t.sections.map(i=>{const o=Ge(i.heading||"",i.content||""),l=Oe(o.level);return{...i,bloom:{level:o.level,confidence:o.confidence,...l}}});return{...t,sections:a}}function We(t){const a=[];return t.forEach(i=>{const o=i.tags?.topic||"General",l=i.tags?.level||"Intermediate",h=i.tags?.product||"Unreal Engine",d=i.gemini_enriched?.learning_outcomes||[];d.forEach(u=>{a.push({front:`What will you learn about: ${u}?`,back:`From "${i.title}": ${u}`,topic:o,difficulty:l})});const y=i.gemini_enriched?.one_sentence_summary;if(y&&a.push({front:`Summarize: ${i.title}`,back:y,topic:o,difficulty:l}),d.length===0&&!y){const u=[...i.ai_tags||[],...(i.canonical_tags||[]).map(n=>n.split(".").pop())],w=[...new Set(u)].filter(n=>n&&n.length>2&&n!=="level");a.push({front:`What is the main topic of "${i.title}"?`,back:`${o} — a ${l} course on ${h}`,topic:o,difficulty:l}),w.slice(0,3).forEach(n=>{const k=n.replace(/[._-]/g," ");a.push({front:`In the context of ${o}, what is ${k}?`,back:`${k} is a key concept covered in "${i.title}" (${l})`,topic:o,difficulty:l})})}}),a}function je(t){if(!t||typeof t!="string")return t;let a=t;return a=a.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),a=a.replace(/^### (.+)$/gm,'<h3 style="color: var(--accent-orange, #d29922); font-size: 1rem; margin: 16px 0 8px;">$1</h3>'),a=a.replace(/^## (.+)$/gm,'<h2 style="color: var(--accent-green, #3fb950); font-size: 1.1rem; margin: 20px 0 10px;">$1</h2>'),a=a.replace(/^# (.+)$/gm,'<h1 style="color: var(--accent, #58a6ff); font-size: 1.3rem; margin: 24px 0 12px;">$1</h1>'),a=a.replace(/\*\*\*(.+?)\*\*\*/g,"<strong><em>$1</em></strong>"),a=a.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>"),a=a.replace(/\*(.+?)\*/g,"<em>$1</em>"),a=a.replace(/`([^`]+)`/g,'<code style="background: rgba(88,166,255,0.1); padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 0.85em;">$1</code>'),a=a.replace(/^- (.+)$/gm,'<li style="margin: 4px 0; margin-left: 20px;">$1</li>'),a=a.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g,'<ul style="list-style: disc; padding-left: 20px; margin: 8px 0;">$1</ul>'),a=a.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer" style="color: var(--accent, #58a6ff);">$1</a>'),a=a.replace(/\n\n/g,'</p><p style="margin-bottom: 12px; color: var(--text-secondary, #8b949e);">'),a=a.replace(/\n/g,"<br>"),a}async function He(t){if(!t?.path?.length)throw new Error("No path to preview");const a=t.query?`UE5 Learning Path: ${t.query.substring(0,60)}`:"Learning Path",i=t.path,o=t.bridges||[],l=i.map((n,k)=>{const j=n.segment?.title||n.title||`Step ${k+1}`,M=n.gemini_enriched?.one_sentence_summary||n.summary||n.segment?.summary||n.segment?.text||n.description||"";let C=ae(M);if(!C){const N=n.doc_meta?.section||"",L=n.source==="epic_docs"?"Official Unreal Engine documentation":"Reference material";C=N?`${L} covering ${N.replace(/-/g," ")}.`:`${L} for ${j}.`}const O=n.category||"core",A=n.segment?.source||n.segment?.type||"",U=o[k]||null,F=U?.text||U?.narration||"",Q=[n.segment?.videoUrl,n.segment?.url,n._url,n.url,n.code].filter(Boolean),B=n.videos?.[0]||n.segment?.videos?.[0];let z=null,$=null;if(B?.drive_id?z=B.drive_id:n.segment?.drive_id?z=n.segment.drive_id:n.drive_id&&(z=n.drive_id),!z&&!$)for(const N of Q){if(!N)continue;const L=N.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)||N.match(/[?&]id=([a-zA-Z0-9_-]+)/);if(L){z=L[1];break}try{const v=new URL(N);if(v.hostname.includes("youtube.com")){$=v.searchParams.get("v");break}if(v.hostname.includes("youtu.be")){$=v.pathname.slice(1);break}}catch{}if(/^[a-zA-Z0-9_-]{11}$/.test(N)){$=N;break}}!z&&!$&&n.segment?.videoId&&/^[a-zA-Z0-9_-]{11}$/.test(n.segment.videoId)&&($=n.segment.videoId);const P=Math.round(n.segment?.startTime||0),T=Math.round(n.segment?.endTime||0),D=n.segment?.videoTitle||"",G=N=>Math.floor(N/60)+":"+String(N%60).padStart(2,"0");let H="";if(z)H='<div class="video-section"><h2>🎬 Video Reference</h2><div class="video-embed"><iframe src="https://drive.google.com/file/d/'+z+'/preview" allow="autoplay" allowfullscreen></iframe></div><div class="video-meta">'+(D?"<span>"+W(D)+"</span>":"")+(P||T?'<span class="timestamp-badge">⏱ '+G(P)+" – "+G(T)+"</span>":"")+'<a href="https://drive.google.com/file/d/'+z+'/view" target="_blank" rel="noopener noreferrer">Open in Drive ↗</a></div></div>';else if($){const N=P?"&start="+P:"";H='<div class="video-section"><h2>🎬 Video Reference</h2><div class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/'+$+"?rel=0&modestbranding=1"+N+'" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div><div class="video-meta">'+(D?"<span>"+W(D)+"</span>":"")+(P||T?'<span class="timestamp-badge">⏱ '+G(P)+" – "+G(T)+"</span>":"")+'<a href="https://www.youtube.com/watch?v='+$+(P?"&t="+P:"")+'" target="_blank" rel="noopener noreferrer">Watch on YouTube ↗</a></div></div>'}const c=O.toLowerCase(),q=c.includes("foundation")?"cat-foundation":c.includes("transfer")||c.includes("practice")?"cat-transfer":"cat-core",Y=`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${W(j)}</title>
  <style>
    :root { --bg: #0d1117; --card-bg: #161b22; --text: #e6edf3; --text-secondary: #8b949e; --accent: #58a6ff; --accent-green: #3fb950; --accent-orange: #d29922; --border: #30363d; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; padding: 40px; max-width: 900px; margin: 0 auto; }
    h1 { font-size: 1.8rem; margin-bottom: 8px; color: var(--accent); }
    h2 { font-size: 1.3rem; margin: 24px 0 12px; color: var(--accent-green); }
    p { margin-bottom: 12px; color: var(--text-secondary); }
    .step-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 24px; margin-bottom: 20px; }
    .step-meta { font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 16px; display: flex; gap: 16px; align-items: center; }
    .category-badge { display: inline-block; padding: 2px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
    .cat-foundation { background: rgba(88, 166, 255, 0.15); color: #58a6ff; }
    .cat-core { background: rgba(63, 185, 80, 0.15); color: #3fb950; }
    .cat-transfer, .cat-practice { background: rgba(210, 153, 34, 0.15); color: #d29922; }
    .bridge-box { background: rgba(88, 166, 255, 0.05); border-left: 3px solid var(--accent); padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0; font-style: italic; color: var(--text-secondary); }
    .nav-buttons { display: flex; gap: 1rem; margin-top: 24px; }
    .nav-btn { padding: 0.75rem 1.5rem; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 600; }
    .nav-btn.primary { background: var(--accent-green); color: #000; }
    .nav-btn.secondary { background: #30363d; color: var(--text); }
    .nav-btn:hover { opacity: 0.9; }
    .breadcrumb { font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 8px; }
    .video-section { margin: 20px 0; }
    .video-section h2 { font-size: 1.1rem; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    .video-embed { position: relative; width: 100%; padding-bottom: 56.25%; border-radius: 8px; overflow: hidden; background: #000; }
    .video-embed iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; }
    .video-meta { display: flex; gap: 16px; align-items: center; margin-top: 8px; font-size: 0.8rem; color: var(--text-secondary); }
    .video-meta a { color: var(--accent); text-decoration: none; }
    .video-meta a:hover { text-decoration: underline; }
    .timestamp-badge { background: rgba(88, 166, 255, 0.1); padding: 2px 8px; border-radius: 4px; font-family: monospace; }
  </style>
</head>
<body>
  <p class="breadcrumb">${W(a)} — Step ${k+1} of ${i.length}</p>
  <h1>${W(j)}</h1>
  ${F?`<div class="bridge-box"><strong>Connection:</strong> ${W(F)}</div>`:""}
  ${H}
  <div class="step-card">
    <div class="step-meta">
      <span class="category-badge ${q}">${W(O)}</span>
      ${A?`<span>Source: ${W(A)}</span>`:""}
    </div>
    ${C?`<div class="step-summary">${je(C)}</div>`:"<p><em>No content summary available for this step.</em></p>"}
  </div>
  <div class="nav-buttons">
    <button class="nav-btn secondary" onclick="if(window.parent)window.parent.postMessage({type:'sco_previous'},'*')">← Previous</button>
    <button class="nav-btn primary" onclick="if(window.parent)window.parent.postMessage({type:'sco_complete'},'*')">Complete & Continue →</button>
  </div>
</body>
</html>`;return{title:j,html:Y}}),h=JSON.stringify(l.map(n=>({title:n.title,html:n.html}))),d=btoa(unescape(encodeURIComponent(h))),y=`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SCORM Preview — ${W(a)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; display: flex; height: 100vh; background: #0d1117; color: #c9d1d9; }
    .sidebar { width: 280px; background: #161b22; border-right: 1px solid #30363d; overflow-y: auto; padding: 1rem 0; flex-shrink: 0; }
    .sidebar h2 { padding: 0 1rem 0.75rem; font-size: 0.85rem; color: #8b949e; text-transform: uppercase; letter-spacing: 0.05em; }
    .sidebar .title { padding: 0 1rem 1rem; font-size: 1.1rem; color: #f0f6fc; border-bottom: 1px solid #30363d; margin-bottom: 0.5rem; }
    .nav-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1rem; cursor: pointer; transition: background 0.15s; font-size: 0.9rem; }
    .nav-item:hover { background: #21262d; }
    .nav-item.active { background: #1f6feb22; border-left: 3px solid #58a6ff; color: #58a6ff; }
    .nav-item .num { width: 22px; height: 22px; border-radius: 50%; background: #30363d; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; flex-shrink: 0; }
    .nav-item.active .num { background: #1f6feb; color: #fff; }
    .content { flex: 1; display: flex; flex-direction: column; }
    .toolbar { height: 42px; background: #161b22; border-bottom: 1px solid #30363d; display: flex; align-items: center; padding: 0 1rem; gap: 0.75rem; font-size: 0.85rem; color: #8b949e; }
    .toolbar .badge { background: #238636; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; }
    iframe { flex: 1; border: none; background: #fff; }
  </style>
</head>
<body>
  <div class="sidebar">
    <div class="title">${W(a)}</div>
    <h2>📦 SCORM Preview</h2>
    <div id="nav"></div>
  </div>
  <div class="content">
    <div class="toolbar">
      <span class="badge">SCORM 1.2</span>
      <span>Learner Preview — <span id="current-title"></span></span>
    </div>
    <iframe id="viewer"></iframe>
  </div>
  <script id="sco-data" type="application/json">${d}<\/script>
  <script>
    var raw = document.getElementById('sco-data').textContent;
    var scos = JSON.parse(decodeURIComponent(escape(atob(raw))));
    var nav = document.getElementById('nav');
    var viewer = document.getElementById('viewer');
    var currentTitle = document.getElementById('current-title');
    var activeIdx = 0;

    function loadSco(idx) {
      activeIdx = idx;
      var blob = new Blob([scos[idx].html], { type: 'text/html' });
      viewer.src = URL.createObjectURL(blob);
      currentTitle.textContent = scos[idx].title;
      document.querySelectorAll('.nav-item').forEach(function(el, i) {
        el.classList.toggle('active', i === idx);
      });
    }

    scos.forEach(function(sco, idx) {
      var item = document.createElement('div');
      item.className = 'nav-item' + (idx === 0 ? ' active' : '');
      var numSpan = document.createElement('span');
      numSpan.className = 'num';
      numSpan.textContent = idx + 1;
      var titleSpan = document.createElement('span');
      titleSpan.textContent = sco.title;
      item.appendChild(numSpan);
      item.appendChild(titleSpan);
      item.onclick = function() { loadSco(idx); };
      nav.appendChild(item);
    });

    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'sco_complete' && activeIdx < scos.length - 1) loadSco(activeIdx + 1);
      if (e.data && e.data.type === 'sco_previous' && activeIdx > 0) loadSco(activeIdx - 1);
    });

    if (scos.length > 0) loadSco(0);
  <\/script>
</body>
</html>`,u=new Blob([y],{type:"text/html"}),w=URL.createObjectURL(u);window.open(w,"_blank")}function W(t){return String(t||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;")}const Ve=`
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
`,Ye=`
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
`;function Je(t){return t.replace(/[^a-zA-Z0-9_-]/g,"_").substring(0,50)}function ue(t){return(t||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;")}function V(t){return(t||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function Ke(t){const a=t.toLowerCase();return a.includes("foundation")?"cat-foundation":a.includes("fix")||a.includes("core")?"cat-fix":a.includes("transfer")||a.includes("practice")?"cat-transfer":""}function Ze(t,a,i,o,l){const h=be(t)||ye(t.segment?.title||t.title||`Step ${a+1}`),d=t.summary||t.segment?.text||t.segment?.summary||"",y=ae(d),u=t.category||"core",w=Ke(u),n=t.segment?.source||t.segment?.type||"",k=a>0?`<a class="nav-link" href="sco_${a-1}.html">← Previous</a>`:"<span></span>",j=a<i-1?`<a class="nav-link" href="sco_${a+1}.html">Next →</a>`:"<span></span>",M=o?.text?`<div class="bridge-box"><strong>Connection:</strong> ${V(o.text)}</div>`:"";return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${V(h)}</title>
  <link rel="stylesheet" href="shared/style.css">
  <script src="shared/scormapi.js"><\/script>
</head>
<body>
  <p style="font-size:0.8rem;color:var(--text-secondary)">
    ${V(l)} — Step ${a+1} of ${i}
  </p>
  <h1>${V(h)}</h1>
  <div class="step-card">
    <div class="step-meta">
      <span class="category-badge ${w}">${V(u)}</span>
      ${n?`<span>Source: ${V(n)}</span>`:""}
    </div>
    <div class="step-summary">${je(y)}</div>
  </div>
  ${M}
  <button class="complete-btn" id="mark-complete" onclick="this.disabled=true;this.textContent='✅ Completed';completeSCORM();">
    Mark Step Complete
  </button>
  <div class="nav-row">
    ${k}
    ${j}
  </div>
</body>
</html>`}function Xe(t,a){const i=t.slice(0,10).map((l,h)=>{const d=ye(l.segment?.title||l.title||`Step ${h+1}`);return{question:`What is the main topic covered in "${d}"?`,stepTitle:d}}),o=i.map((l,h)=>`
    <div class="quiz-q">
      <p><strong>Q${h+1}:</strong> ${V(l.question)}</p>
      <label><input type="radio" name="q${h}" value="correct"> ${V(l.stepTitle)}</label>
      <label><input type="radio" name="q${h}" value="wrong1"> Unrelated Topic A</label>
      <label><input type="radio" name="q${h}" value="wrong2"> Unrelated Topic B</label>
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
  <p>Review your understanding of the concepts from "${V(a)}".</p>
  <form id="quiz-form">
    ${o}
    <button type="submit" class="complete-btn">Submit Answers</button>
  </form>
  <div id="result" style="display:none;text-align:center;margin-top:24px;"></div>
  <script>
    document.getElementById('quiz-form').addEventListener('submit', function(e) {
      e.preventDefault();
      var total = ${i.length};
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
</html>`}function et(t,a,i){const o="ORG-001",l="MANIFEST-UE5-"+Date.now(),h=a.map((w,n)=>`
    <resource identifier="RES-${n}" type="webcontent" adlcp:scormtype="sco" href="${w}">
      <file href="${w}"/>
      <file href="shared/scormapi.js"/>
      <file href="shared/style.css"/>
    </resource>`).join(`
`),d=i?`
    <resource identifier="RES-QUIZ" type="webcontent" adlcp:scormtype="sco" href="quiz.html">
      <file href="quiz.html"/>
      <file href="shared/scormapi.js"/>
      <file href="shared/style.css"/>
    </resource>`:"",y=a.map((w,n)=>`
      <item identifier="ITEM-${n}" identifierref="RES-${n}">
        <title>${ue(`Step ${n+1}`)}</title>
      </item>`).join(`
`),u=i?`
      <item identifier="ITEM-QUIZ" identifierref="RES-QUIZ">
        <title>Knowledge Check</title>
      </item>`:"";return`<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${l}"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                       http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="${o}">
    <organization identifier="${o}">
      <title>${ue(t)}</title>
      ${y}
      ${u}
    </organization>
  </organizations>
  <resources>
    ${h}
    ${d}
  </resources>
</manifest>`}async function tt(t,a={}){const{includeQuiz:i=!0}=a;if(!t?.path?.length)throw new Error("Cannot export empty path");const o=t.query?`UE5 Learning Path: ${t.query.substring(0,60)}`:"UE5 Learning Path",l=new Ue;l.file("shared/scormapi.js",Ve),l.file("shared/style.css",Ye);const h=[];t.path.forEach((w,n)=>{const k=`sco_${n}.html`,j=t.bridges?.[n]||null,M=Ze(w,n,t.path.length,j,o);l.file(k,M),h.push(k)}),i&&t.path.length>=2&&l.file("quiz.html",Xe(t.path,o)),l.file("imsmanifest.xml",et(o,h,i&&t.path.length>=2));const d=await l.generateAsync({type:"blob"}),y=`scorm_${Je(t.query||"path")}_${Date.now()}.zip`,u=document.createElement("a");u.href=URL.createObjectURL(d),u.download=y,document.body.appendChild(u),u.click(),document.body.removeChild(u),URL.revokeObjectURL(u.href),Ae(`[SCORM] Package downloaded: ${y} (${h.length} SCOs)`)}function st(t){return t?t.replace(/#{1,6}\s*/g,"").replace(/\*{1,3}([^*]+)\*{1,3}/g,"$1").replace(/`([^`]+)`/g,"$1").replace(/\[([^\]]+)\]\([^)]+\)/g,"$1").replace(/!\[([^\]]*)\]\([^)]+\)/g,"$1").replace(/^[-*+]\s+/gm,"• ").replace(/^\d+\.\s+/gm,"").replace(/^>\s?/gm,"").replace(/---+/g,"").replace(/\s{2,}/g," ").trim():""}function at(t,a=[]){return t.map((i,o)=>{const l=be(i)||i.segment?.title||i.title||`Step ${o+1}`,h=i.gemini_enriched?.one_sentence_summary||i.summary||i.segment?.summary||i.segment?.text||i.description||"";let d=st(ae(h));if(!d){const C=i.doc_meta?.section||"",O=i.source==="epic_docs"?"Official Unreal Engine documentation":"Reference material";d=C?`${O} covering ${C.replace(/-/g," ")}.`:`${O} for ${l}.`}const y=i.category||"",u=i.phase||"",w=i.tier||i.segment?.tier||"",n=i.segment?.source||i.segment?.type||i.source||"",k=a[o]||null,j=k?.text||k?.narration||"",M=it(i);return{title:l,summary:d,category:y,phase:u,tier:w,source:n,bridgeText:j,video:M,index:o}})}function it(t){const a=[t.segment?.videoUrl,t.segment?.url,t._url,t.url,t.code].filter(Boolean),i=t.videos?.[0]||t.segment?.videos?.[0];let o=null,l=null;if(i?.drive_id?o=i.drive_id:t.segment?.drive_id?o=t.segment.drive_id:t.drive_id&&(o=t.drive_id),!o&&!l)for(const u of a){if(!u)continue;const w=u.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)||u.match(/[?&]id=([a-zA-Z0-9_-]+)/);if(w){o=w[1];break}try{const n=new URL(u);if(n.hostname.includes("youtube.com")){l=n.searchParams.get("v");break}if(n.hostname.includes("youtu.be")){l=n.pathname.slice(1);break}}catch{}if(/^[a-zA-Z0-9_-]{11}$/.test(u)){l=u;break}}!o&&!l&&t.segment?.videoId&&/^[a-zA-Z0-9_-]{11}$/.test(t.segment.videoId)&&(l=t.segment.videoId);const h=Math.round(t.segment?.startTime||0),d=Math.round(t.segment?.endTime||0),y=t.segment?.videoTitle||"";return!o&&!l?null:{driveId:o,youtubeId:l,startSec:h,endSec:d,videoTitle:y}}const Se="wp_progress_";function Ne(t){try{const a=localStorage.getItem(Se+t);if(!a)return{completedSteps:new Set,lastStep:0};const i=JSON.parse(a);return{completedSteps:new Set(i.completed||[]),lastStep:i.lastStep||0}}catch{return{completedSteps:new Set,lastStep:0}}}function nt(t,a){const i=Ne(t);i.completedSteps.add(a),i.lastStep=a;try{localStorage.setItem(Se+t,JSON.stringify({completed:[...i.completedSteps],lastStep:i.lastStep,updatedAt:Date.now()}))}catch{}return i}function rt(t){return`wp_${t.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").substring(0,48)}_${Date.now().toString(36)}`}function ge(t){const a=Math.floor(t/60),i=String(t%60).padStart(2,"0");return`${a}:${i}`}function ot(t){const a=t.toLowerCase();return a.includes("foundation")||a.includes("prerequisite")?"wp-cat-foundation":a.includes("transfer")||a.includes("practice")?"wp-cat-transfer":"wp-cat-core"}const lt=[{id:"prerequisites",label:"📘 Prerequisites",match:t=>{const a=(t.category||"").toLowerCase(),i=(t.phase||"").toLowerCase(),o=(t.tier||"").toLowerCase();return a.includes("foundation")||a.includes("prerequisite")||a.includes("diagnosis")||i==="prerequisite"||o==="beginner"}},{id:"core",label:"📗 Core Lessons",match:t=>{const a=(t.category||"").toLowerCase(),i=(t.phase||"").toLowerCase(),o=(t.tier||"").toLowerCase();return a.includes("core")||a.includes("fix")||i==="core"||o==="intermediate"}},{id:"practice",label:"📙 Practice & Reference",match:t=>{const a=(t.category||"").toLowerCase(),i=(t.phase||"").toLowerCase(),o=(t.tier||"").toLowerCase();return a.includes("practice")||a.includes("transfer")||i==="supplemental"||o==="advanced"}}];function ct(t){const a=lt.map(i=>({...i,steps:[]}));return t.forEach((i,o)=>{(a.find(d=>d.match(i))||a[1]).steps.push({...i,globalIndex:o})}),a.filter(i=>i.steps.length>0)}function ke({question:t,index:a,selectedAnswer:i,onSelect:o}){const l=t.choices||{},h=Object.entries(l).slice(0,4);return e.jsxs("div",{className:"wp-quiz-card",children:[e.jsxs("p",{className:"wp-quiz-stem",children:[e.jsxs("strong",{children:["Q",a+1,":"]})," ",t.stem]}),e.jsx("div",{className:"wp-quiz-choices",children:h.map(([d,y])=>e.jsxs("label",{className:`wp-quiz-choice ${i===d?"wp-quiz-selected":""} ${i&&d===t.correct?"wp-quiz-correct":""} ${i&&i===d&&d!==t.correct?"wp-quiz-wrong":""}`,children:[e.jsx("input",{type:"radio",name:`quiz-q-${a}`,value:d,checked:i===d,onChange:()=>o(d),disabled:!!i}),e.jsx("span",{className:"wp-quiz-letter",children:d}),e.jsx("span",{className:"wp-quiz-text",children:y})]},d))}),i&&e.jsxs("div",{className:`wp-quiz-feedback ${i===t.correct?"wp-quiz-fb-correct":"wp-quiz-fb-wrong"}`,children:[i===t.correct?"✅ Correct!":`❌ Incorrect — the answer is ${t.correct}.`,t.explanation&&e.jsx("p",{className:"wp-quiz-explanation",children:t.explanation})]})]})}ke.propTypes={question:X.object.isRequired,index:X.number.isRequired,selectedAnswer:X.string,onSelect:X.func.isRequired};function $e({pathResult:t,courses:a,onClose:i}){const o=t?.query?`UE5 Learning Path: ${t.query.substring(0,60)}`:"Learning Path",l=m.useMemo(()=>rt(o),[o]),h=m.useMemo(()=>t?.path?t.path.map(g=>{const I=g.segment||{};if(I.videoUrl||I.drive_id)return g;const _=(a||[]).find(E=>E.code&&g.code&&E.code===g.code||E.title&&g.title&&E.title===g.title||E.title&&g.title&&g.title.includes(E.title));if(!_)return g;const Z=_.videos?.[0],ee=Z?.drive_id||"",J=_._url||(ee?`https://drive.google.com/file/d/${ee}/view`:"");return{...g,videos:g.videos||_.videos,tags:g.tags||_.tags,canonical_tags:g.canonical_tags||_.canonical_tags,ai_tags:g.ai_tags||_.ai_tags,segment:{...I,videoUrl:J,drive_id:ee,videoTitle:I.videoTitle||Z?.title||Z?.name||_.title||""}}}):[],[t,a]),d=m.useMemo(()=>at(h,t?.bridges||[]),[h,t?.bridges]),y=m.useMemo(()=>ct(d),[d]),[u,w]=m.useState("intro"),[n,k]=m.useState(0),[j,M]=m.useState(new Set),[C,O]=m.useState(!1),[A,U]=m.useState([]),[F,Q]=m.useState(!1),[B,z]=m.useState({});m.useEffect(()=>{const v=Ne(l);M(v.completedSteps),v.lastStep>0&&v.lastStep<d.length&&(k(v.lastStep),w("lesson"))},[l,d.length]),m.useEffect(()=>{const v=g=>{g.key==="Escape"&&i(),u==="lesson"&&(g.key==="ArrowRight"&&n<d.length-1&&$(),g.key==="ArrowLeft"&&n>0&&k(I=>I-1))};return window.addEventListener("keydown",v),()=>window.removeEventListener("keydown",v)},[n,d.length,u]);const $=m.useCallback(()=>{const v=nt(l,n);M(new Set(v.completedSteps)),n<d.length-1?k(g=>g+1):w("quiz")},[l,n,d.length]),P=m.useCallback(()=>{n>0&&k(v=>v-1)},[n]),T=m.useCallback(v=>{k(v),w("lesson")},[]),D=m.useCallback(()=>{k(0),w("lesson")},[]),G=m.useCallback(async()=>{Q(!0);try{const v=await ve(t?.path||[],t?.query||"",5),g=[];for(const[,I]of v)g.push(...I);U(g)}catch{U([])}Q(!1)},[t]),H=m.useCallback((v,g)=>{z(I=>({...I,[v]:g}))},[]),c=d[n],q=j.size,Y=d.length?Math.round(q/d.length*100):0,N=m.useMemo(()=>{if(A.length===0||Object.keys(B).length<A.length)return null;const g=A.filter((I,_)=>B[_]===I.correct).length;return{correct:g,total:A.length,pct:Math.round(g/A.length*100)}},[A,B]),L=m.useMemo(()=>d.length*3,[d.length]);return e.jsxs("div",{className:"wp-overlay",children:[e.jsxs("div",{className:`wp-sidebar ${C?"wp-sidebar-collapsed":""}`,children:[e.jsxs("div",{className:"wp-sidebar-header",children:[e.jsx("h2",{className:"wp-sidebar-title",children:o}),e.jsx("button",{className:"wp-sidebar-toggle",onClick:()=>O(!C),title:C?"Expand sidebar":"Collapse sidebar",children:C?"→":"←"})]}),!C&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"wp-progress",children:[e.jsx("div",{className:"wp-progress-bar",children:e.jsx("div",{className:"wp-progress-fill",style:{width:`${Y}%`}})}),e.jsxs("span",{className:"wp-progress-text",children:[q,"/",d.length," completed"]})]}),e.jsxs("nav",{className:"wp-nav",children:[e.jsxs("button",{className:`wp-nav-item wp-nav-intro ${u==="intro"?"wp-nav-active":""}`,onClick:()=>w("intro"),children:[e.jsx("span",{className:"wp-nav-num",children:"🏠"}),e.jsx("span",{className:"wp-nav-label",children:"Introduction"})]}),y.map(v=>e.jsxs("div",{className:"wp-nav-section",children:[e.jsxs("div",{className:"wp-nav-section-header",children:[e.jsx("span",{children:v.label}),e.jsx("span",{className:"wp-nav-section-count",children:v.steps.length})]}),v.steps.map(g=>e.jsxs("button",{className:`wp-nav-item ${u==="lesson"&&g.globalIndex===n?"wp-nav-active":""} ${j.has(g.globalIndex)?"wp-nav-done":""}`,onClick:()=>T(g.globalIndex),children:[e.jsx("span",{className:"wp-nav-num",children:j.has(g.globalIndex)?"✓":g.globalIndex+1}),e.jsx("span",{className:"wp-nav-label",children:g.title})]},g.globalIndex))]},v.id)),e.jsxs("button",{className:`wp-nav-item wp-nav-quiz ${u==="quiz"?"wp-nav-active":""}`,onClick:()=>w("quiz"),children:[e.jsx("span",{className:"wp-nav-num",children:"📝"}),e.jsx("span",{className:"wp-nav-label",children:"Knowledge Check"})]})]})]})]}),e.jsxs("div",{className:"wp-main",children:[e.jsxs("div",{className:"wp-toolbar",children:[e.jsxs("div",{className:"wp-toolbar-left",children:[e.jsx("button",{className:"wp-back-btn",onClick:i,title:"Back to Path Builder",children:"← Back to Builder"}),e.jsx("span",{className:"wp-badge",children:"🌐 Web Player"}),u==="lesson"&&e.jsxs("span",{className:"wp-breadcrumb",children:["Step ",n+1," of ",d.length]})]}),e.jsx("button",{className:"wp-close-btn",onClick:i,title:"Close preview",children:"✕"})]}),u==="intro"&&e.jsxs("div",{className:"wp-content wp-intro-content",children:[e.jsxs("div",{className:"wp-intro-hero",children:[e.jsx("h1",{className:"wp-intro-title",children:o}),e.jsx("p",{className:"wp-intro-subtitle",children:t?.query?`A structured learning path covering ${t.query}`:"A curated learning experience in Unreal Engine 5"})]}),e.jsxs("div",{className:"wp-intro-stats",children:[e.jsxs("div",{className:"wp-intro-stat",children:[e.jsx("span",{className:"wp-intro-stat-value",children:d.length}),e.jsx("span",{className:"wp-intro-stat-label",children:"Lessons"})]}),e.jsxs("div",{className:"wp-intro-stat",children:[e.jsxs("span",{className:"wp-intro-stat-value",children:["~",L,"m"]}),e.jsx("span",{className:"wp-intro-stat-label",children:"Estimated Time"})]}),e.jsxs("div",{className:"wp-intro-stat",children:[e.jsx("span",{className:"wp-intro-stat-value",children:y.length}),e.jsx("span",{className:"wp-intro-stat-label",children:"Sections"})]})]}),e.jsxs("div",{className:"wp-intro-sections",children:[e.jsx("h2",{children:"What You'll Learn"}),y.map(v=>e.jsxs("div",{className:"wp-intro-section-card",children:[e.jsx("h3",{children:v.label}),e.jsxs("ul",{children:[v.steps.slice(0,5).map(g=>e.jsx("li",{children:g.title},g.globalIndex)),v.steps.length>5&&e.jsxs("li",{className:"wp-intro-more",children:["+",v.steps.length-5," more lessons"]})]})]},v.id))]}),e.jsx("button",{className:"wp-intro-cta",onClick:D,children:"🚀 Begin Learning"})]}),u==="lesson"&&c&&e.jsxs("div",{className:"wp-content",children:[e.jsx("h1",{className:"wp-step-title",children:c.title}),c.bridgeText&&e.jsxs("div",{className:"wp-bridge",children:[e.jsx("strong",{children:"Connection:"})," ",c.bridgeText]}),c.video&&e.jsxs("div",{className:"wp-video-section",children:[e.jsx("h2",{children:"🎬 Video Reference"}),e.jsx("div",{className:"wp-video-embed",children:c.video.driveId?e.jsx("iframe",{src:`https://drive.google.com/file/d/${c.video.driveId}/preview`,allow:"autoplay",allowFullScreen:!0,title:c.video.videoTitle||c.title}):c.video.youtubeId?e.jsx("iframe",{src:`https://www.youtube-nocookie.com/embed/${c.video.youtubeId}?rel=0&modestbranding=1${c.video.startSec?`&start=${c.video.startSec}`:""}`,allow:"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",allowFullScreen:!0,title:c.video.videoTitle||c.title}):null}),e.jsxs("div",{className:"wp-video-meta",children:[c.video.videoTitle&&e.jsx("span",{children:c.video.videoTitle}),(c.video.startSec>0||c.video.endSec>0)&&e.jsxs("span",{className:"wp-timestamp",children:["⏱ ",ge(c.video.startSec)," –"," ",ge(c.video.endSec)]}),c.video.driveId&&e.jsx("a",{href:`https://drive.google.com/file/d/${c.video.driveId}/view`,target:"_blank",rel:"noopener noreferrer",children:"Open in Drive ↗"}),c.video.youtubeId&&e.jsx("a",{href:`https://www.youtube.com/watch?v=${c.video.youtubeId}${c.video.startSec?`&t=${c.video.startSec}`:""}`,target:"_blank",rel:"noopener noreferrer",children:"Watch on YouTube ↗"})]})]}),e.jsxs("div",{className:"wp-step-card",children:[e.jsxs("div",{className:"wp-step-meta",children:[e.jsx("span",{className:`wp-category-badge ${ot(c.category)}`,children:c.category}),c.source&&e.jsxs("span",{children:["Source: ",c.source]})]}),c.summary?e.jsx("p",{className:"wp-step-summary",children:c.summary}):e.jsx("p",{className:"wp-no-content",children:e.jsx("em",{children:"No content summary available for this step."})})]}),e.jsxs("div",{className:"wp-nav-buttons",children:[e.jsx("button",{className:"wp-nav-btn wp-nav-secondary",onClick:P,disabled:n===0,children:"← Previous"}),e.jsx("button",{className:"wp-nav-btn wp-nav-primary",onClick:$,children:n===d.length-1?"✅ Complete & Take Quiz →":"Complete & Continue →"})]})]}),u==="quiz"&&e.jsxs("div",{className:"wp-content wp-quiz-content",children:[e.jsx("h1",{className:"wp-step-title",children:"📝 Knowledge Check"}),e.jsx("p",{className:"wp-quiz-intro",children:"Test your understanding of the concepts covered in this learning path. You need 70% or higher to pass."}),A.length===0&&!F&&e.jsxs("div",{className:"wp-quiz-start",children:[e.jsx("button",{className:"wp-intro-cta",onClick:G,children:"🧠 Generate Quiz Questions"}),e.jsx("p",{className:"wp-quiz-note",children:"Quiz questions are generated based on the lesson content using AI."})]}),F&&e.jsxs("div",{className:"wp-quiz-loading",children:[e.jsx("div",{className:"wp-spinner"}),e.jsx("p",{children:"Generating quiz questions from lesson content..."})]}),A.length>0&&e.jsxs(e.Fragment,{children:[A.map((v,g)=>e.jsx(ke,{question:v,index:g,selectedAnswer:B[g],onSelect:I=>H(g,I)},g)),N&&e.jsxs("div",{className:`wp-quiz-score ${N.pct>=70?"wp-quiz-passed":"wp-quiz-failed"}`,children:[e.jsx("h2",{children:N.pct>=70?"🎉 Congratulations!":"📚 Keep Studying"}),e.jsxs("p",{className:"wp-quiz-score-text",children:["Score: ",N.correct,"/",N.total," (",N.pct,"%)"]}),e.jsx("p",{children:N.pct>=70?"You passed the knowledge check! Great work.":"You need 70% to pass. Review the lessons and try again."}),e.jsx("button",{className:"wp-nav-btn wp-nav-secondary",onClick:()=>{z({}),U([])},children:"🔄 Retake Quiz"})]})]})]})]})]})}$e.propTypes={pathResult:X.object.isRequired,courses:X.array,onClose:X.func.isRequired};const he=["All","General","Games","Film & Television","Architecture","Simulation","Automotive","Media & Entertainment"];function dt({score:t}){const i=2*Math.PI*36,o=Math.round(Math.max(0,Math.min(100,t*100))),l=i-o/100*i,h=o>=80?"#3fb950":o>=50?"#d29922":o>=1?"#f85149":"#484f58";return e.jsxs("div",{className:"ip-gauge",children:[e.jsxs("svg",{width:"88",height:"88",viewBox:"0 0 88 88",children:[e.jsx("circle",{cx:"44",cy:"44",r:36,className:"ip-gauge-bg"}),e.jsx("circle",{cx:"44",cy:"44",r:36,className:"ip-gauge-fill",stroke:h,strokeDasharray:i,strokeDashoffset:l})]}),e.jsxs("div",{className:"ip-gauge-label",style:{color:h},children:[e.jsxs("span",{className:"ip-gauge-pct",children:[o,"%"]}),e.jsx("span",{className:"ip-gauge-sub",children:"coverage"})]})]})}function pt({pathResult:t,analysis:a,courses:i,learningIntent:o,studyGuide:l,flashcards:h,exportingScorm:d,setExportingScorm:y}){const[u,w]=m.useState(!1),[n,k]=m.useState(!1),[j,M]=m.useState(!1),[C,O]=m.useState(!1),[A,U]=m.useState(null),[F,Q]=m.useState(!1),B=m.useMemo(()=>we(t,a),[t,a]),z=B.filter(c=>c.passed).length,$=B.length,P=z===$,T=P&&u,D=async()=>{y(!0),U(null);try{await tt(t,{includeQuiz:!0}),O(!0)}catch(c){console.error("SCORM export failed:",c),U(c.message||"Export failed")}finally{y(!1)}},G=async()=>{M(!0);try{const c={...t};t?.path&&i?.length?c.path=t.path.map((q,Y)=>{const N=q.segment||{};if(N.videoUrl||N.drive_id)return q;const L=i.find(_=>_.code&&q.code&&_.code===q.code||_.title&&q.title&&_.title===q.title||_.title&&q.title&&q.title.includes(_.title));if(!L)return console.debug(`[SCORM Preview] Step ${Y} "${q.title?.slice(0,40)}" — no course match. step.code=${q.code}`),q;const v=L.videos?.[0],g=v?.drive_id||"",I=L._url||(g?`https://drive.google.com/file/d/${g}/view`:"")||"";return console.debug(`[SCORM Preview] Step ${Y} matched → "${L.title?.slice(0,40)}" videoUrl=${I.slice(0,60)} drive_id=${g.slice(0,20)}`),{...q,videos:q.videos||L.videos,segment:{...N,videoUrl:I,drive_id:g,videoTitle:N.videoTitle||v?.title||v?.name||L.title||""}}}):console.debug("[SCORM Preview] No enrichment — courses:",i?.length,"path:",t?.path?.length),await He(c)}catch(c){console.error("Preview failed:",c)}finally{M(!1)}},H=()=>{T&&k(!0)};return e.jsxs("div",{className:"export-panel",children:[e.jsxs("div",{className:"export-section",style:{background:"rgba(88,166,255,0.05)",borderRadius:8,padding:"0.75rem 1rem",marginBottom:"0.75rem"},children:[e.jsx("h4",{style:{margin:"0 0 0.5rem",fontSize:"0.85rem",color:"#8b949e",textTransform:"uppercase",letterSpacing:"0.04em"},children:"📋 Readiness"}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.5rem"},children:[e.jsx("span",{style:{fontSize:"1.1rem"},children:P?"✅":"⚠️"}),e.jsxs("span",{style:{fontSize:"0.9rem",color:P?"#3fb950":"#d29922"},children:[z,"/",$," auto-checks passed"]})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"0.5rem"},children:[e.jsx("span",{style:{fontSize:"1.1rem"},children:u?"✅":"⬜"}),e.jsx("span",{style:{fontSize:"0.9rem",color:u?"#3fb950":"#8b949e"},children:"Instructor sign-off"})]})]}),e.jsxs("div",{className:"wizard-manual-toggle",onClick:()=>w(!u),role:"switch","aria-checked":u,tabIndex:0,onKeyDown:c=>{(c.key==="Enter"||c.key===" ")&&(c.preventDefault(),w(!u))},id:"instructor-signoff-toggle",style:{marginBottom:"0.75rem",padding:"0.5rem 0.75rem",borderRadius:8,cursor:"pointer",display:"flex",gap:"0.75rem",alignItems:"center",background:u?"rgba(63,185,80,0.08)":"rgba(139,148,158,0.06)",border:`1px solid ${u?"#3fb95040":"#30363d"}`},children:[e.jsx("div",{style:{width:36,height:20,borderRadius:10,background:u?"#3fb950":"#484f58",position:"relative",transition:"background 0.2s",flexShrink:0},children:e.jsx("div",{style:{width:16,height:16,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:u?18:2,transition:"left 0.2s"}})}),e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:"0.85rem",fontWeight:600,color:"#c9d1d9"},children:"Instructor Sign-off"}),e.jsx("div",{style:{fontSize:"0.75rem",color:"#8b949e"},children:"I've reviewed the path and confirm it meets quality standards"})]})]}),e.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:"0.5rem"},children:[e.jsx("button",{className:"export-action-btn",onClick:G,disabled:j,id:"export-preview-btn",style:{background:"linear-gradient(135deg, #8b5cf6, #6d28d9)",color:"#fff",border:"none",padding:"0.6rem 1rem",borderRadius:8,cursor:"pointer",fontSize:"0.85rem",fontWeight:600,opacity:j?.7:1,transition:"opacity 0.2s"},children:j?"⏳ Building preview...":"👁️ Preview SCORM"}),e.jsx("button",{className:"export-action-btn",onClick:()=>Q(!0),id:"export-webplayer-btn",style:{background:"linear-gradient(135deg, #06b6d4, #0891b2)",color:"#fff",border:"none",padding:"0.6rem 1rem",borderRadius:8,cursor:"pointer",fontSize:"0.85rem",fontWeight:600,transition:"opacity 0.2s"},children:"🌐 Web Player Preview"}),e.jsx("button",{className:"export-action-btn scorm-btn",onClick:D,disabled:d,id:"export-download-btn",style:{background:C?"linear-gradient(135deg, #10b981, #059669)":"linear-gradient(135deg, #6366f1, #4f46e5)",color:"#fff",border:"none",padding:"0.6rem 1rem",borderRadius:8,cursor:"pointer",fontSize:"0.85rem",fontWeight:600,opacity:d?.7:1,transition:"all 0.2s"},children:d?"⏳ Packaging...":C?"✅ Downloaded!":"📦 Download SCORM 1.2"}),n?e.jsx("div",{style:{textAlign:"center",padding:"0.75rem",background:"rgba(63,185,80,0.1)",borderRadius:8,color:"#3fb950",fontWeight:600,fontSize:"0.9rem"},children:"🎉 Path published successfully!"}):e.jsxs(e.Fragment,{children:[e.jsx("button",{className:"export-action-btn",onClick:H,disabled:!T,id:"export-publish-btn",style:{background:T?"linear-gradient(135deg, #238636, #2ea043)":"#21262d",color:T?"#fff":"#484f58",border:T?"none":"1px solid #30363d",padding:"0.6rem 1rem",borderRadius:8,cursor:T?"pointer":"not-allowed",fontSize:"0.85rem",fontWeight:600,transition:"all 0.2s"},children:T?"🚀 Publish Path":"🔒 Publish Path"}),!T&&e.jsx("p",{style:{textAlign:"center",fontSize:"0.75rem",color:"#8b949e",margin:"0.25rem 0 0"},children:P?"Toggle sign-off above to enable publishing":"Pass all checks on the Review tab first"})]})]}),A&&e.jsxs("p",{style:{textAlign:"center",fontSize:"0.8rem",color:"#f43f5e",marginTop:"0.5rem"},children:["❌ ",A]}),F&&e.jsx($e,{pathResult:t,courses:i,onClose:()=>Q(!1)})]})}const xe=[{id:"coverage",icon:"📊",label:"Coverage"},{id:"gaps",icon:"⚠",label:"Gaps"},{id:"quiz",icon:"📚",label:"Study"},{id:"review",icon:"✅",label:"Review"},{id:"export",icon:"📦",label:"Export"}],mt={build:["coverage","gaps"],review:["coverage","gaps","quiz","review"],export:["quiz","review","export"]},fe={build:"coverage",review:"review",export:"export"};function Ct(){const{courses:t,learningIntent:a,setLearningIntent:i,pathStats:o,addCourse:l,workflowStage:h}=Pe(),{getCourseSummary:d}=Be(),y=m.useCallback((s,r)=>{i({[s]:r})},[i]),u=m.useMemo(()=>a?.primaryGoal?Le(a.primaryGoal):null,[a?.primaryGoal]),[w,n]=m.useState(fe[h]||"coverage");m.useEffect(()=>{const s=fe[h];s&&n(s)},[h]);const k=m.useMemo(()=>{const s=mt[h];return s?xe.filter(r=>s.includes(r.id)):xe},[h]),[j,M]=m.useState(null),[C,O]=m.useState(!1),[A,U]=m.useState(null),[F,Q]=m.useState(null),[B,z]=m.useState({}),[$,P]=m.useState(null),[T,D]=m.useState(!1),[G,H]=m.useState(null),[c,q]=m.useState(null),[Y,N]=m.useState(!1),[L,v]=m.useState(10);m.useEffect(()=>{try{const s=localStorage.getItem("ue5_wizard_intent");if(s){const r=JSON.parse(s);i(r),localStorage.removeItem("ue5_wizard_intent")}}catch{}},[]),m.useEffect(()=>{if(t.length!==0)try{const s=localStorage.getItem("ue5_saved_paths");if(!s)return;const r=JSON.parse(s),p=[...r].sort((f,x)=>new Date(x.updatedAt||0)-new Date(f.updatedAt||0));if(p.length>0){const f=p[0];f.courseCount=t.length,f.totalMinutes=o.totalMinutes||0,f.updatedAt=new Date().toISOString(),localStorage.setItem("ue5_saved_paths",JSON.stringify(r))}}catch{}},[t.length,o.totalMinutes]);const g=t.length>0,I=!!a?.primaryGoal?.trim(),_=!!a?.skillLevel,Z=!!a?.timeBudget,ee=I&&_&&Z,J=g&&ee,E=m.useMemo(()=>J?{query:a.primaryGoal,path:t.map((s,r)=>{const p=s.videos?.[0],f=p?.drive_id||"",x=s._url||s.url||(f?`https://drive.google.com/file/d/${f}/view`:"")||"";return{code:s.code||"",category:s.role?.toLowerCase()==="prerequisite"?"foundation":"core",title:s.title||`Step ${r+1}`,videos:s.videos,segment:{title:s.title||`Step ${r+1}`,text:s.description||s.why||"",source:s.instructor||s.platform||"",type:s.type||"video",videoUrl:x,drive_id:f,videoTitle:p?.title||p?.name||s.title||"",startTime:s.startTime||p?.start_time||0,endTime:s.endTime||p?.end_time||0}}}),bridges:[],gaps:j}:null,[J,t,a,j]),te=m.useMemo(()=>{if(!J)return null;const s=t.map(r=>r.code||r.title).sort().join("|");return`ip-analysis-${a.primaryGoal}-${s}`.replace(/\s+/g,"_").slice(0,120)},[J,t,a?.primaryGoal]);m.useEffect(()=>{if(te)try{const s=localStorage.getItem(te);s&&!j&&M(JSON.parse(s))}catch{}},[te]);const Ce=m.useCallback(async()=>{if(!(!J||C)){O(!0),U(null);try{const s=t.map(p=>({category:p.role?.toLowerCase()==="prerequisite"?"foundation":"core",segment:{title:p.title||"Untitled",text:p.description||p.why||""}})),r=await Me(a.primaryGoal,s);if(M(r),te)try{localStorage.setItem(te,JSON.stringify(r))}catch{}}catch(s){U(s.message||"Analysis failed")}finally{O(!1)}}},[J,C,t,a,te]),ze=m.useCallback(async s=>{if(!F){Q(s);try{const r=t.map(x=>({category:"core",segment:{title:x.title||"",text:x.description||""}})),p=t.map(x=>x.code).filter(Boolean),f=await Ee(s,a.primaryGoal,r,p);z(x=>({...x,[s]:f}))}catch{z(r=>({...r,[s]:{error:!0}}))}finally{Q(null)}}},[F,t,a]),Ie=m.useCallback((s,r)=>{l({code:s.code,title:s.title,role:"core",isGapFill:!0,gapTopic:r}),z(p=>({...p,[r]:{...p[r],addedCode:s.code}}))},[l]),_e=m.useCallback((s,r)=>{const p=Re(r,s);l(p),z(f=>({...f,[r]:{...f[r],bespokeGenerated:!0}}))},[l]),Te=m.useCallback((s,r,p)=>{l({code:`bespoke-${r}-${p}`,title:s.title||`${r} Segment`,description:s.text||"",videoTitle:s.videoTitle||"",role:"core",type:"bespoke-segment",isGapFill:!0,gapTopic:r}),z(f=>({...f,[r]:{...f[r],addedSegments:[...f[r]?.addedSegments||[],p]}}))},[l]),qe=m.useCallback(async()=>{if(!(!E||T)){D(!0);try{const s=await ve(E.path,a.primaryGoal,L),r=[];if(s instanceof Map)for(const p of s.values())r.push(...p);else Array.isArray(s)&&r.push(...s);P(r)}catch{P([])}finally{D(!1)}}},[E,T,a,L]),ce=j?.blindSpots||[],ie=j?.suggestions||[],de=j?.assumedKnowledge||[],ne=j?.weaklyCovered||[],re=j?.coverageScore??0,pe=j?.corpusStats||{},me=Object.values(B).filter(s=>s&&!s.error&&(s.addedCode||s.generated)).length,oe=ce.length+ne.length,le=Math.max(0,oe-me),K=oe>0?Math.min(1,re+me/oe*(1-re)):re;return e.jsxs("div",{className:"ip-panel",children:[e.jsxs("div",{className:"ip-header",children:[e.jsx("span",{className:"ip-logo",children:"🧠"}),e.jsx("h3",{children:"Path Intelligence"})]}),ee?g?e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"ip-summary",children:[e.jsx("span",{className:"ip-summary-goal",children:a.primaryGoal}),e.jsxs("span",{className:"ip-summary-meta",children:[a.skillLevel," ·"," ",a.timeBudget==="none"?"No Limit":`~${a.timeBudget}h`,a.industries?.length>0&&e.jsxs(e.Fragment,{children:[" · ",a.industries.join(", ")]})]}),e.jsxs("div",{className:"ip-industry-chips ip-industry-chips-compact",children:[e.jsx("button",{type:"button",className:`ip-industry-chip ${a.industries?.length?"":"selected"}`,onClick:()=>y("industries",[]),children:"All"}),he.filter(s=>s!=="All").map(s=>e.jsx("button",{type:"button",className:`ip-industry-chip ${a.industries?.includes(s)?"selected":""}`,onClick:()=>{const r=a.industries||[],p=r.includes(s)?r.filter(f=>f!==s):[...r,s];y("industries",p)},children:s},s))]})]}),(h==="review"||h==="export")&&E&&(()=>{const s=we(E,j),r=s.filter(S=>S.passed).length,p=s.length,f=r===p,x=p>0?Math.round(r/p*100):0;return e.jsxs("div",{className:"ip-readiness-bar",onClick:()=>n("review"),role:"button",tabIndex:0,style:{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.5rem 0.75rem",borderRadius:8,cursor:"pointer",background:f?"rgba(63,185,80,0.08)":"rgba(210,153,34,0.08)",border:`1px solid ${f?"#3fb95040":"#d2992240"}`,marginBottom:"0.5rem",transition:"all 0.2s"},children:[e.jsx("span",{style:{fontSize:"1rem"},children:f?"✅":"⚠️"}),e.jsxs("div",{style:{flex:1},children:[e.jsx("div",{style:{fontSize:"0.8rem",fontWeight:600,color:f?"#3fb950":"#d29922"},children:f?"Ready to Export":`${r}/${p} checks — Fix ${p-r} issue${p-r>1?"s":""}`}),e.jsx("div",{style:{height:4,borderRadius:2,marginTop:4,background:"rgba(139,148,158,0.15)"},children:e.jsx("div",{style:{height:"100%",borderRadius:2,transition:"width 0.3s",width:`${x}%`,background:f?"#3fb950":"#d29922"}})})]})]})})(),e.jsx("div",{className:"ip-tabs",children:k.map(s=>e.jsxs("button",{className:`ip-tab ${w===s.id?"active":""}`,onClick:()=>n(s.id),children:[e.jsx("span",{className:"ip-tab-icon",children:s.icon}),e.jsx("span",{className:"ip-tab-label",children:s.label}),s.id==="gaps"&&le>0&&e.jsx("span",{className:"ip-tab-badge",children:le})]},s.id))}),e.jsxs("div",{className:"ip-content",children:[w==="coverage"&&e.jsxs("div",{className:"ip-tab-pane",children:[e.jsx(dt,{score:K}),e.jsxs("div",{className:"ip-stats",children:[e.jsxs("div",{className:"ip-stat",children:[e.jsx("span",{children:"Courses"}),e.jsx("strong",{children:o.courseCount})]}),e.jsxs("div",{className:"ip-stat",children:[e.jsx("span",{children:"Est. Time"}),e.jsxs("strong",{children:[o.estimatedHours,"h",a?.timeBudget&&a.timeBudget!=="none"&&o.estimatedHours>Number(a.timeBudget)&&e.jsx("span",{className:"ip-budget-warn",title:`Path is ${o.estimatedHours}h but your budget is ${a.timeBudget}h`,style:{marginLeft:4,fontSize:"0.7rem",color:o.estimatedHours>Number(a.timeBudget)*2?"#f85149":"#d29922"},children:o.estimatedHours>Number(a.timeBudget)*2?"🔴":"⚠️"})]})]}),o.levelRange&&e.jsxs("div",{className:"ip-stat",children:[e.jsx("span",{children:"Levels"}),e.jsx("strong",{children:o.levelRange})]}),j&&e.jsxs("div",{className:"ip-stat",children:[e.jsx("span",{children:"Topics Covered"}),e.jsxs("strong",{children:[pe.subtopicsCovered||0," / ",pe.subtopicsChecked||0]})]})]}),a?.skillLevel&&o.estimatedHours>0&&(()=>{const r={Beginner:{max:5,label:"Beginner",research:"learners lose focus past 5h — chunk into 3–5 min segments"},Foundation:{max:5,label:"Beginner",research:"learners lose focus past 5h — chunk into 3–5 min segments"},Intermediate:{max:15,label:"Intermediate",research:"can handle longer sessions but fatigue sets in past 15h"},Advanced:{max:25,label:"Advanced",research:"self-directed learning allows up to 25h but diminishing returns beyond"}}[a.skillLevel];if(!r)return null;const p=o.estimatedHours,f=p>r.max;return e.jsx("div",{className:`ip-time-warning ${f?"warn":"ok"}`,children:f?`⚠️ ${p}h exceeds recommended ${r.max}h for ${r.label} — ${r.research}`:`✅ ${p}h within ${r.max}h ${r.label} range`})})(),t.length>0&&(()=>{const s=t.map(x=>({code:x.code,title:x.title,aug:d(x.code)})).filter(x=>x.aug);if(s.length===0)return null;const r=Math.round(s.reduce((x,S)=>x+S.aug.avgScore,0)/s.length),p=r>=45?"A":r>=39?"B":r>=33?"C":r>=22?"D":"F",f=s.filter(x=>x.aug.avgGrade==="D"||x.aug.avgGrade==="F");return e.jsxs("div",{className:"ip-aug-card",children:[e.jsxs("div",{className:"ip-aug-header",children:[e.jsx("span",{className:`ip-aug-grade aug-badge aug-${p}`,children:p}),e.jsxs("div",{children:[e.jsx("strong",{children:"Augmentation Quality"}),e.jsxs("span",{className:"ip-aug-sub",children:[r,"/55 avg · ",s.length,"/",t.length," courses analyzed"]})]})]}),f.length>0&&e.jsxs("div",{className:"ip-aug-alert",children:["⚡ ",f.length," course",f.length>1?"s":""," rated D/F — pedagogy needs augmentation"]}),e.jsx("div",{className:"ip-aug-list",children:s.map(x=>e.jsxs("div",{className:"ip-aug-item",children:[e.jsx("span",{className:`ip-aug-dot aug-badge aug-${x.aug.avgGrade}`,children:x.aug.avgGrade}),e.jsx("span",{className:"ip-aug-title",title:x.title,children:x.code}),e.jsxs("span",{className:"ip-aug-score",children:[x.aug.avgScore,"/55"]})]},x.code))})]})})(),e.jsx("button",{className:"ip-btn primary",onClick:Ce,disabled:C,children:C?e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"ip-spinner"})," Analyzing…"]}):j?"🔄 Re-Analyze":"🔍 Analyze Path"}),A&&e.jsxs("p",{className:"ip-error",children:["❌ ",A]}),j&&e.jsx("div",{className:`ip-explain ${K>=.8?"good":K>=.5?"warn":"low"}`,children:K>=.8?e.jsxs("p",{children:[e.jsx("strong",{children:"✅ Great!"})," Your path covers"," ",Math.round(K*100),"% of key subtopics."]}):K>=.5?e.jsxs("p",{children:[e.jsx("strong",{children:"⚠️ Partial"})," — ",Math.round(K*100),"% covered. Check the ",e.jsx("strong",{children:"Gaps"})," tab to see what's missing."]}):e.jsxs("p",{children:[e.jsx("strong",{children:"🔴 Low"})," — Only ",Math.round(K*100),"% covered. Check the ",e.jsx("strong",{children:"Gaps"})," tab for blind spots and suggestions."]})})]}),w==="gaps"&&e.jsx("div",{className:"ip-tab-pane",children:j?le===0&&ie.length===0?e.jsxs("div",{className:"ip-empty",children:[e.jsx("span",{className:"ip-empty-icon",children:"🎉"}),e.jsx("p",{children:"No gaps detected! Your path looks solid."})]}):e.jsxs(e.Fragment,{children:[ce.map((s,r)=>{const p=typeof s=="string"?s:s.topic,f=s.severity||"medium",x=s.reason||"",S=B[p];return e.jsxs("div",{className:`ip-gap-card ip-sev-${f}`,children:[e.jsxs("div",{className:"ip-gap-header",children:[e.jsx("span",{className:`ip-sev-dot ${f}`}),e.jsx("strong",{children:p})]}),x&&e.jsx("p",{className:"ip-gap-reason",children:x}),S?S.error?e.jsx("p",{className:"ip-gap-status error",children:"Could not generate fill"}):S.source==="library"?e.jsxs("div",{className:"ip-fill-library",children:[e.jsx("p",{className:"ip-fill-tier-label",children:"📚 Found in course library"}),S.matchedCourses.map(b=>e.jsxs("div",{className:"ip-fill-course-match",children:[e.jsxs("div",{className:"ip-fill-course-info",children:[e.jsx("strong",{children:b.title||b.code}),e.jsxs("span",{className:"ip-fill-sim",children:[Math.round(b.similarity*100),"% match"]})]}),S.addedCode===b.code?e.jsx("span",{className:"ip-gap-status success",children:"✅ Added"}):e.jsx("button",{className:"ip-btn small",onClick:()=>Ie(b,p),children:"➕ Add to Path"})]},b.code))]}):S.source==="bespoke"?e.jsxs("div",{className:"ip-fill-bespoke",children:[e.jsx("p",{className:"ip-fill-tier-label",children:"🎬 Video segments found"}),S.segments.slice(0,3).map((b,R)=>e.jsx("div",{className:"ip-fill-segment-preview",children:e.jsxs("div",{className:"ip-fill-seg-row",children:[e.jsxs("div",{className:"ip-fill-seg-info",children:[e.jsxs("div",{className:"ip-fill-seg-title",style:{display:"flex",alignItems:"center",gap:"6px"},children:[b.type==="transcript"&&"🎥",b.type==="docs"&&"📄",b.type==="epic_learning"&&"🎓",e.jsx("span",{style:{fontWeight:600},children:b.title}),b.type==="transcript"&&b.courseCode&&e.jsx("span",{className:"gap-fill-badge",children:b.courseCode})]}),b.type==="transcript"&&b.videoTitle&&b.videoTitle!==b.title&&e.jsxs("div",{className:"ip-fill-seg-video",style:{fontSize:"0.8rem",color:"var(--fg-muted)",marginTop:"2px"},children:["From: ",e.jsx("em",{children:b.videoTitle})]}),b.type==="transcript"&&b.startTimestamp&&e.jsxs("div",{className:"ip-fill-seg-video",style:{fontSize:"0.75rem",color:"var(--accent-fg)",marginTop:"2px",fontWeight:500},children:["⏱ ",b.startTimestamp,b.endTimestamp?` - ${b.endTimestamp}`:""]}),b.type==="docs"&&b.url&&e.jsx("div",{style:{fontSize:"0.75rem",color:"var(--accent-fg)",marginTop:"2px"},children:e.jsx("a",{href:b.url,target:"_blank",rel:"noreferrer",style:{color:"inherit",textDecoration:"none"},children:"🔗 View Documentation"})}),(b.summary||b.text)&&e.jsx("div",{className:"ip-fill-seg-snippet",style:{fontSize:"0.8rem",color:"var(--fg-muted)",marginTop:"6px",marginBottom:"6px",display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical",overflow:"hidden",fontStyle:b.summary?"normal":"italic",borderLeft:"2px solid var(--border-muted)",paddingLeft:"8px"},children:b.summary||ae(b.text)}),e.jsxs("span",{className:"ip-fill-sim",children:[Math.round(b.similarity*100),"% relevance"]})]}),S.addedSegments?.includes(R)?e.jsx("span",{className:"ip-gap-status success",children:"✅"}):e.jsx("button",{className:"ip-btn small",onClick:()=>Te(b,p,R),children:"➕"})]})},R)),S.bespokeGenerated?e.jsx("span",{className:"ip-gap-status success",children:"✅ Bespoke step added"}):e.jsx("button",{className:"ip-btn small",onClick:()=>_e(S.segments,p),children:"🎬 Generate Bespoke Step"})]}):S.source==="ai"&&S.step?e.jsxs("div",{className:"ip-fill-ai",children:[e.jsx("p",{className:"ip-fill-tier-label",children:"🤖 AI-generated step"}),e.jsxs("p",{className:"ip-gap-status success",children:["✅ ",S.step.segment?.title||"Fill generated"]}),S.step.summary&&e.jsx("p",{className:"ip-fill-ai-summary",children:S.step.summary})]}):e.jsxs("p",{className:"ip-gap-status success",children:["✅ ",S.segment?.title||S.title||"Fill generated"]}):e.jsx("button",{className:"ip-btn small",onClick:()=>ze(p),disabled:!!F,children:F===p?"Searching…":"🔍 Find Courses"})]},r)}),ne.length>0&&e.jsxs("div",{className:"ip-weak-section",children:[e.jsx("h4",{children:"⚠️ Weakly Covered"}),e.jsx("p",{className:"ip-weak-desc",children:"These topics exist in your path but have low pedagogical quality."}),ne.map((s,r)=>e.jsxs("div",{className:"ip-gap-card ip-sev-low ip-weak-card",children:[e.jsxs("div",{className:"ip-gap-header",children:[e.jsx("span",{className:`ip-sev-dot aug-badge aug-${s.augGrade}`,style:{borderRadius:"4px",width:"auto",height:"auto",padding:"1px 5px",fontSize:"10px"},children:s.augGrade}),e.jsx("strong",{children:s.topic})]}),e.jsx("p",{className:"ip-gap-reason",children:s.reason}),e.jsx("button",{className:"ip-btn small aug-action-inline",onClick:()=>{window.open("/Unreal-Learning-Path-Tagging-System/augmentation_viewer.html","_blank")},children:"⚡ View Augmented Guide"})]},`wc-${r}`))]}),ie.length>0&&e.jsxs("div",{className:"ip-suggestions",children:[e.jsx("h4",{children:"💡 Suggestions"}),ie.map((s,r)=>e.jsxs("div",{className:"ip-suggestion",children:[e.jsx("strong",{children:s.topic||s}),s.rationale&&e.jsx("p",{children:s.rationale})]},r))]}),de.length>0&&e.jsxs("div",{className:"ip-assumed",children:[e.jsx("h4",{children:"🎓 Assumed Knowledge"}),e.jsx("p",{children:"Your path assumes learners already know:"}),e.jsx("div",{className:"ip-chip-row",children:de.map((s,r)=>e.jsx("span",{className:"ip-chip",children:s},r))})]})]}):e.jsx("div",{className:"ip-empty",children:e.jsxs("p",{children:["Run analysis on the ",e.jsx("strong",{children:"Coverage"})," tab first to see gaps."]})})}),w==="quiz"&&e.jsxs("div",{className:"ip-tab-pane",children:[e.jsx("p",{className:"ip-tab-desc",children:"Generate study materials and knowledge-checks from your path content."}),e.jsxs("div",{className:"export-section",style:{marginBottom:"16px"},children:[e.jsx("button",{className:"export-action-btn study-btn",onClick:()=>{const s=De(t);Qe(s),H(s)},children:"📄 Generate Study Guide"}),G&&e.jsxs("div",{className:"export-preview study-guide-preview",children:[e.jsx("h4",{children:G.title}),(G.sections||[]).map((s,r)=>e.jsxs("div",{className:"guide-section",children:[e.jsxs("div",{className:"guide-heading",children:[s.bloom&&e.jsxs("span",{className:"bloom-badge-sm",style:{color:s.bloom.color},title:`Bloom's Taxonomy: ${s.bloom.level}`,children:[s.bloom.emoji," ",s.bloom.level]}),e.jsx("strong",{children:s.heading})]}),e.jsx("p",{className:"guide-content",children:s.content})]},r))]})]}),e.jsxs("div",{className:"export-section",style:{marginBottom:"16px"},children:[e.jsx("button",{className:"export-action-btn flashcard-btn",onClick:()=>q(We(t)),children:"🃏 Generate Flashcards"}),c&&e.jsxs("div",{className:"export-preview flashcard-list",children:[e.jsxs("span",{className:"card-count",children:[c.length," cards"]}),c.slice(0,10).map((s,r)=>e.jsxs("div",{className:"flashcard",children:[e.jsxs("div",{className:"fc-front",children:[e.jsx("strong",{children:"Q:"})," ",s.front]}),e.jsxs("div",{className:"fc-back",children:[e.jsx("strong",{children:"A:"})," ",s.back]})]},r)),c.length>10&&e.jsxs("p",{className:"more-items",children:["+",c.length-10," more cards..."]})]})]}),e.jsxs("div",{className:"export-section",children:[e.jsx("h4",{style:{marginBottom:8,fontSize:"0.85rem",color:"var(--fg-muted)"},children:"Path-Specific AI Quiz"}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:8,fontSize:"0.8rem"},children:[e.jsx("label",{htmlFor:"quiz-total-questions",children:"Total questions:"}),e.jsx("input",{id:"quiz-total-questions",type:"number",min:1,max:20,value:L,onChange:s=>v(Math.max(1,Math.min(20,+s.target.value||10))),style:{width:48,textAlign:"center",padding:"2px 4px",borderRadius:4,border:"1px solid var(--border, #30363d)",background:"var(--bg-secondary, #161b22)",color:"inherit"}})]}),e.jsxs("div",{className:"ip-quiz-actions",children:[e.jsx("button",{className:"ip-btn primary",onClick:qe,disabled:T,children:T?e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"ip-spinner"})," Generating…"]}):$?"🔄 Regenerate All":"📝 Generate Quiz"}),$&&$.length>0&&e.jsxs("span",{className:"ip-quiz-count",children:[$.length," questions"]})]}),$&&$.length>0&&e.jsx("div",{className:"ip-quiz-list",children:$.map((s,r)=>{const p=s.question||s.stem||"",f=s.explanation||"",x=s.answer||s.correct||"";let S=[],b="";return Array.isArray(s.options)?(S=s.options,b=x):s.choices&&(S=Object.entries(s.choices).map(([R,se])=>({key:R,val:se})),b=x),e.jsxs("div",{className:"ip-quiz-card",children:[e.jsx("div",{className:"ip-quiz-header",children:e.jsxs("p",{className:"ip-quiz-q",children:[e.jsxs("strong",{children:["Q",r+1,":"]})," ",p]})}),Array.isArray(s.options)?e.jsx("ul",{className:"ip-quiz-opts",children:S.map((R,se)=>e.jsxs("li",{className:R===b?"correct":"",children:[R===b&&e.jsx("span",{className:"ip-quiz-check",children:"✓"}),R]},se))}):S.length>0?e.jsx("ul",{className:"ip-quiz-opts",children:S.map(({key:R,val:se})=>e.jsxs("li",{className:R===b?"correct":"",children:[R===b&&e.jsx("span",{className:"ip-quiz-check",children:"✓"}),e.jsxs("strong",{children:[R,"."]})," ",se]},R))}):null,f&&e.jsxs("div",{className:"ip-quiz-explanation",children:[e.jsx("span",{className:"ip-quiz-explain-icon",children:"💡"}),f]})]},r)})}),$&&$.length===0&&e.jsx("p",{className:"ip-error",children:"Could not generate quiz questions. Try again."})]})]}),w==="review"&&e.jsx("div",{className:"ip-tab-pane",children:E?e.jsx(Fe,{pathResult:E,gaps:j,onFixClick:s=>{if(["has-prerequisites","has-core","has-practice","no-high-gaps","coverage-threshold"].includes(s)){n("gaps"),requestAnimationFrame(()=>{const x=document.querySelector(".ip-tab-pane");x&&(x.scrollTop=0);const S=document.querySelector(".ip-tab.active");S&&(S.style.transition="background 0.3s",S.style.background="rgba(245, 158, 11, 0.25)",setTimeout(()=>{S.style.background=""},800))});return}const p={"step-count":"Remove lower-priority steps from the Assembly Line to reduce step count below 7.","no-long-videos":"Split videos over 6 minutes — shorter segments keep learner engagement high.","has-bridges":"Re-analyze your path on the Coverage tab to generate bridge narrations.","all-verified":"Approve or flag each step in your learning path to complete verification."};s==="has-bridges"?n("coverage"):s==="all-verified"&&n("review");const f=p[s];if(f){const x=document.createElement("div");x.textContent=`💡 ${f}`,Object.assign(x.style,{position:"fixed",bottom:"24px",left:"50%",transform:"translateX(-50%)",background:"#1c2128",color:"#e6edf3",border:"1px solid #d29922",borderRadius:"8px",padding:"12px 20px",fontSize:"0.85rem",maxWidth:"420px",zIndex:9999,boxShadow:"0 8px 24px rgba(0,0,0,0.4)"}),document.body.appendChild(x),setTimeout(()=>{x.style.opacity="0",x.style.transition="opacity 0.3s",setTimeout(()=>x.remove(),300)},4e3)}}}):e.jsxs("div",{className:"ip-empty",children:[e.jsx("span",{className:"ip-empty-icon",children:"✅"}),e.jsx("p",{children:"Add courses and set a goal to enable path review."})]})}),w==="export"&&e.jsx("div",{className:"ip-tab-pane",children:E?e.jsx(pt,{pathResult:E,analysis:j,courses:t,learningIntent:a,studyGuide:G,flashcards:c,exportingScorm:Y,setExportingScorm:N}):e.jsx("div",{className:"ip-empty",children:e.jsx("p",{children:"Add courses and set a goal to enable export."})})})]})]}):e.jsxs("div",{className:"ip-gate",children:[e.jsx("div",{className:"ip-gate-icon",children:"📚"}),e.jsx("h4",{children:"Add Courses"}),e.jsx("p",{children:"Drag courses from the left panel to build your path."})]}):e.jsxs("div",{className:"ip-setup",children:[e.jsxs("div",{className:"ip-setup-header",children:[e.jsx("span",{children:"🎯"}),e.jsx("h4",{children:"Define Your Path"})]}),e.jsxs("div",{className:"ip-field",children:[e.jsx("label",{children:"Primary Goal *"}),e.jsx("input",{type:"text",placeholder:"e.g. Master Lumen Lighting",value:a.primaryGoal||"",onChange:s=>y("primaryGoal",s.target.value)}),u&&e.jsxs("span",{className:"ip-persona-badge",children:["👤 ",u.name]})]}),e.jsxs("div",{className:"ip-field",children:[e.jsx("label",{children:"Skill Level *"}),e.jsxs("select",{value:a.skillLevel||"",onChange:s=>y("skillLevel",s.target.value),children:[e.jsx("option",{value:"",children:"Select Level…"}),e.jsx("option",{value:"Beginner",children:"Beginner (New to topic)"}),e.jsx("option",{value:"Intermediate",children:"Intermediate (Some exp)"}),e.jsx("option",{value:"Advanced",children:"Advanced (Expert)"})]})]}),e.jsxs("div",{className:"ip-field",children:[e.jsx("label",{children:"Time Budget"}),e.jsxs("select",{value:a.timeBudget||"",onChange:s=>y("timeBudget",s.target.value),children:[e.jsx("option",{value:"",children:"Select…"}),e.jsxs("option",{value:"5",children:["~5 Hours",a.skillLevel==="Beginner"?" ★ Recommended":""]}),e.jsxs("option",{value:"10",children:["~10 Hours",a.skillLevel==="Intermediate"?" ★ Recommended":""]}),e.jsxs("option",{value:"15",children:["~15 Hours",a.skillLevel==="Intermediate"?" ★ Max":""]}),e.jsxs("option",{value:"20",children:["~20 Hours",a.skillLevel==="Advanced"?" ★ Recommended":""]}),e.jsxs("option",{value:"25",children:["~25 Hours",a.skillLevel==="Advanced"?" ★ Max":""]}),e.jsx("option",{value:"none",children:"No Limit"})]}),a.skillLevel&&e.jsxs("span",{className:"ip-field-hint",children:[a.skillLevel==="Beginner"&&"📖 Research: ≤5h for beginners",a.skillLevel==="Intermediate"&&"📖 Research: 5–15h for intermediate",a.skillLevel==="Advanced"&&"📖 Research: 10–25h for advanced"]})]}),e.jsxs("div",{className:"ip-field",children:[e.jsx("label",{children:"Industry Focus"}),e.jsxs("div",{className:"ip-industry-chips",children:[e.jsx("button",{type:"button",className:`ip-industry-chip ${a.industries?.length?"":"selected"}`,onClick:()=>y("industries",[]),children:"All"}),he.filter(s=>s!=="All").map(s=>e.jsx("button",{type:"button",className:`ip-industry-chip ${a.industries?.includes(s)?"selected":""}`,onClick:()=>{const r=a.industries||[],p=r.includes(s)?r.filter(f=>f!==s):[...r,s];y("industries",p)},children:s},s))]})]}),e.jsxs("div",{className:"ip-setup-progress",children:[e.jsx("div",{className:"ip-progress-bar",children:e.jsx("div",{className:"ip-progress-fill",style:{width:`${[I,_,Z].filter(Boolean).length/3*100}%`}})}),e.jsxs("span",{children:[[I,_,Z].filter(Boolean).length,"/3 complete"]})]})]})]})}export{Ct as default};
