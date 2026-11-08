import type { Request, Response, NextFunction } from "express";
import { parseTier, tierForApi, tierIncludes, TIER_LABEL, type Tier } from "@shared/licence";

// Which level (Bronze, Silver or Gold) this deployment is licensed for. Set CAPERA_TIER on the server; Gold when it is not set, so a
// deployment with no setting loses nothing. Which parts of the server belong to which level is in shared/licence.ts.
export const licensedTier = (): Tier => parseTier(process.env.CAPERA_TIER);

// Refuses a request for a part of the server the licence does not include. The pages are hidden as well (see the menu and the page
// guard), but the server is what actually decides, so typing an address or calling the API by hand gets the same answer.
export function licenceGate(req: Request, res: Response, next: NextFunction) {
  const needed = tierForApi(req.originalUrl || req.url);
  const licensed = licensedTier();
  if (tierIncludes(licensed, needed)) return next();
  res.status(403).json({
    error: `This is part of Capera ${TIER_LABEL[needed]}. Your organisation is on Capera ${TIER_LABEL[licensed]}.`,
    code: "not_licensed", tierNeeded: needed, tierLicensed: licensed,
  });
}
