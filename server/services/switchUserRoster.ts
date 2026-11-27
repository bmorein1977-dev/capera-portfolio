// Which team members the "Switch User" menu offers. The sample data scripts use the same rule, so that what they say is waiting for a person is
// waiting for someone who is actually on the menu. The order is fixed by name: without it the database may return people in a different order on
// another copy, or after a record has been edited.
interface Person { id: string; role: string; isActive: boolean | null; isArchived: boolean | null; anonymisedAt: Date | null; approvalStatus: string | null; employmentType: string | null }

export const isOfferable = (u: Person) => u.isActive !== false && !u.isArchived && !u.anonymisedAt && u.approvalStatus !== "pending" && /^demo-/.test(u.id);

/** The host company's own people holding this role (contractors are shown under their administrator), the first `n` by name. */
export function offeredTeamMembers<T extends Person>(everyone: T[], role: "candidate" | "trainee", n: number): T[] {
  return everyone.filter(u => u.role === role && isOfferable(u) && u.employmentType !== "contractor")
    .sort((a, b) => a.id.localeCompare(b.id)) // demo ids are "demo-firstname.lastname"
    .slice(0, n);
}
