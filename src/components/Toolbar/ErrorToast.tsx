import { useEffect } from "react";

interface ErrorToastProps {
  message: string;
  onClose: () => void;
}

export function ErrorToast({ message, onClose }: ErrorToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      onClose();
    }, 8_000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [onClose]);

  return (
    <div
      role="alert"
      className="fixed right-4 top-4 z-50 max-w-sm rounded-md border border-red-200 bg-red-50 p-3 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-red-800">Model fit failed</p>
          <p className="mt-1 text-sm text-red-700">{message}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-1 text-red-700 hover:bg-red-100"
          aria-label="Dismiss error"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
