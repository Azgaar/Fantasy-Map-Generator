# Contributing to Azgaar's Fantasy Map Generator

Thank you for your interest in contributing to Azgaar's Fantasy Map Generator! Whether you're fixing a bug, adding a feature, or improving documentation, your help is appreciated.

To keep the project healthy, maintainable, and manageable for maintainers, all contributions must follow the guidelines below.

The short version: **a PR should do one thing, be manually tested, not break existing maps, and be understood by its author.** How you wrote it – by hand or with an AI agent — is your business.

## 1. Before You Begin

Before starting work on a new feature or making significant architectural changes, please **discuss your idea with the community on [Discord](https://discord.com/channels/515358903299735564/515359096925454350) first**.

Aligning on scope and design beforehand prevents wasted effort on changes that might not fit the project's roadmap or vision.

- **Check what's already in flight.** Search open issues and PRs. Large parts of the codebase are mid-migration, and a change that fights an in-progress migration cannot be merged even if it's correct.
- **Bug fixes need a reproduction.** Link the issue, or describe the seed, settings and steps that trigger the bug.

## 2. AI Usage and Code Quality Policy

We don't care what tools you use to write code, including LLMs, as long as your submission meets these core criteria:

1. You must **manually test** your changes in the browser. Automated and AI-generated tests are supplementary only.
2. Keep pull requests **focused**. Do not combine multiple unrelated features, fix unrelated bugs, or let an AI tool refactor unrelated files. Overly wide PRs will be rejected. 1 PR = 1 Feature/Fix.
3. You must **read and understand your code**. You should be ready to explain and defend your changes during code review.
4. **No AI Slop:** Pull requests containing unreviewed LLM dumps, unnecessary code bloat, or complex unverified logic will be closed without a detailed review.

## 3. Technical Standards

Before opening a Pull Request, ensure your code meets the following technical gates:

- Your code must adhere to our project formatting rules. Refer to [`biome.json`](./biome.json) for guidelines.
- Familiarize yourself with [`docs/architecture`](./docs/architecture) before making structural edits or introducing new patterns.
- Prioritize performance. Code that runs during page load or map creation is a hot path: avoid unnecessary work and verify that changes do not noticeably slow generation.
- All automated tests must pass.
- The linter must pass with zero errors/warnings.
- The production build must complete clean with no errors.
- If your change alters user-visible behaviour, update the changelog in the root.

## 4. Pull Request and Review Process

- **Scope Check:** Ensure your PR addresses a single problem or feature.
- **Maintainer Authority:** Azgaar has the final say on all code merges (Go / No-Go). To preserve maintainer bandwidth, **PRs that do not follow these guidelines may be closed with only a brief explanation.**
- **Commit Squashing:** Note that commits may be squashed into a single clean commit upon merging into the main branch.

## 5. Contributor Recognition and Perks

We value everyone who contributes to making the Fantasy Map Generator better! When your PR is merged, you will receive:

- **Git History Attribution:** Your name/handle will remain permanently in the Git commit history (even if commits are squashed).
- **GitHub Contributors Page:** You will be automatically listed on the repository's official GitHub Contributors tab.
- **Discord Contributor Role:** You get access to an exclusive, private channel on our Discord server. _(Direct message `@azgaar.fmg` on Discord with your merged PR link to claim your role!)_

_Thank you for contributing and helping build the best Map Generator!_
