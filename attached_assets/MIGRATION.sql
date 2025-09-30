-- Optional columns used by the importer output (adjust table names as needed)
ALTER TABLE knowledge_items   ADD COLUMN assessor_guidance TEXT DEFAULT '';
ALTER TABLE performance_items ADD COLUMN assessor_guidance TEXT DEFAULT '';
ALTER TABLE knowledge_items   ADD COLUMN fmt_bold BOOLEAN DEFAULT 0;
ALTER TABLE knowledge_items   ADD COLUMN fmt_italic BOOLEAN DEFAULT 0;
ALTER TABLE performance_items ADD COLUMN fmt_bold BOOLEAN DEFAULT 0;
ALTER TABLE performance_items ADD COLUMN fmt_italic BOOLEAN DEFAULT 0;

ALTER TABLE competence_elements ADD COLUMN proficiency_scheme INTEGER DEFAULT 1;
ALTER TABLE competence_elements ADD COLUMN criticality VARCHAR(16) DEFAULT '';
ALTER TABLE competence_elements ADD COLUMN reassess_years INTEGER DEFAULT 0;
