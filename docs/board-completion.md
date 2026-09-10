# Board completion tracking

The [FMG dev board](https://github.com/users/Azgaar/projects/3) derives completion from the issue or pull request. Status changes on the board do not replace resolving the underlying request.

| GitHub state | Board status |
|---|---|
| Issue closed as completed | Done |
| Issue closed as not planned or duplicate | Archive |
| Pull request merged | Done |
| Pull request closed without merging | Archive |
| Open issue or PR incorrectly marked Done, including reopened work | Backlog, ready for re-triage |
| Open work with any other status | Preserve the maintainer's choice |

Done means the issue was accepted as complete or the PR was merged. It does **not** assert that a release has been deployed. Check the PR's target branch and record a release/version when confirming availability to users. A superseded PR belongs in Archive even when its replacement has shipped; link the replacement in its resolution record.

Archive is a Status value, distinct from Projects' archive mechanism. Open proposals may also be deliberately parked there. Actually archived project items keep their status unchanged. A closed issue with an unknown closure reason is reported for review instead of being guessed complete.

## Completing a request

1. Link the implementation to its issue. Use `Fixes #123` when the issue is fully addressed, or `Refs #123` for partial work. Include the source discussion if the issue came from an idea.
2. Check the request's acceptance criteria against the implementation. Update old checklists; create linked follow-up issues for any remaining asks. Do not close a broad request just because a similarly titled PR merged.
3. Record the implementing PR/commit and the release/version if verified. When resolving a source discussion, link the canonical issue or implementation too. The resolution must be understandable without private chat history.
4. Close the issue as completed, or as not planned with an explanation for a declined/superseded request. The reconciler updates the board. Reopening a completed issue returns a stale Done card to Backlog; assign its next working status after re-triage.

When merging through a release branch, confirm that the original issue was resolved after integration; do not assume closing keywords ran when the feature PR merged. Review shipped requests and originating discussions as part of each release.

## Automation

`scripts/board-reconcile.mjs` reads all project pages and repairs status from GitHub state, including populated Status fields. Theme, Priority and Size retain their separate fill-only policy. The reconciler never closes issues or discussions itself, and it does not infer completion from titles, checkboxes or source-code similarity.

Issue closure/reopening and PR closure/reopening trigger reconciliation. PR events use `pull_request_target` strictly for metadata: checkout always selects the default branch and no PR code is executed. The scheduled sweep repairs missed events and any later changes from native project workflows; GitHub schedules may be delayed.

In the project's Workflows UI, prefer **issue completed → Done**, **issue not planned → Archive**, **PR merged → Done**, and **PR closed unmerged → Archive**, where the available filters support those distinctions. Disable any generic closed → Done rule that conflicts. Keep any reverse **Status Done → close issue** workflow disabled: a board move is not acceptance evidence. These UI settings are separate from the repository workflow and must be verified in GitHub; the API audit cannot confirm them.

Manual workflow dispatch defaults to a dry run. It reads current metadata and reports the plan without changing fields, labels, or filing token-failure issues. Execution failures make the run fail; unknown closure reasons appear in the summary and require a maintainer decision.
