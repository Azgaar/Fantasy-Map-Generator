import { InputGroup } from "@patkepa/kantzen-ui/primitives";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes
} from "react";
import { useId } from "react";
import "./form-field.css";

interface WorkspaceFieldBaseProps {
  description?: string;
  error?: string;
  id?: string;
  label: string;
  required?: boolean;
}

interface WorkspaceTextFieldProps
  extends WorkspaceFieldBaseProps,
    Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "required" | "type"> {}

interface WorkspaceNumberFieldProps
  extends WorkspaceFieldBaseProps,
    Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "required" | "type"> {}

interface WorkspaceSelectOption {
  disabled?: boolean;
  label: string;
  value: string;
}

interface WorkspaceSelectFieldProps
  extends WorkspaceFieldBaseProps,
    Omit<SelectHTMLAttributes<HTMLSelectElement>, "children" | "id" | "required"> {
  options: readonly WorkspaceSelectOption[];
}

interface WorkspaceRangeFieldProps
  extends WorkspaceFieldBaseProps,
    Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "required" | "type" | "value"> {
  formatValue?: (value: number) => string;
  value: number;
}

interface WorkspaceColorFieldProps
  extends WorkspaceFieldBaseProps,
    Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "required" | "type" | "value"> {
  value: string;
}

interface WorkspaceToggleFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  description?: string;
  label: string;
}

interface WorkspaceFieldLayoutProps extends WorkspaceFieldBaseProps {
  children: (accessibility: WorkspaceFieldAccessibility) => ReactNode;
}

interface WorkspaceFieldAccessibility {
  controlId: string;
  describedBy: string | undefined;
  invalid: true | undefined;
}

function WorkspaceFieldLayout({
  children,
  description,
  error,
  id,
  label,
  required
}: WorkspaceFieldLayoutProps): React.JSX.Element {
  const generatedId = useId();
  const controlId = id ?? `fmg-field-${generatedId}`;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`fmg-field${error ? " fmg-field--invalid" : ""}`}>
      <label className="fmg-field__label" htmlFor={controlId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children({ controlId, describedBy, invalid: error ? true : undefined })}
      {description ? (
        <small className="fmg-field__description" id={descriptionId}>
          {description}
        </small>
      ) : null}
      {error ? (
        <small className="fmg-field__error" id={errorId}>
          {error}
        </small>
      ) : null}
    </div>
  );
}

export function WorkspaceTextField({
  description,
  error,
  id,
  label,
  required,
  ...inputProps
}: WorkspaceTextFieldProps): React.JSX.Element {
  return (
    <WorkspaceFieldLayout description={description} error={error} id={id} label={label} required={required}>
      {({ controlId, describedBy, invalid }) => (
        <InputGroup
          {...inputProps}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className="fmg-field__input"
          fill
          id={controlId}
          required={required}
          type="text"
        />
      )}
    </WorkspaceFieldLayout>
  );
}

export function WorkspaceNumberField({
  description,
  error,
  id,
  label,
  required,
  ...inputProps
}: WorkspaceNumberFieldProps): React.JSX.Element {
  return (
    <WorkspaceFieldLayout description={description} error={error} id={id} label={label} required={required}>
      {({ controlId, describedBy, invalid }) => (
        <InputGroup
          {...inputProps}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className="fmg-field__input"
          fill
          id={controlId}
          required={required}
          type="number"
        />
      )}
    </WorkspaceFieldLayout>
  );
}

export function WorkspaceSelectField({
  description,
  error,
  id,
  label,
  options,
  required,
  ...selectProps
}: WorkspaceSelectFieldProps): React.JSX.Element {
  return (
    <WorkspaceFieldLayout description={description} error={error} id={id} label={label} required={required}>
      {({ controlId, describedBy, invalid }) => (
        <select
          {...selectProps}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className="fmg-field__select"
          id={controlId}
          required={required}
        >
          {options.map(option => (
            <option disabled={option.disabled} key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </WorkspaceFieldLayout>
  );
}

export function WorkspaceRangeField({
  description,
  error,
  formatValue = String,
  id,
  label,
  required,
  value,
  ...inputProps
}: WorkspaceRangeFieldProps): React.JSX.Element {
  return (
    <WorkspaceFieldLayout description={description} error={error} id={id} label={label} required={required}>
      {({ controlId, describedBy, invalid }) => (
        <div className="fmg-field__range-row">
          <input
            {...inputProps}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            className="fmg-field__range"
            id={controlId}
            required={required}
            type="range"
            value={value}
          />
          <output className="fmg-field__output" htmlFor={controlId}>
            {formatValue(value)}
          </output>
        </div>
      )}
    </WorkspaceFieldLayout>
  );
}

export function WorkspaceColorField({
  description,
  error,
  id,
  label,
  required,
  value,
  ...inputProps
}: WorkspaceColorFieldProps): React.JSX.Element {
  return (
    <WorkspaceFieldLayout description={description} error={error} id={id} label={label} required={required}>
      {({ controlId, describedBy, invalid }) => (
        <div className="fmg-field__color-row">
          <input
            {...inputProps}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            className="fmg-field__color"
            id={controlId}
            required={required}
            type="color"
            value={value}
          />
          <output className="fmg-field__output" htmlFor={controlId}>
            {value.toUpperCase()}
          </output>
        </div>
      )}
    </WorkspaceFieldLayout>
  );
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
