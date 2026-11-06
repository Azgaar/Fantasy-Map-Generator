export type MilitaryUnit = {
  icon: string;
  name: string;
  rural: number;
  urban: number;
  crew: number;
  power: number;
  type: string;
  separate: number;
  biomes?: number[];
  states?: number[];
  cultures?: number[];
  religions?: number[];
  goods?: number[]; // ids of the goods that equip it
};
