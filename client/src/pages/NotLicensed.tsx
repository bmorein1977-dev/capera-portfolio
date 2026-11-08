import { Link } from "wouter";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TIER_LABEL, type Tier } from "@shared/licence";

// Shown instead of a page that belongs to a higher level than this deployment is licensed for (see shared/licence.ts).
export default function NotLicensed({ needed, licensed }: { needed: Tier; licensed: Tier }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center" data-testid="screen-not-licensed">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted"><Lock className="h-6 w-6 text-muted-foreground" aria-hidden /></div>
      <h1 className="text-2xl font-semibold">This is part of Capera {TIER_LABEL[needed]}</h1>
      <p className="mt-2 text-muted-foreground">Your organisation is on Capera {TIER_LABEL[licensed]}, which does not include this area. Ask your administrator if you would like it added.</p>
      <Link href="/"><Button className="mt-6" data-testid="button-not-licensed-home">Back to Home</Button></Link>
    </div>
  );
}
