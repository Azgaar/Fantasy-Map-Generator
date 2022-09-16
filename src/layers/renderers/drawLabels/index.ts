import {drawBurgLabels} from "./drawBurgLabels";
import {drawStateLabels} from "./drawStateLabels";

export function drawLabels() {
  /* global */ const {cells, features, states, burgs} = pack;

  drawStateLabels(features, cells.f, cells.state, states);
  drawBurgLabels(burgs);
  // TODO: draw other labels

  window.Zoom.invoke();
}
