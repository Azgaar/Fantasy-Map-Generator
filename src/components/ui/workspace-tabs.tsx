import { Tabs } from "@patkepa/kantzen-ui";
import type { ReactNode } from "react";
import "./workspace-tabs.css";

export interface WorkspaceTab<TId extends string = string> {
  content: ReactNode;
  disabled?: boolean;
  id: TId;
  label: string;
}

interface WorkspaceTabsProps<TId extends string> {
  ariaLabel: string;
  onChange: (id: TId) => void;
  tabs: readonly WorkspaceTab<TId>[];
  value: TId;
}

export function WorkspaceTabs<TId extends string>({
  ariaLabel,
  onChange,
  tabs,
  value
}: WorkspaceTabsProps<TId>): React.JSX.Element {
  const activeTab = tabs.find(tab => tab.id === value);
  const items = tabs.map(({ disabled, id, label }) => ({ disabled, id, label }));

  return (
    <div className="fmg-workspace-tabs">
      <Tabs
        ariaLabel={ariaLabel}
        className="fmg-workspace-tabs__list"
        items={items}
        onChange={onChange}
        value={value}
      />
      <section aria-label={activeTab?.label ?? value} className="fmg-workspace-tabs__panel" role="tabpanel">
        {activeTab?.content}
      </section>
    </div>
  );
}
