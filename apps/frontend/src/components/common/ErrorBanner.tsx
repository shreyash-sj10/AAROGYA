export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-error/50 bg-error/10 px-3 py-2 text-sm text-error">
      {message}
    </div>
  );
}
