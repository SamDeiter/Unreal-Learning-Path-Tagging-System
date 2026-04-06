const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/v3Adapter-BF_N5Oc1.js","assets/LearningPathV2-BjWiy-nx.js"])))=>i.map(i=>d[i]);
import{d as v,_ as M}from"./index-WxNexZng.js";import{J as y}from"./vendor-export-Cccetl6i.js";import{c as k}from"./cleanVideoTitle-DZxgGY6A.js";import{c as T}from"./cleanTranscriptText-C3y4KawF.js";import{g as A}from"./topicNameService-CvghqRQy.js";function S(e){if(!e||typeof e!="string")return e;let t=e;return t=t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),t=t.replace(/^### (.+)$/gm,'<h3 style="color: var(--accent-orange, #d29922); font-size: 1rem; margin: 16px 0 8px;">$1</h3>'),t=t.replace(/^## (.+)$/gm,'<h2 style="color: var(--accent-green, #3fb950); font-size: 1.1rem; margin: 20px 0 10px;">$1</h2>'),t=t.replace(/^# (.+)$/gm,'<h1 style="color: var(--accent, #58a6ff); font-size: 1.3rem; margin: 24px 0 12px;">$1</h1>'),t=t.replace(/\*\*\*(.+?)\*\*\*/g,"<strong><em>$1</em></strong>"),t=t.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>"),t=t.replace(/\*(.+?)\*/g,"<em>$1</em>"),t=t.replace(/`([^`]+)`/g,'<code style="background: rgba(88,166,255,0.1); padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 0.85em;">$1</code>'),t=t.replace(/^- (.+)$/gm,'<li style="margin: 4px 0; margin-left: 20px;">$1</li>'),t=t.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g,'<ul style="list-style: disc; padding-left: 20px; margin: 8px 0;">$1</ul>'),t=t.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer" style="color: var(--accent, #58a6ff);">$1</a>'),t=t.replace(/\n\n/g,'</p><p style="margin-bottom: 12px; color: var(--text-secondary, #8b949e);">'),t=t.replace(/\n/g,"<br>"),t}const C=`
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
`,z=`
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
`;function x(e){return e.replace(/[^a-zA-Z0-9_-]/g,"_").substring(0,50)}function $(e){return(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;")}function l(e){return(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function E(e){const t=e.toLowerCase();return t.includes("foundation")?"cat-foundation":t.includes("fix")||t.includes("core")?"cat-fix":t.includes("transfer")||t.includes("practice")?"cat-transfer":""}function O(e,t,a,p,s){const i=A(e)||k(e.segment?.title||e.title||`Step ${t+1}`),r=e.summary||e.segment?.text||e.segment?.summary||"",n=T(r),o=e.category||"core",d=E(o),c=e.segment?.source||e.segment?.type||"",h=t>0?`<a class="nav-link" href="sco_${t-1}.html">← Previous</a>`:"<span></span>",u=t<a-1?`<a class="nav-link" href="sco_${t+1}.html">Next →</a>`:"<span></span>",g=p?.text?`<div class="bridge-box"><strong>Connection:</strong> ${l(p.text)}</div>`:"";return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${l(i)}</title>
  <link rel="stylesheet" href="shared/style.css">
  <script src="shared/scormapi.js"><\/script>
</head>
<body>
  <p style="font-size:0.8rem;color:var(--text-secondary)">
    ${l(s)} — Step ${t+1} of ${a}
  </p>
  <h1>${l(i)}</h1>
  <div class="step-card">
    <div class="step-meta">
      <span class="category-badge ${d}">${l(o)}</span>
      ${c?`<span>Source: ${l(c)}</span>`:""}
    </div>
    <div class="step-summary">${S(n)}</div>
  </div>
  ${g}
  <button class="complete-btn" id="mark-complete" onclick="this.disabled=true;this.textContent='✅ Completed';completeSCORM();">
    Mark Step Complete
  </button>
  <div class="nav-row">
    ${h}
    ${u}
  </div>
</body>
</html>`}function I(e,t){const a=[];for(const r of e)if(r.quiz?.questions?.length)for(const n of r.quiz.questions)n.text&&n.options?.length>=2&&a.push({text:n.text,options:n.options,correctIndex:n.correctIndex??0,explanation:n.explanation||""});if(a.length===0)for(let r=0;r<Math.min(e.length,10);r++){const n=e[r],o=k(n.segment?.title||n.title||`Step ${r+1}`);a.push({text:`What is the main topic covered in "${o}"?`,options:[o,"Unrelated Topic A","Unrelated Topic B","Unrelated Topic C"],correctIndex:0,explanation:""})}const p=a.map((r,n)=>{const o=r.options.map((d,c)=>`<label><input type="radio" name="q${n}" value="${c}"> ${l(d)}</label>`).join(`
      `);return`
    <div class="quiz-q">
      <p><strong>Q${n+1}:</strong> ${l(r.text)}</p>
      ${o}
    </div>`}).join(`
`),s=a.map(r=>r.correctIndex??0),i=a.map(r=>r.explanation||"");return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Knowledge Check</title>
  <link rel="stylesheet" href="shared/style.css">
  <script src="shared/scormapi.js"><\/script>
  <style>
    .quiz-feedback { margin-top: 8px; padding: 8px 12px; border-radius: 6px; font-size: 0.9rem; }
    .quiz-feedback.correct { background: rgba(63,185,80,0.12); color: #3fb950; }
    .quiz-feedback.incorrect { background: rgba(248,81,73,0.12); color: #f85149; }
  </style>
</head>
<body>
  <h1>Knowledge Check</h1>
  <p>Review your understanding of the concepts from "${l(t)}".</p>
  <form id="quiz-form">
    ${p}
    <button type="submit" class="complete-btn">Submit Answers</button>
  </form>
  <div id="result" style="display:none;text-align:center;margin-top:24px;"></div>
  <script>
    var correctAnswers = ${JSON.stringify(s)};
    var explanations = ${JSON.stringify(i)};
    document.getElementById('quiz-form').addEventListener('submit', function(e) {
      e.preventDefault();
      var total = ${a.length};
      var correct = 0;
      for (var i = 0; i < total; i++) {
        var sel = document.querySelector('input[name="q' + i + '"]:checked');
        var isCorrect = sel && parseInt(sel.value) === correctAnswers[i];
        if (isCorrect) correct++;
        // Show per-question feedback
        var qDiv = document.querySelectorAll('.quiz-q')[i];
        var existing = qDiv.querySelector('.quiz-feedback');
        if (existing) existing.remove();
        var fb = document.createElement('div');
        fb.className = 'quiz-feedback ' + (isCorrect ? 'correct' : 'incorrect');
        fb.textContent = isCorrect ? '✅ Correct!' : '❌ Incorrect.';
        if (explanations[i]) fb.textContent += ' ' + explanations[i];
        qDiv.appendChild(fb);
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
</html>`}function q(e,t,a){const p="ORG-001",s="MANIFEST-UE5-"+Date.now(),i=t.map((d,c)=>`
    <resource identifier="RES-${c}" type="webcontent" adlcp:scormtype="sco" href="${d}">
      <file href="${d}"/>
      <file href="shared/scormapi.js"/>
      <file href="shared/style.css"/>
    </resource>`).join(`
`),r=a?`
    <resource identifier="RES-QUIZ" type="webcontent" adlcp:scormtype="sco" href="quiz.html">
      <file href="quiz.html"/>
      <file href="shared/scormapi.js"/>
      <file href="shared/style.css"/>
    </resource>`:"",n=t.map((d,c)=>`
      <item identifier="ITEM-${c}" identifierref="RES-${c}">
        <title>${$(`Step ${c+1}`)}</title>
      </item>`).join(`
`),o=a?`
      <item identifier="ITEM-QUIZ" identifierref="RES-QUIZ">
        <title>Knowledge Check</title>
      </item>`:"";return`<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${s}"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                       http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="${p}">
    <organization identifier="${p}">
      <title>${$(e)}</title>
      ${n}
      ${o}
    </organization>
  </organizations>
  <resources>
    ${i}
    ${r}
  </resources>
</manifest>`}async function U(e,t={}){const{includeQuiz:a=!0}=t;if(e?.v2Path)return P(e.v2Path,{includeQuiz:a,query:e.query});if(!e?.path?.length)throw new Error("Cannot export empty path");const p=e.query?`UE5 Learning Path: ${e.query.substring(0,60)}`:"UE5 Learning Path",s=new y;s.file("shared/scormapi.js",C),s.file("shared/style.css",z);const i=[];e.path.forEach((d,c)=>{const h=`sco_${c}.html`,u=e.bridges?.[c]||null,g=O(d,c,e.path.length,u,p);s.file(h,g),i.push(h)}),a&&e.path.length>=2&&s.file("quiz.html",I(e.path,p)),s.file("imsmanifest.xml",q(p,i,a&&e.path.length>=2));const r=await s.generateAsync({type:"blob"}),n=`scorm_${x(e.query||"path")}_${Date.now()}.zip`,o=document.createElement("a");o.href=URL.createObjectURL(r),o.download=n,document.body.appendChild(o),o.click(),document.body.removeChild(o),URL.revokeObjectURL(o.href),v(`[SCORM] Package downloaded: ${n} (${i.length} SCOs)`)}function j(e,t,a,p,s){const i=e.title||`Step ${t+1}`,r=e.completionType||"watch",n={watch:"📺 Watch",do:"🔧 Do",apply:"🎯 Apply",check:"✅ Check"}[r]||"✅ Complete";let o="";if(e.whyThisMatters&&(o+=`<div class="v2-section v2-why"><h3>💡 Why This Matters</h3><p>${l(e.whyThisMatters)}</p></div>`),e.whatToDo?.length){const h=e.whatToDo.map(u=>`<li>${l(u)}</li>`).join("");o+=`<div class="v2-section v2-do"><h3>🔧 What To Do</h3><ol>${h}</ol></div>`}e.howToVerify&&(o+=`<div class="v2-section v2-verify"><h3>✅ How To Verify</h3><p>${l(e.howToVerify)}</p></div>`),e.commonMistake&&(o+=`<div class="v2-section v2-mistake"><h3>⚠️ Common Mistake</h3><p>${l(e.commonMistake)}</p></div>`),e.takeaway&&(o+=`<div class="v2-section v2-takeaway"><h3>🎯 Key Takeaway</h3><p>${l(e.takeaway)}</p></div>`),!o&&e.summary&&(o=`<div class="step-summary">${S(e.summary)}</div>`);const d=t>0?`<a class="nav-link" href="sco_${t-1}.html">← Previous</a>`:"<span></span>",c=t<a-1?`<a class="nav-link" href="sco_${t+1}.html">Next →</a>`:"<span></span>";return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${l(i)}</title>
  <link rel="stylesheet" href="shared/style.css">
  <script src="shared/scormapi.js"><\/script>
</head>
<body>
  <p style="font-size:0.8rem;color:var(--text-secondary)">
    ${l(s)} — ${l(p)} — Step ${t+1} of ${a}
  </p>
  <h1>${l(i)}</h1>
  <div class="step-meta">
    <span class="category-badge cat-${l(r)}">${n}</span>
  </div>
  ${o}
  <button class="complete-btn" id="mark-complete" onclick="this.disabled=true;this.textContent='✅ Completed';completeSCORM();">
    Mark Step Complete
  </button>
  <div class="nav-row">
    ${d}
    ${c}
  </div>
</body>
</html>`}function V(e,t,a,p){const s=e.title||e.phase||`Section ${t+1}`,i=e.purpose||"",r=e.steps?.length||0;return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${l(s)}</title>
  <link rel="stylesheet" href="shared/style.css">
  <script src="shared/scormapi.js"><\/script>
</head>
<body>
  <p style="font-size:0.8rem;color:var(--text-secondary)">
    ${l(p)} — Section ${t+1} of ${a}
  </p>
  <h1>${l(s)}</h1>
  ${i?`<p style="font-size:1.05rem;color:var(--text);margin:16px 0;">${l(i)}</p>`:""}
  <div class="step-card">
    <p>This section contains <strong>${r}</strong> step${r!==1?"s":""}.</p>
    <p>Click "Continue" to begin.</p>
  </div>
  <button class="complete-btn" onclick="this.disabled=true;this.textContent='✅ Ready';completeSCORM();">
    Continue →
  </button>
</body>
</html>`}const R=`
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
`;async function P(e,t={}){const{includeQuiz:a=!0,query:p=""}=t;if(!e?.sections?.length)throw new Error("Cannot export empty V2 path");const s=e.title||(p?`UE5 Learning Path: ${p.substring(0,60)}`:"UE5 Learning Path"),i=new y;i.file("shared/scormapi.js",C),i.file("shared/style.css",z+R);const r=[];let n=0;const o=e.sections.length,d=e.sections.reduce((m,f)=>m+(f.steps?.length||0),0)+o;e.sections.forEach((m,f)=>{const b=`sco_${n}.html`;i.file(b,V(m,f,o,s)),r.push(b),n++,(m.steps||[]).forEach(_=>{const w=`sco_${n}.html`,L=m.title||m.phase||"";i.file(w,j(_,n,d,L,s)),r.push(w),n++})});const c=e.sections.flatMap(m=>m.steps||[]);a&&c.length>=2&&i.file("quiz.html",I(c,s)),i.file("imsmanifest.xml",q(s,r,a&&c.length>=2));const h=await i.generateAsync({type:"blob"}),u=`scorm_v2_${x(p||e.title||"path")}_${Date.now()}.zip`,g=document.createElement("a");g.href=URL.createObjectURL(h),g.download=u,document.body.appendChild(g),g.click(),document.body.removeChild(g),URL.revokeObjectURL(g.href),v(`[SCORM V2] Package downloaded: ${u} (${r.length} SCOs)`)}async function D(e,{quizzes:t={}}={}){const{convertV2ToV3Package:a,renderV3DataFile:p}=await M(async()=>{const{convertV2ToV3Package:f,renderV3DataFile:b}=await import("./v3Adapter-BF_N5Oc1.js");return{convertV2ToV3Package:f,renderV3DataFile:b}},__vite__mapDeps([0,1])),s=a(e,{quizzes:t}),i=p(s),r="/Unreal-Learning-Path-Tagging-System/viewer-v3/";let n,o,d;try{[n,o,d]=await Promise.all([fetch(`${r}index.html`).then(f=>f.text()),fetch(`${r}styles.css`).then(f=>f.text()),fetch(`${r}viewer.js`).then(f=>f.text())])}catch(f){throw v("[V3 Export] Failed to fetch viewer assets:",f.message),new Error("V3 viewer assets not found. Ensure viewer-v3/ is in public/.")}const c=new y;c.file("index.html",n),c.file("styles.css",o),c.file("viewer.js",d),c.file("data.js",i);const h=await c.generateAsync({type:"blob"}),u=e.title||e.query||"course",g=`v3_viewer_${x(u)}_${Date.now()}.zip`,m=document.createElement("a");m.href=URL.createObjectURL(h),m.download=g,document.body.appendChild(m),m.click(),document.body.removeChild(m),URL.revokeObjectURL(m.href)}typeof window<"u"&&(window.__exportV3Package=D);const W=Object.freeze(Object.defineProperty({__proto__:null,exportScormPackage:U,exportV2ScormPackage:P},Symbol.toStringTag,{value:"Module"}));export{U as e,S as m,W as s};
