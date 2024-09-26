'use strict';
function editResources() {
  if (customization) return;
  closeDialogs('#resourcesEditor, .stable');
  if (!layerIsOn('toggleResources')) toggleResources();
  const body = document.getElementById('resourcesBody');

  resourcesEditorAddLines();

  if (modules.editResources) return;
  modules.editResources = true;

  $('#resourcesEditor').dialog({
    title: 'Resources Editor',
    resizable: false,
    width: fitContent(),
    close: closeResourcesEditor,
    position: {my: 'right top', at: 'right-10 top+10', of: 'svg'}
  });

  // add listeners
  document.getElementById('resourcesEditorRefresh').addEventListener('click', resourcesEditorAddLines);
  document.getElementById('resourcesRegenerate').addEventListener('click', regenerateCurrentResources);
  document.getElementById('resourcesLegend').addEventListener('click', toggleLegend);
  document.getElementById('resourcesPercentage').addEventListener('click', togglePercentageMode);
  document.getElementById('resourcesAssign').addEventListener('click', enterResourceAssignMode);
  document.getElementById('resourcesAdd').addEventListener('click', resourceAdd);
  document.getElementById('resourcesRestore').addEventListener('click', resourcesRestoreDefaults);
  document.getElementById('resourcesExport').addEventListener('click', downloadResourcesData);
  document.getElementById('resourcesUnpinAll').addEventListener('click', unpinAllResources);

  body.addEventListener('click', function (ev) {
    const el = ev.target,
      cl = el.classList,
      line = el.parentNode;
    const resource = Resources.get(+line.dataset.id);
    if (cl.contains('resourceIcon')) return changeIcon(resource, line, el);
    if (cl.contains('resourceCategory')) return changeCategory(resource, line, el);
    if (cl.contains('resourceModel')) return changeModel(resource, line, el);
    if (cl.contains('resourceBonus')) return changeBonus(resource, line, el);
    if (cl.contains('icon-pin')) return pinResource(resource, el);
    if (cl.contains('icon-trash-empty')) return removeResource(resource, line);
  });

  body.addEventListener('change', function (ev) {
    const el = ev.target,
      cl = el.classList,
      line = el.parentNode;
    const resource = Resources.get(+line.dataset.id);
    if (cl.contains('resourceName')) return changeName(resource, el.value, line);
    if (cl.contains('resourceValue')) return changeValue(resource, el.value, line);
    if (cl.contains('resourceChance')) return changeChance(resource, el.value, line);
  });

  function getBonusIcon(bonus) {
    if (bonus === 'fleet') return `<span data-tip="Fleet bonus" class="icon-anchor"></span>`;
    if (bonus === 'defence') return `<span data-tip="Defence bonus" class="icon-chess-rook"></span>`;
    if (bonus === 'prestige') return `<span data-tip="Prestige bonus" class="icon-star"></span>`;
    if (bonus === 'artillery') return `<span data-tip="Artillery bonus" class="icon-rocket"></span>`;
    if (bonus === 'infantry') return `<span data-tip="Infantry bonus" class="icon-chess-pawn"></span>`;
    if (bonus === 'population') return `<span data-tip="Population bonus" class="icon-male"></span>`;
    if (bonus === 'archers') return `<span data-tip="Archers bonus" class="icon-dot-circled"></span>`;
    if (bonus === 'cavalry') return `<span data-tip="Cavalry bonus" class="icon-chess-knight"></span>`;
  }

  // add line for each resource
  function resourcesEditorAddLines() {
    const addTitle = (string, max) => (string.length < max ? '' : `title="${string}"`);
    let lines = '';

    for (const r of pack.resources) {
      const stroke = Resources.getStroke(r.color);
      const model = r.model.replaceAll('_', ' ');
      const bonusArray = Object.entries(r.bonus)
        .map((e) => Array(e[1]).fill(e[0]))
        .flat();
      const bonusHTML = bonusArray.map((bonus) => getBonusIcon(bonus)).join('');
      const bonusString = Object.entries(r.bonus)
        .map((e) => e.join(': '))
        .join('; ');

      lines += `<div class="states resources"
          data-id=${r.i} data-name="${r.name}" data-color="${r.color}"
          data-category="${r.category}" data-chance="${r.chance}" data-bonus="${bonusString}"
          data-value="${r.value}" data-model="${r.model}" data-cells="${r.cells}">
        <svg data-tip="Resource icon. Click to change" width="2em" height="2em" class="resourceIcon">
          <circle cx="50%" cy="50%" r="42%" fill="${r.color}" stroke="${stroke}"/>
          <use href="#${r.icon}" x="10%" y="10%" width="80%" height="80%"/>
        </svg>
        <input data-tip="Resource name. Click and category to change" class="resourceName" value="${r.name}" autocorrect="off" spellcheck="false">
        <div data-tip="Resource category. Select to change" class="resourceCategory">${r.category}</div>
        <input data-tip="Resource generation chance in eligible cell. Click and type to change" class="resourceChance" value="${r.chance}" type="number" min=0 max=100 step=.1 />
        <div data-tip="Number of cells with resource" class="resourceCells">${r.cells}</div>

        <div data-tip="Resource spread model. Click to change" class="resourceModel hide" ${addTitle(model, 8)}">${model}</div>
        <input data-tip="Resource basic value. Click and type to change" class="resourceValue hide" value="${r.value}" type="number" min=0 max=100 step=1 />
        <div data-tip="Resource bonus. Click to change" class="resourceBonus hide" title="${bonusString}">${bonusHTML || "<span style='opacity:0'>place</span>"}</div>

        <span data-tip="Toogle resource exclusive visibility (pin)" class="icon-pin inactive hide"></span>
        <span data-tip="Remove resource" class="icon-trash-empty hide"></span>
      </div>`;
    }
    body.innerHTML = lines;

    // update footer
    document.getElementById('resourcesNumber').innerHTML = pack.resources.length;

    // add listeners
    body.querySelectorAll('div.states').forEach((el) => el.addEventListener('click', selectResourceOnLineClick));

    if (body.dataset.type === 'percentage') {
      body.dataset.type = 'absolute';
      togglePercentageMode();
    }
    applySorting(resourcesHeader);
    $('#resourcesEditor').dialog({width: fitContent()});
  }

  function changeCategory(resource, line, el) {
    const categories = [...new Set(pack.resources.map((r) => r.category))].sort();
    const categoryOptions = (category) => categories.map((c) => `<option ${c === category ? 'selected' : ''} value="${c}">${c}</option>`).join('');

    alertMessage.innerHTML = `
      <div style="margin-bottom:.2em" data-tip="Select category from the list">
        <div style="display: inline-block; width: 9em">Select category:</div>
        <select style="width: 9em" id="resouceCategorySelect">${categoryOptions(line.dataset.category)}</select>
      </div>

      <div style="margin-bottom:.2em" data-tip="Type new category name">
        <div style="display: inline-block; width: 9em">Custom category:</div>
        <input style="width: 9em" id="resouceCategoryAdd" placeholder="Category name" />
      </div>
    `;

    $('#alert').dialog({
      resizable: false,
      title: 'Change category',
      buttons: {
        Cancel: function () {
          $(this).dialog('close');
        },
        Apply: function () {
          applyChanges();
          $(this).dialog('close');
        }
      }
    });

    function applyChanges() {
      const custom = document.getElementById('resouceCategoryAdd').value;
      const select = document.getElementById('resouceCategorySelect').value;
      const category = custom ? capitalize(custom) : select;
      resource.category = line.dataset.category = el.innerHTML = category;
    }
  }

  function changeModel(resource, line, el) {
    const model = line.dataset.model;
    const modelOptions = Object.keys(models)
      .sort()
      .map((m) => `<option ${m === model ? 'selected' : ''} value="${m}">${m.replaceAll('_', ' ')}</option>`)
      .join('');
    const wikiURL = 'https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Resources:-spread-functions';
    const onSelect = "resouceModelFunction.innerHTML = Resources.models[this.value] || ' '; resouceModelCustomName.value = ''; resouceModelCustomFunction.value = ''";

    alertMessage.innerHTML = `
      <fieldset data-tip="Select one of the predefined spread models from the list" style="border: 1px solid #999; margin-bottom: 1em">
        <legend>Predefined models</legend>
        <div style="margin-bottom:.2em">
          <div style="display: inline-block; width: 6em">Name:</div>
          <select onchange="${onSelect}" style="width: 18em" id="resouceModelSelect">
            <option value=""><i>Custom</i></option>
            ${modelOptions}
          </select>
        </div>

        <div style="margin-bottom:.2em">
          <div style="display: inline-block; width: 6em">Function:</div>
          <div id="resouceModelFunction" style="display: inline-block; width: 18em; font-family: monospace; border: 1px solid #ccc; padding: 3px; font-size: .95em;vertical-align: middle">
            ${models[model] || ' '}
          </div>
        </div>
      </fieldset>

      <fieldset data-tip="Advanced option. Define custom spread model, click on 'Help' for details" style="border: 1px solid #999">
        <legend>Custom model</legend>
        <div style="margin-bottom:.2em">
          <div style="display: inline-block; width: 6em">Name:</div>
          <input style="width: 18em" id="resouceModelCustomName" value="${resource.custom ? resource.model : ''}" />
        </div>

        <div>
          <div style="display: inline-block; width: 6em">Function:</div>
          <input style="width: 18.75em; font-family: monospace; font-size: .95em" id="resouceModelCustomFunction" spellcheck="false" value="${resource.custom || ''}"/>
        </div>
      </fieldset>

      <div id="resourceModelMessage" style="color: #b20000; margin: .4em 1em 0"></div>
    `;

    $('#alert').dialog({
      resizable: false,
      title: 'Change spread model',
      buttons: {
        Help: () => openURL(wikiURL),
        Cancel: function () {
          $(this).dialog('close');
        },
        Apply: function () {
          applyChanges(this);
        }
      }
    });

    function applyChanges(dialog) {
      const customName = document.getElementById('resouceModelCustomName').value;
      const customFn = document.getElementById('resouceModelCustomFunction').value;

      const message = document.getElementById('resourceModelMessage');
      if (customName && !customFn) return (message.innerHTML = 'Error. Custom model function is required');
      if (!customName && customFn) return (message.innerHTML = 'Error. Custom model name is required');
      message.innerHTML = '';

      if (customName && customFn) {
        try {
          const allMethods = '{' + Object.keys(Resources.methods).join(', ') + '}';
          const fn = new Function(allMethods, 'return ' + customFn);
          fn({...Resources.methods});
        } catch (err) {
          message.innerHTML = 'Error. ' + err.message || err;
          return;
        }

        resource.model = line.dataset.model = el.innerHTML = customName;
        el.setAttribute('title', customName.length > 7 ? customName : '');
        resource.custom = customFn;
        $(dialog).dialog('close');
        return;
      }

      const model = document.getElementById('resouceModelSelect').value;
      if (!model) return (message.innerHTML = 'Error. Model is not set');

      resource.model = line.dataset.model = el.innerHTML = model;
      el.setAttribute('title', model.length > 7 ? model : '');
      $(dialog).dialog('close');
    }
  }

  function changeBonus(resource, line, el) {
    const bonuses = [...new Set(pack.resources.map((r) => Object.keys(r.bonus)).flat())].sort();
    const inputs = bonuses.map(
      (bonus) => `<div style="margin-bottom:.2em">
        ${getBonusIcon(bonus)}
        <div style="display: inline-block; width: 8em">${capitalize(bonus)}</div>
        <input id="resourceBonus_${bonus}" style="width: 4.1em" type="number" step="1" min="0" max="9" value="${resource.bonus[bonus] || 0}" />
      </div>`
    );

    alertMessage.innerHTML = inputs.join('');
    $('#alert').dialog({
      resizable: false,
      title: 'Change bonus',
      buttons: {
        Cancel: function () {
          $(this).dialog('close');
        },
        Apply: function () {
          applyChanges();
          $(this).dialog('close');
        }
      }
    });

    function applyChanges() {
      const bonusObj = {};
      bonuses.forEach((bonus) => {
        const el = document.getElementById('resourceBonus_' + bonus);
        const value = parseInt(el.value);
        if (isNaN(value) || !value) return;
        bonusObj[bonus] = value;
      });

      const bonusArray = Object.entries(bonusObj).map(e => Array(e[1]).fill(e[0])).flat(); //prettier-ignore
      const bonusHTML = bonusArray.map((bonus) => getBonusIcon(bonus)).join('');
      const bonusString = Object.entries(bonusObj).map((e) => e.join(': ')).join('; '); //prettier-ignore

      resource.bonus = bonusObj;
      el.innerHTML = bonusHTML || "<span style='opacity:0'>place</span>";
      line.dataset.bonus = bonusString;
      el.setAttribute('title', bonusString);
    }
  }

  function changeName(resource, name, line) {
    resource.name = line.dataset.name = name;
  }

  function changeValue(resource, value, line) {
    resource.value = line.dataset.value = +value;
  }

  function changeChance(resource, chance, line) {
    resource.chance = line.dataset.chance = +chance;
  }

  function changeIcon(resource, line, el) {
    const standardIcons = Array.from(document.getElementById('resource-icons').querySelectorAll('symbol')).map((el) => el.id);
    const standardIconsOptions = standardIcons.map((icon) => `<option value=${icon}>${icon}</option>`);

    const customIconsEl = document.getElementById('defs-icons');
    const customIcons = customIconsEl ? Array.from(document.getElementById('defs-icons').querySelectorAll('svg')).map((el) => el.id) : [];
    const customIconsOptions = customIcons.map((icon) => `<option value=${icon}>${icon}</option>`);

    const select = document.getElementById('resourceSelectIcon');
    select.innerHTML = standardIconsOptions + customIconsOptions;
    select.value = resource.icon;

    const preview = document.getElementById('resourceIconPreview');
    preview.setAttribute('href', '#' + resource.icon);

    const viewBoxSection = document.getElementById('resourceIconEditorViewboxFields');
    viewBoxSection.style.display = 'none';

    $('#resourceIconEditor').dialog({
      resizable: false,
      title: 'Change Icon',
      buttons: {
        Cancel: function () {
          $(this).dialog('close');
        },
        'Change color': () => changeColor(resource, line, el),
        Apply: function () {
          $(this).dialog('close');

          resource.icon = select.value;
          line.querySelector('svg.resourceIcon > use').setAttribute('href', '#' + select.value);
          drawResources();
        }
      },
      position: {my: 'center bottom', at: 'center', of: 'svg'}
    });

    const uploadTo = document.getElementById('defs-icons');
    const onUpload = (type, id) => {
      preview.setAttribute('href', '#' + id);
      select.innerHTML += `<option value=${id}>${id}</option>`;
      select.value = id;

      if (type === 'image') return;

      // let user set viewBox for svg image
      const el = document.getElementById(id);
      viewBoxSection.style.display = 'block';
      const viewBoxAttr = el.getAttribute('viewBox');
      const initialViewBox = viewBoxAttr ? viewBoxAttr.split(' ') : [0, 0, 200, 200];
      const inputs = viewBoxSection.querySelectorAll('input');
      const changeInput = () => {
        const viewBox = Array.from(inputs)
          .map((input) => input.value)
          .join(' ');
        el.setAttribute('viewBox', viewBox);
      };
      inputs.forEach((input, i) => {
        input.value = initialViewBox[i];
        input.onchange = changeInput;
      });
    };

    // add listeners
    select.onchange = () => preview.setAttribute('href', '#' + select.value);
    document.getElementById('resourceUploadIconRaster').onclick = () => imageToLoad.click();
    document.getElementById('resourceUploadIconVector').onclick = () => svgToLoad.click();
    document.getElementById('imageToLoad').onchange = () => uploadImage('image', uploadTo, onUpload);
    document.getElementById('svgToLoad').onchange = () => uploadImage('svg', uploadTo, onUpload);
  }

  function uploadImage(type, uploadTo, callback) {
    const input = type === 'image' ? document.getElementById('imageToLoad') : document.getElementById('svgToLoad');
    const file = input.files[0];
    input.value = '';

    if (file.size > 200000) return tip(`File is too big, please optimize file size up to 200kB and re-upload. Recommended size is 48x48 px and up to 10kB`, true, 'error', 5000);

    const reader = new FileReader();
    reader.onload = function (readerEvent) {
      const result = readerEvent.target.result;
      const id = 'resource-custom-' + Math.random().toString(36).slice(-6);

      if (type === 'image') {
        const svg = `<svg id="${id}" xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><image x="0" y="0" width="200" height="200" href="${result}"/></svg>`;
        uploadTo.insertAdjacentHTML('beforeend', svg);
      } else {
        const el = document.createElement('html');
        el.innerHTML = result;

        // remove sodipodi and inkscape attributes
        el.querySelectorAll('*').forEach((el) => {
          const attributes = el.getAttributeNames();
          attributes.forEach((attr) => {
            if (attr.includes('inkscape') || attr.includes('sodipodi')) el.removeAttribute(attr);
          });
        });

        // remove all text if source is Noun project (to make it usable)
        if (result.includes('from the Noun Project')) el.querySelectorAll('text').forEach((textEl) => textEl.remove());

        const svg = el.querySelector('svg');
        if (!svg) return tip("The file should be prepated for load to FMG. If you don't know why it's happening, try to upload the raster image", false, 'error');

        const icon = uploadTo.appendChild(svg);
        icon.id = id;
        icon.setAttribute('width', 200);
        icon.setAttribute('height', 200);
      }

      callback(type, id);
    };

    if (type === 'image') reader.readAsDataURL(file);
    else reader.readAsText(file);
  }

  function changeColor(resource, line, el) {
    const circle = el.querySelector('circle');

    const callback = (fill) => {
      const stroke = Resources.getStroke(fill);
      circle.setAttribute('fill', fill);
      circle.setAttribute('stroke', stroke);
      resource.color = fill;
      resource.stroke = stroke;
      goods.selectAll(`circle[data-i='${resource.i}']`).attr('fill', fill).attr('stroke', stroke);
      line.dataset.color = fill;
    };

    openPicker(resource.color, callback, {allowHatching: false});
  }

  function regenerateCurrentResources() {
    const message = 'Are you sure you want to regenerate resources? <br>This action cannot be reverted';
    confirmationDialog({title: 'Regenerate resources', message, confirm: 'Regenerate', onConfirm: regenerateResources});
  }

  function resourcesRestoreDefaults() {
    const message = 'Are you sure you want to restore default resources? <br>This action cannot be reverted';
    const onConfirm = () => {
      delete pack.resources;
      regenerateResources();
    };
    confirmationDialog({title: 'Restore default resources', message, confirm: 'Restore', onConfirm});
  }

  function toggleLegend() {
    if (legend.selectAll('*').size()) {
      clearLegend();
      return;
    }

    const data = pack.resources
      .filter((r) => r.i && r.cells)
      .sort((a, b) => b.cells - a.cells)
      .map((r) => [r.i, r.color, r.name]);
    drawLegend('Resources', data);
  }

  function togglePercentageMode() {
    if (body.dataset.type === 'absolute') {
      body.dataset.type = 'percentage';
      const totalCells = pack.cells.resource.filter((r) => r !== 0).length;

      body.querySelectorAll(':scope > div').forEach(function (el) {
        el.querySelector('.cells').innerHTML = rn((+el.dataset.cells / totalCells) * 100) + '%';
      });
    } else {
      body.dataset.type = 'absolute';
      resourcesEditorAddLines();
    }
  }

  function enterResourceAssignMode() {
    if (this.classList.contains('pressed')) return exitResourceAssignMode();
    customization = 14;
    this.classList.add('pressed');
    if (!layerIsOn('toggleResources')) toggleResources();
    if (!layerIsOn('toggleCells')) {
      const toggler = document.getElementById('toggleCells');
      toggler.dataset.forced = true;
      toggleCells();
    }

    document
      .getElementById('resourcesEditor')
      .querySelectorAll('.hide')
      .forEach((el) => el.classList.add('hidden'));
    document.getElementById('resourcesFooter').style.display = 'none';
    body.querySelectorAll('.resourceName, .resourceCategory, .resourceChance, .resourceCells, svg').forEach((e) => (e.style.pointerEvents = 'none'));
    $('#resourcesEditor').dialog({position: {my: 'right top', at: 'right-10 top+10', of: 'svg', collision: 'fit'}});

    tip('Select resource line in editor, click on cells to remove or add a resource', true);
    viewbox.on('click', changeResourceOnCellClick);

    body.querySelector('div').classList.add('selected');

    const someArePinned = pack.resources.some((resource) => resource.pinned);
    if (someArePinned) unpinAllResources();
  }

  function selectResourceOnLineClick() {
    if (customization !== 14) return;
    //if (this.parentNode.id !== "statesBodySection") return;
    body.querySelector('div.selected').classList.remove('selected');
    this.classList.add('selected');
  }

  function changeResourceOnCellClick() {
    const point = d3.mouse(this);
    const i = findCell(point[0], point[1]);
    const selected = body.querySelector('div.selected');
    if (!selected) return;

    if (pack.cells.resource[i]) {
      const resourceToRemove = Resources.get(pack.cells.resource[i]);
      if (resourceToRemove) resourceToRemove.cells -= 1;
      body.querySelector("div.states[data-id='" + resourceToRemove.i + "'] > .resourceCells").innerHTML = resourceToRemove.cells;
      pack.cells.resource[i] = 0;
    } else {
      const resourceId = +selected.dataset.id;
      const resource = Resources.get(resourceId);
      resource.cells += 1;
      body.querySelector("div.states[data-id='" + resourceId + "'] > .resourceCells").innerHTML = resource.cells;
      pack.cells.resource[i] = resourceId;
    }

    goods.selectAll('*').remove();
    drawResources();
  }

  function exitResourceAssignMode(close) {
    customization = 0;
    document.getElementById('resourcesAssign').classList.remove('pressed');

    if (layerIsOn('toggleCells')) {
      const toggler = document.getElementById('toggleCells');
      if (toggler.dataset.forced) toggleCells();
      delete toggler.dataset.forced;
    }

    document
      .getElementById('resourcesEditor')
      .querySelectorAll('.hide')
      .forEach((el) => el.classList.remove('hidden'));
    document.getElementById('resourcesFooter').style.display = 'block';
    body.querySelectorAll('.resourceName, .resourceCategory, .resourceChance, .resourceCells, svg').forEach((e) => delete e.style.pointerEvents);
    !close && $('#resourcesEditor').dialog({position: {my: 'right top', at: 'right-10 top+10', of: 'svg', collision: 'fit'}});

    restoreDefaultEvents();
    clearMainTip();
    const selected = body.querySelector('div.selected');
    if (selected) selected.classList.remove('selected');
  }

  function resourceAdd() {
    if (pack.resources.length >= 256) return tip('Maximum number of resources is reached', false, 'error');

    let i = last(pack.resources).i;
    while (Resources.get(i)) {
      i++;
    }
    const resource = {i, name: 'Resource' + i, category: 'Unknown', icon: 'resource-unknown', color: '#ff5959', value: 1, chance: 10, model: 'habitability', bonus: {population: 1}, cells: 0};
    pack.resources.push(resource);
    tip('Resource is added', false, 'success', 3000);
    resourcesEditorAddLines();
  }

  function downloadResourcesData() {
    let data = 'Id,Resource,Color,Category,Value,Bonus,Chance,Model,Cells\n'; // headers

    body.querySelectorAll(':scope > div').forEach(function (el) {
      data += el.dataset.id + ',';
      data += el.dataset.name + ',';
      data += el.dataset.color + ',';
      data += el.dataset.category + ',';
      data += el.dataset.value + ',';
      data += el.dataset.bonus + ',';
      data += el.dataset.chance + ',';
      data += el.dataset.model + ',';
      data += el.dataset.cells + '\n';
    });

    const name = getFileName('Resources') + '.csv';
    downloadFile(data, name);
  }

  function pinResource(resource, el) {
    const pin = el.classList.contains('inactive');
    el.classList.toggle('inactive');

    if (pin) resource.pinned = pin;
    else delete resource.pinned;

    goods.selectAll('*').remove();
    drawResources();

    // manage top unpin all button state
    const someArePinned = pack.resources.some((resource) => resource.pinned);
    const unpinAll = document.getElementById('resourcesUnpinAll');
    someArePinned ? unpinAll.classList.remove('hidden') : unpinAll.classList.add('hidden');
  }

  function unpinAllResources() {
    pack.resources.forEach((resource) => delete resource.pinned);
    goods.selectAll('*').remove();
    drawResources();

    document.getElementById('resourcesUnpinAll').classList.add('hidden');
    body.querySelectorAll(':scope > div > span.icon-pin').forEach((el) => el.classList.add('inactive'));
  }

  function removeResource(res, line) {
    if (customization) return;

    const message = 'Are you sure you want to remove the resource? <br>This action cannot be reverted';
    const onConfirm = () => {
      for (const i of pack.cells.i) {
        if (pack.cells.resource[i] === res.i) {
          pack.cells.resource[i] = 0;
        }
      }

      pack.resources = pack.resources.filter((resource) => resource.i !== res.i);
      line.remove();

      goods.selectAll('*').remove();
      drawResources();
    };
    confirmationDialog({title: 'Remove resource', message, confirm: 'Remove', onConfirm});
  }

  function closeResourcesEditor() {
    if (customization === 14) exitResourceAssignMode('close');
    unpinAllResources();
    body.innerHTML = '';
  }
}
