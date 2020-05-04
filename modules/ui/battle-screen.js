"use strict";
class Battle {

  constructor(attacker, defender) {
    if (customization) return;
    closeDialogs(".stable");
    customization = 13; // enter customization to avoid unwanted dialog closing

    Battle.prototype.context = this; // store context
    this.x = defender.x;
    this.y = defender.y;
    this.name = this.getBattleName();
    this.iteration = 0;
    this.attackers = {regiments:[], distances:[], morale:100};
    this.defenders = {regiments:[], distances:[], morale:100};

    this.addHeaders();
    this.addRegiment("attackers", attacker);
    this.addRegiment("defenders", defender);
    this.randomize();
    this.calculateStrength("attackers");
    this.calculateStrength("defenders");
    this.getInitialMorale();

    $("#battleScreen").dialog({
      title: this.name, resizable: false, width: fitContent(), close: this.closeBattleScreen,
      position: {my: "center", at: "center", of: "#map"}
    });

    if (modules.Battle) return;
    modules.Battle = true;

    // add listeners
    document.getElementById("battleAddRegiment").addEventListener("click", this.addSide);
    document.getElementById("battleRoll").addEventListener("click", () => Battle.prototype.context.randomize());
    document.getElementById("battleRun").addEventListener("click", () => Battle.prototype.context.run());
    document.getElementById("battleApply").addEventListener("click", () => Battle.prototype.context.applyResults());
    document.getElementById("battleCancel").addEventListener("click", () => Battle.prototype.context.cancelResults());

    document.getElementById("battlePhase_attackers").addEventListener("click", ev => this.toggleChangePhase(ev, "attackers"));
    document.getElementById("battlePhase_attackers").nextElementSibling.addEventListener("click", ev => Battle.prototype.context.changePhase(ev, "attackers"));
    document.getElementById("battlePhase_defenders").addEventListener("click", ev => this.toggleChangePhase(ev, "defenders"));
    document.getElementById("battlePhase_defenders").nextElementSibling.addEventListener("click", ev => Battle.prototype.context.changePhase(ev, "defenders"));
    document.getElementById("battleDie_attackers").addEventListener("click", () => Battle.prototype.context.rollDie("attackers"));
    document.getElementById("battleDie_defenders").addEventListener("click", () => Battle.prototype.context.rollDie("defenders"));
  }

  getBattleName() {
    const cell = findCell(this.x, this.y);
    const burg = pack.cells.burg[cell] ? pack.burgs[pack.cells.burg[cell]].name : null;
    return burg ? burg + " Battle" : Names.getCulture(pack.cells.culture[cell]) + " Battle"
  }

  addHeaders() {
    let headers = "<thead><tr><th></th><th></th>";

    for (const u of options.military) {
      const label = capitalize(u.name.replace(/_/g, ' '));
      headers += `<th data-tip="${label}">${u.icon}</th>`;
    }

    headers += "<th data-tip='Total military''>Total</th></tr></thead>";
    battleAttackers.innerHTML = battleDefenders.innerHTML = headers;
  }

  addRegiment(side, regiment) {
    regiment.casualties = Object.keys(regiment.u).reduce((a,b) => (a[b]=0,a), {});
    regiment.survivors = Object.assign({}, regiment.u);

    const state = pack.states[regiment.state];
    const distance = Math.hypot(this.y-regiment.by, this.x-regiment.bx) * distanceScaleInput.value | 0; // distance between regiment and its base
    const color = state.color[0] === "#" ? state.color : "#999";
    const icon = `<svg width="1.4em" height="1.4em" style="margin-bottom: -.6em">
      <rect x="0" y="0" width="100%" height="100%" fill="${color}" class="fillRect"></rect>
      <text x="0" y="1.04em" style="">${regiment.icon}</text></svg>`;
    const body = `<tbody id="battle${state.i}-${regiment.i}">`;

    let initial = `<tr class="battleInitial"><td>${icon}</td><td class="regiment">${regiment.name.slice(0, 24)}</td>`;
    let casualties = `<tr class="battleCasualties"><td></td><td>${state.fullName.slice(0, 26)}</td>`;
    let survivors = `<tr class="battleSurvivors"><td></td><td>Distance to base: ${distance} ${distanceUnitInput.value}</td>`;

    for (const u of options.military) {
      initial += `<td style="width: 2.5em; text-align: center">${regiment.u[u.name]||0}</td>`;
      casualties += `<td style="width: 2.5em; text-align: center; color: red">0</td>`;
      survivors += `<td style="width: 2.5em; text-align: center; color: green">${regiment.u[u.name]||0}</td>`;
    }

    initial += `<td style="width: 2.5em; text-align: center">${regiment.a||0}</td></tr>`;
    casualties += `<td style="width: 2.5em; text-align: center; color: red">0</td></tr>`;
    survivors += `<td style="width: 2.5em; text-align: center; color: green">${regiment.a||0}</td></tr>`;

    const div = side === "attackers" ? battleAttackers : battleDefenders;
    div.innerHTML += body + initial + casualties + survivors + "</tbody>";
    this[side].regiments.push(regiment);
    this[side].distances.push(distance);
  }

  addSide() {
    const body = document.getElementById("regimentSelectorBody");
    const context = Battle.prototype.context;
    const regiments = pack.states.filter(s => s.military && !s.removed).map(s => s.military).flat();
    const distance = reg => rn(Math.hypot(context.y-reg.y, context.x-reg.x) * distanceScaleInput.value) + " " + distanceUnitInput.value;
    const isAdded = reg => context.defenders.regiments.some(r => r === reg) || context.attackers.regiments.some(r => r === reg);

    body.innerHTML = regiments.map(r => {
      const s = pack.states[r.state], added = isAdded(r), dist = added ? "0 " + distanceUnitInput.value : distance(r);
      return `<div ${added ? "class='inactive'" : ""} data-s=${s.i} data-i=${r.i} data-state=${s.name} data-regiment=${r.name} 
        data-total=${r.a} data-distance=${dist} data-tip="Click to select regiment">
        <svg width=".9em" height=".9em" style="margin-bottom:-1px"><rect x="0" y="0" width="100%" height="100%" fill="${s.color}" class="fillRect"></svg>
        <div style="width:6em">${s.name.slice(0, 11)}</div>
        <div style="width:1.2em">${r.icon}</div>
        <div style="width:13em">${r.name.slice(0, 24)}</div>
        <div style="width:4em">${r.a}</div>
        <div style="width:4em">${dist}</div>
      </div>`;
    }).join("");

    $("#regimentSelectorScreen").dialog({
      resizable: false, width: fitContent(), title: "Add regiment to the battle",
      position: {my: "left center", at: "right+10 center", of: "#battleScreen"}, close: addSideClosed,
      buttons: {
        "Add to attackers": () => addSideClicked("attackers"),
        "Add to defenders": () => addSideClicked("defenders"),
        Cancel: () => $("#regimentSelectorScreen").dialog("close")
      }
    });

    applySorting(regimentSelectorHeader);
    body.addEventListener("click", selectLine);

    function selectLine(ev) {
      if (ev.target.className === "inactive") {tip("Regiment is already in the battle", false, "error"); return};
      ev.target.classList.toggle("selected");
    }

    function addSideClicked(side) {
      const selected = body.querySelectorAll(".selected");
      if (!selected.length) {tip("Please select a regiment first", false, "error"); return}

      $("#regimentSelectorScreen").dialog("close");
      selected.forEach(line => {
        const state = pack.states[line.dataset.s];
        const regiment = state.military.find(r => r.i == +line.dataset.i);
        Battle.prototype.addRegiment.call(context, side, regiment);
        Battle.prototype.calculateStrength.call(context, side);
        Battle.prototype.getInitialMorale.call(context);

        // move regiment
        const defenders = context.defenders.regiments, attackers = context.attackers.regiments;
        const shift = side === "attackers" ? attackers.length * -8 : (defenders.length-1) * 8;
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
      "skirmish": {"melee":.2, "ranged":2.4, "mounted":.1, "machinery":3, "naval":1, "armored":.2, "aviation":1.8, "magical":1.8}, // ranged excel
      "melee": {"melee":2, "ranged":1.2, "mounted":1.5, "machinery":.5, "naval":.2, "armored":2, "aviation":.8, "magical":.8}, // melee excel
      "pursue": {"melee":1, "ranged":1, "mounted":4, "machinery":.05, "naval":1, "armored":1, "aviation":1.5, "magical":.6}, // mounted excel
      "retreat": {"melee":.1, "ranged":.01, "mounted":.5, "machinery":.01, "naval":.2, "armored":.1, "aviation":.8, "magical":.05} // mounted excel
    };

    const forces = this.getJoinedForces(this[side].regiments);
    const phase = this[side].phase;
    const adjuster = populationRate.value / 10; // population adjuster, by default 100
    this[side].power = d3.sum(options.military.map(u => (forces[u.name] || 0) * u.power * scheme[phase][u.type])) / adjuster;
    const UIvalue = this[side].power ? Math.max(this[side].power|0, 1) : 0;
    document.getElementById("battlePower_"+side).innerHTML = UIvalue;
  }

  getInitialMorale() {
    const powerFee = diff => Math.min(Math.max(100 - diff ** 1.5 * 10 + 10, 50), 100);
    const distanceFee = dist => Math.min(d3.mean(dist) / 50, 15);
    const powerDiff = this.defenders.power / this.attackers.power;
    this.attackers.morale = powerFee(powerDiff) - distanceFee(this.attackers.distances);
    this.defenders.morale = powerFee(1 / powerDiff) - distanceFee(this.defenders.distances);
    this.updateMorale("attackers");
    this.updateMorale("defenders");
  }

  updateMorale(side) {
    const morale = document.getElementById("battleMorale_"+side);
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
    const el = document.getElementById("battleDie_"+side);
    const prev = +el.innerHTML;
    do {el.innerHTML = rand(1, 6)} while (el.innerHTML === prev)
    this[side].die = +el.innerHTML;
  }

  selectPhase() {
    const phase = this.getPhase();
    this.attackers.phase = phase[0];
    this.defenders.phase = phase[1];
    document.getElementById("battlePhase_attackers").className = "icon-button-" + this.attackers.phase;
    document.getElementById("battlePhase_defenders").className = "icon-button-" + this.defenders.phase;
  }

  getPhase() {
    const i = this.iteration;
    const prev = [this.attackers.phase || "skirmish", this.defenders.phase || "skirmish"]; // previous phase
    const morale = [this.attackers.morale, this.defenders.morale];

    if (P(1 - morale[0] / 25)) return ["retreat", "pursue"];
    if (P(1 - morale[1] / 25)) return ["pursue", "retreat"];

    if (prev[0] === "skirmish" && prev[1] === "skirmish") {
      const forces = this.getJoinedForces(this.attackers.regiments.concat(this.defenders.regiments));
      const total = d3.sum(Object.values(forces)); // total forces
      const ranged = d3.sum(options.military.filter(u => u.type === "ranged").map(u => u.name).map(u => forces[u])) / total;
      if (ranged && (P(ranged) || P(.8-i/10))) return ["skirmish", "skirmish"];
    }

    return ["melee", "melee"]; // default option
  }

  run() {
    // validations
    if (!this.attackers.power) {tip("Attackers army destroyed", false, "warn"); return}
    if (!this.defenders.power) {tip("Defenders army destroyed", false, "warn"); return}

    // calculate casualties
    const attack = this.attackers.power * (this.attackers.die / 10 + .4);
    const defence = this.defenders.power * (this.defenders.die / 10 + .4);
    const phase = {"skirmish":.1, "melee":.2, "pursue":.3, "retreat":.3}; // casualties modifier for phase
    const casualties = Math.random() * phase[this.attackers.phase]; // total casualties, ~10% per iteration
    const casualtiesA = casualties * defence / (attack + defence); // attackers casualties, ~5% per iteration
    const casualtiesD = casualties * attack / (attack + defence); // defenders casualties, ~5% per iteration

    this.calculateCasualties("attackers", casualtiesA);
    this.calculateCasualties("defenders", casualtiesD);

    // change morale
    this.attackers.morale = Math.max(this.attackers.morale - casualtiesA * 100, 0);
    this.defenders.morale = Math.max(this.defenders.morale - casualtiesD * 100, 0);

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
        const rand = .8 + Math.random() * .4;
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

  toggleChangePhase(ev, side) {
    ev.stopPropagation();
    const button = document.getElementById("battlePhase_"+side);
    const div = button.nextElementSibling;
    button.style.opacity = .5;
    div.style.display = "block";

    const hideSection = function() {button.style.opacity = 1; div.style.display = "none"}
    document.getElementsByTagName("body")[0].addEventListener("click", hideSection, {once: true});
  }

  changePhase(ev, side) {
    if (ev.target.tagName !== "BUTTON") return;
    const phase = this[side].phase = ev.target.dataset.phase;
    const button = document.getElementById("battlePhase_"+side);
    button.className = "icon-button-" + phase;
    this.calculateStrength(side);
  }

  applyResults() {
    this.attackers.regiments.concat(this.defenders.regiments).forEach(r => {
      r.u = Object.assign({}, r.survivors);
      r.a = d3.sum(Object.values(r.u)); // reg total
      armies.select(`g#regiment${r.state}-${r.i} > text`).text(Military.getTotal(r)); // update reg box
      Military.moveRegiment(r, r.x + rand(30) - 15, r.y + rand(30) - 15);
    });

    $("#battleScreen").dialog("close");
  }

  cancelResults() {
    // move regiments back to initial positions
    this.attackers.regiments.concat(this.defenders.regiments).forEach(r => {
      Military.moveRegiment(r, r.px, r.py);
    });

    $("#battleScreen").dialog("close");
  }

  closeBattleScreen() {
    battleAttackers.innerHTML = battleDefenders.innerHTML = ""; // clean DOM
    customization = 0; // exit edit mode

    // clean temp data
    const context = Battle.prototype.context;
    context.attackers.regiments.concat(context.defenders.regiments).forEach(r => {
      delete r.px;
      delete r.py;
      delete r.casualties;
      delete r.survivors;
    });
    delete Battle.prototype.context;
  }

}