import type { InputHTMLAttributes } from "react";

interface WorkspaceToggleFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  description?: string;
  label: string;
}

export function WorkspaceToggleField({
  description,
  label,
  ...inputProps
}: WorkspaceToggleFieldProps): React.JSX.Element {
  return (
    <label className="fmg-toggle-field">
      <input {...inputProps} role="switch" type="checkbox" />
      <span className="fmg-toggle-field__control" aria-hidden="true">
        <span />
      </span>
      <span className="fmg-toggle-field__copy">
        <strong>{label}</strong>
        {description ? <small>{description}</small> : null}
      </span>
    </label>
  );
}
