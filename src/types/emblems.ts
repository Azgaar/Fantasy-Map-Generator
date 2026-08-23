interface EmblemBase {
  size?: number;
  x?: number;
  y?: number;
  shield?: string;
}

export interface HeraldicEmblem extends EmblemBase {
  t1: string;
  division?: EmblemDivision;
  ordinaries?: EmblemOrdinary[];
  charges?: EmblemCharge[];
  custom?: false;
}

export interface CustomEmblem extends EmblemBase {
  custom: true;
}

export type Emblem = HeraldicEmblem | CustomEmblem;

export interface EmblemCharge {
  charge: string;
  t: string;
  p: string;
  t2?: string;
  t3?: string;
  stroke?: string;
  size?: number;
  sinister?: number | boolean;
  reversed?: number | boolean;
  divided?: "field" | "division" | "counter";
}

export interface EmblemOrdinary {
  ordinary: string;
  t: string;
  line?: string;
  divided?: "field" | "division" | "counter";
  above?: boolean;
}

export interface EmblemDivision {
  division: string;
  t: string;
  line?: string;
}
