/**
 * Japanese UI Trigger: Re-applies translations after all UI modules initialize.
 * This runs at the very end, after all dynamic UI elements have been created.
 */
(function () {
  "use strict";

  function applyDataTips() {
    const m = window.FMG_JA_TIP_MAP;
    if (!m) return;
    for (const el of document.querySelectorAll("[data-tip]")) {
      const o = el.getAttribute("data-tip");
      if (o && m[o]) el.setAttribute("data-tip", m[o]);
    }
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setHtml(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  function applyLayersTab() {
    const presetLabels = {
      political: "政治マップ",
      cultural: "文化マップ",
      religions: "宗教マップ",
      provinces: "州マップ",
      biomes: "バイオーム",
      heightmap: "ハイトマップ",
      physical: "自然地理",
      poi: "スポット",
      military: "軍事",
      emblems: "紋章",
      landmass: "陸地のみ",
      custom: "カスタム（未保存）"
    };
    const sel = document.getElementById("layersPreset");
    if (sel) {
      for (const opt of sel.querySelectorAll("option")) {
        const ja = presetLabels[opt.value];
        if (ja) opt.textContent = ja;
      }
    }

    const p = document.querySelector("#layersContent > p[data-tip]");
    if (p && p.textContent.includes("Layers preset")) p.textContent = "レイヤープリセット:";
    const p2 = document.querySelectorAll("#layersContent > p")[1];
    if (p2 && p2.textContent.includes("Displayed layers")) p2.textContent = "表示中のレイヤーと重なり順:";

    const tips = document.querySelectorAll("#layersContent .tip");
    if (tips[0]) tips[0].textContent = "クリックで表示のオン／オフ、ドラッグでレイヤー順を変更";
    if (tips[1]) tips[1].textContent = "Ctrl+クリックでレイヤースタイルを編集";

    const vm = document.getElementById("viewMode");
    if (vm) {
      const pvm = vm.querySelector("p");
      if (pvm) pvm.textContent = "表示モード:";
      setText("viewStandard", "標準");
      setText("viewMesh", "3D表示");
      setText("viewGlobe", "地球儀");
    }

    const layerLi = {
      toggleTexture: "テクスチャ(<u>X</u>)",
      toggleHeight: "<u>H</u>イトマップ",
      toggleBiomes: "<u>B</u>イオーム",
      toggleCells: "セル(<u>E</u>)",
      toggleGrid: "<u>G</u>リッド",
      toggleCoordinates: "座標(<u>O</u>)",
      toggleCompass: "方位(<u>W</u>)",
      toggleRivers: "河川(<u>V</u>)",
      toggleRelief: "起伏(<u>F</u>)",
      toggleReligions: "宗教(<u>R</u>)",
      toggleCultures: "文化(<u>C</u>)",
      toggleStates: "国家(<u>S</u>)",
      toggleProvinces: "州(<u>P</u>)",
      toggleZones: "ゾーン(<u>Z</u>)",
      toggleBorders: "国境(<u>D</u>)",
      toggleRoutes: "ルート(<u>U</u>)",
      toggleTemperature: "気温(<u>T</u>)",
      togglePopulation: "人口(<u>N</u>)",
      toggleIce: "氷(<u>J</u>)",
      togglePrecipitation: "降水量(<u>A</u>)",
      toggleEmblems: "紋章(<u>Y</u>)",
      toggleBurgIcons: "アイコン(<u>I</u>)",
      toggleLabels: "ラベル(<u>L</u>)",
      toggleMilitary: "軍事(<u>M</u>)",
      toggleMarkers: "マーカー(<u>K</u>)",
      toggleRulers: "定規",
      toggleScaleBar: "縮尺バー",
      toggleVignette: "ビネット"
    };
    for (const [id, html] of Object.entries(layerLi)) setHtml(id, html);
  }

  function applyToolsTab() {
    const sep = document.querySelectorAll("#toolsContent .separator");
    const sepJa = ["編集", "再生成", "追加", "表示", "作成"];
    sep.forEach((el, i) => {
      if (sepJa[i]) el.textContent = sepJa[i];
    });

    const tools = {
      editBiomesButton: "バイオーム",
      overviewBurgsButton: "都市",
      editCulturesButton: "文化",
      editDiplomacyButton: "外交",
      editEmblemButton: "紋章",
      editHeightmapButton: "ハイトマップ",
      overviewMarkersButton: "マーカー",
      overviewMilitaryButton: "軍事",
      editNamesBaseButton: "名前ベース",
      editNotesButton: "ノート",
      editProvincesButton: "州",
      editReligions: "宗教",
      overviewRiversButton: "河川",
      overviewRoutesButton: "ルート",
      editStatesButton: "国家",
      editUnitsButton: "ユニット",
      editZonesButton: "ゾーン",
      regenerateBurgs: "都市",
      regenerateCultures: "文化",
      regenerateEmblems: "紋章",
      regenerateIce: "氷",
      regenerateStateLabels: "国家ラベル",
      regenerateMilitary: "軍事",
      regeneratePopulation: "人口",
      regenerateProvinces: "州",
      regenerateReliefIcons: "起伏",
      regenerateReligions: "宗教",
      regenerateRivers: "河川",
      regenerateRoutes: "ルート",
      regenerateStates: "国家",
      regenerateZones: "ゾーン",
      addBurgTool: "都市",
      addLabel: "ラベル",
      addMarker: "マーカー",
      addRiver: "河川",
      addRoute: "ルート",
      overviewCellsButton: "セル",
      overviewChartsButton: "チャート",
      openSubmapTool: "サブマップ",
      openTransformTool: "変形"
    };
    for (const [id, t] of Object.entries(tools)) setText(id, t);

    const rm = document.getElementById("regenerateMarkers");
    if (rm && /Markers|マーカー/.test(rm.textContent)) {
      rm.innerHTML = `マーカー <i id="configRegenerateMarkers" class="icon-cog" data-tip="Click to set number multiplier"></i>`;
    }
  }

  function applyStyleTabBits() {
    const sc = document.getElementById("styleContent");
    if (!sc) return;
    const ps = sc.querySelectorAll(":scope > p");
    if (ps[0] && ps[0].textContent.includes("Style preset")) ps[0].textContent = "スタイルプリセット:";
    if (ps[1] && ps[1].textContent.includes("Select element")) ps[1].textContent = "編集する要素:";

    const styleElJa = {
      anchors: "アンカー",
      biomes: "バイオーム",
      borders: "国境",
      burgIcons: "都市アイコン",
      cells: "セル",
      coastline: "海岸線",
      coordinates: "座標",
      cults: "文化",
      emblems: "紋章",
      fogging: "フォグ",
      gridOverlay: "グリッド",
      terrs: "ハイトマップ",
      ice: "氷",
      labels: "ラベル",
      lakes: "湖",
      landmass: "陸地",
      legend: "凡例",
      markers: "マーカー",
      armies: "軍事",
      ocean: "海洋",
      population: "人口",
      prec: "降水量",
      provs: "州",
      terrain: "起伏アイコン",
      relig: "宗教",
      rivers: "河川",
      routes: "ルート",
      ruler: "定規",
      scaleBar: "縮尺バー",
      regions: "国家",
      temperature: "気温",
      texture: "テクスチャ",
      vignette: "ビネット",
      compass: "方位ローズ",
      zones: "ゾーン"
    };
    const ses = document.getElementById("styleElementSelect");
    if (ses) {
      for (const o of ses.options) {
        const ja = styleElJa[o.value];
        if (ja) o.textContent = ja;
      }
    }
  }

  function applyJapaneseTrigger() {
    applyLayersTab();
    applyToolsTab();
    applyStyleTabBits();
    applyDataTips();
  }

  // Wait a bit for all modules to fully initialize before applying translations
  setTimeout(applyJapaneseTrigger, 100);

  // Also apply on significant events
  document.addEventListener("layersUpdated", applyJapaneseTrigger);
  document.addEventListener("styleUpdated", applyJapaneseTrigger);
})();
