const PARAMS: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

interface PathSegment {
  type: string;
  values: number[];
}

/** a path's segments with implicit repeats expanded, as SVGPathElement.getPathData() gives them */
export function pathSegments(d: string): PathSegment[] {
  const segments: PathSegment[] = [];
  let i = 0;
  let command = "";

  const skip = () => {
    while (i < d.length && /[\s,]/.test(d[i])) i++;
  };
  const number = () => {
    skip();
    const match = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(d.slice(i));
    if (!match) throw new Error(`Invalid path at ${i}: ${d}`);
    i += match[0].length;
    return +match[0];
  };
  const flag = () => {
    skip();
    const char = d[i++];
    if (char !== "0" && char !== "1") throw new Error(`Invalid arc flag at ${i}: ${d}`);
    return +char;
  };

  for (skip(); i < d.length; skip()) {
    if (/[a-z]/i.test(d[i])) command = d[i++];
    else if (!command) throw new Error(`Invalid path at ${i}: ${d}`);

    const lower = command.toLowerCase();
    const values = Array.from({ length: PARAMS[lower] }, (_, k) =>
      lower === "a" && (k === 3 || k === 4) ? flag() : number()
    );
    segments.push({ type: command, values });

    if (lower === "z") command = "";
    else if (lower === "m") command = command === "m" ? "l" : "L";
  }
  return segments;
}

/** dash array splitting a shield outline into compony tiles about `compony` long, symmetric within each edge */
export function componyDashes(shieldPath: string, edges: number[] | undefined, compony: number): number[] {
  const data = pathSegments(shieldPath);
  const merge = edges ?? Array(data.length - 2).fill(1);
  const dashes = [0];
  let counter = 1;
  let start = `M${data[0].values[0]},${data[0].values[1]}`;

  for (const count of merge) {
    if (count === 0) continue;
    let path = start;
    for (let j = 0; j < count; j++) path += data[counter + j].type + data[counter + j].values;
    counter += count;

    const segment = document.createElementNS("http://www.w3.org/2000/svg", "path");
    segment.setAttribute("d", path);
    if (typeof segment.getTotalLength !== "function") return []; // no geometry outside a browser
    const length = segment.getTotalLength();
    const end = segment.getPointAtLength(length);
    start = `M${end.x},${end.y}`;

    // an odd number of dashes per edge keeps it symmetric, unless the outline is one edge
    let numDashes =
      merge.length === 1 ? Math.round(length / compony / 2) * 2 : Math.round(0.5 + length / compony / 2) * 2 - 1;
    const dashLength = length / numDashes;
    dashes.push(dashes.pop()! + dashLength);
    while (--numDashes > 0) dashes.push(dashLength);
  }

  dashes.pop();
  dashes.push(1000); // closes the outline
  if (dashes.length % 2) dashes.push(0);
  return dashes;
}
