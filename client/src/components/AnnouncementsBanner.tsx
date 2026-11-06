import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Megaphone } from "lucide-react";

// A strip across the top of every page when there is an important announcement, or one that must be confirmed, that the person has
// not yet dealt with. Ordinary announcements do not nag: they are on the Announcements page and counted in the menu.
export default function AnnouncementsBanner() {
  const { data } = useQuery<{ needsAction: number }>({ queryKey: ["/api/announcements/mine"], refetchInterval: 5 * 60 * 1000, select: d => ({ needsAction: d.needsAction }) });
  if (!data || data.needsAction < 1) return null;
  return (
    <div className="flex items-center gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200" data-testid="banner-announcements">
      <Megaphone className="h-4 w-4 shrink-0" />
      <span className="flex-1">{data.needsAction === 1 ? "You have an important announcement to read." : `You have ${data.needsAction} important announcements to read.`}</span>
      <Link href="/announcements" className="font-medium underline" data-testid="link-banner-announcements">Read it now</Link>
    </div>
  );
}
