import { db } from "../db";
import { and, eq } from "drizzle-orm";
import { trainingPermissions } from "@shared/schema";
import {
  ACTIONS, AREAS, ALL_PERMISSIONS, DEFAULTS, MATRIX_ROLES, permKey, permissionsForRole, permissionsForRoles,
  type Action, type Overrides,
} from "@shared/trainingPermissions";

// Who may do what in training. The definition and the defaults are in shared/trainingPermissions.ts; this reads an administrator's changes
// from the database (cached for a short while, and cleared whenever they are saved) and answers the one question the routes ask.

export class TrainingPermissionError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

let cache: { at: number; overrides: Overrides } | null = null;
const TTL_MS = 30_000;
export const clearTrainingPermissionCache = () => { cache = null; };

export async function loadOverrides(): Promise<Overrides> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.overrides;
  const rows = await db.select().from(trainingPermissions);
  const overrides: Overrides = {};
  for (const r of rows) (overrides[r.role] ??= {})[permKey(r.area, r.action as Action)] = r.allowed;
  cache = { at: Date.now(), overrides };
  return overrides;
}

/** May a person holding these roles do this? Holding it through any one of their roles is enough. */
export async function canTraining(roles: string[], area: string, action: Action): Promise<boolean> {
  return permissionsForRoles(roles, await loadOverrides()).has(permKey(area, action));
}

/** Everything a person holds, for the menu and the router. */
export async function trainingPermissionsOf(roles: string[]): Promise<string[]> {
  return Array.from(permissionsForRoles(roles, await loadOverrides()));
}

/** The whole table for the administrator's screen: what each user type holds now, what it holds by default, and which cells were changed. */
export async function getMatrix() {
  const overrides = await loadOverrides();
  const effective: Record<string, string[]> = {};
  for (const r of MATRIX_ROLES) effective[r.key] = Array.from(permissionsForRole(r.key, overrides));
  return { areas: AREAS, roles: MATRIX_ROLES, defaults: DEFAULTS, overrides, effective };
}

export interface PermissionChange { role: string; area: string; action: string; allowed: boolean }

export async function saveChanges(actorId: string, changes: unknown) {
  if (!Array.isArray(changes) || changes.length === 0) throw new TrainingPermissionError(400, "There is nothing to change");
  if (changes.length > 400) throw new TrainingPermissionError(400, "Change up to 400 settings at a time");
  const valid = new Set(ALL_PERMISSIONS);
  const roles = new Map(MATRIX_ROLES.map(r => [r.key, r]));
  const clean: PermissionChange[] = [];
  for (const c of changes as PermissionChange[]) {
    const role = roles.get(String(c?.role));
    if (!role) throw new TrainingPermissionError(400, "That user type is not one of the columns in the matrix");
    if (role.locked) throw new TrainingPermissionError(400, `${role.label} always has every permission and cannot be changed`);
    if (!ACTIONS.includes(c.action as Action) || !valid.has(permKey(String(c.area), c.action as Action))) throw new TrainingPermissionError(400, "That permission does not exist");
    if (typeof c.allowed !== "boolean") throw new TrainingPermissionError(400, "Say whether the permission is allowed");
    clean.push({ role: role.key, area: String(c.area), action: String(c.action), allowed: c.allowed });
  }
  let stored = 0, restored = 0;
  for (const c of clean) {
    const key = permKey(c.area, c.action as Action);
    const byDefault = (DEFAULTS[c.role] ?? []).includes(key);
    if (c.allowed === byDefault) {
      // back to what it was by default, so the stored change is simply removed
      await db.delete(trainingPermissions).where(and(eq(trainingPermissions.role, c.role), eq(trainingPermissions.area, c.area), eq(trainingPermissions.action, c.action)));
      restored++;
    } else {
      await db.insert(trainingPermissions).values({ role: c.role, area: c.area, action: c.action, allowed: c.allowed, updatedBy: actorId })
        .onConflictDoUpdate({ target: [trainingPermissions.role, trainingPermissions.area, trainingPermissions.action], set: { allowed: c.allowed, updatedBy: actorId, updatedAt: new Date() } });
      stored++;
    }
  }
  clearTrainingPermissionCache();
  return { changed: clean.length, stored, restoredToDefault: restored };
}

/** Puts one user type back to the defaults. */
export async function resetRole(role: unknown) {
  const r = MATRIX_ROLES.find(x => x.key === role);
  if (!r) throw new TrainingPermissionError(400, "That user type is not one of the columns in the matrix");
  if (r.locked) throw new TrainingPermissionError(400, `${r.label} always has every permission and cannot be changed`);
  const rows = await db.delete(trainingPermissions).where(eq(trainingPermissions.role, r.key)).returning({ id: trainingPermissions.id });
  clearTrainingPermissionCache();
  return { removed: rows.length };
}
