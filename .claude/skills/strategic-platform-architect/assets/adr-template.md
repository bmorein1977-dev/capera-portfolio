# ADR-NNN: <short decision title>

- **Status:** Proposed | Accepted | Superseded by ADR-NNN | Rejected
- **Date:** YYYY-MM-DD
- **Decider(s):** <name(s)>
- **Door type:** One-way (expensive to reverse) | Two-way (cheap to reverse)

## Context
What forces are at play? Business goal, constraints (team size, budget, customer demands, regulation),
current state with evidence (commands run, files read), and what happens if we do nothing.

## Decision
The choice, stated plainly in one or two sentences, with the main reason ("because ...").

## Options considered
| Option | Benefits | Costs / risks | Reversibility |
|---|---|---|---|
| A (chosen) | | | |
| B | | | |
| C | | | |

## Consequences
- What becomes easier.
- What becomes harder or is now forbidden.
- Operational burden added/removed for a single operator.
- Effect on the five promises: isolation, continuity, evolution, speed, exit/trust.

## Data-safety impact
Does this touch production data, schema, or backups? If yes: rehearsal plan, snapshot plan,
verification (row counts, golden figures), rollback path.

## Rollout / migration plan
Ordered steps, effort estimate (founder-weeks), owner, and the first three actions.

## What would change this decision
The observable trigger (customer count, price point, audit requirement, incident, vendor change)
that should make us revisit it, and a review date.

## Verification
How we will know it worked (metrics, tests, checklists) and what evidence we will archive.
