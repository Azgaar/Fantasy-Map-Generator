export interface FontReadinessResult {
  family: string;
  ready: boolean;
}

interface FontSetLike {
  load(font: string, text?: string): PromiseLike<unknown>;
}

export async function ensureFontFamiliesReady(
  families: Iterable<string>,
  fontSet: FontSetLike | undefined = globalThis.document?.fonts
): Promise<FontReadinessResult[]> {
  const uniqueFamilies = [...new Set(families)].sort();
  if (!fontSet) return uniqueFamilies.map(family => ({ family, ready: false }));
  return Promise.all(
    uniqueFamilies.map(async family => {
      try {
        await fontSet.load(`16px "${family.replaceAll('"', '\\"')}"`, "Aa0");
        return { family, ready: true };
      } catch {
        return { family, ready: false };
      }
    })
  );
}
