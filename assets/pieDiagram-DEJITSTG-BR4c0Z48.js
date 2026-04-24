import{g as j,s as H,a as J,b as Q,q as Y,p as tt,_ as o,l as w,c as et,F as at,I as it,K as rt,d as ot,y as st,G as nt}from"./mermaid.core-CZpYdkbu.js";import{p as lt}from"./chunk-4BX2VUAB-DAyAz3OV.js";import{p as ct}from"./wardley-RL74JXVD-hPomxMmq.js";import{d as G,o as pt,a as dt}from"./vendor-charts-BwgkbwHS.js";import"./index-rdkkepkd.js";import"./vendor-cytoscape-DkSHza4h.js";import"./vendor-export-WthTs8Cq.js";import"./vendor-firebase-bQTC33XI.js";import"./data-courses-oma0BiaS.js";import"./index-p2qCMWBM.js";import"./TagGraphService-Bsc0hPPE.js";import"./segmentSearchService-Cd7H8Czw.js";import"./PersonaService-DSiXbI7_.js";import"./tokenTracker-BwJ1LIMb.js";import"./retryWithBackoff-ChyV6NkW.js";import"./feedbackService-C5-Pfk4B.js";import"./cleanVideoTitle-DZxgGY6A.js";import"./createLucideIcon-Cop_VNiI.js";import"./plus-hkzCRlnT.js";import"./x-Xed7i1eR.js";import"./lightbulb-CVFqrRSi.js";import"./docsSearchService-6EQLG29K.js";import"./search-DpDRDR4A.js";import"./circle-x-G0aF4xh-.js";import"./sparkles-B1-FROln.js";import"./SpeakButton-XAuDOjRG.js";import"./semanticSearchService-CcoPCihM.js";import"./min-C-5W9otd.js";import"./_baseUniq-Dgzfhf6s.js";var mt=nt.pie,C={sections:new Map,showData:!1},h=C.sections,D=C.showData,gt=structuredClone(mt),ht=o(()=>structuredClone(gt),"getConfig"),ut=o(()=>{h=new Map,D=C.showData,st()},"clear"),ft=o(({label:t,value:a})=>{if(a<0)throw new Error(`"${t}" has invalid value: ${a}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);h.has(t)||(h.set(t,a),w.debug(`added new section: ${t}, with value: ${a}`))},"addSection"),vt=o(()=>h,"getSections"),xt=o(t=>{D=t},"setShowData"),St=o(()=>D,"getShowData"),M={getConfig:ht,clear:ut,setDiagramTitle:tt,getDiagramTitle:Y,setAccTitle:Q,getAccTitle:J,setAccDescription:H,getAccDescription:j,addSection:ft,getSections:vt,setShowData:xt,getShowData:St},wt=o((t,a)=>{lt(t,a),a.setShowData(t.showData),t.sections.map(a.addSection)},"populateDb"),Ct={parse:o(async t=>{const a=await ct("pie",t);w.debug(a),wt(a,M)},"parse")},Dt=o(t=>`
  .pieCircle{
    stroke: ${t.pieStrokeColor};
    stroke-width : ${t.pieStrokeWidth};
    opacity : ${t.pieOpacity};
  }
  .pieOuterCircle{
    stroke: ${t.pieOuterStrokeColor};
    stroke-width: ${t.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${t.pieTitleTextSize};
    fill: ${t.pieTitleTextColor};
    font-family: ${t.fontFamily};
  }
  .slice {
    font-family: ${t.fontFamily};
    fill: ${t.pieSectionTextColor};
    font-size:${t.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${t.pieLegendTextColor};
    font-family: ${t.fontFamily};
    font-size: ${t.pieLegendTextSize};
  }
`,"getStyles"),yt=Dt,$t=o(t=>{const a=[...t.values()].reduce((r,n)=>r+n,0),y=[...t.entries()].map(([r,n])=>({label:r,value:n})).filter(r=>r.value/a*100>=1);return dt().value(r=>r.value).sort(null)(y)},"createPieArcs"),Tt=o((t,a,y,$)=>{w.debug(`rendering pie chart
`+t);const r=$.db,n=et(),T=at(r.getConfig(),n.pie),A=40,s=18,d=4,c=450,p=c,u=it(a),l=u.append("g");l.attr("transform","translate("+p/2+","+c/2+")");const{themeVariables:i}=n;let[b]=rt(i.pieOuterStrokeWidth);b??=2;const _=T.textPosition,m=Math.min(p,c)/2-A,L=G().innerRadius(0).outerRadius(m),B=G().innerRadius(m*_).outerRadius(m*_);l.append("circle").attr("cx",0).attr("cy",0).attr("r",m+b/2).attr("class","pieOuterCircle");const g=r.getSections(),I=$t(g),O=[i.pie1,i.pie2,i.pie3,i.pie4,i.pie5,i.pie6,i.pie7,i.pie8,i.pie9,i.pie10,i.pie11,i.pie12];let f=0;g.forEach(e=>{f+=e});const E=I.filter(e=>(e.data.value/f*100).toFixed(0)!=="0"),v=pt(O).domain([...g.keys()]);l.selectAll("mySlices").data(E).enter().append("path").attr("d",L).attr("fill",e=>v(e.data.label)).attr("class","pieCircle"),l.selectAll("mySlices").data(E).enter().append("text").text(e=>(e.data.value/f*100).toFixed(0)+"%").attr("transform",e=>"translate("+B.centroid(e)+")").style("text-anchor","middle").attr("class","slice");const P=l.append("text").text(r.getDiagramTitle()).attr("x",0).attr("y",-400/2).attr("class","pieTitleText"),k=[...g.entries()].map(([e,S])=>({label:e,value:S})),x=l.selectAll(".legend").data(k).enter().append("g").attr("class","legend").attr("transform",(e,S)=>{const z=s+d,V=z*k.length/2,X=12*s,Z=S*z-V;return"translate("+X+","+Z+")"});x.append("rect").attr("width",s).attr("height",s).style("fill",e=>v(e.label)).style("stroke",e=>v(e.label)),x.append("text").attr("x",s+d).attr("y",s-d).text(e=>r.getShowData()?`${e.label} [${e.value}]`:e.label);const N=Math.max(...x.selectAll("text").nodes().map(e=>e?.getBoundingClientRect().width??0)),U=p+A+s+d+N,R=P.node()?.getBoundingClientRect().width??0,q=p/2-R/2,K=p/2+R/2,F=Math.min(0,q),W=Math.max(U,K)-F;u.attr("viewBox",`${F} 0 ${W} ${c}`),ot(u,c,W,T.useMaxWidth)},"draw"),At={draw:Tt},ie={parser:Ct,db:M,renderer:At,styles:yt};export{ie as diagram};
