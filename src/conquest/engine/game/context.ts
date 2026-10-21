/** Shared engine context (kept in its own module to avoid import cycles). */

import type { ContentPack, ResolvedContent } from "../common/content";
import type { MapPack } from "../common/types";
import type { Command } from "./commandTypes";
import type { CampaignConfig } from "./config";
import type { Campaign } from "./state";

export interface EngineCtx {
  campaign: Campaign;
  pack: MapPack;
  config: CampaignConfig;
  content: ContentPack;
  resolved: ResolvedContent;
  /** Player command log (save format). Internal AI applications skip this. */
  commands?: Command[];
}
