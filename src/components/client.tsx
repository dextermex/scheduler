"use client";

import { useRef } from "react";

/** A <select> that submits its parent form as soon as a value is picked. */
export function AutoSubmitSelect({
  name,
  placeholder,
  options,
  className,
}: {
  name: string;
  placeholder: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const ref = useRef<HTMLSelectElement>(null);
  return (
    <select
      ref={ref}
      name={name}
      defaultValue=""
      className={className}
      onChange={() => {
        if (ref.current?.value) ref.current.form?.requestSubmit();
      }}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Submit button that asks for confirmation first. */
export function ConfirmButton({
  children,
  message,
  className,
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

export function PrintButton() {
  return (
    <button type="button" className="btn" onClick={() => window.print()}>
      Print / Save as PDF
    </button>
  );
}
