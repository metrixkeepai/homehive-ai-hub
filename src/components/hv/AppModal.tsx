import type { FormEvent, ReactNode } from "react";
import { X } from "lucide-react";

/** Centred in-app modal (same look as New workspace). Prefer this over window.prompt / confirm. */
export function AppModal({
  title,
  description,
  children,
  onClose,
  wide,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/60 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-modal-title"
        className={`animate-rise max-h-[min(90vh,40rem)] w-full space-y-3 overflow-y-auto rounded-3xl bg-card p-6 shadow-glow ${wide ? "max-w-lg" : "max-w-sm"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id="app-modal-title" className="font-display text-2xl text-foreground">
              {title}
            </h3>
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function AppModalInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  maxLength = 200,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  maxLength?: number;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      maxLength={maxLength}
      className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
    />
  );
}

export function AppModalPrimaryButton({
  children,
  disabled,
  type = "submit",
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-full bg-aurora py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function AppModalForm({
  onSubmit,
  children,
}: {
  onSubmit: (e: FormEvent) => void | Promise<void>;
  children: ReactNode;
}) {
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit(e);
      }}
    >
      {children}
    </form>
  );
}
