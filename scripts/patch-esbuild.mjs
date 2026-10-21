import fs from "node:fs";
import path from "node:path";

const esbuildPath = path.resolve("node_modules/esbuild/lib/main.js");
if (fs.existsSync(esbuildPath)) {
  let content = fs.readFileSync(esbuildPath, "utf8");
  const target = 'return ["node", [path2.join(__dirname, "..", "bin", "esbuild")]];';
  const replacement = 'return [process.env.ComSpec || "cmd.exe", ["/c", "bun", path2.join(__dirname, "..", "bin", "esbuild")]];';
  if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(esbuildPath, content, "utf8");
    console.log("[patch-esbuild] esbuild main patched for Windows cmd/bun spawn");
  }
}

const binPath = path.resolve("node_modules/esbuild/bin/esbuild");
if (fs.existsSync(binPath)) {
  let content = fs.readFileSync(binPath, "utf8");
  const marker = '// Node has another bug where using "fs.read"';
  if (content.includes(marker) && !content.includes("const openSync = fs.openSync;")) {
    const patch = `const openSync = fs.openSync;
fs.openSync = function (path, flags, mode) {
  if (typeof flags === 'number') {
    if (flags === 577 || flags === 769) flags = 'w';
    else if (flags === 0) flags = 'r';
    else if (flags === 1) flags = 'w';
    else if (flags === 2) flags = 'r+';
    else flags = Number(flags) | 0;
  }
  return openSync.apply(this, arguments);
};

const open = fs.open;
fs.open = function (path, flags, mode, callback) {
  if (typeof flags === 'number') {
    if (flags === 577 || flags === 769) flags = 'w';
    else if (flags === 0) flags = 'r';
    else if (flags === 1) flags = 'w';
    else if (flags === 2) flags = 'r+';
    else flags = Number(flags) | 0;
  }
  return open.apply(this, arguments);
};

`;
    content = content.replace(marker, patch + marker);
    fs.writeFileSync(binPath, content, "utf8");
    console.log("[patch-esbuild] esbuild bin patched for flags");
  }
}
