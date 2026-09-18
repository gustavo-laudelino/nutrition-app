CREATE TABLE nutritionists (
 id uuid PRIMARY KEY, name varchar(120) NOT NULL, email varchar(254) NOT NULL UNIQUE,
 password_hash varchar(100) NOT NULL, created_at timestamptz NOT NULL
);
CREATE TABLE patients (
 id uuid PRIMARY KEY, nutritionist_id uuid NOT NULL REFERENCES nutritionists(id),
 name varchar(120) NOT NULL, birth_date date, sex varchar(10), phone varchar(30),
 email varchar(254), notes varchar(2000), weight_kg numeric(7,3), height_cm numeric(5,2),
 dri_activity varchar(20), measured_at date, archived_at timestamptz,
 created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, version bigint NOT NULL
);
CREATE INDEX patients_nutritionist_name_idx ON patients(nutritionist_id, name);
