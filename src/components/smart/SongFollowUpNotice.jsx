import { AlertCircle } from "lucide-react";
import { formatScheduleDateWithService } from "../../services/dateUtils";

const issueLabels = {
  regular: "Funcionó regular",
  "no-funciono": "No funcionó",
  dificil: "Dificultad alta",
  poco: "Poca respuesta congregacional",
  alta: "Tonalidad alta",
  baja: "Tonalidad baja"
};

export function SongFollowUpNotice({ issues = [] }) {
  if (!issues.length) return null;
  const latest = issues[0];
  const followUp = latest.followUp || {};
  const labels = [
    issueLabels[followUp.result],
    issueLabels[followUp.difficulty],
    issueLabels[followUp.congregationResponse],
    issueLabels[followUp.keyComfort]
  ].filter(Boolean);
  return (
    <div className="mt-3 rounded-2xl border border-amber-300/80 bg-amber-50 p-3 text-amber-950 dark:border-amber-400/45 dark:bg-amber-950/65 dark:text-amber-100">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide">Pendiente del último uso</p>
          <p className="mt-1 text-xs font-semibold opacity-80">{formatScheduleDateWithService(latest.schedule)}</p>
          {labels.length ? <p className="mt-1 text-sm font-bold">{labels.join(" · ")}</p> : null}
          {followUp.notes || followUp.resourceIssues ? <p className="mt-1 text-sm leading-5">{followUp.notes || followUp.resourceIssues}</p> : null}
        </div>
      </div>
    </div>
  );
}
