import { createBurgsAdapter } from "./adapters/burgs-adapter";
import { createMarkersAdapter } from "./adapters/markers-adapter";
import { createProvincesAdapter } from "./adapters/provinces-adapter";
import { createRoutesAdapter } from "./adapters/routes-adapter";
import { createZonesAdapter } from "./adapters/zones-adapter";
import { BulkActionBar } from "./bulk-action-bar";
import type { BulkEntityAdapter } from "./bulk-entity-adapter";

/**
 * Bridge that lets the legacy `public/modules/ui/*.js` menus — which load as plain
 * <script> tags and cannot import ES modules — drive the TS BulkActionBar through a
 * `window` global (the idiomatic pattern in this codebase, cf. window.tip/ensureEl).
 * Each legacy menu calls `window.bulkBars.mount(type, { redraw })` when it opens and
 * `window.bulkBars.sync(type)` at the end of its row-render. Migrated TS menus skip
 * this and use the adapter factory + BulkActionBar directly; this bridge can be
 * deleted once all listed menus are migrated.
 */

type AdapterFactory = (redraw: () => void) => BulkEntityAdapter;

const factories: Record<string, AdapterFactory> = {
  burgs: createBurgsAdapter,
  provinces: createProvincesAdapter,
  markers: createMarkersAdapter,
  routes: createRoutesAdapter,
  zones: createZonesAdapter
};

interface BridgeEntry {
  bar: BulkActionBar;
  redraw: () => void;
}

const entries: Record<string, BridgeEntry> = {};

function mount(type: string, options: { redraw: () => void }): void {
  const factory = factories[type];
  if (!factory) return;

  let entry = entries[type];
  if (!entry) {
    entry = { redraw: options.redraw } as BridgeEntry;
    entry.bar = new BulkActionBar(factory(() => entry.redraw()));
    entries[type] = entry;
  }
  entry.redraw = options.redraw; // track the current menu instance's renderer
  entry.bar.mount();
}

function sync(type: string): void {
  entries[type]?.bar.sync();
}

declare global {
  var bulkBars: { mount: typeof mount; sync: typeof sync };
}

window.bulkBars = { mount, sync };
