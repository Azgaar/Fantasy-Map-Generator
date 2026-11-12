export type MilitaryUnit = {
  icon: string;
  name: string;
  rural: number;
  urban: number;
  crew: number;
  attack: number; // what a unit strikes and shoots with
  defense: number; // what it stands blows and shots with
  speed: number; // battle plan units a tick, the plan is 1000 wide
  range: number; // battle plan units it shoots over, 0 to fight hand to hand
  morale: number; // steadiness: 1 is ordinary, lower breaks sooner
  type: string;
  separate: number;
  biomes?: number[];
  states?: number[];
  cultures?: number[];
  religions?: number[];
  goods?: number[]; // ids of the goods that equip it
};
