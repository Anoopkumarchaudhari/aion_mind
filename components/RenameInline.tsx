"use client";

import { useEffect, useRef, useState } from "react";

type RenameInlineProps = {
  title: string;
  onCancel: () => void;
  onSave: (title: string) => void;
};

export function RenameInline({ title, onCancel, onSave }: RenameInlineProps) {
  const [value, setValue] = useState(title);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function save() {
    const trimmed = value.trim();
    onSave(trimmed || title);
  }

  return (
    <input
      ref={inputRef}
      className="rename-input"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          save();
        }

        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
      aria-label="Rename chat"
    />
  );
}
