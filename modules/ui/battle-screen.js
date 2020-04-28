"use strict";
function showBattleScreen(attacker, defender) {
  if (customization) return;
  closeDialogs(".stable");

  const battle = {name:"Battle", attackers:[attacker], defenders:[defender]};
  const battleAttackers = document.getElementById("battleAttackers");
  const battleDefenders = document.getElementById("battleDefenders");
  addHeaders();
  addRegiment(battleAttackers, attacker);
  addRegiment(battleDefenders, defender);

  $("#battleScreen").dialog({
    title: battle.name, resizable: false, width: fitContent(), close: closeBattleScreen,
    position: {my: "center", at: "center", of: "#map"}
  });

  if (modules.showBattleScreen) return;
  modules.showBattleScreen = true;

  // add listeners
  document.getElementById("battleAddRegiment").addEventListener("click", addSide);

  function addHeaders() {
    document.getElementById("battleScreen").querySelectorAll("th").forEach(el => el.remove());
    const attackers = battleAttackers.querySelector("tr");
    const defenders = battleDefenders.querySelector("tr");
    let headers = "<th></th><th></th>";

    for (const u of options.military) {
      const label = capitalize(u.name.replace(/_/g, ' '));
      headers += `<th data-tip="${label}">${u.icon}</th>`;
    }

    headers += "<th>Total</th>";
    attackers.insertAdjacentHTML("beforebegin", headers);
    defenders.insertAdjacentHTML("beforebegin", headers);
  }

  function addRegiment(div, regiment) {
    const state = ra(pack.states), supply = rand(1000) + " " + distanceUnitInput.value;
    const color = state.color[0] === "#" ? state.color : "#999";
    const icon = `<svg width="1.4em" height="1.4em" style="margin-bottom: -.6em;">
      <rect x="0" y="0" width="100%" height="100%" fill="${color}" class="fillRect"></rect>
      <text x="0" y="1.04em" style="">${regiment.icon}</text></svg>`;
    const body = `<tbody id="battle${state.i}-${regiment.i}">`;

    let initial = `<tr class="battleInitial"><td>${icon}</td><td class="regiment">${regiment.name.slice(0,25)}</td>`;
    let casualties = `<tr class="battleCasualties"><td></td><td>${state.fullName}</td>`;
    let survivors = `<tr class="battleSurvivors"><td></td><td>Supply line length: ${supply}</td>`;

    for (const u of options.military) {
      initial += `<td style="width: 2.5em; text-align: center">${regiment.u[u.name]||0}</td>`;
      casualties += `<td style="width: 2.5em; text-align: center; color: red">0</td>`;
      survivors += `<td style="width: 2.5em; text-align: center; color: green">${regiment.u[u.name]||0}</td>`;
    }

    initial += `<td style="width: 2.5em; text-align: center">${regiment.a||0}</td></tr>`;
    casualties += `<td style="width: 2.5em; text-align: center; color: red">0</td></tr>`;
    survivors += `<td style="width: 2.5em; text-align: center; color: green">${regiment.a||0}</td></tr>`;

    div.innerHTML += body + initial + casualties + survivors + "</tbody>";
  }

  function addSide() {
    const states = pack.states.filter(s => s.i && !s.removed);
    const stateOptions = states.map(s => `<option value=${s.i}>${s.fullName}</option>`).join("");
    const regiments = states[0].military.map(r => `<option value=${r.i}>${r.icon} ${r.name} (${r.a})</option>`).join("");
    alertMessage.innerHTML = `<select id="addSideSide" data-tip="Select side"><option>Attackers</option><option>Defenders</option></select>
      <select id="addSideState" data-tip="Select state">${stateOptions}</select><br>
      <select id="addSideRegiment" data-tip="Select regiment">${regiments}</select>`;
    $("#alert").dialog({resizable: false, title: "Add regiment to the battle",
      buttons: {
        Add: function() {
          $(this).dialog("close");
          const div = document.getElementById("addSideSide").selectedIndex ? battleDefenders : battleAttackers;
          const state = pack.states.find(s => s.i == document.getElementById("addSideState").value);
          const regiment = state.military.find(r => r.i == document.getElementById("addSideRegiment").value);
          addRegiment(div, regiment);
        },
        Cancel: function() {$(this).dialog("close");}
      }
    });

    document.getElementById("addSideState").onchange = function () {
      const state = pack.states.find(s => s.i == this.value);
      const regiments = state.military.map(r => `<option value=${r.i}>${r.icon} ${r.name} (${r.a})</option>`).join("");
      document.getElementById("addSideRegiment").innerHTML = regiments;
    }
  }

  function closeBattleScreen() {

  }

}