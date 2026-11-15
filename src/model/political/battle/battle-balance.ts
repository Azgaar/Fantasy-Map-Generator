// The numbers that decide how battles go: blows and losses, morale, energy, pace, the generals' odds, works.
// Tune them here; see docs/domain/battles.md for what each mechanism does.

import type { WorkKind } from "./battlefield";

// Blows and shots

// a hundred men of attack 1 cut down or shoot down one and a quarter men of defense 1 a round
export const KILL_RATE = 0.0125;
export const FLANK = 1.25; // how much harder a blow or a shot lands in the flank
export const REAR = 1.8; // and in the rear
export const BROKEN = 0.1; // strike of troops on the run or giving themselves up; they stand as well as ever
export const SHOCK = 0.5; // strength of a side taken by surprise
export const IMPETUS = 6.2; // closing speed in m/s that adds a whole blow again: riders at the gallop strike 2.7 times, foot at the charge 1.6
export const MAX_IMPETUS = 5;
export const SPENT = 0.85; // share of a charge's impetus left after each tick at grips
export const WALLS = 4; // how many times weaker a blow or a shot is from without the walls at those within
export const BREACH_BLOWS = 185; // the blows that open a breach: what would cut down so many men of defense 1
export const COVER = 0.6; // share of the shots that tell on troops in a wood or a burg
export const SHELTER = 0.5; // what blows and shots over wagons keep; a charge over any work has no impetus
export const POINT_BLANK = { shooter: 2, engine: 20 }; // under which they cannot shoot

// Reach

export const CONTACT = 12; // gap at which blocks fight
// in battalion fronts
export const CHARGE = 2.75; // how far from its place a battalion goes for a foe when its side closes
export const COUNTER = 1; // and when it holds
export const CHARGE_HASTE = 3; // how much faster than its pace a battalion runs in at a foe it is about to strike

// Morale

export const MORALE_LOSS = 300; // morale a block loses when all its troops fall
export const NERVE = 12; // morale a round the odds at hand give or take, at most half of it
export const REST = 4; // morale a round a battalion left alone recovers
export const SHAKEN = 30; // morale under which a battalion does not attack
export const BREAK = 15; // morale at which it breaks and runs
export const RALLY = 35; // and at which a broken one that got away stands again
export const YIELD = 20; // morale under which a battalion with no way out gives itself up
export const HUNGER = 1; // morale a round a garrison cut off loses, down to STARVED
export const STARVED = 20; // morale hunger takes a garrison cut off down to: there it gives the burg up
// in battalion fronts
export const AT_HAND = 2.95; // how far a battalion counts friends and foes to take or lose heart
export const SAFE = 4.5; // a broken one gathers itself with no foe in order that near
export const SHAKE = 3.6; // how far a battalion broken or lost unsettles friends

// Energy and pace

// energy a tick by what a battalion does: gone after 2 hours of marching, 30 minutes at grips; back in an hour of rest
export const EXERTION = {
  rest: -1 / 450,
  march: 1 / 900,
  build: 1 / 600,
  shoot: 1 / 450,
  fight: 1 / 225,
  run: 1 / 150
};
export const RUNNING = 1.5; // of its pace, how fast a battalion runs rather than marches
export const FLIGHT = 1.2; // of its pace, how fast a broken battalion runs
export const WADING = 0.12; // share of the pace kept in deep water
export const FORDING = 0.4; // and in a ford
export const RUBBLE = 0.5; // and over the rubble of a breach
export const SLOPE_FOOTING = 0.5; // the least of its strength a block keeps on a steep slope

// The generals' odds: own power to the foe's

export const BOLD = 0.75; // odds at which attackers still attack
export const KEEN = 1.25; // and at which defenders come out to meet them
export const STORM_ODDS = [4, 2.5, 1.8, 1.4]; // besiegers to besieged it takes to storm walls, by the breaches in them
export const ASSAULT_ODDS = 1.25; // and a burg without walls
export const RING_ODDS = 3; // besiegers to besieged it takes to ring a walled burg in
export const RING_BATTALIONS = 6; // and battalions at the least, a stretch of the ring each
export const BREACHES = 2; // gaps the engines knock in the foe's wagons before the side goes in

// Works

export const BUILD_TICKS: Record<WorkKind, number> = { stakes: 15, wagons: 10, ditch: 60 };
