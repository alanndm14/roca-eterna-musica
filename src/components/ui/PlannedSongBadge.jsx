import { Music2, Sparkles } from "lucide-react";
import { isPlannedSpecial, plannedSongLabel } from "../../services/plannedSong";

export function PlannedSongBadge({ item, count }) {
  const special = isPlannedSpecial(item);
  const Icon = special ? Sparkles : Music2;
  const label = plannedSongLabel(item);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold sm:px-2 sm:text-xs ${special ? "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200" : "bg-brass/15 text-ink"}`}
      title={count == null ? undefined : `${label}: ${count}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {count == null ? label : <><span className="sr-only">{label}: </span>{count}</>}
    </span>
  );
}
