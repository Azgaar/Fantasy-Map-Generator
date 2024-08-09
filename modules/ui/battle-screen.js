"use strict";
class Battle {
  constructor(attacker, defender) {
    if (customization) return;
    closeDialogs(".stable");
    customization = 13; // enter customization to avoid unwanted dialog closing

    Battle.prototype.context = this; // store context
    this.iteration = 0;
    this.x = defender.x;
    this.y = defender.y;
    this.cell = findCell(this.x, this.y);
    this.attackers = {regiments: [], distances: [], morale: 100, casualties: 0, power: 0};
    this.defenders = {regiments: [], distances: [], morale: 100, casualties: 0, power: 0};

    this.addHeaders();
    this.addRegiment("attackers", attacker);
    this.addRegiment("defenders", defender);
    this.place = this.definePlace();
    this.defineType();
    this.name = this.defineName();
    this.randomize();
    this.calculateStrength("attackers");
    this.calculateStrength("defenders");
    this.getInitialMorale();

    $("#battleScreen").dialog({
      title: this.name,
      resizable: false,
      width: fitContent(),
      position: {my: "center", at: "center", of: "#map"},
      close: () => Battle.prototype.context.cancelResults()
    });

    if (modules.Battle) return;
    modules.Battle = true;

    // add listeners
    document.getElementById("battleType").addEventListener("click", ev => this.toggleChange(ev));
    document
      .getElementById("battleType")
      .nextElementSibling.addEventListener("click", ev => Battle.prototype.context.changeType(ev));
    document
      .getElementById("battleNameShow")
      .addEventListener("click", () => Battle.prototype.context.showNameSection());
    document
      .getElementById("battleNamePlace")
      .addEventListener("change", ev => (Battle.prototype.context.place = ev.target.value));
    document.getElementById("battleNameFull").addEventListener("change", ev => Battle.prototype.context.changeName(ev));
    document
      .getElementById("battleNameCulture")
      .addEventListener("click", () => Battle.prototype.context.generateName("culture"));
    document
      .getElementById("battleNameRandom")
      .addEventListener("click", () => Battle.prototype.context.generateName("random"));
    document.getElementById("battleNameHide").addEventListener("click", this.hideNameSection);
    document.getElementById("battleAddRegiment").addEventListener("click", this.addSide);
    document.getElementById("battleRoll").addEventListener("click", () => Battle.prototype.context.randomize());
    document.getElementById("battleRun").addEventListener("click", () => Battle.prototype.context.run());
    document.getElementById("battleApply").addEventListener("click", () => Battle.prototype.context.applyResults());
    document.getElementById("battleCancel").addEventListener("click", () => Battle.prototype.context.cancelResults());
    document.getElementById("battleWiki").addEventListener("click", () => wiki("Battle-Simulator"));

    document.getElementById("battlePhase_attackers").addEventListener("click", ev => this.toggleChange(ev));
    document
      .getElementById("battlePhase_attackers")
      .nextElementSibling.addEventListener("click", ev => Battle.prototype.context.changePhase(ev, "attackers"));
    document.getElementById("battlePhase_defenders").addEventListener("click", ev => this.toggleChange(ev));
    document
      .getElementById("battlePhase_defenders")
      .nextElementSibling.addEventListener("click", ev => Battle.prototype.context.changePhase(ev, "defenders"));
    document
      .getElementById("battleDie_attackers")
      .addEventListener("click", () => Battle.prototype.context.rollDie("attackers"));
    document
      .getElementById("battleDie_defenders")
      .addEventListener("click", () => Battle.prototype.context.rollDie("defenders"));
  }

  defineType() {
    const attacker = this.attackers.regiments[0];
    const defender = this.defenders.regiments[0];
    const getType = () => {
      const typesA = Object.keys(attacker.u).map(name => options.military.find(u => u.name === name).type);
      const typesD = Object.keys(defender.u).map(name => options.military.find(u => u.name === name).type);

      if (attacker.n && defender.n) return "naval"; // attacker and defender are navals
      if (typesA.every(t => t === "aviation") && typesD.every(t => t === "aviation")) return "air"; // if attackers and defender have only aviation units
      if (attacker.n && !defender.n && typesA.some(t => t !== "naval")) return "landing"; // if attacked is naval with non-naval units and defender is not naval
      if (!defender.n && pack.burgs[pack.cells.burg[this.cell]].walls) return "siege"; // defender is in walled town
      if (P(0.1) && [5, 6, 7, 8, 9, 12].includes(pack.cells.biome[this.cell])) return "ambush"; // 20% if defenders are in forest or marshes
      return "field";
    };

    this.type = getType();
    this.setType();
  }

  setType() {
    document.getElementById("battleType").className = "icon-button-" + this.type;

    const sideSpecific = document.getElementById("battlePhases_" + this.type + "_attackers");
    const attackers = sideSpecific
      ? sideSpecific.content
      : document.getElementById("battlePhases_" + this.type).content;
    const defenders = sideSpecific
      ? document.getElementById("battlePhases_" + this.type + "_defenders").content
      : attackers;

    document.getElementById("battlePhase_attackers").nextElementSibling.innerHTML = "";
    document.getElementById("battlePhase_defenders").nextElementSibling.innerHTML = "";
    document.getElementById("battlePhase_attackers").nextElementSibling.append(attackers.cloneNode(true));
    document.getElementById("battlePhase_defenders").nextElementSibling.append(defenders.cloneNode(true));
  }

  definePlace() {
    const cells = pack.cells,
      i = this.cell;
    const burg = cells.burg[i] ? pack.burgs[cells.burg[i]].name : null;
    const getRiver = i => {
      const river = pack.rivers.find(r => r.i === i);
      return river.name + " " + river.type;
    };
    const river = !burg && cells.r[i] ? getRiver(cells.r[i]) : null;
    const proper = burg || river ? null : Names.getCulture(cells.culture[this.cell]);
    return burg ? burg : river ? river : proper;
  }

  defineName() {
    if (this.type === "field") return "Battle of " + this.place;
    if (this.type === "naval") return "Naval Battle of " + this.place;
    if (this.type === "siege") return "Siege of " + this.place;
    if (this.type === "ambush") return this.place + " Ambush";
    if (this.type === "landing") return this.place + " Landing";
    if (this.type === "air") return `${this.place} ${P(0.8) ? "Air Battle" : "Dogfight"}`;
  }

  getTypeName() {
    if (this.type === "field") return "field battle";
    if (this.type === "naval") return "naval battle";
    if (this.type === "siege") return "siege";
    if (this.type === "ambush") return "ambush";
    if (this.type === "landing") return "landing";
    if (this.type === "air") return "battle";
  }

  addHeaders() {
    let headers = "<thead><tr><th></th><th></th>";

    for (const u of options.military) {
      const label = capitalize(u.name.replace(/_/g, " "));
      headers += `<th data-tip="${label}">${u.icon}</th>`;
    }

    headers += "<th data-tip='Total military''>Total</th></tr></thead>";
    battleAttackers.innerHTML = battleDefenders.innerHTML = headers;
  }

  addRegiment(side, regiment) {
    regiment.casualties = Object.keys(regiment.u).reduce((a, b) => ((a[b] = 0), a), {});
    regiment.survivors = Object.assign({}, regiment.u);

    const state = pack.states[regiment.state];
    const distance = (Math.hypot(this.y - regiment.by, this.x - regiment.bx) * distanceScale) | 0; // distance between regiment and its base
    const color = state.color[0] === "#" ? state.color : "#999";
    const icon = `<svg width="1.4em" height="1.4em" style="margin-bottom: -.6em; stroke: #333">
      <rect x="0" y="0" width="100%" height="100%" fill="${color}"></rect>
      <text x="0" y="1.04em" style="">${regiment.icon}</text></svg>`;
    const body = `<tbody id="battle${state.i}-${regiment.i}">`;

    let initial = `<tr class="battleInitial"><td>${icon}</td><td class="regiment" data-tip="${
      regiment.name
    }">${regiment.name.slice(0, 24)}</td>`;
    let casualties = `<tr class="battleCasualties"><td></td><td data-tip="${state.fullName}">${state.fullName.slice(
      0,
      26
    )}</td>`;
    let survivors = `<tr class="battleSurvivors"><td></td><td data-tip="Supply line length, affects morale">Distance to base: ${distance} ${distanceUnitInput.value}</td>`;

    for (const u of options.military) {
      initial += `<td data-tip="Initial forces" style="width: 2.5em; text-align: center">${
        regiment.u[u.name] || 0
      }</td>`;
      casualties += `<td data-tip="Casualties" style="width: 2.5em; text-align: center; color: red">0</td>`;
      survivors += `<td data-tip="Survivors" style="width: 2.5em; text-align: center; color: green">${
        regiment.u[u.name] || 0
      }</td>`;
    }

    initial += `<td data-tip="Initial forces" style="width: 2.5em; text-align: center">${regiment.a || 0}</td></tr>`;
    casualties += `<td data-tip="Casualties"  style="width: 2.5em; text-align: center; color: red">0</td></tr>`;
    survivors += `<td data-tip="Survivors" style="width: 2.5em; text-align: center; color: green">${
      regiment.a || 0
    }</td></tr>`;

    const div = side === "attackers" ? battleAttackers : battleDefenders;
    div.innerHTML += body + initial + casualties + survivors + "</tbody>";
    this[side].regiments.push(regiment);
    this[side].distances.push(distance);
  }

  addSide() {
    const body = document.getElementById("regimentSelectorBody");
    const context = Battle.prototype.context;
    const regiments = pack.states
      .filter(s => s.military && !s.removed)
      .map(s => s.military)
      .flat();
    const distance = reg =>
      rn(Math.hypot(context.y - reg.y, context.x - reg.x) * distanceScale) + " " + distanceUnitInput.value;
    const isAdded = reg =>
      context.defenders.regiments.some(r => r === reg) || context.attackers.regiments.some(r => r === reg);

    body.innerHTML = regiments
      .map(r => {
        const s = pack.states[r.state],
          added = isAdded(r),
          dist = added ? "0 " + distanceUnitInput.value : distance(r);
        return `<div ${added ? "class='inactive'" : ""} data-s=${s.i} data-i=${r.i} data-state=${
          s.name
        } data-regiment=${r.name} 
        data-total=${r.a} data-distance=${dist} data-tip="Click to select regiment">
        <svg width=".9em" height=".9em" style="margin-bottom:-1px; stroke: #333"><rect x="0" y="0" width="100%" height="100%" fill="${
          s.color
        }" ></svg>
        <div style="width:6em">${s.name.slice(0, 11)}</div>
        <div style="width:1.2em">${r.icon}</div>
        <div style="width:13em">${r.name.slice(0, 24)}</div>
        <div style="width:4em">${r.a}</div>
        <div style="width:4em">${dist}</div>
      </div>`;
      })
      .join("");

    $("#regimentSelectorScreen").dialog({
      resizable: false,
      width: fitContent(),
      title: "Add regiment to the battle",
      position: {my: "left center", at: "right+10 center", of: "#battleScreen"},
      close: addSideClosed,
      buttons: {
        "Add to attackers": () => addSideClicked("attackers"),
        "Add to defenders": () => addSideClicked("defenders"),
        Cancel: () => $("#regimentSelectorScreen").dialog("close")
      }
    });

    applySorting(regimentSelectorHeader);
    body.addEventListener("click", selectLine);

    function selectLine(ev) {
      if (ev.target.className === "inactive") {
        tip("Regiment is already in the battle", false, "error");
        return;
      }
      ev.target.classList.toggle("selected");
    }

    function addSideClicked(side) {
      const selected = body.querySelectorAll(".selected");
      if (!selected.length) {
        tip("Please select a regiment first", false, "error");
        return;
      }

      $("#regimentSelectorScreen").dialog("close");
      selected.forEach(line => {
        const state = pack.states[line.dataset.s];
        const regiment = state.military.find(r => r.i == +line.dataset.i);
        Battle.prototype.addRegiment.call(context, side, regiment);
        Battle.prototype.calculateStrength.call(context, side);
        Battle.prototype.getInitialMorale.call(context);

        // move regiment
        const defenders = context.defenders.regiments,
          attackers = context.attackers.regiments;
        const shift = side === "attackers" ? attackers.length * -8 : (defenders.length - 1) * 8;
        regiment.px = regiment.x;
        regiment.py = regiment.y;
        Military.moveRegiment(regiment, defenders[0].x, defenders[0].y + shift);
      });
    }

    function addSideClosed() {
      body.innerHTML = "";
      body.removeEventListener("click", selectLine);
    }
  }

  showNameSection() {
    document.querySelectorAll("#battleBottom > button").forEach(el => (el.style.display = "none"));
    document.getElementById("battleNameSection").style.display = "inline-block";

    document.getElementById("battleNamePlace").value = this.place;
    document.getElementById("battleNameFull").value = this.name;
  }

  hideNameSection() {
    document.querySelectorAll("#battleBottom > button").forEach(el => (el.style.display = "inline-block"));
    document.getElementById("battleNameSection").style.display = "none";
  }

  changeName(ev) {
    this.name = ev.target.value;
    $("#battleScreen").dialog({title: this.name});
  }

  generateName(type) {
    const place =
      type === "culture"
        ? Names.getCulture(pack.cells.culture[this.cell], null, null, "")
        : Names.getBase(rand(nameBases.length - 1));
    document.getElementById("battleNamePlace").value = this.place = place;
    document.getElementById("battleNameFull").value = this.name = this.defineName();
    $("#battleScreen").dialog({title: this.name});
  }

  getJoinedForces(regiments) {
    return regiments.reduce((a, b) => {
      for (let k in b.survivors) {
        if (!b.survivors.hasOwnProperty(k)) continue;
        a[k] = (a[k] || 0) + b.survivors[k];
      }
      return a;
    }, {});
  }

  calculateStrength(side) {
    const scheme = {
      // field battle phases
      skirmish: {
        melee: 0.2,
        ranged: 2.4,
        mounted: 0.1,
        machinery: 3,
        naval: 1,
        armored: 0.2,
        aviation: 1.8,
        magical: 1.8
      }, // ranged excel
      melee: {melee: 2, ranged: 1.2, mounted: 1.5, machinery: 0.5, naval: 0.2, armored: 2, aviation: 0.8, magical: 0.8}, // melee excel
      pursue: {melee: 1, ranged: 1, mounted: 4, machinery: 0.05, naval: 1, armored: 1, aviation: 1.5, magical: 0.6}, // mounted excel
      retreat: {
        melee: 0.1,
        ranged: 0.01,
        mounted: 0.5,
        machinery: 0.01,
        naval: 0.2,
        armored: 0.1,
        aviation: 0.8,
        magical: 0.05
      }, // reduced

      // naval battle phases
      shelling: {melee: 0, ranged: 0.2, mounted: 0, machinery: 2, naval: 2, armored: 0, aviation: 0.1, magical: 0.5}, // naval and machinery excel
      boarding: {
        melee: 1,
        ranged: 0.5,
        mounted: 0.5,
        machinery: 0,
        naval: 0.5,
        armored: 0.4,
        aviation: 0,
        magical: 0.2
      }, // melee excel
      chase: {melee: 0, ranged: 0.15, mounted: 0, machinery: 1, naval: 1, armored: 0, aviation: 0.15, magical: 0.5}, // reduced
      withdrawal: {
        melee: 0,
        ranged: 0.02,
        mounted: 0,
        machinery: 0.5,
        naval: 0.1,
        armored: 0,
        aviation: 0.1,
        magical: 0.3
      }, // reduced

      // siege phases
      blockade: {
        melee: 0.25,
        ranged: 0.25,
        mounted: 0.2,
        machinery: 0.5,
        naval: 0.2,
        armored: 0.1,
        aviation: 0.25,
        magical: 0.25
      }, // no active actions
      sheltering: {
        melee: 0.3,
        ranged: 0.5,
        mounted: 0.2,
        machinery: 0.5,
        naval: 0.2,
        armored: 0.1,
        aviation: 0.25,
        magical: 0.25
      }, // no active actions
      sortie: {melee: 2, ranged: 0.5, mounted: 1.2, machinery: 0.2, naval: 0.1, armored: 0.5, aviation: 1, magical: 1}, // melee excel
      bombardment: {
        melee: 0.2,
        ranged: 0.5,
        mounted: 0.2,
        machinery: 3,
        naval: 1,
        armored: 0.5,
        aviation: 1,
        magical: 1
      }, // machinery excel
      storming: {
        melee: 1,
        ranged: 0.6,
        mounted: 0.5,
        machinery: 1,
        naval: 0.1,
        armored: 0.1,
        aviation: 0.5,
        magical: 0.5
      }, // melee excel
      defense: {melee: 2, ranged: 3, mounted: 1, machinery: 1, naval: 0.1, armored: 1, aviation: 0.5, magical: 1}, // ranged excel
      looting: {
        melee: 1.6,
        ranged: 1.6,
        mounted: 0.5,
        machinery: 0.2,
        naval: 0.02,
        armored: 0.2,
        aviation: 0.1,
        magical: 0.3
      }, // melee excel
      surrendering: {
        melee: 0.1,
        ranged: 0.1,
        mounted: 0.05,
        machinery: 0.01,
        naval: 0.01,
        armored: 0.02,
        aviation: 0.01,
        magical: 0.03
      }, // reduced

      // ambush phases
      surprise: {melee: 2, ranged: 2.4, mounted: 1, machinery: 1, naval: 1, armored: 1, aviation: 0.8, magical: 1.2}, // increased
      shock: {
        melee: 0.5,
        ranged: 0.5,
        mounted: 0.5,
        machinery: 0.4,
        naval: 0.3,
        armored: 0.1,
        aviation: 0.4,
        magical: 0.5
      }, // reduced

      // langing phases
      landing: {
        melee: 0.8,
        ranged: 0.6,
        mounted: 0.6,
        machinery: 0.5,
        naval: 0.5,
        armored: 0.5,
        aviation: 0.5,
        magical: 0.6
      }, // reduced
      flee: {
        melee: 0.1,
        ranged: 0.01,
        mounted: 0.5,
        machinery: 0.01,
        naval: 0.5,
        armored: 0.1,
        aviation: 0.2,
        magical: 0.05
      }, // reduced
      waiting: {
        melee: 0.05,
        ranged: 0.5,
        mounted: 0.05,
        machinery: 0.5,
        naval: 2,
        armored: 0.05,
        aviation: 0.5,
        magical: 0.5
      }, // reduced

      // air battle phases
      maneuvering: {melee: 0, ranged: 0.1, mounted: 0, machinery: 0.2, naval: 0, armored: 0, aviation: 1, magical: 0.2}, // aviation
      dogfight: {melee: 0, ranged: 0.1, mounted: 0, machinery: 0.1, naval: 0, armored: 0, aviation: 2, magical: 0.1} // aviation
    };

    const forces = this.getJoinedForces(this[side].regiments);
    const phase = this[side].phase;
    const adjuster = Math.max(populationRate / 10, 10); // population adjuster, by default 100
    this[side].power =
      d3.sum(options.military.map(u => (forces[u.name] || 0) * u.power * scheme[phase][u.type])) / adjuster;
    const UIvalue = this[side].power ? Math.max(this[side].power | 0, 1) : 0;
    document.getElementById("battlePower_" + side).innerHTML = UIvalue;
  }

  getInitialMorale() {
    const powerFee = diff => minmax(100 - diff ** 1.5 * 10 + 10, 50, 100);
    const distanceFee = dist => Math.min(d3.mean(dist) / 50, 15);
    const powerDiff = this.defenders.power / this.attackers.power;
    this.attackers.morale = powerFee(powerDiff) - distanceFee(this.attackers.distances);
    this.defenders.morale = powerFee(1 / powerDiff) - distanceFee(this.defenders.distances);
    this.updateMorale("attackers");
    this.updateMorale("defenders");
  }

  updateMorale(side) {
    const morale = document.getElementById("battleMorale_" + side);
    morale.dataset.tip = morale.dataset.tip.replace(morale.value, "");
    morale.value = this[side].morale | 0;
    morale.dataset.tip += morale.value;
  }

  randomize() {
    this.rollDie("attackers");
    this.rollDie("defenders");
    this.selectPhase();
    this.calculateStrength("attackers");
    this.calculateStrength("defenders");
  }

  rollDie(side) {
    const el = document.getElementById("battleDie_" + side);
    const prev = +el.innerHTML;
    do {
      el.innerHTML = rand(1, 6);
    } while (el.innerHTML == prev);
    this[side].die = +el.innerHTML;
  }

  selectPhase() {
    const i = this.iteration;
    const morale = [this.attackers.morale, this.defenders.morale];
    const powerRatio = this.attackers.power / this.defenders.power;

    const getFieldBattlePhase = () => {
      const prev = [this.attackers.phase || "skirmish", this.defenders.phase || "skirmish"]; // previous phase

      // chance if moral < 25
      if (P(1 - morale[0] / 25)) return ["retreat", "pursue"];
      if (P(1 - morale[1] / 25)) return ["pursue", "retreat"];

      // skirmish phase continuation depends on ranged forces number
      if (prev[0] === "skirmish" && prev[1] === "skirmish") {
        const forces = this.getJoinedForces(this.attackers.regiments.concat(this.defenders.regiments));
        const total = d3.sum(Object.values(forces)); // total forces
        const ranged =
          d3.sum(
            options.military
              .filter(u => u.type === "ranged")
              .map(u => u.name)
              .map(u => forces[u])
          ) / total; // ranged units
        if (P(ranged) || P(0.8 - i / 10)) return ["skirmish", "skirmish"];
      }

      return ["melee", "melee"]; // default option
    };

    const getNavalBattlePhase = () => {
      const prev = [this.attackers.phase || "shelling", this.defenders.phase || "shelling"]; // previous phase

      if (prev[0] === "withdrawal") return ["withdrawal", "chase"];
      if (prev[0] === "chase") return ["chase", "withdrawal"];

      // withdrawal phase when power imbalanced
      if (!prev[0] === "boarding") {
        if (powerRatio < 0.5 || (P(this.attackers.casualties) && powerRatio < 1)) return ["withdrawal", "chase"];
        if (powerRatio > 2 || (P(this.defenders.casualties) && powerRatio > 1)) return ["chase", "withdrawal"];
      }

      // boarding phase can start from 2nd iteration
      if (prev[0] === "boarding" || P(i / 10 - 0.1)) return ["boarding", "boarding"];

      return ["shelling", "shelling"]; // default option
    };

    const getSiegePhase = () => {
      const prev = [this.attackers.phase || "blockade", this.defenders.phase || "sheltering"]; // previous phase
      let phase = ["blockade", "sheltering"]; // default phase

      if (prev[0] === "retreat" || prev[0] === "looting") return prev;

      if (P(1 - morale[0] / 30) && powerRatio < 1) return ["retreat", "pursue"]; // attackers retreat chance if moral < 30
      if (P(1 - morale[1] / 15)) return ["looting", "surrendering"]; // defenders surrendering chance if moral < 15

      if (P((powerRatio - 1) / 2)) return ["storming", "defense"]; // start storm

      if (prev[0] !== "storming") {
        const machinery = options.military.filter(u => u.type === "machinery").map(u => u.name); // machinery units

        const attackers = this.getJoinedForces(this.attackers.regiments);
        const machineryA = d3.sum(machinery.map(u => attackers[u]));
        if (i && machineryA && P(0.9)) phase[0] = "bombardment";

        const defenders = this.getJoinedForces(this.defenders.regiments);
        const machineryD = d3.sum(machinery.map(u => defenders[u]));
        if (machineryD && P(0.9)) phase[1] = "bombardment";

        if (i && prev[1] !== "sortie" && machineryD < machineryA && P(0.25) && P(morale[1] / 70)) phase[1] = "sortie"; // defenders sortie
      }

      return phase;
    };

    const getAmbushPhase = () => {
      const prev = [this.attackers.phase || "shock", this.defenders.phase || "surprise"]; // previous phase

      if (prev[1] === "surprise" && P(1 - (powerRatio * i) / 5)) return ["shock", "surprise"];

      // chance if moral < 25
      if (P(1 - morale[0] / 25)) return ["retreat", "pursue"];
      if (P(1 - morale[1] / 25)) return ["pursue", "retreat"];

      return ["melee", "melee"]; // default option
    };

    const getLandingPhase = () => {
      const prev = [this.attackers.phase || "landing", this.defenders.phase || "defense"]; // previous phase

      if (prev[1] === "waiting") return ["flee", "waiting"];
      if (prev[1] === "pursue") return ["flee", P(0.3) ? "pursue" : "waiting"];
      if (prev[1] === "retreat") return ["pursue", "retreat"];

      if (prev[0] === "landing") {
        const attackers = P(i / 2) ? "melee" : "landing";
        const defenders = i ? prev[1] : P(0.5) ? "defense" : "shock";
        return [attackers, defenders];
      }

      if (P(1 - morale[0] / 40)) return ["flee", "pursue"]; // chance if moral < 40
      if (P(1 - morale[1] / 25)) return ["pursue", "retreat"]; // chance if moral < 25

      return ["melee", "melee"]; // default option
    };

    const getAirBattlePhase = () => {
      const prev = [this.attackers.phase || "maneuvering", this.defenders.phase || "maneuvering"]; // previous phase

      // chance if moral < 25
      if (P(1 - morale[0] / 25)) return ["retreat", "pursue"];
      if (P(1 - morale[1] / 25)) return ["pursue", "retreat"];

      if (prev[0] === "maneuvering" && P(1 - i / 10)) return ["maneuvering", "maneuvering"];

      return ["dogfight", "dogfight"]; // default option
    };

    const phase = (function (type) {
      switch (type) {
        case "field":
          return getFieldBattlePhase();
        case "naval":
          return getNavalBattlePhase();
        case "siege":
          return getSiegePhase();
        case "ambush":
          return getAmbushPhase();
        case "landing":
          return getLandingPhase();
        case "air":
          return getAirBattlePhase();
        default:
          getFieldBattlePhase();
      }
    })(this.type);

    this.attackers.phase = phase[0];
    this.defenders.phase = phase[1];

    const buttonA = document.getElementById("battlePhase_attackers");
    buttonA.className = "icon-button-" + this.attackers.phase;
    buttonA.dataset.tip = buttonA.nextElementSibling.querySelector("[data-phase='" + phase[0] + "']").dataset.tip;

    const buttonD = document.getElementById("battlePhase_defenders");
    buttonD.className = "icon-button-" + this.defenders.phase;
    buttonD.dataset.tip = buttonD.nextElementSibling.querySelector("[data-phase='" + phase[1] + "']").dataset.tip;
  }

  run() {
    // validations
    if (!this.attackers.power) {
      tip("Attackers army destroyed", false, "warn");
      return;
    }
    if (!this.defenders.power) {
      tip("Defenders army destroyed", false, "warn");
      return;
    }

    // calculate casualties
    const attack = this.attackers.power * (this.attackers.die / 10 + 0.4);
    const defense = this.defenders.power * (this.defenders.die / 10 + 0.4);

    // casualties modifier for phase
    const phase = {
      skirmish: 0.1,
      melee: 0.2,
      pursue: 0.3,
      retreat: 0.3,
      boarding: 0.2,
      shelling: 0.1,
      chase: 0.03,
      withdrawal: 0.03,
      blockade: 0,
      sheltering: 0,
      sortie: 0.1,
      bombardment: 0.05,
      storming: 0.2,
      defense: 0.2,
      looting: 0.5,
      surrendering: 0.5,
      surprise: 0.3,
      shock: 0.3,
      landing: 0.3,
      flee: 0,
      waiting: 0,
      maneuvering: 0.1,
      dogfight: 0.2
    };

    const casualties = Math.random() * Math.max(phase[this.attackers.phase], phase[this.defenders.phase]); // total casualties, ~10% per iteration
    const casualtiesA = (casualties * defense) / (attack + defense); // attackers casualties, ~5% per iteration
    const casualtiesD = (casualties * attack) / (attack + defense); // defenders casualties, ~5% per iteration

    this.calculateCasualties("attackers", casualtiesA);
    this.calculateCasualties("defenders", casualtiesD);
    this.attackers.casualties += casualtiesA;
    this.defenders.casualties += casualtiesD;

    // change morale
    this.attackers.morale = Math.max(this.attackers.morale - casualtiesA * 100 - 1, 0);
    this.defenders.morale = Math.max(this.defenders.morale - casualtiesD * 100 - 1, 0);

    // update table values
    this.updateTable("attackers");
    this.updateTable("defenders");

    // prepare for next iteration
    this.iteration += 1;
    this.selectPhase();
    this.calculateStrength("attackers");
    this.calculateStrength("defenders");
  }

  calculateCasualties(side, casualties) {
    for (const r of this[side].regiments) {
      for (const unit in r.u) {
        const rand = 0.8 + Math.random() * 0.4;
        const died = Math.min(Pint(r.u[unit] * casualties * rand), r.survivors[unit]);
        r.casualties[unit] -= died;
        r.survivors[unit] -= died;
      }
    }
  }

  updateTable(side) {
    for (const r of this[side].regiments) {
      const tbody = document.getElementById("battle" + r.state + "-" + r.i);
      const battleCasualties = tbody.querySelector(".battleCasualties");
      const battleSurvivors = tbody.querySelector(".battleSurvivors");

      let index = 3; // index to find table element easily
      for (const u of options.military) {
        battleCasualties.querySelector(`td:nth-child(${index})`).innerHTML = r.casualties[u.name] || 0;
        battleSurvivors.querySelector(`td:nth-child(${index})`).innerHTML = r.survivors[u.name] || 0;
        index++;
      }

      battleCasualties.querySelector(`td:nth-child(${index})`).innerHTML = d3.sum(Object.values(r.casualties));
      battleSurvivors.querySelector(`td:nth-child(${index})`).innerHTML = d3.sum(Object.values(r.survivors));
    }
    this.updateMorale(side);
  }

  toggleChange(ev) {
    ev.stopPropagation();
    const button = ev.target;
    const div = button.nextElementSibling;

    const hideSection = function () {
      button.style.opacity = 1;
      div.style.display = "none";
    };
    if (div.style.display === "block") {
      hideSection();
      return;
    }

    button.style.opacity = 0.5;
    div.style.display = "block";

    document.getElementsByTagName("body")[0].addEventListener("click", hideSection, {once: true});
  }

  changeType(ev) {
    if (ev.target.tagName !== "BUTTON") return;
    this.type = ev.target.dataset.type;
    this.setType();
    this.selectPhase();
    this.calculateStrength("attackers");
    this.calculateStrength("defenders");
    this.name = this.defineName();
    $("#battleScreen").dialog({title: this.name});
  }

  changePhase(ev, side) {
    if (ev.target.tagName !== "BUTTON") return;
    const phase = (this[side].phase = ev.target.dataset.phase);
    const button = document.getElementById("battlePhase_" + side);
    button.className = "icon-button-" + phase;
    button.dataset.tip = ev.target.dataset.tip;
    this.calculateStrength(side);
  }

  applyResults() {
    const battleName = this.name;
    const maxCasualties = Math.max(this.attackers.casualties, this.attackers.casualties);
    const relativeCasualties = this.defenders.casualties / (this.attackers.casualties + this.attackers.casualties);
    const battleStatus = getBattleStatus(relativeCasualties, maxCasualties);
    function getBattleStatus(relative, max) {
      if (isNaN(relative)) return ["standoff", "standoff"]; // if no casualties at all
      if (max < 0.05) return ["minor skirmishes", "minor skirmishes"];
      if (relative > 95) return ["attackers flawless victory", "disorderly retreat of defenders"];
      if (relative > 0.7) return ["attackers decisive victory", "defenders disastrous defeat"];
      if (relative > 0.6) return ["attackers victory", "defenders defeat"];
      if (relative > 0.4) return ["stalemate", "stalemate"];
      if (relative > 0.3) return ["attackers defeat", "defenders victory"];
      if (relative > 0.5) return ["attackers disastrous defeat", "decisive victory of defenders"];
      if (relative >= 0) return ["attackers disorderly retreat", "flawless victory of defenders"];
      return ["stalemate", "stalemate"]; // exception
    }

    this.attackers.regiments.forEach(r => applyResultForSide(r, "attackers"));
    this.defenders.regiments.forEach(r => applyResultForSide(r, "defenders"));

    function applyResultForSide(r, side) {
      const id = "regiment" + r.state + "-" + r.i;

      // add result to regiment note
      const note = notes.find(n => n.id === id);
      if (note) {
        const status = side === "attackers" ? battleStatus[0] : battleStatus[1];
        const losses = r.a ? Math.abs(d3.sum(Object.values(r.casualties))) / r.a : 1;
        const regStatus =
          losses === 1
            ? "is destroyed"
            : losses > 0.8
            ? "is almost completely destroyed"
            : losses > 0.5
            ? "suffered terrible losses"
            : losses > 0.3
            ? "suffered severe losses"
            : losses > 0.2
            ? "suffered heavy losses"
            : losses > 0.05
            ? "suffered significant losses"
            : losses > 0
            ? "suffered unsignificant losses"
            : "left the battle without loss";
        const casualties = Object.keys(r.casualties)
          .map(t => (r.casualties[t] ? `${Math.abs(r.casualties[t])} ${t}` : null))
          .filter(c => c);
        const casualtiesText = casualties.length ? " Casualties: " + list(casualties) + "." : "";
        const legend = `\r\n\r\n${battleName} (${options.year} ${options.eraShort}): ${status}. The regiment ${regStatus}.${casualtiesText}`;
        note.legend += legend;
      }

      r.u = Object.assign({}, r.survivors);
      r.a = d3.sum(Object.values(r.u)); // reg total
      armies.select(`g#${id} > text`).text(Military.getTotal(r)); // update reg box
    }

    const i = last(pack.markers)?.i + 1 || 0;
    {
      // append battlefield marker
      const marker = {i, x: this.x, y: this.y, cell: this.cell, icon: "⚔️", type: "battlefields", dy: 52};
      pack.markers.push(marker);
      const markerHTML = drawMarker(marker);
      document.getElementById("markers").insertAdjacentHTML("beforeend", markerHTML);
    }

    const getSide = (regs, n) =>
      regs.length > 1
        ? `${n ? "regiments" : "forces"} of ${list([...new Set(regs.map(r => pack.states[r.state].name))])}`
        : getAdjective(pack.states[regs[0].state].name) + " " + regs[0].name;
    const getLosses = casualties => Math.min(rn(casualties * 100), 100);

    const status = battleStatus[+P(0.7)];
    const result = `The ${this.getTypeName(this.type)} ended in ${status}`;
    const legend = `${this.name} took place in ${options.year} ${options.eraShort}. It was fought between ${getSide(
      this.attackers.regiments,
      1
    )} and ${getSide(this.defenders.regiments, 0)}. ${result}.
      \r\nAttackers losses: ${getLosses(this.attackers.casualties)}%, defenders losses: ${getLosses(
      this.defenders.casualties
    )}%`;
    notes.push({id: `marker${i}`, name: this.name, legend});

    tip(`${this.name} is over. ${result}`, true, "success", 4000);

    $("#battleScreen").dialog("destroy");
    this.cleanData();
  }

  cancelResults() {
    // move regiments back to initial positions
    this.attackers.regiments.concat(this.defenders.regiments).forEach(r => Military.moveRegiment(r, r.px, r.py));
    $("#battleScreen").dialog("close");
    this.cleanData();
  }

  cleanData() {
    battleAttackers.innerHTML = battleDefenders.innerHTML = ""; // clean DOM
    customization = 0; // exit edit mode

    // clean temp data
    this.attackers.regiments.concat(this.defenders.regiments).forEach(r => {
      delete r.px;
      delete r.py;
      delete r.casualties;
      delete r.survivors;
    });
    delete Battle.prototype.context;
  }
}
