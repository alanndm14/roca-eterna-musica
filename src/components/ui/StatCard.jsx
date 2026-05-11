import { Card } from "./Card";

export function StatCard({ icon: Icon, label, value, detail, delay = 0 }) {
  return (
    <Card delay={delay} className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">{label}</p>
          <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
          {detail ? <p className="mt-1 text-sm text-ink/55">{detail}</p> : null}
        </div>
        {Icon ? (
          <div className="rounded-xl bg-brass/12 p-2 text-brass">
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
