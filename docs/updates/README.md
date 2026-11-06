# Update notes

A note announces a release worth talking about. It is the same text as the Patreon post, and the newest note is shown in the in-app update window.

## Files

- One folder per release, one note in it: `v1.155.0/v1.155.0 - Translations.md`. The part after the dash is the title shown in the update window.
- Screenshots go in `screenshots/` and are linked relatively: `![What the image shows](screenshots/hex-board.jpg)`.
- `header.jpg` (or `.png`, `.webp`) is the update window banner. Without one, the note's first image is used; with neither, the build fails.

## Images

Optimize images with ffmpeg before committing: width up to 2000 px, same file name and format. Write to a new file and replace the original only if the result is at least 20% smaller, as each lossy pass costs quality.

JPEG:

```bash
ffmpeg -i in.jpg -vf "scale='min(2000,iw)':-1:flags=lanczos" -q:v 4 out.jpg
```

PNG, reduced to 256 colors:

```bash
ffmpeg -i in.png -vf "scale='min(2000,iw)':-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse=dither=none" -compression_level 100 out.png
```

## Format

- First line: `# Azgaar's Fantasy Map Generator v1.155.0: Translations`. The title is a few words naming the headline change.
- Open with what the release is about and why: the request, the problem or the issue that led to it.
- One feature: plain paragraphs. Several: a short section per feature, then lists of small changes and fixes.
- Credit contributors by name, linking their PR or profile.
- Say whether old maps are updated on load, and what may not convert perfectly.
- End with where to ask questions and report bugs: [Discord](https://discord.com/invite/X7E84HU).

## Style

- First person, Azgaar talking to users: "I have reworked the river editor", "Now you can lock a route".
- What users see and can do. Mention code only when it helps to tell the story.
- Honest about limits and trade-offs.
- Plain words. No marketing, no "esteemed cartographers", no emoji bullets.
