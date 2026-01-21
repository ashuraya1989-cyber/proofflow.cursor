import React from "react";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={["pf-input", props.className ?? ""].join(" ").trim()} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={["pf-input", props.className ?? ""].join(" ").trim()} />;
}

