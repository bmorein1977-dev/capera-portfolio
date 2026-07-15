type Props = { 
  item: { 
    number: string; 
    text: string; 
    assessorGuidance?: string;
    required?: boolean;
  } 
};

export default function CriteriaCard({ item }: Props) {
  const number = item.number || "";
  const text = item.text;
  
  // Generate guidance number (KG or PG) from criteria number
  let guidanceNumber: string | null = null;
  if (item.assessorGuidance && typeof number === "string") {
    const parts = number.split(" ");
    if (parts.length === 2) {
      const prefix = number.startsWith("K") ? "KG" : number.startsWith("P") ? "PG" : number.startsWith("S") ? "SG" : "G";
      guidanceNumber = `${prefix} ${parts[1]}`;
    }
  }
  
  return (
    <div className="rounded-lg border p-3 bg-card hover-elevate" data-testid={`criteria-card-${number.replace(/\s+/g, '-')}`}>
      <div className="flex items-start gap-2">
        <div className="text-sm font-semibold text-foreground min-w-[60px]">
          {number}
        </div>
        <div className="flex-1">
          <div className="text-sm text-foreground">{text}</div>
          {item.required !== undefined && (
            <span className="text-xs text-muted-foreground ml-2">
              {item.required ? "(Mandatory)" : "(Optional)"}
            </span>
          )}
        </div>
      </div>
      {item.assessorGuidance && (
        <div className="mt-2 pl-[68px] text-sm text-muted-foreground border-l-2 border-primary/20 ml-2 pl-3">
          <span className="font-semibold">{guidanceNumber}</span> – {item.assessorGuidance}
        </div>
      )}
    </div>
  );
}
