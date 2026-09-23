// Reading and writing local files, plus naming downloads and exports.

/** Build a filename from the map name, optional type and current time */
export function getFileName(dataType?: string): string {
  const pad = (value: number) => String(value).padStart(2, "0");

  const date = new Date();
  const dateString = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes())
  ].join("-");

  const type = dataType ? `${dataType} ` : "";
  return `${options.map.lore.name} ${type}${dateString}`;
}

/** Download data as a file */
export function downloadFile(data: BlobPart, name: string, type = "text/plain"): void {
  const url = window.URL.createObjectURL(new Blob([data], { type }));

  const link = document.createElement("a");
  link.download = name;
  link.href = url;
  link.click();

  window.setTimeout(() => window.URL.revokeObjectURL(url), 2000);
}

const UNSAFE_ELEMENTS = new Set(["script", "foreignobject", "iframe", "object", "embed"]);

/** Parse an uploaded svg inertly and strip scripting, external references, editor metadata and Noun Project credits; null if the markup has no svg */
export function sanitizeSvgIcon(svgText: string): SVGElement | null {
  const parsed = new DOMParser().parseFromString(svgText, "text/html").querySelector("svg");
  if (!parsed) return null;

  for (const element of Array.from(parsed.querySelectorAll("*"))) {
    if (UNSAFE_ELEMENTS.has(element.localName.toLowerCase())) element.remove();
  }

  for (const element of [parsed, ...Array.from(parsed.querySelectorAll("*"))]) {
    for (const attr of element.getAttributeNames()) {
      const value = element.getAttribute(attr) ?? "";
      const isHref = attr === "href" || attr.endsWith(":href");
      if (
        attr.includes("inkscape") ||
        attr.includes("sodipodi") ||
        attr.toLowerCase().startsWith("on") ||
        /javascript:/i.test(value.replace(/[\s\p{Cc}]/gu, "")) ||
        (isHref && !/^\s*(#|data:image\/)/i.test(value))
      )
        element.removeAttribute(attr);
    }
  }

  if (svgText.includes("from the Noun Project")) {
    parsed.querySelectorAll("text").forEach(text => void text.remove());
  }

  return document.importNode(parsed, true);
}

/** Prefix the ids and classes an uploaded svg declares, so it neither collides with the document nor styles it */
export function scopeSvgIcon(svg: Element, prefix: string): void {
  const descendants = Array.from(svg.querySelectorAll("*"));
  const ids = new Set(descendants.map(element => element.id).filter(Boolean));
  const classes = new Set([svg, ...descendants].flatMap(element => Array.from(element.classList)));
  const scoped = (name: string) => `${prefix}-${name}`;
  const pattern = (sigil: string, names: Set<string>) =>
    new RegExp(
      `${sigil}(${[...names].map(name => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\w-])`,
      "g"
    );
  const idRef = ids.size ? pattern("#", ids) : null;
  const classRef = classes.size ? pattern("\\.", classes) : null;

  for (const element of [svg, ...descendants]) {
    if (element !== svg && element.id) element.id = scoped(element.id);
    if (element.classList.length) element.setAttribute("class", Array.from(element.classList, scoped).join(" "));
    if (idRef)
      for (const attr of Array.from(element.attributes))
        attr.value = attr.value.replace(idRef, (_, id) => `#${scoped(id)}`);
    if (element.localName === "style" && element.textContent) {
      let css = element.textContent;
      if (idRef) css = css.replace(idRef, (_, id) => `#${scoped(id)}`);
      if (classRef) css = css.replace(classRef, (_, name) => `.${scoped(name)}`);
      element.textContent = css;
    }
  }
}

/** UTF-8 safe base64 data URI */
export function svgToDataUri(svgText: string): string {
  const bytes = new TextEncoder().encode(svgText);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

/** Whether an icon value is an image URL rather than an emoji or text glyph */
export function isImageIcon(icon: string): boolean {
  return /^(https?:\/\/|data:image\/)/.test(icon);
}

/** A hidden file input owned by the calling module: bind `onchange` on it, then click it */
export function createFileInput(accept: string): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.style.display = "none";
  document.body.append(input);
  return input;
}

/** Read the selected file as text and pass its content to the callback */
export function uploadFile(input: HTMLInputElement, callback: (data: string) => void): void {
  const file = input.files?.[0];
  if (!file) return;

  const fileReader = new FileReader();
  fileReader.readAsText(file, "UTF-8");
  input.value = "";
  fileReader.onload = loaded => callback(loaded.target?.result as string);
}
