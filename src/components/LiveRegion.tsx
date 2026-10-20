/** Visually hidden polite live region for loading / result-count announcements. Keep it mounted. */
export function LiveRegion({ message }: { message: string }) {
  return (
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </p>
  );
}
