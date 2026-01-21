import React from "react";

export type ButtonVariant = "default" | "primary" | "danger" | "ghost";

export function Button({
  children,
  variant = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const cls = ["pf-btn"];
  if (variant === "primary") cls.push("pf-btn--primary");
  if (variant === "danger") cls.push("pf-btn--danger");
  if (variant === "ghost") cls.push("pf-btn--ghost");
  return (
    <button {...props} className={[...cls, props.className ?? ""].join(" ").trim()}>
      {children}
    </button>
  );
}

