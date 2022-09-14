import {drawBurgLabels} from "./drawBurgLabels";
import {drawStateLabels} from "./drawStateLabels";

export function drawLabels() {
  /* global */ const {cells, states, burgs} = pack;

  drawStateLabels(cells, states);
  drawBurgLabels(burgs);
  // TODO: draw other labels

  window.Zoom.invoke();
}
