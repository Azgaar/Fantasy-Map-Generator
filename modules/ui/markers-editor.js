'use strict';
function editMarker() {
  if (customization) return;
  closeDialogs('#markerEditor, .stable');
  $('#markerEditor').dialog();

  elSelected = d3.select(d3.event.target).call(d3.drag().on('start', dragMarker)).classed('draggable', true);
  updateInputs();

  if (modules.editMarker) return;
  modules.editMarker = true;

  $('#markerEditor').dialog({
    title: 'Edit Marker',
    resizable: false,
    position: {my: 'center top+30', at: 'bottom', of: d3.event, collision: 'fit'},
    close: closeMarkerEditor
  });

  // add listeners
  document.getElementById('markerGroup').addEventListener('click', toggleGroupSection);
  document.getElementById('markerAddGroup').addEventListener('click', toggleGroupInput);
  document.getElementById('markerSelectGroup').addEventListener('change', changeGroup);
  document.getElementById('markerInputGroup').addEventListener('change', createGroup);
  document.getElementById('markerRemoveGroup').addEventListener('click', removeGroup);

  document.getElementById('markerIcon').addEventListener('click', toggleIconSection);
  document.getElementById('markerIconSize').addEventListener('input', changeIconSize);
  document.getElementById('markerIconShiftX').addEventListener('input', changeIconShiftX);
  document.getElementById('markerIconShiftY').addEventListener('input', changeIconShiftY);
  document.getElementById('markerIconSelect').addEventListener('click', selectMarkerIcon);

  document.getElementById('markerStyle').addEventListener('click', toggleStyleSection);
  document.getElementById('markerSize').addEventListener('input', changeMarkerSize);
  document.getElementById('markerBaseStroke').addEventListener('input', changePinStroke);
  document.getElementById('markerBaseFill').addEventListener('input', changePinFill);
  document.getElementById('markerIconStrokeWidth').addEventListener('input', changeIconStrokeWidth);
  document.getElementById('markerIconStroke').addEventListener('input', changeIconStroke);
  document.getElementById('markerIconFill').addEventListener('input', changeIconFill);

  document.getElementById('markerToggleBubble').addEventListener('click', togglePinVisibility);
  document.getElementById('markerLegendButton').addEventListener('click', editMarkerLegend);
  document.getElementById('markerAdd').addEventListener('click', toggleAddMarker);
  document.getElementById('markerRemove').addEventListener('click', removeMarker);

  updateGroupOptions();

  function dragMarker() {
    const tr = parseTransform(this.getAttribute('transform'));
    const x = +tr[0] - d3.event.x,
      y = +tr[1] - d3.event.y;

    d3.event.on('drag', function () {
      const transform = `translate(${x + d3.event.x},${y + d3.event.y})`;
      this.setAttribute('transform', transform);
    });
  }

  function updateInputs() {
    const id = elSelected.attr('data-id');
    const symbol = d3.select('#defs-markers').select(id);
    const icon = symbol.select('text');

    markerSelectGroup.value = id.slice(1);
    markerIconSize.value = parseFloat(icon.attr('font-size'));
    markerIconShiftX.value = parseFloat(icon.attr('x'));
    markerIconShiftY.value = parseFloat(icon.attr('y'));

    markerSize.value = elSelected.attr('data-size');
    markerBaseStroke.value = symbol.select('path').attr('fill');
    markerBaseFill.value = symbol.select('circle').attr('fill');

    markerIconStrokeWidth.value = icon.attr('stroke-width');
    markerIconStroke.value = icon.attr('stroke');
    markerIconFill.value = icon.attr('fill');

    markerToggleBubble.className = symbol.select('circle').attr('opacity') === '0' ? 'icon-info' : 'icon-info-circled';
    markerIconSelect.innerHTML = icon.text();
  }

  function toggleGroupSection() {
    if (markerGroupSection.style.display === 'inline-block') {
      markerEditor.querySelectorAll('button:not(#markerGroup)').forEach((b) => (b.style.display = 'inline-block'));
      markerGroupSection.style.display = 'none';
    } else {
      markerEditor.querySelectorAll('button:not(#markerGroup)').forEach((b) => (b.style.display = 'none'));
      markerGroupSection.style.display = 'inline-block';
    }
  }

  function updateGroupOptions() {
    markerSelectGroup.innerHTML = '';
    d3.select('#defs-markers')
      .selectAll('symbol')
      .each(function () {
        markerSelectGroup.options.add(new Option(this.id, this.id));
      });
    markerSelectGroup.value = elSelected.attr('data-id').slice(1);
  }

  function toggleGroupInput() {
    if (markerInputGroup.style.display === 'inline-block') {
      markerSelectGroup.style.display = 'inline-block';
      markerInputGroup.style.display = 'none';
    } else {
      markerSelectGroup.style.display = 'none';
      markerInputGroup.style.display = 'inline-block';
      markerInputGroup.focus();
    }
  }

  function changeGroup() {
    elSelected.attr('xlink:href', '#' + this.value);
    elSelected.attr('data-id', '#' + this.value);
  }

  function createGroup() {
    let newGroup = this.value
      .toLowerCase()
      .replace(/ /g, '_')
      .replace(/[^\w\s]/gi, '');
    if (Number.isFinite(+newGroup.charAt(0))) newGroup = 'm' + newGroup;
    if (document.getElementById(newGroup)) {
      tip('Element with this id already exists. Please provide a unique name', false, 'error');
      return;
    }

    markerInputGroup.value = '';
    // clone old group assigning new id
    const id = elSelected.attr('data-id');
    const clone = d3.select('#defs-markers').select(id).node().cloneNode(true);
    clone.id = newGroup;
    document.getElementById('defs-markers').insertBefore(clone, null);
    elSelected.attr('xlink:href', '#' + newGroup).attr('data-id', '#' + newGroup);

    // select new group
    markerSelectGroup.options.add(new Option(newGroup, newGroup, false, true));
    toggleGroupInput();
  }

  function removeGroup() {
    const id = elSelected.attr('data-id');
    const used = document.querySelectorAll("use[data-id='" + id + "']");

    const count = used.length === 1 ? '1 element' : used.length + ' elements';
    const message = `Are you sure you want to remove all markers of that type (${count})? <br>This action cannot be reverted`;
    const onConfirm = () => {
      if (id !== '#marker0') d3.select('#defs-markers').select(id).remove();
      used.forEach((e) => {
        const index = notes.findIndex((n) => n.id === e.id);
        if (index != -1) notes.splice(index, 1);
        e.remove();
      });
      updateGroupOptions();
      updateGroupOptions();
      $('#markerEditor').dialog('close');
    };
    confirmationDialog({title: 'Remove marker type', message, confirm: 'Remove', onConfirm});
  }

  function toggleIconSection() {
    if (markerIconSection.style.display === 'inline-block') {
      markerEditor.querySelectorAll('button:not(#markerIcon)').forEach((b) => (b.style.display = 'inline-block'));
      markerIconSection.style.display = 'none';
      markerIconSelect.style.display = 'none';
    } else {
      markerEditor.querySelectorAll('button:not(#markerIcon)').forEach((b) => (b.style.display = 'none'));
      markerIconSection.style.display = 'inline-block';
      markerIconSelect.style.display = 'inline-block';
    }
  }

  function selectMarkerIcon() {
    selectIcon(this.innerHTML, (v) => {
      this.innerHTML = v;
      const id = elSelected.attr('data-id');
      d3.select('#defs-markers').select(id).select('text').text(v);
    });
  }

  function changeIconSize() {
    const id = elSelected.attr('data-id');
    d3.select('#defs-markers')
      .select(id)
      .select('text')
      .attr('font-size', this.value + 'px');
  }

  function changeIconShiftX() {
    const id = elSelected.attr('data-id');
    d3.select('#defs-markers')
      .select(id)
      .select('text')
      .attr('x', this.value + '%');
  }

  function changeIconShiftY() {
    const id = elSelected.attr('data-id');
    d3.select('#defs-markers')
      .select(id)
      .select('text')
      .attr('y', this.value + '%');
  }

  function toggleStyleSection() {
    if (markerStyleSection.style.display === 'inline-block') {
      markerEditor.querySelectorAll('button:not(#markerStyle)').forEach((b) => (b.style.display = 'inline-block'));
      markerStyleSection.style.display = 'none';
    } else {
      markerEditor.querySelectorAll('button:not(#markerStyle)').forEach((b) => (b.style.display = 'none'));
      markerStyleSection.style.display = 'inline-block';
    }
  }

  function changeMarkerSize() {
    const id = elSelected.attr('data-id');
    document.querySelectorAll("use[data-id='" + id + "']").forEach((e) => {
      const x = +e.dataset.x,
        y = +e.dataset.y;
      const desired = (e.dataset.size = +markerSize.value);
      const size = Math.max(desired * 5 + 25 / scale, 1);

      e.setAttribute('x', x - size / 2);
      e.setAttribute('y', y - size / 2);
      e.setAttribute('width', size);
      e.setAttribute('height', size);
    });
    invokeActiveZooming();
  }

  function changePinStroke() {
    const id = elSelected.attr('data-id');
    d3.select(id).select('path').attr('fill', this.value);
    d3.select(id).select('circle').attr('stroke', this.value);
  }

  function changePinFill() {
    const id = elSelected.attr('data-id');
    d3.select(id).select('circle').attr('fill', this.value);
  }

  function changeIconStrokeWidth() {
    const id = elSelected.attr('data-id');
    d3.select('#defs-markers').select(id).select('text').attr('stroke-width', this.value);
  }

  function changeIconStroke() {
    const id = elSelected.attr('data-id');
    d3.select('#defs-markers').select(id).select('text').attr('stroke', this.value);
  }

  function changeIconFill() {
    const id = elSelected.attr('data-id');
    d3.select('#defs-markers').select(id).select('text').attr('fill', this.value);
  }

  function togglePinVisibility() {
    const id = elSelected.attr('data-id');
    let show = 1;
    if (this.className === 'icon-info-circled') {
      this.className = 'icon-info';
      show = 0;
    } else this.className = 'icon-info-circled';
    d3.select(id).select('circle').attr('opacity', show);
    d3.select(id).select('path').attr('opacity', show);
  }

  function editMarkerLegend() {
    const id = elSelected.attr('id');
    editNotes(id, id);
  }

  function toggleAddMarker() {
    document.getElementById('addMarker').click();
  }

  function removeMarker() {
    const message = 'Are you sure you want to remove the marker? <br>This action cannot be reverted';
    const onConfirm = () => {
      const index = notes.findIndex((n) => n.id === elSelected.attr('id'));
      if (index != -1) notes.splice(index, 1);
      elSelected.remove();
      $('#markerEditor').dialog('close');
    };
    confirmationDialog({title: 'Remove marker', message, confirm: 'Remove', onConfirm});
  }

  function closeMarkerEditor() {
    unselect();
    if (addMarker.classList.contains('pressed')) addMarker.classList.remove('pressed');
    if (markerAdd.classList.contains('pressed')) markerAdd.classList.remove('pressed');
    restoreDefaultEvents();
    clearMainTip();
  }
}
