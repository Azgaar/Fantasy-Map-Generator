# Update notes

A note announces a release worth talking about. It is the same text as the Patreon post, and the newest note is shown in the in-app update window.

## Files

- One folder per release, one note in it: `v1.155.0/v1.155.0 - Translations.md`. The part after the dash is the title shown in the update window.
- Screenshots go in `screenshots/` and are linked relatively: `![What the image shows](screenshots/hex-board.jpg)`.
- `header.jpg` (or `.png`, `.webp`) is the update window banner. Without one, the note's first image is used; with neither, the build fails.

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
