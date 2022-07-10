interface PrecreatedHeightmap {
  id: number;
  name: string;
  size: number;
  latitude: number;
}

export const precreatedHeightmaps: Dict<PrecreatedHeightmap> = {
  "africa-centric": {id: 0, name: "Africa Centric", size: 45, latitude: 53},
  arabia: {id: 1, name: "Arabia", size: 20, latitude: 35},
  atlantics: {id: 2, name: "Atlantics", size: 42, latitude: 23},
  britain: {id: 3, name: "Britain", size: 7, latitude: 20},
  caribbean: {id: 4, name: "Caribbean", size: 15, latitude: 40},
  "east-asia": {id: 5, name: "East Asia", size: 11, latitude: 28},
  eurasia: {id: 6, name: "Eurasia", size: 38, latitude: 19},
  europe: {id: 7, name: "Europe", size: 20, latitude: 16},
  "europe-accented": {id: 8, name: "Europe Accented", size: 14, latitude: 22},
  "europe-and-central-asia": {id: 9, name: "Europe and Central Asia", size: 25, latitude: 10},
  "europe-central": {id: 10, name: "Europe Central", size: 11, latitude: 22},
  "europe-north": {id: 11, name: "Europe North", size: 7, latitude: 18},
  greenland: {id: 12, name: "Greenland", size: 22, latitude: 7},
  hellenica: {id: 13, name: "Hellenica", size: 8, latitude: 27},
  iceland: {id: 14, name: "Iceland", size: 2, latitude: 15},
  "indian-ocean": {id: 15, name: "Indian Ocean", size: 45, latitude: 55},
  "mediterranean-sea": {id: 16, name: "Mediterranean Sea", size: 10, latitude: 29},
  "middle-east": {id: 17, name: "Middle East", size: 8, latitude: 31},
  "north-america": {id: 18, name: "North America", size: 37, latitude: 17},
  "us-centric": {id: 19, name: "US-centric", size: 66, latitude: 27},
  "us-mainland": {id: 20, name: "US Mainland", size: 16, latitude: 30},
  world: {id: 21, name: "World", size: 78, latitude: 27},
  "world-from-pacific": {id: 22, name: "World from Pacific", size: 75, latitude: 32}
};
