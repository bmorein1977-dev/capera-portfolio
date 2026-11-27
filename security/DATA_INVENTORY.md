# Data inventory and classification (draft)

Generated 2026-11-26 from the structure of the demo database by `scripts/security/dataInventory.ts`. **A draft for the data owner to correct**: levels are worked out from table and column names, so free-text columns are treated as personal until someone says otherwise. Column by column detail is in `security/data-inventory.csv` (the "Reviewed" column is for a person's decision and is kept when the script is rerun).

## What the levels mean

| Level | Meaning | Handling |
|---|---|---|
| Credential | secrets, tokens, session values | never logged, never exported, never shown; protected at rest |
| Special-risk | performance ratings and appraisal text, 360 feedback, health or absence detail, date of birth, audit trail of who did what | named access only, every opening of someone else's record logged, kept out of reports and email |
| Personal | names, emails, photos, CVs, reporting lines, anything linked to a person, free text | role-based and per-record access; removed or anonymised on leaving after the retention period |
| Internal | company data not about a person (standards, requirements, courses) | signed-in staff only |
| Reference | catalogue values, statuses, housekeeping | no special handling |

## Tables by highest level held

| Level | Tables |
|---|---|
| Credential | 2 |
| Special-risk | 21 |
| Personal | 67 |
| Internal | 9 |
| Reference | 6 |

### Credential

| Table | Rows | Columns at this level |
|---|---|---|
| sessions | 0 | 3 |
| training_content_progress | 0 | 1 |

### Special-risk

| Table | Rows | Columns at this level |
|---|---|---|
| absences | 4 | 4 |
| appraisal_behaviour_ratings | 246 | 2 |
| appraisal_comments | 0 | 3 |
| appraisals | 72 | 12 |
| assessment_evidence | 4 | 2 |
| assessments | 267 | 3 |
| audit_events | 12063 | 7 |
| competency_element_target_scores | 0 | 1 |
| contractor_declarations | 53 | 3 |
| contractor_visits | 0 | 9 |
| course_training_sessions | 0 | 1 |
| feedback_requests | 186 | 5 |
| objective_updates | 0 | 2 |
| performance_cycles | 3 | 1 |
| performance_objectives | 239 | 4 |
| succession_candidates | 6 | 2 |
| talent_score_settings | 1 | 4 |
| training_course_reviews | 0 | 3 |
| training_evaluations | 0 | 6 |
| users | 54 | 2 |
| verifications | 64 | 1 |

### Personal

| Table | Rows | Columns at this level |
|---|---|---|
| announcement_reads | 0 | 1 |
| announcements | 0 | 7 |
| assessment_expiry_history | 18 | 1 |
| assessment_feedback | 25 | 3 |
| assessment_knowledge_answers | 0 | 1 |
| behaviours | 6 | 1 |
| booking_approvals | 0 | 1 |
| candidate_allocations | 37 | 2 |
| certificate_settings | 1 | 1 |
| competence_criteria | 78 | 2 |
| competency_categories | 5 | 1 |
| competency_certifications | 0 | 2 |
| competency_element_review_history | 3 | 1 |
| competency_elements | 13 | 2 |
| competency_levels | 0 | 1 |
| competency_matrix | 0 | 1 |
| course_bookings | 0 | 2 |
| elearning_certificates | 1 | 2 |
| external_training_courses | 0 | 1 |
| induction_programs | 0 | 2 |
| induction_tasks | 0 | 1 |
| initiative_role_requirements | 5 | 2 |
| job_families | 4 | 1 |
| job_role_skills | 33 | 1 |
| job_roles | 16 | 3 |
| kpi_targets | 0 | 1 |
| notification_logs | 298 | 3 |
| notification_queue | 0 | 1 |
| notification_rules | 0 | 2 |
| notification_settings | 0 | 2 |
| onboarding_assignments | 0 | 1 |
| onboarding_task_completions | 0 | 1 |
| opito_documents | 0 | 1 |
| report_schedules | 0 | 2 |
| retention_settings | 1 | 1 |
| role_element_levels | 0 | 1 |
| sampling_plans | 4 | 2 |
| skills | 18 | 1 |
| staffing_requirements | 6 | 4 |
| staffing_shortfall_reviews | 3 | 1 |
| standard_draft_questions | 0 | 1 |
| standard_draft_scenarios | 0 | 1 |
| standard_draft_sessions | 0 | 2 |
| succession_plans | 3 | 3 |
| teams | 4 | 1 |
| training_categories | 5 | 1 |
| training_certificates | 0 | 1 |
| training_completion_audit | 37 | 1 |
| training_content | 0 | 1 |
| training_enrollments | 469 | 1 |
| training_evaluation_settings | 1 | 1 |
| training_levels | 0 | 1 |
| training_permissions | 0 | 1 |
| training_policy_matrix | 0 | 2 |
| training_providers | 3 | 3 |
| training_requests | 0 | 4 |
| training_venues | 0 | 1 |
| trainings | 24 | 1 |
| user_experience | 70 | 3 |
| user_language_preferences | 0 | 1 |
| user_qualifications | 65 | 2 |
| user_role_assignments | 0 | 1 |
| user_skills | 154 | 2 |
| verification_tasks | 80 | 2 |
| verifier_allocations | 17 | 2 |
| visitor_settings | 0 | 1 |
| workforce_initiatives | 2 | 2 |

## Where personal data also lives outside the tables

- **Session store**: the signed-in person's id, email and identity-provider tokens (a Credential-level table; see ASVS 14.2.2).
- **Object storage**: CV files, profile photos, evidence files, uploaded training content (named by random keys; the file names inside can name a person).
- **Email log**: the text of every email sent, which can include names and review stages.
- **Server log**: method, path, status and time only. Response bodies are never logged (ASVS 16.2.5).
- **Exports and scheduled reports**: an Excel file with names, held for 15 minutes by the server and, if emailed, in the owner's mailbox (outside Capera's control).
- **AI provider** (only if the AI step is switched on for a report): counts and category names only, from an approved list of columns, never names, emails or free text.
