import { byId } from "utils/nodeUtils";

export function drawIce() {
  const ice = byId("ice");
  const { ice: icePack } = pack;

  let innerHTML = "";
  for (const shield of icePack.iceShields) {
    innerHTML += `<polygon points="${shield.points.toString()}" />`;
  }

  for (const iceberg of icePack.icebergs) {
    innerHTML += `<polygon points="${iceberg.points.toString()}" />`;
  }
  ice.innerHTML = innerHTML;
}
