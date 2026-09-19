-- A filled record per consultation. structure and answers are JSON copies: the template structure (with each
-- field's catalog definition) as it was when the consultation was opened, and the answers by field code.
CREATE TABLE consultations (
 id uuid PRIMARY KEY,
 nutritionist_id uuid NOT NULL REFERENCES nutritionists(id),
 patient_id uuid NOT NULL REFERENCES patients(id),
 template_id uuid REFERENCES record_templates(id) ON DELETE SET NULL,
 template_name varchar(60) NOT NULL,
 structure text NOT NULL, answers text NOT NULL,
 consultation_date date NOT NULL,
 status varchar(10) NOT NULL CHECK (status IN ('DRAFT', 'COMPLETED')),
 first_completed_at timestamptz, completed_at timestamptz, reopened_at timestamptz,
 -- Consultations completed at least once are hidden instead of deleted (records must be kept).
 deleted_at timestamptz,
 created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, version bigint NOT NULL
);
CREATE INDEX consultations_patient_idx ON consultations(patient_id, consultation_date);
