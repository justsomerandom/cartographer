"use client";

import { Icon } from "./ui";

export function RemoveProjectButton() {
  return (
    <button
      type="submit"
      onClick={(event) => {
        if (!window.confirm("Remove this saved project? The repository files will not be changed.")) {
          event.preventDefault();
        }
      }}
      className="inline-flex min-h-8 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
    >
      <Icon name="trash" className="size-4" />
      Remove
    </button>
  );
}
