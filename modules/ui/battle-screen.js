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
  //document.getElementById("regimentNameRestore").addEventListener("click", restoreName);

  function addHeaders() {
    document.getElementById("battleScreen").querySelectorAll("th").forEach(el => el.remove());
    const attackers = battleAttackers.querySelector("tr");
    const defenders = battleDefenders.querySelector("tr");
    let headers = "<th></th>";

    for (const u of options.military) {
      const label = capitalize(u.name.replace(/_/g, ' '));
      headers += `<th data-tip="${label}">${u.icon}</th>`;
    }

    headers += "<th>Total</th>";
    attackers.insertAdjacentHTML("beforebegin", headers);
    defenders.insertAdjacentHTML("beforebegin", headers);
  }

  function addRegiment(div, regiment) {
    const reg = document.createElement("div");
    reg.innerHTML = regiment.name;
    div.append(reg);
  }

  function closeBattleScreen() {

  }

}