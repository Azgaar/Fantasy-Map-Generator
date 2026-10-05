// Custom icons as a zip: `icons.json` restores them under the same ids, the picture files are there to look at
import { type CustomIcon, CustomIcons } from "@/components/icons";
import { customIcon } from "@/components/options-schema";
import { loadScript } from "@/utils";

const MANIFEST = "icons.json";

async function loadJSZip(): Promise<any> {
  if (!window.JSZip) await loadScript("libs/jszip.min.js");
  return window.JSZip;
}

function addPicture(zip: any, { id, kind, content, viewBox }: CustomIcon): void {
  if (kind === "svg") {
    zip.file(`${id}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${content}</svg>`);
    return;
  }
  const embedded = content.match(/^data:image\/([\w+]+);base64,(.*)$/); // a linked image lives only in the manifest
  if (embedded) zip.file(`${id}.${embedded[1].replace("+xml", "")}`, embedded[2], { base64: true });
}

/** A zip of the given custom icons, all of them by default */
async function pack(icons: readonly CustomIcon[] = CustomIcons.all): Promise<Blob> {
  const JSZip = await loadJSZip();
  const zip = new JSZip();
  zip.file(MANIFEST, JSON.stringify(icons, null, 2));
  for (const icon of icons) addPicture(zip, icon);
  return zip.generateAsync({ type: "blob" });
}

const samePicture = (a: CustomIcon, b: CustomIcon): boolean =>
  a.kind === b.kind && a.content === b.content && a.viewBox === b.viewBox;

/** Add the icons of a zip the map lacks; an id the map uses for another picture is a conflict, left as it is */
async function unpack(
  file: Blob
): Promise<{ added: number; unchanged: number; conflicts: CustomIcon[]; invalid: number }> {
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(file).catch(() => {
    throw new Error("The file is not a zip archive");
  });
  const manifest = await zip.file(MANIFEST)?.async("string");
  if (!manifest) throw new Error(`The archive has no ${MANIFEST}: it is not a custom icons archive`);
  const listed: unknown = JSON.safeParse(manifest);
  if (!Array.isArray(listed)) throw new Error(`The archive's ${MANIFEST} is not a list of icons`);

  const result = { added: 0, unchanged: 0, conflicts: [] as CustomIcon[], invalid: 0 };
  for (const entry of listed) {
    const parsed = customIcon.safeParse(entry);
    if (!parsed.success) {
      result.invalid++;
      continue;
    }
    const icon = parsed.data;
    const existing = CustomIcons.get(icon.id);
    if (!existing) {
      CustomIcons.add(icon);
      result.added++;
    } else if (samePicture(existing, icon)) result.unchanged++;
    else result.conflicts.push(icon);
  }
  return result;
}

/** Give the map's icons the pictures of conflicting archived ones */
function replace(icons: readonly CustomIcon[]): void {
  for (const { id, ...picture } of icons) CustomIcons.update(id, picture);
}

export const IconsArchive = { pack, unpack, replace };
