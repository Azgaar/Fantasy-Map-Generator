import { z } from "zod";
import type { HeraldicEmblem } from "@/types/emblems";
import { ARMORIA_GUI, coaSchema } from "./armoria";

const updateSchema = z.object({
  type: z.literal("armoria:coa"),
  version: z.literal(1),
  session: z.string(),
  coa: coaSchema,
  svg: z.string()
});

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
    const message = updateSchema.safeParse(event.data);
    if (!message.success) return null;
    const { session, coa, svg } = message.data;
    const live = this.sessions.get(session);
    if (!live || event.origin !== live.origin || live.map !== map) return null;
    return { target: live.target, coa: coa as HeraldicEmblem, svg };
  }
}
