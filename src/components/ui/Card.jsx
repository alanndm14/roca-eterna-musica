export function Card({ children, className = "", delay = 0, ...props }) {
  const hasCustomBackground = /\bbg-/.test(className);
  const hasCustomPadding = /(?:^|\s)(p|px|py|pt|pr|pb|pl)-/.test(className);

  return (
    <section
      className={`min-w-0 max-w-full rounded-2xl border border-ink/10 shadow-soft ${hasCustomBackground ? "" : "bg-white"} ${hasCustomPadding ? "" : "p-5"} ${className}`}
      {...props}
    >
      {children}
    </section>
  );
}
