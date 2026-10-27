import { useState } from 'preact/hooks';
import type { Task } from '@/core/messages';

export const REFINE_TASKS: { task: Task; label: string }[] = [
  { task: 'polish', label: 'Polish' },
  { task: 'formalize', label: 'Formalize' },
  { task: 'elaborate', label: 'Elaborate' },
  { task: 'shorten', label: 'Shorten' },
];

export function RefineMenu({ onPick, disabled }: { onPick(task: Task): void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div class="menu-wrap">
      <button type="button" class="text-btn" aria-haspopup="menu" aria-expanded={open} disabled={disabled} onClick={() => setOpen(!open)}>
        Refine ▾
      </button>
      {open && (
        <div class="menu" role="menu">
          {REFINE_TASKS.map(({ task, label }) => (
            <button
              type="button"
              role="menuitem"
              key={task}
              onClick={() => {
                setOpen(false);
                onPick(task);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
