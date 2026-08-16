import { Icon, type IconName } from "@patkepa/kantzen-ui/icons";
import type { ReactNode } from "react";
import "./feedback.css";

export type WorkspaceNoticeTone = "danger" | "info" | "success" | "warning";

interface WorkspaceNoticeProps {
  children?: ReactNode;
  title: string;
  tone?: WorkspaceNoticeTone;
}

const NOTICE_ICONS: Record<WorkspaceNoticeTone, IconName> = {
  danger: "error",
  info: "info-sign",
  success: "tick-circle",
  warning: "warning-sign"
};

export function WorkspaceNotice({
  children,
  title,
  tone = "info"
}: WorkspaceNoticeProps): React.JSX.Element {
  return (
    <div className={`fmg-notice fmg-notice--${tone}`} role={tone === "danger" ? "alert" : "status"}>
      <Icon icon={NOTICE_ICONS[tone]} size={16} />
      <div>
        <strong>{title}</strong>
        {children ? <div className="fmg-notice__content">{children}</div> : null}
      </div>
    </div>
  );
}
