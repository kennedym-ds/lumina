import { useState, type ReactNode } from "react";

/** Shared className for buttons rendered as items inside a ToolbarMenu. */
export const MENU_ITEM_CLASS =
  "block w-full rounded px-2 py-1.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

interface ToolbarMenuProps {
  label: string;
  children: ReactNode;
}

/** A compact dropdown that groups related toolbar actions into one trigger. */
export function ToolbarMenu({ label, children }: ToolbarMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        {label}
        <span aria-hidden="true" className="text-xs text-slate-400">
          ▾
        </span>
      </button>

      {isOpen ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div
            className="absolute right-0 z-20 mt-1 flex min-w-[160px] flex-col gap-0.5 rounded-md border border-slate-200 bg-white p-1 shadow-lg"
            onClick={() => setIsOpen(false)}
          >
            {children}
          </div>
        </>
      ) : null}
    </div>
  );
}
