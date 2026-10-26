export function SparkPen({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M5 19.5 4.5 15l9.6-9.6 4 4L8.5 19z M15.2 4.3l1.4-1.4a1.4 1.4 0 0 1 2 0l2 2a1.4 1.4 0 0 1 0 2l-1.4 1.4z" />
      <path d="M6 2.5l.8 2 2 .8-2 .8L6 8.1l-.8-2-2-.8 2-.8z M19 14.5l.6 1.4 1.4.6-1.4.6L19 18.5l-.6-1.4-1.4-.6 1.4-.6z" />
    </svg>
  );
}

export function Close() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M18.3 5.7a1 1 0 0 0-1.4 0L12 10.6 7.1 5.7a1 1 0 0 0-1.4 1.4l4.9 4.9-4.9 4.9a1 1 0 1 0 1.4 1.4l4.9-4.9 4.9 4.9a1 1 0 0 0 1.4-1.4L13.4 12l4.9-4.9a1 1 0 0 0 0-1.4z" />
    </svg>
  );
}

export function Send() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" />
    </svg>
  );
}
