import { Link, useLocation } from "wouter";
import { ChevronRight } from "lucide-react";
import { useAuth, useLicence, useTrainingPermissions } from "@/hooks/useAuth";
import { findNavContext, hubUrl, visibleSections } from "@/lib/navigation";

// Where you are, in the top bar: Section > Page, with the section linking back to its tile page. Shown for pages that are in the menu;
// other pages (an individual review, say) simply show nothing rather than guess.
export default function AppBreadcrumb() {
  const [location] = useLocation();
  const { user } = useAuth();
  const licence = useLicence();
  const trainingPermissions = useTrainingPermissions();
  const { section: found, item } = findNavContext(location);
  if (!found) return null;
  // named for this person (a manager's team area is "My Team")
  const section = { ...found, title: visibleSections(user ? (user.effectiveRoles ?? [user.role]) : [], licence, trainingPermissions).find(s => s.id === found.id)?.title ?? found.title };
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm" data-testid="breadcrumb">
      {item ? (
        <>
          <Link href={hubUrl(section.id)} className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline" data-testid="breadcrumb-section">{section.title}</Link>
          <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground/60 sm:block" />
          <span className="truncate font-medium" data-testid="breadcrumb-page">{item.title}</span>
        </>
      ) : <span className="truncate font-medium" data-testid="breadcrumb-page">{section.title}</span>}
    </nav>
  );
}
