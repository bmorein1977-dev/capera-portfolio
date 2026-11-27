// Which AI features a deployment allows. Every AI feature sends data to an outside provider, so each one can be switched off on its own.
//
//   AI_FEATURES=off                              no AI feature runs, whatever keys are configured
//   AI_FEATURES=reports,authoring                only the features listed run
//   (not set)                                    features run where their provider key is configured
//   AI_REPORTS=off                               older setting, still honoured for the report summaries
export const AI_FEATURE_LIST = {
  evidence: "AI review of an evidence item",
  standard_review: "AI review of a competence standard",
  authoring: "AI drafting of questions and scenarios",
  reports: "AI wording for report summaries",
  translation: "AI translation",
  theming: "AI colour theme",
} as const;
export type AiFeature = keyof typeof AI_FEATURE_LIST;

export function aiEnabled(feature: AiFeature, env: NodeJS.ProcessEnv = process.env): boolean {
  if (feature === "reports" && env.AI_REPORTS === "off") return false;
  const setting = (env.AI_FEATURES ?? "").trim().toLowerCase();
  if (!setting || setting === "all" || setting === "on") return true;
  if (setting === "off" || setting === "none") return false;
  return setting.split(/[\s,]+/).includes(feature);
}

/** route guard: answers plainly when a feature is switched off, so a button never fails with an unexplained error */
export function requireAi(feature: AiFeature) {
  return (_req: any, res: any, next: any) => {
    if (aiEnabled(feature)) return next();
    res.status(403).json({ error: `${AI_FEATURE_LIST[feature]} is switched off for this system`, code: "AI_OFF" });
  };
}
