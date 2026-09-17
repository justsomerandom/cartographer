"use client";

export function RemoveProjectButton() {
  return (
    <button
      type="submit"
      onClick={(event) => {
        if (!window.confirm("Remove this saved project? The repository files will not be changed.")) {
          event.preventDefault();
        }
      }}
      className="min-h-9 rounded border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
    >
      Remove saved project
    </button>
  );
}
