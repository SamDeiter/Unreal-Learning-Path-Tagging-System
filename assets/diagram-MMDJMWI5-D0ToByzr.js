import{s as k,g as I,q as R,p as F,a as _,b as D,_ as l,I as E,y as G,F as f,G as z,D as C,l as P,L as W,d as B}from"./mermaid.core-C5_QcRZ4.js";import{p as V}from"./chunk-4BX2VUAB-D9R9v7lv.js";import{p as H}from"./wardley-RL74JXVD-DrDvNi6K.js";import"./index-BxfGu0zv.js";import"./vendor-cytoscape-DkSHza4h.js";import"./vendor-export-WthTs8Cq.js";import"./vendor-firebase-bQTC33XI.js";import"./data-courses-oma0BiaS.js";import"./index-XCowZZRY.js";import"./TagGraphService-Bsc0hPPE.js";import"./segmentSearchService-ayFVPvZv.js";import"./PersonaService-DSiXbI7_.js";import"./tokenTracker-CeusxfAh.js";import"./retryWithBackoff-ChyV6NkW.js";import"./feedbackService-BxrNXj_C.js";import"./cleanVideoTitle-DZxgGY6A.js";import"./createLucideIcon-Cop_VNiI.js";import"./plus-hkzCRlnT.js";import"./x-Xed7i1eR.js";import"./lightbulb-CVFqrRSi.js";import"./docsSearchService-DGItxPUc.js";import"./search-DpDRDR4A.js";import"./circle-x-G0aF4xh-.js";import"./sparkles-B1-FROln.js";import"./SpeakButton-D0vD292t.js";import"./semanticSearchService-o3Av3ajg.js";import"./vendor-charts-BwgkbwHS.js";import"./min-FyyZf0Yf.js";import"./_baseUniq-DJos7NP2.js";var x={showLegend:!0,ticks:5,max:null,min:0,graticule:"circle"},w={axes:[],curves:[],options:x},g=structuredClone(w),j=z.radar,q=l(()=>f({...j,...C().radar}),"getConfig"),b=l(()=>g.axes,"getAxes"),N=l(()=>g.curves,"getCurves"),U=l(()=>g.options,"getOptions"),X=l(a=>{g.axes=a.map(t=>({name:t.name,label:t.label??t.name}))},"setAxes"),Y=l(a=>{g.curves=a.map(t=>({name:t.name,label:t.label??t.name,entries:Z(t.entries)}))},"setCurves"),Z=l(a=>{if(a[0].axis==null)return a.map(e=>e.value);const t=b();if(t.length===0)throw new Error("Axes must be populated before curves for reference entries");return t.map(e=>{const r=a.find(s=>s.axis?.$refText===e.name);if(r===void 0)throw new Error("Missing entry for axis "+e.label);return r.value})},"computeCurveEntries"),J=l(a=>{const t=a.reduce((e,r)=>(e[r.name]=r,e),{});g.options={showLegend:t.showLegend?.value??x.showLegend,ticks:t.ticks?.value??x.ticks,max:t.max?.value??x.max,min:t.min?.value??x.min,graticule:t.graticule?.value??x.graticule}},"setOptions"),K=l(()=>{G(),g=structuredClone(w)},"clear"),$={getAxes:b,getCurves:N,getOptions:U,setAxes:X,setCurves:Y,setOptions:J,getConfig:q,clear:K,setAccTitle:D,getAccTitle:_,setDiagramTitle:F,getDiagramTitle:R,getAccDescription:I,setAccDescription:k},Q=l(a=>{V(a,$);const{axes:t,curves:e,options:r}=a;$.setAxes(t),$.setCurves(e),$.setOptions(r)},"populate"),tt={parse:l(async a=>{const t=await H("radar",a);P.debug(t),Q(t)},"parse")},et=l((a,t,e,r)=>{const s=r.db,o=s.getAxes(),i=s.getCurves(),n=s.getOptions(),c=s.getConfig(),p=s.getDiagramTitle(),m=E(t),d=at(m,c),u=n.max??Math.max(...i.map(y=>Math.max(...y.entries))),h=n.min,v=Math.min(c.width,c.height)/2;rt(d,o,v,n.ticks,n.graticule),st(d,o,v,c),M(d,o,i,h,u,n.graticule,c),T(d,i,n.showLegend,c),d.append("text").attr("class","radarTitle").text(p).attr("x",0).attr("y",-c.height/2-c.marginTop)},"draw"),at=l((a,t)=>{const e=t.width+t.marginLeft+t.marginRight,r=t.height+t.marginTop+t.marginBottom,s={x:t.marginLeft+t.width/2,y:t.marginTop+t.height/2};return B(a,r,e,t.useMaxWidth??!0),a.attr("viewBox",`0 0 ${e} ${r}`),a.append("g").attr("transform",`translate(${s.x}, ${s.y})`)},"drawFrame"),rt=l((a,t,e,r,s)=>{if(s==="circle")for(let o=0;o<r;o++){const i=e*(o+1)/r;a.append("circle").attr("r",i).attr("class","radarGraticule")}else if(s==="polygon"){const o=t.length;for(let i=0;i<r;i++){const n=e*(i+1)/r,c=t.map((p,m)=>{const d=2*m*Math.PI/o-Math.PI/2,u=n*Math.cos(d),h=n*Math.sin(d);return`${u},${h}`}).join(" ");a.append("polygon").attr("points",c).attr("class","radarGraticule")}}},"drawGraticule"),st=l((a,t,e,r)=>{const s=t.length;for(let o=0;o<s;o++){const i=t[o].label,n=2*o*Math.PI/s-Math.PI/2;a.append("line").attr("x1",0).attr("y1",0).attr("x2",e*r.axisScaleFactor*Math.cos(n)).attr("y2",e*r.axisScaleFactor*Math.sin(n)).attr("class","radarAxisLine"),a.append("text").text(i).attr("x",e*r.axisLabelFactor*Math.cos(n)).attr("y",e*r.axisLabelFactor*Math.sin(n)).attr("class","radarAxisLabel")}},"drawAxes");function M(a,t,e,r,s,o,i){const n=t.length,c=Math.min(i.width,i.height)/2;e.forEach((p,m)=>{if(p.entries.length!==n)return;const d=p.entries.map((u,h)=>{const v=2*Math.PI*h/n-Math.PI/2,y=A(u,r,s,c),S=y*Math.cos(v),O=y*Math.sin(v);return{x:S,y:O}});o==="circle"?a.append("path").attr("d",L(d,i.curveTension)).attr("class",`radarCurve-${m}`):o==="polygon"&&a.append("polygon").attr("points",d.map(u=>`${u.x},${u.y}`).join(" ")).attr("class",`radarCurve-${m}`)})}l(M,"drawCurves");function A(a,t,e,r){const s=Math.min(Math.max(a,t),e);return r*(s-t)/(e-t)}l(A,"relativeRadius");function L(a,t){const e=a.length;let r=`M${a[0].x},${a[0].y}`;for(let s=0;s<e;s++){const o=a[(s-1+e)%e],i=a[s],n=a[(s+1)%e],c=a[(s+2)%e],p={x:i.x+(n.x-o.x)*t,y:i.y+(n.y-o.y)*t},m={x:n.x-(c.x-i.x)*t,y:n.y-(c.y-i.y)*t};r+=` C${p.x},${p.y} ${m.x},${m.y} ${n.x},${n.y}`}return`${r} Z`}l(L,"closedRoundCurve");function T(a,t,e,r){if(!e)return;const s=(r.width/2+r.marginRight)*3/4,o=-(r.height/2+r.marginTop)*3/4,i=20;t.forEach((n,c)=>{const p=a.append("g").attr("transform",`translate(${s}, ${o+c*i})`);p.append("rect").attr("width",12).attr("height",12).attr("class",`radarLegendBox-${c}`),p.append("text").attr("x",16).attr("y",0).attr("class","radarLegendText").text(n.label)})}l(T,"drawLegend");var nt={draw:et},ot=l((a,t)=>{let e="";for(let r=0;r<a.THEME_COLOR_LIMIT;r++){const s=a[`cScale${r}`];e+=`
		.radarCurve-${r} {
			color: ${s};
			fill: ${s};
			fill-opacity: ${t.curveOpacity};
			stroke: ${s};
			stroke-width: ${t.curveStrokeWidth};
		}
		.radarLegendBox-${r} {
			fill: ${s};
			fill-opacity: ${t.curveOpacity};
			stroke: ${s};
		}
		`}return e},"genIndexStyles"),it=l(a=>{const t=W(),e=C(),r=f(t,e.themeVariables),s=f(r.radar,a);return{themeVariables:r,radarOptions:s}},"buildRadarStyleOptions"),lt=l(({radar:a}={})=>{const{themeVariables:t,radarOptions:e}=it(a);return`
	.radarTitle {
		font-size: ${t.fontSize};
		color: ${t.titleColor};
		dominant-baseline: hanging;
		text-anchor: middle;
	}
	.radarAxisLine {
		stroke: ${e.axisColor};
		stroke-width: ${e.axisStrokeWidth};
	}
	.radarAxisLabel {
		dominant-baseline: middle;
		text-anchor: middle;
		font-size: ${e.axisLabelFontSize}px;
		color: ${e.axisColor};
	}
	.radarGraticule {
		fill: ${e.graticuleColor};
		fill-opacity: ${e.graticuleOpacity};
		stroke: ${e.graticuleColor};
		stroke-width: ${e.graticuleStrokeWidth};
	}
	.radarLegendText {
		text-anchor: start;
		font-size: ${e.legendFontSize}px;
		dominant-baseline: hanging;
	}
	${ot(t,e)}
	`},"styles"),zt={parser:tt,db:$,renderer:nt,styles:lt};export{zt as diagram};
