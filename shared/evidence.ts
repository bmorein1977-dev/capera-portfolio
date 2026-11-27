// Evidence of competence: the rules the screens and the server share.

export const EVIDENCE_TYPES = ["Document", "Photo", "Video", "Audio", "Observation record", "Certificate"] as const;
export const ASSESSOR_UPLOAD = "assessor_upload";
export const EVIDENCE_TITLE_MAX = 200;
export const EVIDENCE_DESCRIPTION_MAX = 5000;
export const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;
/** what the file picker offers; the server checks type and content itself */
export const EVIDENCE_ACCEPT = ".pdf,.png,.jpg,.jpeg,.gif,.webp,.docx,.xlsx,.pptx,.doc,.xls,.ppt,.txt,.csv,.mp4,.mov,.mp3,.m4a,.wav";

/** The stored kind of evidence, from what a screen sent. Anything unrecognised is left unrecorded rather than stored as typed. */
export function evidenceTypeFrom(value: unknown): string | null {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === ASSESSOR_UPLOAD) return ASSESSOR_UPLOAD;
  return EVIDENCE_TYPES.find(t => t.toLowerCase() === v) ?? null;
}
export const evidenceTypeLabel = (t: string | null | undefined) => (t === ASSESSOR_UPLOAD ? "Added by the assessor" : t ?? null);
