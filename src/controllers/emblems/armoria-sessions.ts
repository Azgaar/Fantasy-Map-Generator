import type { HeraldicEmblem } from "@/types/emblems";
import { ARMORIA_GUI, isCoa } from "./armoria";

export interface ArmoriaUpdate<T> {
  target: T;
  coa: HeraldicEmblem;
  svg: string;
}

/** Armoria editing sessions: each stays live while its Armoria tab sends updates, until the emblem opens again */
export class ArmoriaSessions<T> {
  private sessions = new Map<string, { target: T; key: string; map: object; origin: string }>();

  start(target: T, key: string, map: object, origin = new URL(ARMORIA_GUI).origin): string {
    for (const [token, live] of this.sessions) if (live.key === key) this.sessions.delete(token);
    const token = crypto.randomUUID();
    this.sessions.set(token, { target, key, map, origin });
    return token;
  }

  /** an update from the Armoria tab of a live session for the current map, or null for any other message */
  receive(event: MessageEvent, map: object): ArmoriaUpdate<T> | null {
    const data: unknown = event.data;
    if (!data || typeof data !== "object") return null;
    const message = data as { type?: unknown; version?: unknown; session?: unknown; coa?: unknown; svg?: unknown };
    if (
      message.type !== "armoria:coa" ||
      message.version !== 1 ||
      typeof message.session !== "string" ||
      typeof message.svg !== "string"
    )
      return null;
    const live = this.sessions.get(message.session);
    if (!live || event.origin !== live.origin || live.map !== map || !isCoa(message.coa)) return null;
    return { target: live.target, coa: message.coa, svg: message.svg };
  }
}
