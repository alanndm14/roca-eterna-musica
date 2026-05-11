export function EmptyState({ title, text, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink/15 bg-white/70 p-8 text-center">
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      {text ? <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink/60">{text}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
