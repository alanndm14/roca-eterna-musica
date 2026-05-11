export function Field({ label, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-ink/55">{label}</span>
      {children}
    </label>
  );
}

export function Input(props) {
  return (
    <input
      className="h-11 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm outline-none transition placeholder:text-ink/35 focus:border-brass focus:ring-4 focus:ring-brass/15"
      {...props}
    />
  );
}

export function Select({ children, ...props }) {
  return (
    <select
      className="h-11 w-full rounded-xl border border-ink/10 bg-white px-3 text-sm outline-none transition focus:border-brass focus:ring-4 focus:ring-brass/15"
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea(props) {
  return (
    <textarea
      className="min-h-28 w-full rounded-xl border border-ink/10 bg-white px-3 py-3 text-sm outline-none transition placeholder:text-ink/35 focus:border-brass focus:ring-4 focus:ring-brass/15"
      {...props}
    />
  );
}
