export async function decodeMapFile(result: ArrayBuffer | Uint8Array): Promise<string[]> {
  const bytes = result instanceof Uint8Array ? result : new Uint8Array(result);
  const decoded = isGzip(bytes) ? await decompressGzip(bytes) : bytes;
  let content = new TextDecoder().decode(decoded);

  if (!content.substring(0, 10).includes("|")) content = decodeURIComponent(atob(content));

  const svgMatch = content.match(/<svg[^>]*id="map"[\s\S]*?<\/svg>/);
  if (svgMatch?.[0].includes("\r\n")) content = content.replace(svgMatch[0], svgMatch[0].replace(/\r\n/g, "\n"));
  return content.split("\r\n");
}

function isGzip(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

async function decompressGzip(bytes: Uint8Array): Promise<Uint8Array> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const stream = new Blob([copy.buffer]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
