import{b as o,s as R,g as k,a as v}from"./index.73bf34f9.js";const p=v();let n=d(grid);O();_();j();function E(){closeDialogs(".stable");const e=o("templateInput");S(e.value),n=d(n),$("#heightmapSelection").dialog({title:"Select Heightmap",resizable:!1,position:{my:"center",at:"center",of:"svg"},buttons:{Cancel:function(){$(this).dialog("close")},Select:function(){const t=g();applyOption(e,t,u(t)),lock("template"),$(this).dialog("close")},"New Map":function(){const t=g();applyOption(e,t,u(t)),lock("template");const i=q();regeneratePrompt({seed:i,graph:n}),$(this).dialog("close")}}})}function O(){const e=document.createElement("style");e.textContent=`
    div.dialog > div.heightmap-selection {
      width: 70vw;
      height: 70vh;
    }

    .heightmap-selection_container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      grid-gap: 6px;
    }

    @media (max-width: 600px) {
      .heightmap-selection_container {
        grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
        grid-gap: 4px;
      }
    }

    @media (min-width: 2000px) {
      .heightmap-selection_container {
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        grid-gap: 8px;
      }
    }

    .heightmap-selection_options {
      display: grid;
      grid-template-columns: 2fr 1fr;
    }

    .heightmap-selection_options > div:first-child {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      align-items: center;
      justify-self: start;
      justify-items: start;
    }

    @media (max-width: 600px) {
      .heightmap-selection_options {
        grid-template-columns: 3fr 1fr;
      }

      .heightmap-selection_options > div:first-child {
        display: block;
      }
    }

    .heightmap-selection_options > div:last-child {
      justify-self: end;
    }

    .heightmap-selection article {
      padding: 4px;
      border-radius: 8px;
      transition: all 0.1s ease-in-out;
      filter: drop-shadow(1px 1px 4px #999);
    }

    .heightmap-selection article:hover {
      background-color: #ddd;
      filter: drop-shadow(1px 1px 8px #999);
      cursor: pointer;
    }

    .heightmap-selection article.selected {
      background-color: #ccc;
      outline: 1px solid var(--dark-solid);
      filter: drop-shadow(1px 1px 8px #999);
    }

    .heightmap-selection article > div {
      display: flex;
      justify-content: space-between;
      padding: 2px 1px;
    }

    .heightmap-selection article > img {
      width: 100%;
      aspect-ratio: ${graphWidth}/${graphHeight};
      border-radius: 8px;
      object-fit: fill;
    }

    .heightmap-selection article .regeneratePreview {
      outline: 1px solid #bbb;
      padding: 1px 3px;
      border-radius: 4px;
      transition: all 0.1s ease-in-out;
    }

    .heightmap-selection article .regeneratePreview:hover {
      outline: 1px solid #666;
    }

    .heightmap-selection article .regeneratePreview:active {
      outline: 1px solid #333;
      color: #000;
      transform: rotate(45deg);
    }
  `,document.head.appendChild(e)}function _(){const e=`<div id="heightmapSelection" class="dialog stable">
    <div class="heightmap-selection">
      <section data-tip="Select heightmap template \u2013 template provides unique, but similar-looking maps on generation">
        <header><h1>Heightmap templates</h1></header>
        <div class="heightmap-selection_container"></div>
      </section>
      <section data-tip="Select precreated heightmap \u2013 it will be the same for each map">
        <header><h1>Precreated heightmaps</h1></header>
        <div class="heightmap-selection_container"></div>
      </section>
      <section>
        <header><h1>Options</h1></header>
        <div class="heightmap-selection_options">
          <div>
            <label data-tip="Rerender all preview images" class="checkbox-label" id="heightmapSelectionRedrawPreview">
              <i class="icon-cw"></i>
              Redraw preview
            </label>
            <div>
              <input id="heightmapSelectionRenderOcean" class="checkbox" type="checkbox" />
              <label data-tip="Draw heights of water cells" for="heightmapSelectionRenderOcean" class="checkbox-label">Render ocean heights</label>
            </div>
            <div data-tip="Color scheme used for heightmap preview">
              Color scheme
              <select id="heightmapSelectionColorScheme">
                <option value="bright" selected>Bright</option>
                <option value="light">Light</option>
                <option value="green">Green</option>
                <option value="monochrome">Monochrome</option>
              </select>
            </div>
          </div>
          <div>
            <button data-tip="Open Template Editor" data-tool="templateEditor" id="heightmapSelectionEditTemplates">Edit Templates</button>
            <button data-tip="Open Image Converter" data-tool="imageConverter" id="heightmapSelectionImportHeightmap">Import Heightmap</button>
          </div>
        </div>
      </section>
    </div>
  </div>`;o("dialogs").insertAdjacentHTML("beforeend",e);const t=document.getElementsByClassName("heightmap-selection_container");t[0].innerHTML=Object.keys(heightmapTemplates).map(i=>{const a=heightmapTemplates[i].name;Math.random=aleaPRNG(p);const c=HeightmapGenerator.fromTemplate(n,i),r=m(c);return`<article data-id="${i}" data-seed="${p}">
        <img src="${r}" alt="${a}" />
        <div>
          ${a}
          <span data-tip="Regenerate preview" class="icon-cw regeneratePreview"></span>
        </div>
      </article>`}).join(""),t[1].innerHTML=Object.keys(precreatedHeightmaps).map(i=>{const a=precreatedHeightmaps[i].name;return w(i),`<article data-id="${i}" data-seed="${p}">
        <img alt="${a}" />
        <div>${a}</div>
      </article>`}).join("")}function j(){o("heightmapSelection").on("click",e=>{const t=e.target.closest("#heightmapSelection article");if(!t)return;const i=t.dataset.id;e.target.matches("span.icon-cw")&&G(t,i),S(i)}),o("heightmapSelectionRenderOcean").on("change",h),o("heightmapSelectionColorScheme").on("change",h),o("heightmapSelectionRedrawPreview").on("click",h),o("heightmapSelectionEditTemplates").on("click",f),o("heightmapSelectionImportHeightmap").on("click",f)}function g(){var e,t;return(t=(e=o("heightmapSelection").querySelector(".selected"))==null?void 0:e.dataset)==null?void 0:t.id}function S(e){var i,a,c,r;const t=o("heightmapSelection");(a=(i=t.querySelector(".selected"))==null?void 0:i.classList)==null||a.remove("selected"),(r=(c=t.querySelector(`[data-id="${e}"]`))==null?void 0:c.classList)==null||r.add("selected")}function q(){var e,t;return(t=(e=o("heightmapSelection").querySelector(".selected"))==null?void 0:e.dataset)==null?void 0:t.seed}function u(e){return e in heightmapTemplates?heightmapTemplates[e].name:precreatedHeightmaps[e].name}function d(e){const t=R(e)?k():structuredClone(e);return delete t.cells.h,t}function m(e){const t=document.createElement("canvas");t.width=n.cellsX,t.height=n.cellsY;const i=t.getContext("2d"),a=i.createImageData(n.cellsX,n.cellsY),c=o("heightmapSelectionColorScheme").value,r=getColorScheme(c),b=o("heightmapSelectionRenderOcean").checked,y=l=>l<20?b?l:0:l;for(let l=0;l<e.length;l++){const H=r(1-y(e[l])/100),{r:T,g:C,b:P}=d3.color(H),s=l*4;a.data[s]=T,a.data[s+1]=C,a.data[s+2]=P,a.data[s+3]=255}return i.putImageData(a,0,0),t.toDataURL("image/png")}function x(e){const t=HeightmapGenerator.fromTemplate(n,e),i=m(t),a=o("heightmapSelection").querySelector(`[data-id="${e}"]`);a.querySelector("img").src=i}async function w(e){const t=await HeightmapGenerator.fromPrecreated(n,e),i=m(t),a=o("heightmapSelection").querySelector(`[data-id="${e}"]`);a.querySelector("img").src=i}function G(e,t){n=d(n);const i=v();e.dataset.seed=i,Math.random=aleaPRNG(i),x(t)}function h(){n=d(n);const e=o("heightmapSelection").querySelectorAll("article");for(const t of e){const{id:i,seed:a}=t.dataset;Math.random=aleaPRNG(a),i in heightmapTemplates?x(i):w(i)}}function f(){const e=this.dataset.tool;confirmationDialog({title:this.dataset.tip,message:"Opening the tool will erase the current map. Are you sure you want to proceed?",confirm:"Continue",onConfirm:()=>editHeightmap({mode:"erase",tool:e})})}export{E as open};
