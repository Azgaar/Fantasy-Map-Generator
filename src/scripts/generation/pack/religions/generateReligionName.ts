import {religionsData} from "config/religionsData";
import {trimVowels, getAdjective} from "utils/languageUtils";
import {rw, ra} from "utils/probabilityUtils";
import {isCulture, isState} from "utils/typeUtils";

const {Names} = window;
const {methods, types} = religionsData;

interface IContext {
  cultureId: number;
  stateId: number;
  burgId: number;
  cultures: TCultures;
  states: TStates;
  burgs: TBurgs;
  center: number;
  form: keyof typeof types;
  deity: string;
}

const context = {
  data: {} as IContext,

  // data setter
  set current(data: IContext) {
    this.data = data;
  },

  // data getters
  get culture() {
    return this.data.cultures[this.data.cultureId];
  },

  get state() {
    return this.data.states[this.data.stateId];
  },

  get burg() {
    return this.data.burgs[this.data.burgId];
  },

  get form() {
    return this.data.form;
  },

  get deity() {
    return this.data.deity;
  },

  // generation methods
  get random() {
    return Names.getBase(this.culture.base);
  },

  get type() {
    return rw(types[this.form] as {[key: string]: number});
  },

  get supreme() {
    return this.deity.split(/[ ,]+/)[0];
  },

  get cultureName() {
    return this.culture.name;
  },

  get place() {
    const base = this.burg.name || this.state.name;
    return trimVowels(base.split(/[ ,]+/)[0]);
  }
};

const nameMethodsMap = {
  "Random + type": {getName: () => `${context.random} ${context.type}`, expansion: "global"},
  "Random + ism": {getName: () => `${trimVowels(context.random)}ism`, expansion: "global"},
  "Supreme + ism": {getName: () => `${trimVowels(context.supreme)}ism`, expansion: "global"},
  "Faith of + Supreme": {
    getName: () => `${ra(["Faith", "Way", "Path", "Word", "Witnesses"])} of ${context.supreme}`,
    expansion: "global"
  },
  "Place + ism": {getName: () => `${context.place}ism`, expansion: "state"},
  "Culture + ism": {getName: () => `${trimVowels(context.cultureName)}ism`, expansion: "culture"},
  "Place + ian + type": {
    getName: () => `${getAdjective(context.place)} ${context.type}`,
    expansion: "state"
  },
  "Culture + type": {getName: () => `${context.cultureName} ${context.type}`, expansion: "culture"}
};

export function generateReligionName(data: IContext) {
  context.current = data;
  const {stateId, cultureId, states, cultures, center} = data;

  const method = nameMethodsMap[rw(methods)];
  const name = method.getName();

  let expansion = method.expansion;
  if (expansion === "state" && !stateId) expansion = "global";
  if (expansion === "culture" && !cultureId) expansion = "global";

  if (expansion === "state" && Math.random() > 0.5) {
    const state = states[stateId];
    if (isState(state)) return {name, expansion, center: state.center};
  }

  if (expansion === "culture" && Math.random() > 0.5) {
    const culture = cultures[cultureId];
    if (isCulture(culture)) return {name, expansion, center: culture.center};
  }

  return {name, expansion, center};
}
