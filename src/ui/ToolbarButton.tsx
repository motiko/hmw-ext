import { SparkPen } from './icons';

export function ToolbarButton({ onClick }: { onClick(): void }) {
  return (
    <button
      type="button"
      class="toolbar-btn"
      aria-label="Help me write"
      title="Help me write (Alt+H)"
      onMouseDown={(e) => e.preventDefault() /* keep the caret/selection in the draft */}
      onClick={onClick}
    >
      <SparkPen />
    </button>
  );
}
