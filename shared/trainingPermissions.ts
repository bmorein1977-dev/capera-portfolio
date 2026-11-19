// Who may do what in training: one table of training areas x actions x user types, shared by the server (which enforces it), the router and
// the menu (which show only what a person may open) and the administrator's screen (which changes it). Defaults are in this file; an
// administrator's changes are stored as overrides and win over the defaults. A super administrator always has everything and cannot be
// changed, so nobody can lock themselves out.
//
// "view" means opening the management screen. Reading the lists that booking and request flows need (courses, sessions, providers, venues)
// stays open to every signed-in person, because ordinary people need them to book and to ask for training. A manager can always approve a
// request from their own direct reports; the approve permission is for approving anyone's.

export const ACTIONS = ["view", "create", "edit", "delete", "approve"] as const;
export type Action = typeof ACTIONS[number];
export const ACTION_LABEL: Record<Action, string> = { view: "View", create: "Create", edit: "Edit", delete: "Delete", approve: "Approve" };

export interface TrainingArea {
  key: string;
  label: string;
  group: "Training and records" | "External training" | "Requests and bookings" | "Reports and imports";
  description: string;
  /** which actions apply to this area, with what each one means here */
  actions: Partial<Record<Action, string>>;
}

export const AREAS: TrainingArea[] = [
  { key: "catalogue", group: "Training and records", label: "Training catalogue", description: "The courses, categories and levels people can be trained on.",
    actions: { view: "Open Training Manager", create: "Add trainings, categories and levels", edit: "Change them", delete: "Remove them" } },
  { key: "role_requirements", group: "Training and records", label: "Role training requirements", description: "Which training each job role needs, and the groups where any one course will do.",
    actions: { create: "Add a requirement or group", edit: "Change one", delete: "Remove one" } },
  { key: "records", group: "Training and records", label: "Training records and certificates", description: "Enrolling people, recording completions and issuing certificates.",
    actions: { create: "Enrol people and record completions", edit: "Correct a record and issue certificates", delete: "Remove a record" } },
  { key: "content", group: "Training and records", label: "E-learning content", description: "Videos, documents and SCORM packages attached to a course.",
    actions: { view: "Open Learning Content", create: "Upload content and SCORM packages", edit: "Change content details", delete: "Remove content" } },
  { key: "providers", group: "External training", label: "Training providers", description: "The organisations that deliver external courses.",
    actions: { view: "Open Training Providers", create: "Add a provider", edit: "Change a provider", delete: "Remove a provider" } },
  { key: "venues", group: "External training", label: "Training venues", description: "Where external courses are held.",
    actions: { view: "Open Training Venues", create: "Add a venue", edit: "Change a venue", delete: "Remove a venue" } },
  { key: "courses", group: "External training", label: "External course catalogue", description: "External courses, their prices and providers.",
    actions: { view: "Open the course catalogue screen", create: "Add a course", edit: "Change a course", delete: "Remove a course" } },
  { key: "sessions", group: "External training", label: "Training sessions", description: "Scheduled dates, capacity and attendees.",
    actions: { view: "Open Training Sessions", create: "Schedule a session", edit: "Change a session", delete: "Cancel a session" } },
  { key: "policy", group: "External training", label: "Training policy matrix", description: "Which training needs approval, and from whom.",
    actions: { view: "Open the policy matrix", create: "Add a rule", edit: "Change a rule", delete: "Remove a rule" } },
  { key: "bookings", group: "Requests and bookings", label: "Course bookings", description: "Everyone's bookings, with their cost.",
    actions: { view: "Open Course Bookings and see costs", edit: "Confirm, change or cancel anyone's booking", delete: "Delete any booking" } },
  { key: "requests", group: "Requests and bookings", label: "Training requests", description: "Requests for training that need approving and then arranging.",
    actions: { view: "See every request waiting to be arranged", edit: "Arrange (fulfil) an approved request", approve: "Approve or reject anyone's request" } },
  { key: "reports_cost", group: "Reports and imports", label: "Cost and Activity report", description: "What training is costing and who is using it.",
    actions: { view: "Open the report and download it" } },
  { key: "reports_completions", group: "Reports and imports", label: "Training Completions report", description: "Who has completed which training.",
    actions: { view: "Open the report and download it" } },
  { key: "imports", group: "Reports and imports", label: "Imports and bulk assignment", description: "Bringing in training matrices and assigning training in bulk.",
    actions: { view: "Open Training Matrix Import", create: "Run an import or a bulk assignment" } },
];

export const AREA_BY_KEY = new Map(AREAS.map(a => [a.key, a]));
export const permKey = (area: string, action: Action) => `${area}.${action}`;
export const ALL_PERMISSIONS: string[] = AREAS.flatMap(a => (Object.keys(a.actions) as Action[]).map(act => permKey(a.key, act)));

// The user types the matrix has a column for: the five everyday roles and the two training roles an administrator can grant on top.
export const MATRIX_ROLES: Array<{ key: string; label: string; locked?: boolean }> = [
  { key: "super_admin", label: "Super administrator", locked: true },
  { key: "admin", label: "Administrator" },
  { key: "developer", label: "Developer" },
  { key: "training_administrator", label: "Training administrator" },
  { key: "training_approver", label: "Training approver" },
  { key: "manager", label: "Manager" },
  { key: "internal_verifier", label: "Internal verifier" },
  { key: "assessor", label: "Assessor" },
  { key: "candidate", label: "Candidate" },
  { key: "trainee", label: "Trainee" },
];

const everything = ALL_PERMISSIONS;
const only = (...keys: string[]) => keys;
const area = (key: string, ...actions: Action[]) => actions.map(a => permKey(key, a));

// What each user type can do before anyone changes anything. These match what the screens already offered: the administrator side is
// everything; the training administrator runs external training, bookings and the arranging of requests; approvers approve; some roles
// can read the completions report.
export const DEFAULTS: Record<string, string[]> = {
  super_admin: everything,
  admin: everything,
  developer: everything,
  training_administrator: [
    ...area("providers", "view", "create", "edit", "delete"), ...area("venues", "view", "create", "edit", "delete"), ...area("courses", "view", "create", "edit", "delete"),
    ...area("sessions", "view", "create", "edit", "delete"), ...area("policy", "view", "create", "edit", "delete"),
    ...area("bookings", "view", "edit", "delete"), ...area("requests", "view", "edit"), ...area("reports_cost", "view"),
  ],
  training_approver: only(permKey("requests", "approve")),
  manager: only(permKey("reports_completions", "view")),
  internal_verifier: only(permKey("reports_completions", "view")),
  assessor: only(permKey("reports_completions", "view")),
  candidate: [],
  trainee: [],
};

export type Overrides = Record<string, Record<string, boolean>>; // role -> permission -> allowed

const norm = (r: string) => r.toLowerCase().trim().replace(/[\s-]+/g, "_");

/** The permissions one user type holds: its defaults with the administrator's changes applied. */
export function permissionsForRole(role: string, overrides: Overrides = {}): Set<string> {
  const r = norm(role);
  if (r === "super_admin") return new Set(everything);
  const set = new Set(DEFAULTS[r] ?? []);
  for (const [perm, allowed] of Object.entries(overrides[r] ?? {})) { if (allowed) set.add(perm); else set.delete(perm); }
  return set;
}

/** The permissions a person holds across all their roles (their own role plus any granted ones). Holding it through any role is enough. */
export function permissionsForRoles(roles: string[], overrides: Overrides = {}): Set<string> {
  const out = new Set<string>();
  for (const role of roles) permissionsForRole(role, overrides).forEach(p => out.add(p));
  return out;
}

export const canRoles = (roles: string[], area: string, action: Action, overrides: Overrides = {}) => permissionsForRoles(roles, overrides).has(permKey(area, action));
