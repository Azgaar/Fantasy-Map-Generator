#!/usr/bin/env python3
"""Repair a Fantasy Map Generator .map file whose line endings were normalized.

FMG .map files are sections joined by CRLF (\\r\\n), while the embedded SVG
section contains bare LF (\\n) newlines inside it. Text editors and git
(core.autocrlf, .gitattributes text rules, VSCode "files.eol") often strip or
rewrite the CR bytes, after which the loader's split on \\r\\n yields a single
giant section and the map fails to load as "invalid file".

This script rebuilds the section structure. It works because every section
except the SVG is a single line: the sections before the SVG map one-to-one
onto lines, the SVG block (first line starting with "<svg" through the line
ending "</svg>") is re-joined with bare LF into one section, and every line
after it is one section. The result is re-joined with CRLF.

Usage:
    python3 repair-map-line-endings.py Lendeia.map
    python3 repair-map-line-endings.py Lendeia.map -o fixed.map

By default the repaired file is written next to the input as
"<name>.repaired.map"; the input file is never modified.

To stop git from corrupting .map files in the first place, add to
.gitattributes:
    *.map -text
"""

import argparse
import json
import sys
from pathlib import Path
from typing import NoReturn

GZIP_MAGIC = b"\x1f\x8b"


def fail(message) -> NoReturn:
    sys.exit(f"error: {message}")


def parse_sections(text):
    """Split normalized (LF-only) map text into FMG sections."""
    lines = text.split("\n")

    svg_start = next((i for i, line in enumerate(lines) if line.lstrip().startswith("<svg")), None)
    if svg_start is None:
        fail("no '<svg' line found — this does not look like an FMG .map file")

    # gridGeneral is the section right after the SVG and always starts with {"spacing"
    svg_end = None
    for i in range(svg_start + 1, len(lines)):
        if lines[i].startswith('{"spacing"'):
            svg_end = i - 1
            break
    if svg_end is None:
        # fallback for hypothetical older formats: last line closing the svg
        svg_end = max((i for i, line in enumerate(lines) if line.rstrip().endswith("</svg>")), default=None)
    if svg_end is None or svg_end < svg_start:
        fail("could not locate the end of the SVG section")
    if not lines[svg_end].rstrip().endswith("</svg>"):
        fail(f"SVG section (lines {svg_start + 1}-{svg_end + 1}) does not end with '</svg>'")

    svg_section = "\n".join(lines[svg_start : svg_end + 1])
    return lines[:svg_start] + [svg_section] + lines[svg_end + 1 :]


def validate(sections):
    first = sections[0].split("|")[0]
    if not first.replace(".", "").isdigit():
        fail(f"first section does not start with a version number: {sections[0][:60]!r}")
    if "|" not in sections[0]:
        fail("first section has no '|' delimiters — not an FMG .map file")

    for i, section in enumerate(sections):
        if section.startswith(("{", "[")) and i != 5:  # 5 is the SVG slot in modern files, never JSON
            try:
                json.loads(section)
            except json.JSONDecodeError as e:
                fail(f"section {i} looks like JSON but does not parse ({e}) — file may be truncated or otherwise damaged")


def main():
    parser = argparse.ArgumentParser(
        description="Repair an FMG .map file whose CRLF section delimiters were normalized to LF.",
        epilog='Prevent recurrence: add "*.map -text" to .gitattributes.'
    )
    parser.add_argument("input", type=Path, help="corrupted .map file")
    parser.add_argument("-o", "--output", type=Path, help="output path (default: <input>.repaired.map)")
    args = parser.parse_args()

    raw = args.input.read_bytes()
    if raw[:2] == GZIP_MAGIC:
        fail("this is a gzip-compressed save (.gz); intact .gz files are immune to line-ending "
             "corruption, and a .gz that went through text-mode conversion is not recoverable")
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        fail("file is not valid UTF-8 text — not a plain .map save (or binary-level damage)")

    crlf_sections = text.split("\r\n")
    if len(crlf_sections) >= 30 and "|" in crlf_sections[0]:
        print(f"{args.input}: already has {len(crlf_sections)} CRLF-delimited sections — no repair needed")
        return

    # normalize whatever mix of endings is present, then rebuild
    sections = parse_sections(text.replace("\r\n", "\n").replace("\r", "\n"))
    validate(sections)

    output = args.output or args.input.with_suffix(".repaired.map")
    if output.resolve() == args.input.resolve():
        fail("output path equals input path; refusing to overwrite the original")
    output.write_bytes("\r\n".join(sections).encode("utf-8"))

    svg_lines = sections[5].count("\n") + 1
    print(f"{args.input}: rebuilt {len(sections)} sections (SVG block spans {svg_lines} lines)")
    print(f"wrote {output}")


if __name__ == "__main__":
    main()
