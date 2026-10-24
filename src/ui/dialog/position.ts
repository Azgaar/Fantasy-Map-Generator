// Dialog placement: align a point of the window to a point of a target, with keyword + offset syntax, kept inside the viewport

export type DialogPosition = {
  my?: string;
  at?: string;
  of?: string | Element | Window;
};

type Box = { left: number; top: number; width: number; height: number };

const HORIZONTAL = /^(left|center|right)$/;
const VERTICAL = /^(top|center|bottom)$/;
const OFFSET = /[+-]\d+(\.\d+)?%?$/;

/** The window's top-left in viewport pixels: `my` of an element of `size` aligned to `at` of `target`, kept inside `within` */
export function placeBox(
  { my = "center", at = "center" }: DialogPosition,
  size: { width: number; height: number },
  target: Box,
  within: Box
): { left: number; top: number } {
  const [atX, atY] = parse(at);
  const [myX, myY] = parse(my);

  let left = target.left + anchor(atX.keyword, target.width) + offset(atX.offset, target.width);
  let top = target.top + anchor(atY.keyword, target.height) + offset(atY.offset, target.height);
  left += -anchor(myX.keyword, size.width) + offset(myX.offset, size.width);
  top += -anchor(myY.keyword, size.height) + offset(myY.offset, size.height);

  left = fitInside(left, size.width, within.left, within.width);
  top = fitInside(top, size.height, within.top, within.height);
  return { left, top: Math.max(top, within.top) }; // the titlebar is never above the viewport
}

function parse(value: string): [{ keyword: string; offset: string }, { keyword: string; offset: string }] {
  let parts = value.split(" ");
  if (parts.length === 1) parts = HORIZONTAL.test(keywordOf(parts[0])) ? [parts[0], "center"] : ["center", parts[0]];
  if (VERTICAL.test(keywordOf(parts[0])) && HORIZONTAL.test(keywordOf(parts[1]))) parts = [parts[1], parts[0]];
  return [split(parts[0], HORIZONTAL), split(parts[1], VERTICAL)];
}

function keywordOf(part: string): string {
  return part.replace(OFFSET, "");
}

function split(part: string, keywords: RegExp): { keyword: string; offset: string } {
  const keyword = keywordOf(part);
  return { keyword: keywords.test(keyword) ? keyword : "center", offset: part.match(OFFSET)?.[0] ?? "" };
}

function anchor(keyword: string, length: number): number {
  if (keyword === "right" || keyword === "bottom") return length;
  if (keyword === "center") return length / 2;
  return 0;
}

function offset(value: string, length: number): number {
  if (!value) return 0;
  const number = parseFloat(value);
  return value.endsWith("%") ? (number * length) / 100 : number;
}

function fitInside(position: number, length: number, withinStart: number, withinLength: number): number {
  const overStart = withinStart - position;
  const overEnd = position + length - withinLength - withinStart;

  if (length > withinLength) {
    if (overStart > 0 && overEnd <= 0) return withinStart + withinLength - length;
    if (overEnd > 0 && overStart <= 0) return withinStart;
    return overStart > overEnd ? withinStart + withinLength - length : withinStart;
  }
  if (overStart > 0) return position + overStart;
  if (overEnd > 0) return position - overEnd;
  return position;
}
