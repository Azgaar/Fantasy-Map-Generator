'use strict';
function editCultures() {
  if (customization) return;
  closeDialogs('#culturesEditor, .stable');
  if (!layerIsOn('toggleCultures')) toggleCultures();
  if (layerIsOn('toggleStates')) toggleStates();
  if (layerIsOn('toggleBiomes')) toggleBiomes();
  if (layerIsOn('toggleReligions')) toggleReligions();
  if (layerIsOn('toggleProvinces')) toggleProvinces();

  const body = document.getElementById('culturesBody');
  drawCultureCenters();
  refreshCulturesEditor();

  if (modules.editCultures) return;
  modules.editCultures = true;

  $('#culturesEditor').dialog({
    title: 'Cultures Editor',
    resizable: false,
    width: fitContent(),
    close: closeCulturesEditor,
    position: {my: 'right top', at: 'right-10 top+10', of: 'svg'}
  });
  body.focus();

  // add listeners
  document.getElementById('culturesEditorRefresh').addEventListener('click', refreshCulturesEditor);
  document.getElementById('culturesEditStyle').addEventListener('click', () => editStyle('cults'));
  document.getElementById('culturesLegend').addEventListener('click', toggleLegend);
  document.getElementById('culturesPercentage').addEventListener('click', togglePercentageMode);
  document.getElementById('culturesHeirarchy').addEventListener('click', showHierarchy);
  document.getElementById('culturesRecalculate').addEventListener('click', () => recalculateCultures(true));
  document.getElementById('culturesManually').addEventListener('click', enterCultureManualAssignent);
  document.getElementById('culturesManuallyApply').addEventListener('click', applyCultureManualAssignent);
  document.getElementById('culturesManuallyCancel').addEventListener('click', () => exitCulturesManualAssignment());
  document.getElementById('culturesEditNamesBase').addEventListener('click', editNamesbase);
  document.getElementById('culturesAdd').addEventListener('click', enterAddCulturesMode);
  document.getElementById('culturesExport').addEventListener('click', downloadCulturesData);

  function refreshCulturesEditor() {
    culturesCollectStatistics();
    culturesEditorAddLines();
    drawCultureCenters();
  }

  function culturesCollectStatistics() {
    const cells = pack.cells,
      cultures = pack.cultures;
    cultures.forEach((c) => (c.cells = c.area = c.rural = c.urban = 0));

    for (const i of cells.i) {
      if (cells.h[i] < 20) continue;
      const c = cells.culture[i];
      cultures[c].cells += 1;
      cultures[c].area += cells.area[i];
      cultures[c].rural += cells.pop[i];
      if (cells.burg[i]) cultures[c].urban += pack.burgs[cells.burg[i]].population;
    }
  }

  // add line for each culture
  function culturesEditorAddLines() {
    const unit = areaUnit.value === 'square' ? ' ' + distanceUnitInput.value + '²' : ' ' + areaUnit.value;
    let lines = '',
      totalArea = 0,
      totalPopulation = 0;

    const emblemShapeGroup = document.getElementById('emblemShape').selectedOptions[0].parentNode.label;
    const selectShape = emblemShapeGroup === 'Diversiform';

    for (const c of pack.cultures) {
      if (c.removed) continue;
      const area = c.area * distanceScaleInput.value ** 2;
      const rural = c.rural * populationRate.value;
      const urban = c.urban * populationRate.value * urbanization.value;
      const population = rn(rural + urban);
      const populationTip = `Total population: ${si(population)}; Rural population: ${si(rural)}; Urban population: ${si(urban)}. Click to edit`;
      totalArea += area;
      totalPopulation += population;

      if (!c.i) {
        // Uncultured (neutral) line
        lines += `<div class="states" data-id=${c.i} data-name="${c.name}" data-color="" data-cells=${c.cells}
        data-area=${area} data-population=${population} data-base=${c.base} data-type="" data-expansionism="" data-emblems="${c.shield}">
          <svg width="9" height="9" class="placeholder"></svg>
          <input data-tip="Culture name. Click and type to change" class="cultureName italic" value="${c.name}" autocorrect="off" spellcheck="false">
          <span data-tip="Cells count" class="icon-check-empty hide"></span>
          <div data-tip="Cells count" class="stateCells hide">${c.cells}</div>
          <span class="icon-resize-full placeholder hide"></span>
          <input class="statePower placeholder hide" type="number">
          <select class="cultureType placeholder">${getTypeOptions(c.type)}</select>
          <span data-tip="Culture area" style="padding-right: 4px" class="icon-map-o hide"></span>
          <div data-tip="Culture area" class="biomeArea hide">${si(area) + unit}</div>
          <span data-tip="${populationTip}" class="icon-male hide"></span>
          <div data-tip="${populationTip}" class="culturePopulation hide">${si(population)}</div>
          <span data-tip="Click to re-generate names for burgs with this culture assigned" class="icon-arrows-cw hide"></span>
          <select data-tip="Culture namesbase. Click to change. Click on arrows to re-generate names" class="cultureBase">${getBaseOptions(c.base)}</select>
          ${selectShape ? `<select data-tip="Emblem shape associated with culture. Click to change" class="cultureShape hide">${getShapeOptions(c.shield)}</select>` : ''}
        </div>`;
        continue;
      }

      lines += `<div class="states cultures" data-id=${c.i} data-name="${c.name}" data-color="${c.color}" data-cells=${c.cells}
      data-area=${area} data-population=${population} data-base=${c.base} data-type=${c.type} data-expansionism=${c.expansionism} data-emblems="${c.shield}">
        <svg data-tip="Culture fill style. Click to change" width=".9em" height=".9em" style="margin-bottom:-1px"><rect x="0" y="0" width="100%" height="100%" fill="${
          c.color
        }" class="fillRect pointer"></svg>
        <input data-tip="Culture name. Click and type to change" class="cultureName" value="${c.name}" autocorrect="off" spellcheck="false">
        <span data-tip="Cells count" class="icon-check-empty hide"></span>
        <div data-tip="Cells count" class="stateCells hide">${c.cells}</div>
        <span data-tip="Culture expansionism. Defines competitive size" class="icon-resize-full hide"></span>
        <input data-tip="Culture expansionism. Defines competitive size. Click to change, then click Recalculate to apply change" class="statePower hide" type="number" min=0 max=99 step=.1 value=${
          c.expansionism
        }>
        <select data-tip="Culture type. Defines growth model. Click to change" class="cultureType">${getTypeOptions(c.type)}</select>
        <span data-tip="Culture area" style="padding-right: 4px" class="icon-map-o hide"></span>
        <div data-tip="Culture area" class="biomeArea hide">${si(area) + unit}</div>
        <span data-tip="${populationTip}" class="icon-male hide"></span>
        <div data-tip="${populationTip}" class="culturePopulation hide">${si(population)}</div>
        <span data-tip="Click to re-generate names for burgs with this culture assigned" class="icon-arrows-cw hide"></span>
        <select data-tip="Culture namesbase. Click to change. Click on arrows to re-generate names" class="cultureBase">${getBaseOptions(c.base)}</select>
        ${selectShape ? `<select data-tip="Emblem shape associated with culture. Click to change" class="cultureShape hide">${getShapeOptions(c.shield)}</select>` : ''}
        <span data-tip="Remove culture" class="icon-trash-empty hide"></span>
      </div>`;
    }
    body.innerHTML = lines;

    // update footer
    culturesFooterCultures.innerHTML = pack.cultures.filter((c) => c.i && !c.removed).length;
    culturesFooterCells.innerHTML = pack.cells.h.filter((h) => h >= 20).length;
    culturesFooterArea.innerHTML = si(totalArea) + unit;
    culturesFooterPopulation.innerHTML = si(totalPopulation);
    culturesFooterArea.dataset.area = totalArea;
    culturesFooterPopulation.dataset.population = totalPopulation;

    // add listeners
    body.querySelectorAll('div.cultures').forEach((el) => el.addEventListener('mouseenter', (ev) => cultureHighlightOn(ev)));
    body.querySelectorAll('div.cultures').forEach((el) => el.addEventListener('mouseleave', (ev) => cultureHighlightOff(ev)));
    body.querySelectorAll('div.states').forEach((el) => el.addEventListener('click', selectCultureOnLineClick));
    body.querySelectorAll('rect.fillRect').forEach((el) => el.addEventListener('click', cultureChangeColor));
    body.querySelectorAll('div > input.cultureName').forEach((el) => el.addEventListener('input', cultureChangeName));
    body.querySelectorAll('div > input.statePower').forEach((el) => el.addEventListener('input', cultureChangeExpansionism));
    body.querySelectorAll('div > select.cultureType').forEach((el) => el.addEventListener('change', cultureChangeType));
    body.querySelectorAll('div > select.cultureBase').forEach((el) => el.addEventListener('change', cultureChangeBase));
    body.querySelectorAll('div > select.cultureShape').forEach((el) => el.addEventListener('change', cultureChangeShape));
    body.querySelectorAll('div > div.culturePopulation').forEach((el) => el.addEventListener('click', changePopulation));
    body.querySelectorAll('div > span.icon-arrows-cw').forEach((el) => el.addEventListener('click', cultureRegenerateBurgs));
    body.querySelectorAll('div > span.icon-trash-empty').forEach((el) => el.addEventListener('click', cultureRemove));

    culturesHeader.querySelector("div[data-sortby='emblems']").style.display = selectShape ? 'inline-block' : 'none';

    if (body.dataset.type === 'percentage') {
      body.dataset.type = 'absolute';
      togglePercentageMode();
    }
    applySorting(culturesHeader);
    $('#culturesEditor').dialog({width: fitContent()});
  }

  function getTypeOptions(type) {
    let options = '';
    const types = ['Generic', 'River', 'Lake', 'Naval', 'Nomadic', 'Hunting', 'Highland'];
    types.forEach((t) => (options += `<option ${type === t ? 'selected' : ''} value="${t}">${t}</option>`));
    return options;
  }

  function getBaseOptions(base) {
    let options = '';
    nameBases.forEach((n, i) => (options += `<option ${base === i ? 'selected' : ''} value="${i}">${n.name}</option>`));
    return options;
  }

  function getShapeOptions(selected) {
    const shapes = Object.keys(COA.shields.types)
      .map((type) => Object.keys(COA.shields[type]))
      .flat();
    return shapes.map((shape) => `<option ${shape === selected ? 'selected' : ''} value="${shape}">${capitalize(shape)}</option>`);
  }

  function cultureHighlightOn(event) {
    const culture = +event.target.dataset.id;
    const info = document.getElementById('cultureInfo');
    if (info) {
      d3.select('#hierarchy')
        .select("g[data-id='" + culture + "'] > path")
        .classed('selected', 1);
      const c = pack.cultures[culture];
      const rural = c.rural * populationRate.value;
      const urban = c.urban * populationRate.value * urbanization.value;
      const population = rural + urban > 0 ? si(rn(rural + urban)) + ' people' : 'Extinct';
      info.innerHTML = `${c.name} culture. ${c.type}. ${population}`;
      tip('Drag to change parent, drag to itself to move to the top level. Hold CTRL and click to change abbreviation');
    }

    if (!layerIsOn('toggleCultures')) return;
    if (customization) return;
    const animate = d3.transition().duration(2000).ease(d3.easeSinIn);
    cults
      .select('#culture' + culture)
      .raise()
      .transition(animate)
      .attr('stroke-width', 2.5)
      .attr('stroke', '#d0240f');
    debug
      .select('#cultureCenter' + culture)
      .raise()
      .transition(animate)
      .attr('r', 8)
      .attr('stroke', '#d0240f');
  }

  function cultureHighlightOff(event) {
    const culture = +event.target.dataset.id;
    const info = document.getElementById('cultureInfo');
    if (info) {
      d3.select('#hierarchy')
        .select("g[data-id='" + culture + "'] > path")
        .classed('selected', 0);
      info.innerHTML = '&#8205;';
      tip('');
    }

    if (!layerIsOn('toggleCultures')) return;
    cults
      .select('#culture' + culture)
      .transition()
      .attr('stroke-width', null)
      .attr('stroke', null);
    debug
      .select('#cultureCenter' + culture)
      .transition()
      .attr('r', 6)
      .attr('stroke', null);
  }

  function cultureChangeColor() {
    const el = this;
    const currentFill = el.getAttribute('fill');
    const culture = +el.parentNode.parentNode.dataset.id;

    const callback = function (fill) {
      el.setAttribute('fill', fill);
      pack.cultures[culture].color = fill;
      cults
        .select('#culture' + culture)
        .attr('fill', fill)
        .attr('stroke', fill);
      debug.select('#cultureCenter' + culture).attr('fill', fill);
    };

    openPicker(currentFill, callback);
  }

  function cultureChangeName() {
    const culture = +this.parentNode.dataset.id;
    this.parentNode.dataset.name = this.value;
    pack.cultures[culture].name = this.value;
    pack.cultures[culture].code = abbreviate(
      this.value,
      pack.cultures.map((c) => c.code)
    );
  }

  function cultureChangeExpansionism() {
    const culture = +this.parentNode.dataset.id;
    this.parentNode.dataset.expansionism = this.value;
    pack.cultures[culture].expansionism = +this.value;
    recalculateCultures();
  }

  function cultureChangeType() {
    const culture = +this.parentNode.dataset.id;
    this.parentNode.dataset.type = this.value;
    pack.cultures[culture].type = this.value;
    recalculateCultures();
  }

  function cultureChangeBase() {
    const culture = +this.parentNode.dataset.id;
    const v = +this.value;
    this.parentNode.dataset.base = pack.cultures[culture].base = v;
  }

  function cultureChangeShape() {
    const culture = +this.parentNode.dataset.id;
    const shape = this.value;
    this.parentNode.dataset.emblems = pack.cultures[culture].shield = shape;

    const rerenderCOA = (id, coa) => {
      const coaEl = document.getElementById(id);
      if (!coaEl) return; // not rendered
      coaEl.remove();
      COArenderer.trigger(id, coa);
    };

    pack.states.forEach((state) => {
      if (state.culture !== culture || !state.i || state.removed || !state.coa || state.coa === 'custom') return;
      if (shape === state.coa.shield) return;
      state.coa.shield = shape;
      rerenderCOA('stateCOA' + state.i, state.coa);
    });

    pack.provinces.forEach((province) => {
      if (pack.cells.culture[province.center] !== culture || !province.i || province.removed || !province.coa || province.coa === 'custom') return;
      if (shape === province.coa.shield) return;
      province.coa.shield = shape;
      rerenderCOA('provinceCOA' + province.i, province.coa);
    });

    pack.burgs.forEach((burg) => {
      if (burg.culture !== culture || !burg.i || burg.removed || !burg.coa || burg.coa === 'custom') return;
      if (shape === burg.coa.shield) return;
      burg.coa.shield = shape;
      rerenderCOA('burgCOA' + burg.i, burg.coa);
    });
  }

  function changePopulation() {
    const culture = +this.parentNode.dataset.id;
    const c = pack.cultures[culture];
    if (!c.cells) {
      tip('Culture does not have any cells, cannot change population', false, 'error');
      return;
    }
    const rural = rn(c.rural * populationRate.value);
    const urban = rn(c.urban * populationRate.value * urbanization.value);
    const total = rural + urban;
    const l = (n) => Number(n).toLocaleString();
    const burgs = pack.burgs.filter((b) => !b.removed && b.culture === culture);

    alertMessage.innerHTML = `
    Rural: <input type="number" min=0 step=1 id="ruralPop" value=${rural} style="width:6em">
    Urban: <input type="number" min=0 step=1 id="urbanPop" value=${urban} style="width:6em" ${burgs.length ? '' : 'disabled'}>
    <p>Total population: ${l(total)} ⇒ <span id="totalPop">${l(total)}</span> (<span id="totalPopPerc">100</span>%)</p>`;

    const update = function () {
      const totalNew = ruralPop.valueAsNumber + urbanPop.valueAsNumber;
      if (isNaN(totalNew)) return;
      totalPop.innerHTML = l(totalNew);
      totalPopPerc.innerHTML = rn((totalNew / total) * 100);
    };

    ruralPop.oninput = () => update();
    urbanPop.oninput = () => update();

    $('#alert').dialog({
      resizable: false,
      title: 'Change culture population',
      width: '24em',
      buttons: {
        Apply: function () {
          applyPopulationChange();
          $(this).dialog('close');
        },
        Cancel: function () {
          $(this).dialog('close');
        }
      },
      position: {my: 'center', at: 'center', of: 'svg'}
    });

    function applyPopulationChange() {
      const ruralChange = ruralPop.value / rural;
      if (isFinite(ruralChange) && ruralChange !== 1) {
        const cells = pack.cells.i.filter((i) => pack.cells.culture[i] === culture);
        cells.forEach((i) => (pack.cells.pop[i] *= ruralChange));
      }
      if (!isFinite(ruralChange) && +ruralPop.value > 0) {
        const points = ruralPop.value / populationRate.value;
        const cells = pack.cells.i.filter((i) => pack.cells.culture[i] === culture);
        const pop = rn(points / cells.length);
        cells.forEach((i) => (pack.cells.pop[i] = pop));
      }

      const urbanChange = urbanPop.value / urban;
      if (isFinite(urbanChange) && urbanChange !== 1) {
        burgs.forEach((b) => (b.population = rn(b.population * urbanChange, 4)));
      }
      if (!isFinite(urbanChange) && +urbanPop.value > 0) {
        const points = urbanPop.value / populationRate.value / urbanization.value;
        const population = rn(points / burgs.length, 4);
        burgs.forEach((b) => (b.population = population));
      }

      refreshCulturesEditor();
    }
  }

  function cultureRegenerateBurgs() {
    if (customization === 4) return;
    const culture = +this.parentNode.dataset.id;
    const cBurgs = pack.burgs.filter((b) => b.culture === culture && !b.lock);
    cBurgs.forEach((b) => {
      b.name = Names.getCulture(culture);
      labels.select("[data-id='" + b.i + "']").text(b.name);
    });
    tip(`Names for ${cBurgs.length} burgs are regenerated`, false, 'success');
  }

  function cultureRemove() {
    if (customization === 4) return;
    const culture = +this.parentNode.dataset.id;

    const message = 'Are you sure you want to remove the culture? <br>This action cannot be reverted';
    const onConfirm = () => {
      cults.select('#culture' + culture).remove();
      debug.select('#cultureCenter' + culture).remove();

      pack.burgs.filter((b) => b.culture == culture).forEach((b) => (b.culture = 0));
      pack.states.forEach((s, i) => {
        if (s.culture === culture) s.culture = 0;
      });
      pack.cells.culture.forEach((c, i) => {
        if (c === culture) pack.cells.culture[i] = 0;
      });
      pack.cultures[culture].removed = true;

      const origin = pack.cultures[culture].origin;
      pack.cultures.forEach((c) => {
        if (c.origin === culture) c.origin = origin;
      });
      refreshCulturesEditor();
    };
    confirmationDialog({title: 'Remove culture', message, confirm: 'Remove', onConfirm});
  }

  function drawCultureCenters() {
    const tooltip = 'Drag to move the culture center (ancestral home)';
    debug.select('#cultureCenters').remove();
    const cultureCenters = debug.append('g').attr('id', 'cultureCenters').attr('stroke-width', 2).attr('stroke', '#444444').style('cursor', 'move');

    const data = pack.cultures.filter((c) => c.i && !c.removed);
    cultureCenters
      .selectAll('circle')
      .data(data)
      .enter()
      .append('circle')
      .attr('id', (d) => 'cultureCenter' + d.i)
      .attr('data-id', (d) => d.i)
      .attr('r', 6)
      .attr('fill', (d) => d.color)
      .attr('cx', (d) => pack.cells.p[d.center][0])
      .attr('cy', (d) => pack.cells.p[d.center][1])
      .on('mouseenter', (d) => {
        tip(tooltip, true);
        body.querySelector(`div[data-id='${d.i}']`).classList.add('selected');
        cultureHighlightOn(event);
      })
      .on('mouseleave', (d) => {
        tip('', true);
        body.querySelector(`div[data-id='${d.i}']`).classList.remove('selected');
        cultureHighlightOff(event);
      })
      .call(d3.drag().on('start', cultureCenterDrag));
  }

  function cultureCenterDrag() {
    const el = d3.select(this);
    const c = +this.id.slice(13);
    d3.event.on('drag', () => {
      el.attr('cx', d3.event.x).attr('cy', d3.event.y);
      const cell = findCell(d3.event.x, d3.event.y);
      if (pack.cells.h[cell] < 20) return; // ignore dragging on water
      pack.cultures[c].center = cell;
      recalculateCultures();
    });
  }

  function toggleLegend() {
    if (legend.selectAll('*').size()) {
      clearLegend();
      return;
    } // hide legend
    const data = pack.cultures
      .filter((c) => c.i && !c.removed && c.cells)
      .sort((a, b) => b.area - a.area)
      .map((c) => [c.i, c.color, c.name]);
    drawLegend('Cultures', data);
  }

  function togglePercentageMode() {
    if (body.dataset.type === 'absolute') {
      body.dataset.type = 'percentage';
      const totalCells = +culturesFooterCells.innerHTML;
      const totalArea = +culturesFooterArea.dataset.area;
      const totalPopulation = +culturesFooterPopulation.dataset.population;

      body.querySelectorAll(':scope > div').forEach(function (el) {
        el.querySelector('.stateCells').innerHTML = rn((+el.dataset.cells / totalCells) * 100) + '%';
        el.querySelector('.biomeArea').innerHTML = rn((+el.dataset.area / totalArea) * 100) + '%';
        el.querySelector('.culturePopulation').innerHTML = rn((+el.dataset.population / totalPopulation) * 100) + '%';
      });
    } else {
      body.dataset.type = 'absolute';
      culturesEditorAddLines();
    }
  }

  function showHierarchy() {
    // build hierarchy tree
    pack.cultures[0].origin = null;
    const cultures = pack.cultures.filter((c) => !c.removed);
    if (cultures.length < 3) {
      tip('Not enough cultures to show hierarchy', false, 'error');
      return;
    }
    const root = d3
      .stratify()
      .id((d) => d.i)
      .parentId((d) => d.origin)(cultures);
    const treeWidth = root.leaves().length;
    const treeHeight = root.height;
    const width = treeWidth * 40,
      height = treeHeight * 60;

    const margin = {top: 10, right: 10, bottom: -5, left: 10};
    const w = width - margin.left - margin.right;
    const h = height + 30 - margin.top - margin.bottom;
    const treeLayout = d3.tree().size([w, h]);

    // prepare svg
    alertMessage.innerHTML = "<div id='cultureInfo' class='chartInfo'>&#8205;</div>";
    const svg = d3.select('#alertMessage').insert('svg', '#cultureInfo').attr('id', 'hierarchy').attr('width', width).attr('height', height).style('text-anchor', 'middle');
    const graph = svg.append('g').attr('transform', `translate(10, -45)`);
    const links = graph.append('g').attr('fill', 'none').attr('stroke', '#aaaaaa');
    const nodes = graph.append('g');

    renderTree();
    function renderTree() {
      treeLayout(root);
      links
        .selectAll('path')
        .data(root.links())
        .enter()
        .append('path')
        .attr('d', (d) => {
          return (
            'M' +
            d.source.x +
            ',' +
            d.source.y +
            'C' +
            d.source.x +
            ',' +
            (d.source.y * 3 + d.target.y) / 4 +
            ' ' +
            d.target.x +
            ',' +
            (d.source.y * 2 + d.target.y) / 3 +
            ' ' +
            d.target.x +
            ',' +
            d.target.y
          );
        });

      const node = nodes
        .selectAll('g')
        .data(root.descendants())
        .enter()
        .append('g')
        .attr('data-id', (d) => d.data.i)
        .attr('stroke', '#333333')
        .attr('transform', (d) => `translate(${d.x}, ${d.y})`)
        .on('mouseenter', () => cultureHighlightOn(event))
        .on('mouseleave', () => cultureHighlightOff(event))
        .call(d3.drag().on('start', (d) => dragToReorigin(d)));

      node
        .append('path')
        .attr('d', (d) => {
          if (!d.data.i) return 'M5,0A5,5,0,1,1,-5,0A5,5,0,1,1,5,0';
          // small circle
          else if (d.data.type === 'Generic') return 'M11.3,0A11.3,11.3,0,1,1,-11.3,0A11.3,11.3,0,1,1,11.3,0';
          // circle
          else if (d.data.type === 'River') return 'M0,-14L14,0L0,14L-14,0Z';
          // diamond
          else if (d.data.type === 'Lake') return 'M-6.5,-11.26l13,0l6.5,11.26l-6.5,11.26l-13,0l-6.5,-11.26Z';
          // hexagon
          else if (d.data.type === 'Naval') return 'M-11,-11h22v22h-22Z'; // square
          if (d.data.type === 'Highland') return 'M-11,-11l11,2l11,-2l-2,11l2,11l-11,-2l-11,2l2,-11Z'; // concave square
          if (d.data.type === 'Nomadic') return 'M-4.97,-12.01 l9.95,0 l7.04,7.04 l0,9.95 l-7.04,7.04 l-9.95,0 l-7.04,-7.04 l0,-9.95Z'; // octagon
          if (d.data.type === 'Hunting') return 'M0,-14l14,11l-6,14h-16l-6,-14Z'; // pentagon
          return 'M-11,-11h22v22h-22Z'; // square
        })
        .attr('fill', (d) => (d.data.i ? d.data.color : '#ffffff'))
        .attr('stroke-dasharray', (d) => (d.data.cells ? 'null' : '1'));

      node
        .append('text')
        .attr('dy', '.35em')
        .text((d) => (d.data.i ? d.data.code : ''));
    }

    $('#alert').dialog({
      title: 'Cultures tree',
      width: fitContent(),
      resizable: false,
      position: {my: 'left center', at: 'left+10 center', of: 'svg'},
      buttons: {},
      close: () => {
        alertMessage.innerHTML = '';
      }
    });

    function dragToReorigin(d) {
      if (isCtrlClick(d3.event.sourceEvent)) {
        changeCode(d);
        return;
      }

      const originLine = graph.append('path').attr('class', 'dragLine').attr('d', `M${d.x},${d.y}L${d.x},${d.y}`);

      d3.event.on('drag', () => {
        originLine.attr('d', `M${d.x},${d.y}L${d3.event.x},${d3.event.y}`);
      });

      d3.event.on('end', () => {
        originLine.remove();
        const selected = graph.select('path.selected');
        if (!selected.size()) return;
        const culture = d.data.i;
        const oldOrigin = d.data.origin;
        let newOrigin = selected.datum().data.i;
        if (newOrigin == oldOrigin) return; // already a child of the selected node
        if (newOrigin == culture) newOrigin = 0; // move to top
        if (newOrigin && d.descendants().some((node) => node.id == newOrigin)) return; // cannot be a child of its own child
        pack.cultures[culture].origin = d.data.origin = newOrigin; // change data
        showHierarchy(); // update hierarchy
      });
    }

    function changeCode(d) {
      prompt(`Please provide an abbreviation for culture: ${d.data.name}`, {default: d.data.code}, (v) => {
        pack.cultures[d.data.i].code = v;
        nodes
          .select("g[data-id='" + d.data.i + "']")
          .select('text')
          .text(v);
      });
    }
  }

  function recalculateCultures(must) {
    if (!must && !culturesAutoChange.checked) return;

    pack.cells.culture = new Uint16Array(pack.cells.i.length);
    pack.cultures.forEach(function (c) {
      if (!c.i || c.removed) return;
      pack.cells.culture[c.center] = c.i;
    });
    Cultures.expand();
    drawCultures();
    pack.burgs.forEach((b) => (b.culture = pack.cells.culture[b.cell]));
    refreshCulturesEditor();
    document.querySelector('input.statePower').focus(); // to not trigger hotkeys
  }

  function enterCultureManualAssignent() {
    if (!layerIsOn('toggleCultures')) toggleCultures();
    customization = 4;
    cults.append('g').attr('id', 'temp');
    document.querySelectorAll('#culturesBottom > *').forEach((el) => (el.style.display = 'none'));
    document.getElementById('culturesManuallyButtons').style.display = 'inline-block';
    debug.select('#cultureCenters').style('display', 'none');

    culturesEditor.querySelectorAll('.hide').forEach((el) => el.classList.add('hidden'));
    culturesHeader.querySelector("div[data-sortby='type']").style.left = '8.8em';
    culturesHeader.querySelector("div[data-sortby='base']").style.left = '13.6em';
    culturesFooter.style.display = 'none';
    body.querySelectorAll('div > input, select, span, svg').forEach((e) => (e.style.pointerEvents = 'none'));
    $('#culturesEditor').dialog({position: {my: 'right top', at: 'right-10 top+10', of: 'svg'}});

    tip('Click on culture to select, drag the circle to change culture', true);
    viewbox.style('cursor', 'crosshair').on('click', selectCultureOnMapClick).call(d3.drag().on('start', dragCultureBrush)).on('touchmove mousemove', moveCultureBrush);

    body.querySelector('div').classList.add('selected');
  }

  function selectCultureOnLineClick(i) {
    if (customization !== 4) return;
    body.querySelector('div.selected').classList.remove('selected');
    this.classList.add('selected');
  }

  function selectCultureOnMapClick() {
    const point = d3.mouse(this);
    const i = findCell(point[0], point[1]);
    if (pack.cells.h[i] < 20) return;

    const assigned = cults.select('#temp').select("polygon[data-cell='" + i + "']");
    const culture = assigned.size() ? +assigned.attr('data-culture') : pack.cells.culture[i];

    body.querySelector('div.selected').classList.remove('selected');
    body.querySelector("div[data-id='" + culture + "']").classList.add('selected');
  }

  function dragCultureBrush() {
    const r = +culturesManuallyBrush.value;

    d3.event.on('drag', () => {
      if (!d3.event.dx && !d3.event.dy) return;
      const p = d3.mouse(this);
      moveCircle(p[0], p[1], r);

      const found = r > 5 ? findAll(p[0], p[1], r) : [findCell(p[0], p[1], r)];
      const selection = found.filter(isLand);
      if (selection) changeCultureForSelection(selection);
    });
  }

  function changeCultureForSelection(selection) {
    const temp = cults.select('#temp');
    const selected = body.querySelector('div.selected');

    const cultureNew = +selected.dataset.id;
    const color = pack.cultures[cultureNew].color || '#ffffff';

    selection.forEach(function (i) {
      const exists = temp.select("polygon[data-cell='" + i + "']");
      const cultureOld = exists.size() ? +exists.attr('data-culture') : pack.cells.culture[i];
      if (cultureNew === cultureOld) return;

      // change of append new element
      if (exists.size()) exists.attr('data-culture', cultureNew).attr('fill', color).attr('stroke', color);
      else temp.append('polygon').attr('data-cell', i).attr('data-culture', cultureNew).attr('points', getPackPolygon(i)).attr('fill', color).attr('stroke', color);
    });
  }

  function moveCultureBrush() {
    showMainTip();
    const point = d3.mouse(this);
    const radius = +culturesManuallyBrush.value;
    moveCircle(point[0], point[1], radius);
  }

  function applyCultureManualAssignent() {
    const changed = cults.select('#temp').selectAll('polygon');
    changed.each(function () {
      const i = +this.dataset.cell;
      const c = +this.dataset.culture;
      pack.cells.culture[i] = c;
      if (pack.cells.burg[i]) pack.burgs[pack.cells.burg[i]].culture = c;
    });

    if (changed.size()) {
      drawCultures();
      refreshCulturesEditor();
    }
    exitCulturesManualAssignment();
  }

  function exitCulturesManualAssignment(close) {
    customization = 0;
    cults.select('#temp').remove();
    removeCircle();
    document.querySelectorAll('#culturesBottom > *').forEach((el) => (el.style.display = 'inline-block'));
    document.getElementById('culturesManuallyButtons').style.display = 'none';

    culturesEditor.querySelectorAll('.hide').forEach((el) => el.classList.remove('hidden'));
    culturesHeader.querySelector("div[data-sortby='type']").style.left = '18.6em';
    culturesHeader.querySelector("div[data-sortby='base']").style.left = '35.8em';
    culturesFooter.style.display = 'block';
    body.querySelectorAll('div > input, select, span, svg').forEach((e) => (e.style.pointerEvents = 'all'));
    if (!close) $('#culturesEditor').dialog({position: {my: 'right top', at: 'right-10 top+10', of: 'svg'}});

    debug.select('#cultureCenters').style('display', null);
    restoreDefaultEvents();
    clearMainTip();
    const selected = body.querySelector('div.selected');
    if (selected) selected.classList.remove('selected');
  }

  function enterAddCulturesMode() {
    if (this.classList.contains('pressed')) {
      exitAddCultureMode();
      return;
    }
    customization = 9;
    this.classList.add('pressed');
    tip('Click on the map to add a new culture', true);
    viewbox.style('cursor', 'crosshair').on('click', addCulture);
    body.querySelectorAll('div > input, select, span, svg').forEach((e) => (e.style.pointerEvents = 'none'));
  }

  function exitAddCultureMode() {
    customization = 0;
    restoreDefaultEvents();
    clearMainTip();
    body.querySelectorAll('div > input, select, span, svg').forEach((e) => (e.style.pointerEvents = 'all'));
    if (culturesAdd.classList.contains('pressed')) culturesAdd.classList.remove('pressed');
  }

  function addCulture() {
    const point = d3.mouse(this);
    const center = findCell(point[0], point[1]);
    if (pack.cells.h[center] < 20) {
      tip('You cannot place culture center into the water. Please click on a land cell', false, 'error');
      return;
    }
    const occupied = pack.cultures.some((c) => !c.removed && c.center === center);
    if (occupied) {
      tip('This cell is already a culture center. Please select a different cell', false, 'error');
      return;
    }

    if (d3.event.shiftKey === false) exitAddCultureMode();
    Cultures.add(center);

    drawCultureCenters();
    culturesEditorAddLines();
  }

  function downloadCulturesData() {
    const unit = areaUnit.value === 'square' ? distanceUnitInput.value + '2' : areaUnit.value;
    let data = 'Id,Culture,Color,Cells,Expansionism,Type,Area ' + unit + ',Population,Namesbase,Emblems Shape\n'; // headers

    body.querySelectorAll(':scope > div').forEach(function (el) {
      data += el.dataset.id + ',';
      data += el.dataset.name + ',';
      data += el.dataset.color + ',';
      data += el.dataset.cells + ',';
      data += el.dataset.expansionism + ',';
      data += el.dataset.type + ',';
      data += el.dataset.area + ',';
      data += el.dataset.population + ',';
      const base = +el.dataset.base;
      data += nameBases[base].name + ',';
      data += el.dataset.emblems + '\n';
    });

    const name = getFileName('Cultures') + '.csv';
    downloadFile(data, name);
  }

  function closeCulturesEditor() {
    debug.select('#cultureCenters').remove();
    exitCulturesManualAssignment('close');
    exitAddCultureMode();
  }
}
