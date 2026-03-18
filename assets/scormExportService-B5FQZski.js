import{t as P,v as L}from"./vendor-firebase-CCJ1U6o_.js";import{c as E,d as f,e as _}from"./index-5zmNsc6F.js";import{r as U}from"./tokenTracker-BOW1dzot.js";import{J as $}from"./vendor-export-Cccetl6i.js";import{c as S}from"./cleanVideoTitle-DZxgGY6A.js";import{c as O}from"./gapFill-B3nBsd28.js";import{g as j}from"./topicNameService-CvghqRQy.js";async function D(e,t,a=3){if(!e?.segment?.text&&!e?.summary)return[];const s=(e.summary||e.segment?.text||"").slice(0,1500);try{const r=E(),o=P(r,"us-central1"),i=await L(o,"generateAudioBriefing")({mode:"quiz",query:t,stepContent:s,stepCategory:e.category||"learning",quizCount:a});return i.data?.questions&&Array.isArray(i.data.questions)?(f(`[Quiz] Generated ${i.data.questions.length} questions for ${e.category} step`),U("quizGeneration",Math.ceil(s.length/4),Math.ceil(JSON.stringify(i.data.questions).length/4)),i.data.questions):x(e)}catch(r){return _("[Quiz] AI quiz generation failed:",r.message),x(e)}}async function Y(e,t,a=5){if(!e||e.length===0||a<=0)return new Map;const s=Math.floor(a/e.length);let r=a%e.length;const o=await Promise.allSettled(e.map(i=>{let n=s;return r>0&&(n++,r--),n===0?Promise.resolve([]):D(i,t,n)})),c=new Map;return o.forEach((i,n)=>{i.status==="fulfilled"&&i.value.length>0&&c.set(n,i.value)}),f(`[Quiz] Generated quizzes for ${c.size}/${e.length} steps`),c}function ee(e,t){return{isCorrect:t===e.correct,correctAnswer:e.correct,explanation:e.explanation||""}}function x(e){const t={foundation:{stem:"Based on the content you just read, what is the fundamental concept being explained?",choices:{A:"A performance optimization technique",B:"A core architectural pattern in UE5",C:"A debugging methodology",D:"A deployment configuration"},correct:"B",explanation:"Foundation content typically covers core architectural patterns and concepts."},diagnosis:{stem:"What is the key indicator that helps identify this type of problem?",choices:{A:"Compile-time errors in the build log",B:"Visual artifacts or unexpected behavior at runtime",C:"Missing asset references in the content browser",D:"Network timeout errors in the output log"},correct:"B",explanation:"Diagnosis content focuses on identifying symptoms and root causes at runtime."},fix:{stem:"What is the recommended first step when applying this fix?",choices:{A:"Restart the editor immediately",B:"Back up the project and verify the issue is reproducible",C:"Delete all derived data caches",D:"Update to the latest engine version"},correct:"B",explanation:"Always back up and verify reproducibility before applying fixes."},transfer:{stem:"How can this knowledge be applied to other areas of UE5 development?",choices:{A:"It only applies to this specific use case",B:"The underlying pattern is reusable across similar systems",C:"It requires a completely different approach in other contexts",D:"It's only relevant for legacy projects"},correct:"B",explanation:"Transfer knowledge emphasizes reusable patterns across different contexts."}};return[t[e.category]||t.foundation]}function k(e){if(!e||typeof e!="string")return e;let t=e;return t=t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),t=t.replace(/^### (.+)$/gm,'<h3 style="color: var(--accent-orange, #d29922); font-size: 1rem; margin: 16px 0 8px;">$1</h3>'),t=t.replace(/^## (.+)$/gm,'<h2 style="color: var(--accent-green, #3fb950); font-size: 1.1rem; margin: 20px 0 10px;">$1</h2>'),t=t.replace(/^# (.+)$/gm,'<h1 style="color: var(--accent, #58a6ff); font-size: 1.3rem; margin: 24px 0 12px;">$1</h1>'),t=t.replace(/\*\*\*(.+?)\*\*\*/g,"<strong><em>$1</em></strong>"),t=t.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>"),t=t.replace(/\*(.+?)\*/g,"<em>$1</em>"),t=t.replace(/`([^`]+)`/g,'<code style="background: rgba(88,166,255,0.1); padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 0.85em;">$1</code>'),t=t.replace(/^- (.+)$/gm,'<li style="margin: 4px 0; margin-left: 20px;">$1</li>'),t=t.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g,'<ul style="list-style: disc; padding-left: 20px; margin: 8px 0;">$1</ul>'),t=t.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer" style="color: var(--accent, #58a6ff);">$1</a>'),t=t.replace(/\n\n/g,'</p><p style="margin-bottom: 12px; color: var(--text-secondary, #8b949e);">'),t=t.replace(/\n/g,"<br>"),t}const C=`
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
`;function A(e){return e.replace(/[^a-zA-Z0-9_-]/g,"_").substring(0,50)}function w(e){return(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;")}function l(e){return(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function R(e){const t=e.toLowerCase();return t.includes("foundation")?"cat-foundation":t.includes("fix")||t.includes("core")?"cat-fix":t.includes("transfer")||t.includes("practice")?"cat-transfer":""}function F(e,t,a,s,r){const o=j(e)||S(e.segment?.title||e.title||`Step ${t+1}`),c=e.summary||e.segment?.text||e.segment?.summary||"",i=O(c),n=e.category||"core",d=R(n),p=e.segment?.source||e.segment?.type||"",h=t>0?`<a class="nav-link" href="sco_${t-1}.html">← Previous</a>`:"<span></span>",u=t<a-1?`<a class="nav-link" href="sco_${t+1}.html">Next →</a>`:"<span></span>",m=s?.text?`<div class="bridge-box"><strong>Connection:</strong> ${l(s.text)}</div>`:"";return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${l(o)}</title>
  <link rel="stylesheet" href="shared/style.css">
  <script src="shared/scormapi.js"><\/script>
</head>
<body>
  <p style="font-size:0.8rem;color:var(--text-secondary)">
    ${l(r)} — Step ${t+1} of ${a}
  </p>
  <h1>${l(o)}</h1>
  <div class="step-card">
    <div class="step-meta">
      <span class="category-badge ${d}">${l(n)}</span>
      ${p?`<span>Source: ${l(p)}</span>`:""}
    </div>
    <div class="step-summary">${k(i)}</div>
  </div>
  ${m}
  <button class="complete-btn" id="mark-complete" onclick="this.disabled=true;this.textContent='✅ Completed';completeSCORM();">
    Mark Step Complete
  </button>
  <div class="nav-row">
    ${h}
    ${u}
  </div>
</body>
</html>`}function q(e,t){const a=e.slice(0,10).map((r,o)=>{const c=S(r.segment?.title||r.title||`Step ${o+1}`);return{question:`What is the main topic covered in "${c}"?`,stepTitle:c}}),s=a.map((r,o)=>`
    <div class="quiz-q">
      <p><strong>Q${o+1}:</strong> ${l(r.question)}</p>
      <label><input type="radio" name="q${o}" value="correct"> ${l(r.stepTitle)}</label>
      <label><input type="radio" name="q${o}" value="wrong1"> Unrelated Topic A</label>
      <label><input type="radio" name="q${o}" value="wrong2"> Unrelated Topic B</label>
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
  <p>Review your understanding of the concepts from "${l(t)}".</p>
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
</html>`}function M(e,t,a){const s="ORG-001",r="MANIFEST-UE5-"+Date.now(),o=t.map((d,p)=>`
    <resource identifier="RES-${p}" type="webcontent" adlcp:scormtype="sco" href="${d}">
      <file href="${d}"/>
      <file href="shared/scormapi.js"/>
      <file href="shared/style.css"/>
    </resource>`).join(`
`),c=a?`
    <resource identifier="RES-QUIZ" type="webcontent" adlcp:scormtype="sco" href="quiz.html">
      <file href="quiz.html"/>
      <file href="shared/scormapi.js"/>
      <file href="shared/style.css"/>
    </resource>`:"",i=t.map((d,p)=>`
      <item identifier="ITEM-${p}" identifierref="RES-${p}">
        <title>${w(`Step ${p+1}`)}</title>
      </item>`).join(`
`),n=a?`
      <item identifier="ITEM-QUIZ" identifierref="RES-QUIZ">
        <title>Knowledge Check</title>
      </item>`:"";return`<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${r}"
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
      <title>${w(e)}</title>
      ${i}
      ${n}
    </organization>
  </organizations>
  <resources>
    ${o}
    ${c}
  </resources>
</manifest>`}async function te(e,t={}){const{includeQuiz:a=!0}=t;if(e?.v2Path)return Q(e.v2Path,{includeQuiz:a,query:e.query});if(!e?.path?.length)throw new Error("Cannot export empty path");const s=e.query?`UE5 Learning Path: ${e.query.substring(0,60)}`:"UE5 Learning Path",r=new $;r.file("shared/scormapi.js",C),r.file("shared/style.css",z);const o=[];e.path.forEach((d,p)=>{const h=`sco_${p}.html`,u=e.bridges?.[p]||null,m=F(d,p,e.path.length,u,s);r.file(h,m),o.push(h)}),a&&e.path.length>=2&&r.file("quiz.html",q(e.path,s)),r.file("imsmanifest.xml",M(s,o,a&&e.path.length>=2));const c=await r.generateAsync({type:"blob"}),i=`scorm_${A(e.query||"path")}_${Date.now()}.zip`,n=document.createElement("a");n.href=URL.createObjectURL(c),n.download=i,document.body.appendChild(n),n.click(),document.body.removeChild(n),URL.revokeObjectURL(n.href),f(`[SCORM] Package downloaded: ${i} (${o.length} SCOs)`)}function V(e,t,a,s,r){const o=e.title||`Step ${t+1}`,c=e.completionType||"watch",i={watch:"📺 Watch",do:"🔧 Do",apply:"🎯 Apply",check:"✅ Check"}[c]||"✅ Complete";let n="";if(e.whyThisMatters&&(n+=`<div class="v2-section v2-why"><h3>💡 Why This Matters</h3><p>${l(e.whyThisMatters)}</p></div>`),e.whatToDo?.length){const h=e.whatToDo.map(u=>`<li>${l(u)}</li>`).join("");n+=`<div class="v2-section v2-do"><h3>🔧 What To Do</h3><ol>${h}</ol></div>`}e.howToVerify&&(n+=`<div class="v2-section v2-verify"><h3>✅ How To Verify</h3><p>${l(e.howToVerify)}</p></div>`),e.commonMistake&&(n+=`<div class="v2-section v2-mistake"><h3>⚠️ Common Mistake</h3><p>${l(e.commonMistake)}</p></div>`),e.takeaway&&(n+=`<div class="v2-section v2-takeaway"><h3>🎯 Key Takeaway</h3><p>${l(e.takeaway)}</p></div>`),!n&&e.summary&&(n=`<div class="step-summary">${k(e.summary)}</div>`);const d=t>0?`<a class="nav-link" href="sco_${t-1}.html">← Previous</a>`:"<span></span>",p=t<a-1?`<a class="nav-link" href="sco_${t+1}.html">Next →</a>`:"<span></span>";return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${l(o)}</title>
  <link rel="stylesheet" href="shared/style.css">
  <script src="shared/scormapi.js"><\/script>
</head>
<body>
  <p style="font-size:0.8rem;color:var(--text-secondary)">
    ${l(r)} — ${l(s)} — Step ${t+1} of ${a}
  </p>
  <h1>${l(o)}</h1>
  <div class="step-meta">
    <span class="category-badge cat-${l(c)}">${i}</span>
  </div>
  ${n}
  <button class="complete-btn" id="mark-complete" onclick="this.disabled=true;this.textContent='✅ Completed';completeSCORM();">
    Mark Step Complete
  </button>
  <div class="nav-row">
    ${d}
    ${p}
  </div>
</body>
</html>`}function B(e,t,a,s){const r=e.title||e.phase||`Section ${t+1}`,o=e.purpose||"",c=e.steps?.length||0;return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${l(r)}</title>
  <link rel="stylesheet" href="shared/style.css">
  <script src="shared/scormapi.js"><\/script>
</head>
<body>
  <p style="font-size:0.8rem;color:var(--text-secondary)">
    ${l(s)} — Section ${t+1} of ${a}
  </p>
  <h1>${l(r)}</h1>
  ${o?`<p style="font-size:1.05rem;color:var(--text);margin:16px 0;">${l(o)}</p>`:""}
  <div class="step-card">
    <p>This section contains <strong>${c}</strong> step${c!==1?"s":""}.</p>
    <p>Click "Continue" to begin.</p>
  </div>
  <button class="complete-btn" onclick="this.disabled=true;this.textContent='✅ Ready';completeSCORM();">
    Continue →
  </button>
</body>
</html>`}const H=`
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
`;async function Q(e,t={}){const{includeQuiz:a=!0,query:s=""}=t;if(!e?.sections?.length)throw new Error("Cannot export empty V2 path");const r=e.title||(s?`UE5 Learning Path: ${s.substring(0,60)}`:"UE5 Learning Path"),o=new $;o.file("shared/scormapi.js",C),o.file("shared/style.css",z+H);const c=[];let i=0;const n=e.sections.length,d=e.sections.reduce((g,y)=>g+(y.steps?.length||0),0)+n;e.sections.forEach((g,y)=>{const b=`sco_${i}.html`;o.file(b,B(g,y,n,r)),c.push(b),i++,(g.steps||[]).forEach(I=>{const v=`sco_${i}.html`,T=g.title||g.phase||"";o.file(v,V(I,i,d,T,r)),c.push(v),i++})});const p=e.sections.flatMap(g=>g.steps||[]);a&&p.length>=2&&o.file("quiz.html",q(p,r)),o.file("imsmanifest.xml",M(r,c,a&&p.length>=2));const h=await o.generateAsync({type:"blob"}),u=`scorm_v2_${A(s||e.title||"path")}_${Date.now()}.zip`,m=document.createElement("a");m.href=URL.createObjectURL(h),m.download=u,document.body.appendChild(m),m.click(),document.body.removeChild(m),URL.revokeObjectURL(m.href),f(`[SCORM V2] Package downloaded: ${u} (${c.length} SCOs)`)}export{D as a,te as e,Y as g,k as m,ee as s};
