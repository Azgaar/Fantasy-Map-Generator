import type { LayerId } from "@/components/layers";

/** A form-shaped corner of the app the wheel cannot express as sectors, hosted in the side drawer */
export interface DrawerSpec {
  /** id of the live element to host, e.g. "optionsContent" */
  host: string;
  title: string;
  /** control ids; rows in the host not containing one of these are hidden while the drawer is open */
  only?: string[];
}

export interface WheelNode {
  label: string;
  /** icon-* class from public/icons.css */
  icon: string;
  /** third label line; the renderer fills in "▸" when a node has children and no note of its own */
  note?: string;
  danger?: boolean;
  toggle?: LayerId;
  /** HERE channel: index into the resolved subject stack */
  pick?: number;
  children?: WheelNode[] | (() => WheelNode[]);
  panel?: DrawerSpec;
  run?: () => void;
}

export type NodeKind = "toggle" | "pick" | "panel" | "children" | "run" | "inert";

/**
 * Which branch a click takes. The order is the spec's click order and is load-bearing: a layer
 * toggle must win over everything else so the ring can double as the layer panel's status display.
 */
export function nodeKind(node: WheelNode): NodeKind {
  if (node.toggle) return "toggle";
  if (node.pick !== undefined) return "pick";
  if (node.panel) return "panel";
  if (node.children) return "children";
  if (node.run) return "run";
  return "inert";
}

export function childrenOf(node: WheelNode): WheelNode[] {
  if (!node.children) return [];
  return typeof node.children === "function" ? node.children() : node.children;
}
