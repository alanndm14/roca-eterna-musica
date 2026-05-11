import { Loader2 } from "lucide-react";

const variants = {
  primary: "bg-ink text-white hover:bg-charcoal shadow-soft",
  secondary: "bg-white text-ink border border-ink/10 hover:border-ink/25",
  subtle: "bg-ink/5 text-ink hover:bg-ink/10",
  danger: "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100",
  light: "bg-white text-ink hover:bg-linen",
  darkSubtle: "border border-white/10 bg-white/8 text-white hover:bg-white/14"
};

export function Button({
  children,
  variant = "primary",
  className = "",
  isLoading = false,
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}
