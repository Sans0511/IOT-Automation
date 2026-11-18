"use client";

type EditorToolbarProps = {
  isDirty: boolean;
  placementCount: number;
  backgroundItemCount: number;
  connectionCount: number;
  snapToGrid: boolean;
  canCopy: boolean;
  canPaste: boolean;
  linkMode: boolean;
  hasLinkSource: boolean;
  canRotate: boolean;
  canDelete: boolean;
  saving: boolean;
  publishing: boolean;
  error: string | null;
  message: string | null;
  onToggleSnap: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onToggleLinkMode: () => void;
  onCancelFlow: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onRotate: (delta: number) => void;
  onDelete: () => void;
  onReload: () => void;
  onClear: () => void;
  onPublish: () => void;
  onSave: () => void;
};

export default function EditorToolbar({
  isDirty,
  placementCount,
  backgroundItemCount,
  connectionCount,
  snapToGrid,
  canCopy,
  canPaste,
  linkMode,
  hasLinkSource,
  canRotate,
  canDelete,
  saving,
  publishing,
  error,
  message,
  onToggleSnap,
  onCopy,
  onPaste,
  onToggleLinkMode,
  onCancelFlow,
  onZoomIn,
  onZoomOut,
  onFit,
  onRotate,
  onDelete,
  onReload,
  onClear,
  onPublish,
  onSave,
}: EditorToolbarProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              isDirty
                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
            }`}
          >
            {isDirty ? "Unsaved changes" : "Saved"}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {placementCount} device
            {placementCount === 1 ? "" : "s"} ·{" "}
            {backgroundItemCount} background item
            {backgroundItemCount === 1 ? "" : "s"} ·{" "}
            {connectionCount} link
            {connectionCount === 1 ? "" : "s"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onToggleSnap}
            className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
              snapToGrid
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"
            }`}
          >
            Snap: {snapToGrid ? "On" : "Off"}
          </button>
          <button
            type="button"
            onClick={onCopy}
            disabled={!canCopy}
            title="Copy selected device or background item (Ctrl/Cmd+C)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={onPaste}
            disabled={!canPaste}
            title="Paste copied item (Ctrl/Cmd+V)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Paste
          </button>
          <button
            type="button"
            onClick={onToggleLinkMode}
            className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
              linkMode
                ? "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"
            }`}
          >
            {linkMode ? "Drawing flow" : "Draw flow"}
          </button>
          {linkMode && hasLinkSource ? (
            <button
              type="button"
              onClick={onCancelFlow}
              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              Cancel flow
            </button>
          ) : null}
          <button
            type="button"
            onClick={onZoomIn}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Zoom in
          </button>
          <button
            type="button"
            onClick={onZoomOut}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Zoom out
          </button>
          <button
            type="button"
            onClick={onFit}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Fit
          </button>
          <button
            type="button"
            onClick={() => onRotate(-15)}
            disabled={!canRotate}
            title="Rotate selected item 15 degrees counter-clockwise"
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Rotate -15°
          </button>
          <button
            type="button"
            onClick={() => onRotate(15)}
            disabled={!canRotate}
            title="Rotate selected item 15 degrees clockwise"
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Rotate +15°
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={!canDelete}
            title="Delete selected item"
            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            Delete selected
          </button>
          <button
            type="button"
            onClick={onReload}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onPublish}
            disabled={saving || publishing}
            className="rounded-lg border border-emerald-300 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
          >
            {publishing ? "Publishing..." : "Publish"}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !isDirty}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save layout"}
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Drag irrigation presets, farm devices, or scenery from the left panel
        onto the canvas. While dragging, items snap-align to other items with
        pink guides. Select an item to edit its position, label, or
        rotation, or use the toolbar to rotate/delete it. With Draw flow on,
        start and end lines at ports, or branch from an existing flow line.
        Click empty canvas to add bends. Centers and free points cannot be
        flow endpoints. Attached lines merge into one flow and share the
        upstream pump state. Select a line to drag its waypoints. Copy/Paste
        (or Ctrl/Cmd+C and Ctrl/Cmd+V) duplicates the selected palette device
        or background item.
      </p>

      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          {message}
        </p>
      ) : null}
    </section>
  );
}
