// What a piece of evidence is, as the person described it: the same wherever it is shown, to the person, their assessor or a verifier.
import { format } from "date-fns";
import { evidenceTypeLabel } from "@shared/evidence";

export interface EvidenceLink { fromCode: string | null; fromName: string; byName: string | null; on: string; afterSignOff: boolean }
export interface EvidenceWords { title?: string | null; evidenceType?: string | null; description?: string | null; fileName: string; hasFile: boolean; linked?: EvidenceLink | null }

// stored times carry no zone and are UTC
const day = (v: string) => format(new Date(`${v.replace(" ", "T")}Z`), "PP");

export function EvidenceDetails({ item, struck }: { item: EvidenceWords; struck?: boolean }) {
  const heading = item.title || item.fileName;
  const kind = evidenceTypeLabel(item.evidenceType);
  const detail = [kind, item.hasFile && item.fileName !== heading ? item.fileName : null, item.hasFile ? null : "written note, no file"].filter(Boolean).join(" · ");
  return (
    <div className="min-w-0 space-y-0.5">
      <div className={`break-words text-sm font-medium ${struck ? "text-muted-foreground line-through" : ""}`}>{heading}</div>
      {detail && <div className="break-words text-xs text-muted-foreground">{detail}</div>}
      {item.linked && (
        <div className="text-xs font-medium text-primary" data-testid="text-evidence-linked">
          Attached from {item.linked.fromCode ?? item.linked.fromName}{item.linked.byName ? ` by ${item.linked.byName}` : ""} on {day(item.linked.on)}
          {item.linked.afterSignOff && <span className="text-amber-700 dark:text-amber-400">, after sign-off</span>}
        </div>
      )}
      {item.description && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground" data-testid="text-evidence-description">{item.description}</p>}
    </div>
  );
}
