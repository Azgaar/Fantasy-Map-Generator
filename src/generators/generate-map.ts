import { AddedLabels } from "./added-labels";
import { Biomes } from "./biomes-generator";
import { Burgs } from "./burgs-generator";
import { Cultures } from "./cultures-generator";
import { Features } from "./features";
import { Goods } from "./goods-generator";
import { HeightmapGenerator } from "./heightmap-generator";
import { Ice } from "./ice-generator";
import { Lakes } from "./lakes";
import { Markers } from "./markers-generator";
import { Markets } from "./markets-generator";
import { Military } from "./military-generator";
import { Names } from "./names-generator";
import { Production } from "./production-generator";
import { Provinces } from "./provinces-generator";
import { Religions } from "./religions-generator";
import { Rivers } from "./river-generator";
import { Routes } from "./routes-generator";
import { States } from "./states-generator";
import { Zones } from "./zones-generator";

export async function generateMap(): Promise<void> {
  grid.cells.h = await HeightmapGenerator.generate(grid);
  pack = {} as typeof pack;

  Features.markupGrid();
  addLakesInDeepDepressions();
  openNearSeaLakes();

  defineMapSize();
  calculateMapCoordinates();
  calculateTemperatures();
  generatePrecipitation();

  reGraph();
  Features.markupPack();
  Measurers.createDefaultRuler();

  Rivers.generate();
  Biomes.generate();
  Features.defineGroups();

  Ice.generate();

  Goods.generate();

  rankCells();
  Cultures.generate();
  Cultures.expand();

  Burgs.generate();
  States.generate();
  Routes.generate();
  Religions.generate();

  Burgs.specify();
  States.collectStatistics();
  States.defineStateForms();

  Provinces.generate();
  Provinces.getPoles();

  Rivers.specify();
  Lakes.defineNames();

  Markets.generate();
  Production.produce();
  States.collectTaxes();

  Military.generate();
  Markers.generate();
  Zones.generate();

  AddedLabels.initiate();
  Names.getMapName(false);
}

window.generateMap = generateMap;
