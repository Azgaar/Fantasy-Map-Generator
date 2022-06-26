import{r as u,b as c,t as lt,c as pt,i as mt,d as at,e as H,f as T}from"./index.73bf34f9.js";const K={states:{label:"State",getCellsData:()=>pack.cells.state,getName:G("states"),getColors:W("states"),landOnly:!0},cultures:{label:"Culture",getCellsData:()=>pack.cells.culture,getName:G("cultures"),getColors:W("cultures"),landOnly:!0},religions:{label:"Religion",getCellsData:()=>pack.cells.religion,getName:G("religions"),getColors:W("religions"),landOnly:!0},provinces:{label:"Province",getCellsData:()=>pack.cells.province,getName:G("provinces"),getColors:W("provinces"),landOnly:!0},biomes:{label:"Biome",getCellsData:()=>pack.cells.biome,getName:xt,getColors:St,landOnly:!1}},Q={total_population:{label:"Total population",quantize:t=>ot(t)+rt(t),aggregate:t=>u(d3.sum(t)),formatTicks:t=>H(t),stringify:t=>t.toLocaleString(),stackable:!0,landOnly:!0},urban_population:{label:"Urban population",quantize:ot,aggregate:t=>u(d3.sum(t)),formatTicks:t=>H(t),stringify:t=>t.toLocaleString(),stackable:!0,landOnly:!0},rural_population:{label:"Rural population",quantize:rt,aggregate:t=>u(d3.sum(t)),formatTicks:t=>H(t),stringify:t=>t.toLocaleString(),stackable:!0,landOnly:!0},area:{label:"Land area",quantize:t=>getArea(pack.cells.area[t]),aggregate:t=>u(d3.sum(t)),formatTicks:t=>`${H(t)} ${getAreaUnit()}`,stringify:t=>`${t.toLocaleString()} ${getAreaUnit()}`,stackable:!0,landOnly:!0},cells:{label:"Number of cells",quantize:()=>1,aggregate:t=>d3.sum(t),formatTicks:t=>t,stringify:t=>t.toLocaleString(),stackable:!0,landOnly:!0},burgs_number:{label:"Number of burgs",quantize:t=>pack.cells.burg[t]?1:0,aggregate:t=>d3.sum(t),formatTicks:t=>t,stringify:t=>t.toLocaleString(),stackable:!0,landOnly:!0},average_elevation:{label:"Average elevation",quantize:t=>pack.cells.h[t],aggregate:t=>d3.mean(t),formatTicks:t=>getHeight(t),stringify:t=>getHeight(t),stackable:!1,landOnly:!1},max_elevation:{label:"Maximum mean elevation",quantize:t=>pack.cells.h[t],aggregate:t=>d3.max(t),formatTicks:t=>getHeight(t),stringify:t=>getHeight(t),stackable:!1,landOnly:!1},min_elevation:{label:"Minimum mean elevation",quantize:t=>pack.cells.h[t],aggregate:t=>d3.min(t),formatTicks:t=>getHeight(t),stringify:t=>getHeight(t),stackable:!1,landOnly:!1},average_temperature:{label:"Annual mean temperature",quantize:t=>grid.cells.temp[pack.cells.g[t]],aggregate:t=>d3.mean(t),formatTicks:t=>T(t),stringify:t=>T(t),stackable:!1,landOnly:!1},max_temperature:{label:"Mean annual maximum temperature",quantize:t=>grid.cells.temp[pack.cells.g[t]],aggregate:t=>d3.max(t),formatTicks:t=>T(t),stringify:t=>T(t),stackable:!1,landOnly:!1},min_temperature:{label:"Mean annual minimum temperature",quantize:t=>grid.cells.temp[pack.cells.g[t]],aggregate:t=>d3.min(t),formatTicks:t=>T(t),stringify:t=>T(t),stackable:!1,landOnly:!1},average_precipitation:{label:"Annual mean precipitation",quantize:t=>grid.cells.prec[pack.cells.g[t]],aggregate:t=>u(d3.mean(t)),formatTicks:t=>getPrecipitation(u(t)),stringify:t=>getPrecipitation(u(t)),stackable:!1,landOnly:!0},max_precipitation:{label:"Mean annual maximum precipitation",quantize:t=>grid.cells.prec[pack.cells.g[t]],aggregate:t=>u(d3.max(t)),formatTicks:t=>getPrecipitation(u(t)),stringify:t=>getPrecipitation(u(t)),stackable:!1,landOnly:!0},min_precipitation:{label:"Mean annual minimum precipitation",quantize:t=>grid.cells.prec[pack.cells.g[t]],aggregate:t=>u(d3.min(t)),formatTicks:t=>getPrecipitation(u(t)),stringify:t=>getPrecipitation(u(t)),stackable:!1,landOnly:!0},coastal_cells:{label:"Number of coastal cells",quantize:t=>pack.cells.t[t]===1?1:0,aggregate:t=>d3.sum(t),formatTicks:t=>t,stringify:t=>t.toLocaleString(),stackable:!0,landOnly:!0},river_cells:{label:"Number of river cells",quantize:t=>pack.cells.r[t]?1:0,aggregate:t=>d3.sum(t),formatTicks:t=>t,stringify:t=>t.toLocaleString(),stackable:!0,landOnly:!0}},dt={stackedBar:{offset:d3.stackOffsetDiverging},normalizedStackedBar:{offset:d3.stackOffsetExpand,formatX:t=>u(t*100)+"%"}};let L=[],nt=mapId;ft();vt();ht();ct();function Lt(){closeDialogs("#chartsOverview, .stable"),nt!==mapId&&(L=[],nt=mapId),L.length?L.forEach(t=>st(t)):it(),$("#chartsOverview").dialog({title:"Data Charts",position:{my:"center",at:"center",of:"svg"},close:kt})}function ft(){const t=document.createElement("style");t.textContent=`
    #chartsOverview {
      max-width: 90vw !important;
      max-height: 90vh !important;
      overflow: hidden;
      display: grid;
      grid-template-rows: auto 1fr;
    }

    #chartsOverview__form {
      font-size: 1.1em;
      margin: 0.3em 0;
      display: grid;
      grid-template-columns: auto auto;
      grid-gap: 0.3em;
      align-items: start;
     justify-items: end;
    }

    @media (max-width: 600px) {
      #chartsOverview__form {
        font-size: 1em;
        grid-template-columns: 1fr;
        justify-items: normal;
      }
    }

    #chartsOverview__charts {
      overflow: auto;
      scroll-behavior: smooth;
      display: grid;
    }

    #chartsOverview__charts figure {
      margin: 0;
    }

    #chartsOverview__charts figcaption {
      font-size: 1.2em;
      margin: 0 1% 0 4%;
      display: grid;
      grid-template-columns: 1fr auto;
    }
  `,document.head.appendChild(t)}function vt(){const t=Object.entries(K).map(([r,{label:i}])=>[r,i]),a=Object.entries(Q).map(([r,{label:i}])=>[r,i]),n=([r,i])=>`<option value="${r}">${i}</option>`,o=r=>r.map(n).join(""),l=`<div id="chartsOverview" class="dialog stable">
    <form id="chartsOverview__form">
      <div>
        <button data-tip="Add a chart" type="submit">Plot</button>

        <select data-tip="Select entity (y axis)" id="chartsOverview__entitiesSelect">
          ${o(t)}
        </select>

        <label>by
          <select data-tip="Select value to plot by (x axis)" id="chartsOverview__plotBySelect">
            ${o(a)}
          </select>
        </label>

        <label>grouped by
          <select data-tip="Select entoty to group by. If you don't need grouping, set it the same as the entity" id="chartsOverview__groupBySelect">
            ${o(t)}
          </select>
        </label>

        <label data-tip="Sorting type">sorted
          <select id="chartsOverview__sortingSelect">
            <option value="value">by value</option>
            <option value="name">by name</option>
            <option value="natural">naturally</option>
          </select>
        </label>
      </div>
      <div>
        <span data-tip="Chart type">Type</span>
        <select id="chartsOverview__chartType">
          <option value="stackedBar" selected>Stacked Bar</option>
          <option value="normalizedStackedBar">Normalized Stacked Bar</option>
        </select>

        <span data-tip="Columns to display">Columns</span>
        <select id="chartsOverview__viewColumns">
          <option value="1" selected>1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
        </select>
      </div>
    </form>

    <section id="chartsOverview__charts"></section>
  </div>`;c("dialogs").insertAdjacentHTML("beforeend",l),c("chartsOverview__entitiesSelect").value="states",c("chartsOverview__plotBySelect").value="total_population",c("chartsOverview__groupBySelect").value="cultures"}function ht(){c("chartsOverview__form").on("submit",it),c("chartsOverview__viewColumns").on("change",ct)}function it(t){t&&t.preventDefault();const a=c("chartsOverview__entitiesSelect").value,n=c("chartsOverview__plotBySelect").value;let o=c("chartsOverview__groupBySelect").value;const l=c("chartsOverview__sortingSelect").value,r=c("chartsOverview__chartType").value,{stackable:i}=Q[n];!i&&o!==a&&(lt(`Grouping is not supported for ${plotByLabel}`,!1,"warn",4e3),o=a);const p={id:Date.now(),entity:a,plotBy:n,groupBy:o,sorting:l,type:r};L.push(p),st(p),tt()}function st({id:t,entity:a,plotBy:n,groupBy:o,sorting:l,type:r}){const{label:i,stringify:p,quantize:d,aggregate:h,formatTicks:z,landOnly:B}=Q[n],C=o===a,{label:N,getName:_,getCellsData:q,landOnly:E}=K[a],{label:g,getName:X,getCellsData:x,getColors:U}=K[o],Y=q(),R=x(),F=`${pt(a)} by ${i}${C?"":" grouped by "+g}`,k=(m,f,v,b)=>{const D=`${N}: ${m}`,S=C?"":`${g}: ${f}`;let w=`${i}: ${p(v)}`;return C||(w+=` (${u(b*100)}%)`),[D,S,w].filter(Boolean)},y={},V=new Set;for(const m of pack.cells.i){if((E||B)&&mt(m))continue;const f=Y[m],v=R[m],b=d(m);y[f]?y[f][v]?y[f][v].push(b):y[f][v]=[b]:y[f]={[v]:[b]},V.add(v)}const Z=Object.entries(y).map(([m,f])=>{const v=_(m);return Object.entries(f).map(([b,D])=>{const S=X(b),w=h(D);return{name:v,group:S,value:w}})}).flat(),O=U(),{offset:j,formatX:J=z}=dt[r],P=yt(Z,{sorting:l,colors:O,tooltip:k,offset:j,formatX:J});bt(t,P,F),c("chartsOverview__charts").lastChild.scrollIntoView()}function yt(t,{sorting:a,colors:n,tooltip:o,offset:l,formatX:r}){const i=Tt(t,a),p=i.map(e=>e.value),d=i.map(e=>e.name),h=i.map(e=>e.group),z=new Set(d),B=new Set(h),C=d3.range(p.length).filter(e=>z.has(d[e])&&B.has(h[e])),N=Array.from(z),_=Array.from(B),q=gt(N),E=Ct(_,A-q-15),g={top:30,right:15,bottom:E*20+10,left:q},X=[g.left,A-g.right],x=z.size*25+g.top+g.bottom,U=[x-g.bottom,g.top],Y=at(C,([e])=>e,e=>d[e],e=>h[e]),R=d3.stack().keys(_).value(([,e],s)=>p[new Map(e).get(s)]).order(d3.stackOrderNone).offset(l)(Y).map(e=>{const M=e.filter(I=>!isNaN(I[1])).map(I=>Object.assign(I,{i:new Map(I.data[1]).get(e.key)}));return{key:e.key,data:M}}),F=d3.extent(R.map(e=>e.data).flat(2)),k=d3.scaleLinear(F,X),y=d3.scaleBand(N,U).paddingInner(Ot),V=d3.axisTop(k).ticks(A/80,null),Z=d3.axisLeft(y).tickSizeOuter(0),O=d3.create("svg").attr("version","1.1").attr("xmlns","http://www.w3.org/2000/svg").attr("viewBox",[0,0,A,x]).attr("style","max-width: 100%; height: auto; height: intrinsic;");O.append("g").attr("transform",`translate(0,${g.top})`).call(V).call(e=>e.select(".domain").remove()).call(e=>e.selectAll("text").text(s=>r(s))).call(e=>e.selectAll(".tick line").clone().attr("y2",x-g.top-g.bottom).attr("stroke-opacity",.1));const j=O.append("g").attr("stroke","#666").attr("stroke-width",.5).selectAll("g").data(R).join("g").attr("fill",e=>n[e.key]).selectAll("rect").data(e=>e.data.filter(([s,M])=>s!==M)).join("rect").attr("x",([e,s])=>Math.min(k(e),k(s))).attr("y",({i:e})=>y(d[e])).attr("width",([e,s])=>Math.abs(k(e)-k(s))).attr("height",y.bandwidth()),J=Object.fromEntries(at(C,([e])=>e,e=>d[e],e=>p[e]).map(([e,s])=>[e,d3.sum(s,M=>M[0])])),P=({i:e})=>o(d[e],h[e],p[e],p[e]/J[d[e]]);j.append("title").text(e=>P(e).join(`\r
`)),j.on("mouseover",e=>lt(P(e).join(". "))),O.append("g").attr("transform",`translate(${k(0)},0)`).call(Z);const m=Math.ceil(_.length/E),f=A/(m+.5),v=20,b=(e,s)=>s%m*f,D=(e,s)=>b(e,s)+ut,S=(e,s)=>Math.floor(s/m)*v,w=O.append("g").attr("stroke","#666").attr("stroke-width",.5).attr("dominant-baseline","central").attr("transform",`translate(${g.left},${x-g.bottom+15})`);return w.selectAll("circle").data(_).join("rect").attr("x",b).attr("y",S).attr("width",10).attr("height",10).attr("transform","translate(-5, -5)").attr("fill",e=>n[e]),w.selectAll("text").data(_).join("text").attr("x",D).attr("y",S).text(e=>e),O.node()}function bt(t,a,n){const o=c("chartsOverview__charts"),l=document.createElement("figure"),r=document.createElement("figcaption"),i=o.childElementCount+1;r.innerHTML=`
    <div>
      <strong>Figure ${i}</strong>. ${n}
    </div>
    <div>
      <button data-tip="Download the chart in svg format (can open in browser or Inkscape)" class="icon-download"></button>
      <button data-tip="Remove the chart" class="icon-trash"></button>
    </div>
  `,l.appendChild(a),l.appendChild(r),o.appendChild(l);const p=()=>{const h=`${getFileName(n)}.svg`;downloadFile(a.outerHTML,h)},d=()=>{l.remove(),L=L.filter(h=>h.id!==t),tt()};l.querySelector("button.icon-download").on("click",p),l.querySelector("button.icon-trash").on("click",d)}function ct(){const t=c("chartsOverview__viewColumns").value,a=c("chartsOverview__charts");a.style.gridTemplateColumns=`repeat(${t}, 1fr)`,tt()}function tt(){$("#chartsOverview").dialog({position:{my:"center",at:"center",of:"svg"}})}function kt(){const t=c("chartsOverview__charts");t.innerHTML="",$("#chartsOverview").dialog("destroy")}const _t="#ccc",et="no",A=800,Ot=.2,wt=7,ut=10;function gt(t){return d3.max(t.map(a=>a.length))*wt}function Ct(t,a){const n=ut+gt(t),o=Math.floor(a/n);return Math.ceil(t.length/o)}function G(t){return a=>pack[t][a].name||et}function W(t){return()=>Object.fromEntries(pack[t].map(({name:a,color:n})=>[a||et,n||_t]))}function xt(t){return biomesData.name[t]||et}function St(){return Object.fromEntries(biomesData.i.map(t=>[biomesData.name[t],biomesData.color[t]]))}function ot(t){const a=pack.cells.burg[t];return a?pack.burgs[a].population*populationRate*urbanization:0}function rt(t){return pack.cells.pop[t]*populationRate}function Tt(t,a){if(a==="natural")return t;if(a==="name")return t.sort((n,o)=>n.name!==o.name?o.name.localeCompare(n.name):n.group.localeCompare(o.group));if(a==="value"){const n={},o={};for(const{name:l,group:r,value:i}of t)n[l]=(n[l]||0)+i,o[r]=(o[r]||0)+i;return t.sort((l,r)=>l.name!==r.name?n[l.name]-n[r.name]:o[r.group]-o[l.group])}return t}export{Lt as open};
