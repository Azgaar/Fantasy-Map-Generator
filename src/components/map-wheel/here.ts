// The HERE channel: the active subject's actions, plus a way back to everything else the click
// could have been about.
import type { WheelContext } from "./context";
import { ITEM_CAPS } from "./geometry";
import type { WheelNode } from "./types";

// one root slot is always the "What's here" sector, so the actions get the rest
const ACTION_SLOTS = ITEM_CAPS[0] - 1;

export function hereRoot(ctx: WheelContext, subject: number): WheelNode[] {
  const active = ctx.subjects[subject];
  const actions = active?.actions ?? [];

  const toNode = (action: (typeof actions)[number]): WheelNode => ({
    label: action.label,
    icon: action.icon,
    danger: /remove|delete/i.test(action.label) || undefined,
    run: action.run
  });

  // overflow folds into More… rather than squeezing the root past what its arc can hold
  const shown =
    actions.length > ACTION_SLOTS
      ? [
          ...actions.slice(0, ACTION_SLOTS - 1).map(toNode),
          { label: "More…", icon: "icon-asterisk", children: actions.slice(ACTION_SLOTS - 1).map(toNode) }
        ]
      : actions.map(toNode);

  return [
    ...shown,
    {
      label: "What's here",
      icon: "icon-target",
      note: `${ctx.subjects.length} here`,
      children: ctx.subjects.map((candidate, index) => ({
        label: candidate.name,
        icon: candidate.icon,
        note: candidate.kind,
        pick: index
      }))
    }
  ];
}
