export interface MapHistoryEntry {
  seed: string;
  width: number;
  height: number;
  template: string;
  created: number;
  /** when this entry was put on screen in this session, unlike `created` never backdated to a loaded file's own timestamp */
  registeredAt: number;
}

/** Every map this session put on screen, oldest first; the last one is what is on screen now */
export const mapHistory: MapHistoryEntry[] = [];
