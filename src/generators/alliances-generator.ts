export type AllianceStatus = "active" | "dormant" | "dissolved";
export type AllianceType = "defensive" | "military" | "economic" | "political";

export interface Alliance {
  id: string;
  name: string;
  color: string;
  type: AllianceType;
  members: number[];
  status: AllianceStatus;
  foundedYear: number | null;
  dissolvedYear: number | null;
  description: string;
}

export interface AllianceState {
  i: number;
  name: string;
  removed?: boolean;
}

export const isAllianceColor = (color: string): boolean => /^#[0-9a-f]{6}$/i.test(color);

export function normalizeAlliances(value: unknown, states: AllianceState[]): Alliance[] {
  if (!Array.isArray(value)) return [];
  const validStateIds = new Set(states.filter(state => state.i && !state.removed).map(state => state.i));
  const seen = new Set<string>();
  const alliances: Alliance[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Partial<Alliance>;
    if (typeof candidate.id !== "string" || !candidate.id || seen.has(candidate.id)) continue;
    if (typeof candidate.name !== "string" || !candidate.name.trim()) continue;
    if (typeof candidate.color !== "string" || !isAllianceColor(candidate.color)) continue;
    const members = Array.isArray(candidate.members)
      ? [...new Set(candidate.members.filter((id): id is number => Number.isInteger(id) && validStateIds.has(id)))]
      : [];
    const type: AllianceType = ["defensive", "military", "economic", "political"].includes(candidate.type as string)
      ? (candidate.type as AllianceType)
      : "political";
    const status: AllianceStatus = ["active", "dormant", "dissolved"].includes(candidate.status as string)
      ? (candidate.status as AllianceStatus)
      : members.length < 2 ? "dormant" : "active";
    seen.add(candidate.id);
    alliances.push({
      id: candidate.id,
      name: candidate.name.trim(),
      color: candidate.color,
      type,
      members,
      status,
      foundedYear: Number.isInteger(candidate.foundedYear) ? candidate.foundedYear! : null,
      dissolvedYear: Number.isInteger(candidate.dissolvedYear) ? candidate.dissolvedYear! : null,
      description: typeof candidate.description === "string" ? candidate.description : ""
    });
  }
  return alliances;
}

export function createAlliance(
  alliances: Alliance[],
  states: AllianceState[],
  input: Pick<Alliance, "name" | "color" | "type" | "members"> & Partial<Pick<Alliance, "description">>
): Alliance {
  const name = input.name.trim();
  if (!name) throw new Error("Alliance name is required");
  if (!isAllianceColor(input.color)) throw new Error("Alliance color must be a six-digit hex color");
  if (alliances.some(alliance => alliance.name.toLocaleLowerCase() === name.toLocaleLowerCase()))
    throw new Error("An alliance with this name already exists");
  const validStateIds = new Set(states.filter(state => state.i && !state.removed).map(state => state.i));
  const members = [...new Set(input.members)].filter(id => validStateIds.has(id));
  if (members.length < 2) throw new Error("Select at least two countries");
  const alliance: Alliance = {
    id: `alliance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    color: input.color,
    type: input.type,
    members,
    status: "active",
    foundedYear: null,
    dissolvedYear: null,
    description: input.description?.trim() ?? ""
  };
  alliances.push(alliance);
  return alliance;
}

export function setAllianceMembers(alliance: Alliance, members: number[], states: AllianceState[]): void {
  const validStateIds = new Set(states.filter(state => state.i && !state.removed).map(state => state.i));
  alliance.members = [...new Set(members)].filter(id => validStateIds.has(id));
  if (alliance.status !== "dissolved") alliance.status = alliance.members.length < 2 ? "dormant" : "active";
}

export function dissolveAlliance(alliance: Alliance, year: number | null = null): void {
  alliance.status = "dissolved";
  alliance.dissolvedYear = year;
}

export function cleanupAllianceMembers(alliances: Alliance[], states: AllianceState[]): void {
  const validStateIds = new Set(states.filter(state => state.i && !state.removed).map(state => state.i));
  for (const alliance of alliances) {
    alliance.members = alliance.members.filter(id => validStateIds.has(id));
    if (alliance.status !== "dissolved" && alliance.members.length < 2) alliance.status = "dormant";
  }
}
