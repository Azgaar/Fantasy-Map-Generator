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
  inscriptions?: EmblemInscription[];
  diaper?: string;
  zoom?: number;
}

export interface PictureEmblem extends EmblemBase {
  icon: string;
}

export type Emblem = HeraldicEmblem | PictureEmblem;

type Divided = "field" | "division" | "counter";

/** placement shared by charges and ordinaries, in shield units around the center */
interface EmblemPlacement {
  size?: number;
  stretch?: number; // negative widens, positive heightens
  x?: number;
  y?: number;
  angle?: number;
  stroke?: string;
  divided?: Divided;
}

export interface EmblemCharge extends EmblemPlacement {
  charge: string;
  t: string;
  p: string;
  t2?: string;
  t3?: string;
  sinister?: number | boolean;
  reversed?: number | boolean;
  layered?: number | boolean; // redraws the charge's foreground over what it overlaps
  outside?: "above" | "below" | "around"; // drawn over or under the shield outline
}

export interface EmblemOrdinary extends EmblemPlacement {
  ordinary: string;
  t: string;
  t2?: string;
  line?: string;
  above?: boolean;
  strokeWidth?: number;
  compony?: number; // bordure and orle tile length
  gyronny?: number; // bordure and orle sector count
}

export interface EmblemDivision {
  division: string;
  t: string;
  line?: string;
}

export interface EmblemInscription {
  text: string; // `|` breaks lines
  font: string;
  size: number;
  color: string;
  path: string; // around the shield center
  bold?: boolean;
  italic?: boolean;
  spacing?: number;
  shadow?: { x: number; y: number; blur: number; color: string };
}
