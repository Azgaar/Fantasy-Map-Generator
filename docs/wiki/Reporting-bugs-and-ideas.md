# Reporting bugs and suggesting ideas

Use [GitHub Issues](https://github.com/Azgaar/Fantasy-Map-Generator/issues) for bugs, [Ideas discussions](https://github.com/Azgaar/Fantasy-Map-Generator/discussions/categories/ideas) for feature suggestions, and [Q&A discussions](https://github.com/Azgaar/Fantasy-Map-Generator/discussions/categories/q-a) for questions about using the generator. Development is tracked on the [FMG dev board](https://github.com/users/Azgaar/projects/3).

You can also get help in the [FMG Discord server](https://discord.com/invite/X7E84HU): use `#fmg-bugs` for problems and `#fmg-suggestions` for ideas. If the FMG Assistant's reporting commands are available, `/bug` and `/idea` open a report form; a moderator reviews it before anything is submitted to GitHub. See [Reporting through Discord](#reporting-through-discord) below.

## Report a bug

Search [existing issues](https://github.com/Azgaar/Fantasy-Map-Generator/issues?q=is%3Aissue) first, including closed ones. If the same problem is already open, add your reproduction details there. If a closed problem happens again on a newer version, link the old issue and explain what still fails.

Open the [bug report form](https://github.com/Azgaar/Fantasy-Map-Generator/issues/new?template=bug_report.yml). Include:

- A specific title describing what fails.
- The steps you took, what you expected, and what actually happened. Say whether it happens every time or only sometimes.
- The FMG version shown in the page title/loading screen, your browser and version, your operating system, and whether you use the website or an installed app.
- The affected `.map` file in a ZIP archive when the problem depends on a saved map; a screenshot and the exact error text also help.
- The closest Theme, or **Not sure** if none fits.

If practical, try a private/incognito window or another browser and include the result. Keep a copy of your map before troubleshooting; you do not need to erase browser storage or reproduce the problem in every browser to report it.

Example wording (illustrative, not a claim about a current bug):

```text
Title: A burg name reverts after saving and loading the map
Version/system: [FMG version], [browser and version], [OS], website
Steps:
1. Load the attached map.
2. Rename the burg Northport to Southport in its editor.
3. Save to machine, reload the page, and load that saved file.
Expected: The burg is still called Southport.
Actual: It is called Northport again. This happens on each attempt.
Theme: Burgs & Population
Attachments: map.zip and a screenshot of the name before saving.
```

## Suggest an idea

Search [Ideas discussions](https://github.com/Azgaar/Fantasy-Map-Generator/discussions/categories/ideas), [issues](https://github.com/Azgaar/Fantasy-Map-Generator/issues), and the [dev board](https://github.com/users/Azgaar/projects/3) before opening a new suggestion. Upvote an existing idea and add your use case if it covers the same need.

Use the [new idea form](https://github.com/Azgaar/Fantasy-Map-Generator/discussions/new?category=ideas). Describe one proposal, the problem it solves, an example of how you would use it, and any current workaround. Choose the closest Theme or **Not sure**. You do not need to estimate its implementation size or set its priority.

Example wording:

```text
The idea: Let me group journeys by campaign in the Journeys Overview.
Why: I run two campaigns on one map and want to see only the journeys
for the campaign I am preparing. I currently prefix every journey name.
Example: Select “Northern campaign” to show that group's journeys.
Theme: Routes & Roads
```

Votes help maintainers understand demand; they do not guarantee implementation or a release date. Maintainers decide which ideas become implementation issues. If an idea already links to an issue, follow that issue for development progress instead of submitting a duplicate.

## Reporting through Discord

- Use `/bug` to open a bug-report form or `/idea` to open an idea form, **when those FMG Assistant commands are available**.
- On an existing message, the message menu's **Apps** section may offer **Report this as a bug** or **Report this as an idea**. These open the same forms, prefilled with the message text; check the details before submitting.
- Reports wait for moderator review. A moderator can approve, edit, or reject them. An approved report may create a GitHub issue/discussion or add details to an existing item if it is a duplicate.
- A pending report is not yet a GitHub issue. Use the resulting GitHub link to follow progress. If you are unsure whether a report was submitted, ask a moderator before filing it again.
- If the commands are missing or reporting is unavailable, use the GitHub forms linked above. If you cannot use GitHub, post the same details in `#fmg-bugs` or `#fmg-suggestions` and ask a moderator for help.

`/ask`, mentioning the assistant, using the in-app help assistant, or describing a problem in ordinary chat does **not** by itself submit a GitHub report. An assistant answer is advice, not confirmation that a bug has been filed, a fix has shipped, or a feature has been approved.

## Ask for help

If you are unsure whether something is a bug or an existing feature, ask in [Q&A](https://github.com/Azgaar/Fantasy-Map-Generator/discussions/new?category=q-a), use `/ask` in Discord, or ask the community. Include what you are trying to do and where you got stuck. You can turn a confirmed problem into a bug report afterward.
