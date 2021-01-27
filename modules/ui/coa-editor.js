"use strict";
function editEmblem(type, id, el) {
  if (customization) return;

  const emblemStates = document.getElementById("emblemStates");
  const emblemProvinces = document.getElementById("emblemProvinces");
  const emblemBurgs = document.getElementById("emblemBurgs");
  const {states, provinces, burgs, cells} = pack;

  updateElementSelectors(type, id, el);

  $("#emblemEditor").dialog({
    title: "Edit Emblem", resizable: true, width: "auto",
    position: {my: "left top", at: "left+10 top+10", of: "svg", collision: "fit"}
  });

  if (modules.editEmblem) return;
  modules.editEmblem = true;

  // add listeners
  emblemStates.addEventListener("input", selectState);
  emblemProvinces.addEventListener("input", selectProvince);
  emblemBurgs.addEventListener("input", selectBurg);

  function updateElementSelectors(type, id, el) {
    let state = 0, province = 0, burg = 0;

    // set active type
    emblemStates.parentElement.className = type === "state" ? "active" : "";
    emblemProvinces.parentElement.className = type === "province" ? "active" : "";
    emblemBurgs.parentElement.className = type === "burg" ? "active" : "";

    // define selected values
    if (type === "state") state = el.i;
    else if (type === "province") {province = el.i; state = states[el.state].i;}
    else {burg = el.i; province = provinces[cells.province[el.cell]].i; state = provinces[province].state;}

    // update option list and select actual values
    emblemStates.options.length = 0;
    const neutralBurgs = burgs.filter(burg => burg.i && !burg.removed && !burg.state);
    if (neutralBurgs.length) emblemProvinces.options.add(new Option(states[0].name, 0, false, !state));
    const stateList = states.filter(state => state.i && !state.removed);
    stateList.forEach(s => emblemStates.options.add(new Option(s.name, s.i, false, s.i === state)));

    emblemProvinces.options.length = 0;
    emblemProvinces.options.add(new Option("", 0, false, !province));
    const provinceList = provinces.filter(province => !province.removed && province.state === state);
    provinceList.forEach(p => emblemProvinces.options.add(new Option(p.name, p.i, false, p.i === province)));

    emblemBurgs.options.length = 0;
    emblemBurgs.options.add(new Option("", 0, false, !burg));
    const burgList = burgs.filter(burg => !burg.removed && province ? cells.province[burg.cell] === province : burg.state === state);
    burgList.forEach(b => emblemBurgs.options.add(new Option(b.name, b.i, false, b.i === burg)));
    emblemBurgs.options[0].disabled = true;

    COArenderer.trigger(id, el.coa);
    updateEmblemData(type, id, el);
  }

  function updateEmblemData(type, id, el) {
    if (!el.coa) return;
    document.getElementById("emblemImage").setAttribute("href", "#" + id);
    document.getElementById("emblemArmiger").innerText = el.fullName || el.name;
  }

  function selectState() {
    const state = +this.value;
    if (state) {
      type = "state";
      el = states[state];
      id = "stateCOA"+ state;
    } else {
      // select neutral burg if state is changed to Neutrals
      const neutralBurgs = burgs.filter(burg => burg.i && !burg.removed && !burg.state);
      if (!neutralBurgs.length) return;
      type = "burg";
      el = neutralBurgs[0];
      id = "burgCOA"+ neutralBurgs[0].i;
    }
    updateElementSelectors(type, id, el);
  }

  function selectProvince() {
    const province = +this.value;

    if (province) {
      type = "province";
      el = provinces[province];
      id = "provinceCOA"+ province;
    } else {
      // select state if province is changed to null value
      const state = +emblemStates.value;
      type = "state";
      el = states[state];
      id = "stateCOA"+ state;
    }

    updateElementSelectors(type, id, el);
  }

  function selectBurg() {
    const burg = +this.value;
    type = "burg";
    el = burgs[burg];
    id = "burgCOA"+ burg;
    updateElementSelectors(type, id, el);
  }
}