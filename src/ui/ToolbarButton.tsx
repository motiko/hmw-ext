import { SparkPen } from './icons';

/**
 * Opens on press rather than on click: Gmail swallows the click on some toolbars (seen
 * in inline replies), so a click handler alone works only on some emails. Keyboard
 * activation still arrives as a click with `detail === 0`.
 */
export function ToolbarButton({ onClick }: { onClick(): void }) {
  return (
    <button
      type="button"
      class="toolbar-btn"
      aria-label="Help me write"
      title="Help me write (Alt+H)"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault(); // keep the caret/selection in the draft
        e.stopPropagation();
        onClick();
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.detail === 0) onClick();
      }}
    >
      <SparkPen />
    </button>
  );
}
