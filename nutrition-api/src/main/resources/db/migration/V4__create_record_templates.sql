CREATE TABLE record_templates (
 id uuid PRIMARY KEY, nutritionist_id uuid NOT NULL REFERENCES nutritionists(id),
 name varchar(60) NOT NULL, is_default boolean NOT NULL,
 created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, version bigint NOT NULL
);
CREATE INDEX record_templates_nutritionist_idx ON record_templates(nutritionist_id);
-- At most one default template per nutritionist.
CREATE UNIQUE INDEX record_templates_default_idx ON record_templates(nutritionist_id) WHERE is_default;

CREATE TABLE record_template_sections (
 template_id uuid NOT NULL REFERENCES record_templates(id) ON DELETE CASCADE,
 display_order integer NOT NULL, name varchar(60) NOT NULL,
 PRIMARY KEY (template_id, display_order)
);

-- field_code refers to the versioned catalog file (records/field-catalog.json), not to a table.
-- The primary key keeps each catalog field at most once per template.
CREATE TABLE record_template_fields (
 template_id uuid NOT NULL REFERENCES record_templates(id) ON DELETE CASCADE,
 field_code varchar(60) NOT NULL, section_order integer NOT NULL, display_order integer NOT NULL,
 width varchar(12) NOT NULL, text_rows integer,
 PRIMARY KEY (template_id, field_code),
 UNIQUE (template_id, section_order, display_order),
 CHECK (width IN ('THIRD', 'HALF', 'TWO_THIRDS', 'FULL')),
 CHECK (text_rows IS NULL OR text_rows IN (3, 5, 8))
);
