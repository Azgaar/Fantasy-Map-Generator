import {religionsData} from "config/religionsData";
import {trimVowels, getAdjective} from "utils/languageUtils";
import {rw, ra} from "utils/probabilityUtils";
import {generateMeaning} from "./generateDeityName";

const {Names} = window;
const {namingMethods, types} = religionsData;

interface IContext {
  cultureId: number;
  stateId: number;
  burgId: number;
  cultures: TCultures;
  states: TStates;
  burgs: TBurgs;
  form: string;
  supreme: string;
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

  get supreme() {
    return this.data.supreme;
  },

  // generation methods
  get random() {
    return Names.getBase(this.culture.base);
  },

  get type() {
    return rw<string>(types[this.form as keyof typeof types]);
  },

  get supremeName() {
    return this.supreme.split(/[ ,]+/)[0];
  },

  get cultureName() {
    return this.culture.name;
  },

  get place() {
    const base = this.burg.name || this.state.name;
    return trimVowels(base.split(/[ ,]+/)[0]);
  },

  get meaning() {
    return generateMeaning();
  }
};

const nameMethodsMap = {
  "Random + type": {getName: () => `${context.random} ${context.type}`, expansion: "global"},
  "Random + ism": {getName: () => `${trimVowels(context.random)}ism`, expansion: "global"},
  "Supreme + ism": {getName: () => `${trimVowels(context.supremeName)}ism`, expansion: "global"},
  "Faith of + Supreme": {
    getName: () => `${ra(["Faith", "Way", "Path", "Word", "Witnesses"])} of ${context.supremeName}`,
    expansion: "global"
  },
  "Place + ism": {getName: () => `${context.place}ism`, expansion: "state"},
  "Culture + ism": {getName: () => `${trimVowels(context.cultureName)}ism`, expansion: "culture"},
  "Place + ian + type": {
    getName: () => `${getAdjective(context.place)} ${context.type}`,
    expansion: "state"
  },
  "Culture + type": {getName: () => `${context.cultureName} ${context.type}`, expansion: "culture"},
  "Burg + ian + type": {
    getName: () => context.burg.name && `${getAdjective(context.burg.name)} ${context.type}`,
    expansion: "global"
  },
  "Random + ian + type": {getName: () => `${getAdjective(context.random)} ${context.type}`, expansion: "global"},
  "Type + of the + meaning": {getName: () => `${context.type} of the ${context.meaning}`, expansion: "global"}
};

const fallbackMethod = nameMethodsMap["Random + type"];

function getMethod(type: IReligion["type"]) {
  const methods: {[key in string]: number} = namingMethods[type];
  const method = rw(methods);
  return nameMethodsMap[method as keyof typeof nameMethodsMap];
}

export function generateReligionName(
  type: IReligion["type"],
  data: IContext
): {name: string; expansion: IReligion["expansion"]} {
  context.current = data;
  const method = getMethod(type);
  const name = method.getName() || fallbackMethod.getName();

  let expansion = method.expansion as IReligion["expansion"];
  if (expansion === "state" && !data.stateId) expansion = "global";
  else if (expansion === "culture" && !data.cultureId) expansion = "global";

  return {name, expansion};
}
