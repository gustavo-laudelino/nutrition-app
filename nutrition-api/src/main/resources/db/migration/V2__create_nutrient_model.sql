-- Generic nutrient model: nutrient catalog + value of each nutrient per food (per 100 g), with source and status.
-- Energy and macros stay in foods (source of truth); foods is not altered.
CREATE TABLE nutrients (
    code          varchar(40) PRIMARY KEY,
    name          varchar(80) NOT NULL,
    unit          varchar(10) NOT NULL,
    category      varchar(20) NOT NULL,
    display_order integer     NOT NULL,
    in_report     boolean     NOT NULL
);

CREATE TABLE food_nutrients (
    food_id       bigint        NOT NULL REFERENCES foods (id),
    nutrient_code varchar(40)   NOT NULL REFERENCES nutrients (code),
    amount        numeric(19,6),
    status        varchar(20)   NOT NULL,
    source        varchar(30)   NOT NULL,
    PRIMARY KEY (food_id, nutrient_code),
    CONSTRAINT food_nutrients_status_check CHECK (status IN ('VALUE', 'TRACE', 'NOT_APPLICABLE', 'NOT_ANALYZED')),
    CONSTRAINT food_nutrients_value_amount_check CHECK (status <> 'VALUE' OR amount IS NOT NULL)
);

-- Report order: minerals and vitamins alphabetically by name, then lipids; fiber, moisture and ash are not in the report.
INSERT INTO nutrients (code, name, unit, category, display_order, in_report) VALUES
    ('FIBER',               'Fibra alimentar',          'g',   'FIBER',   10,  false),
    ('CALCIUM',             'Cálcio',                   'mg',  'MINERAL', 100, true),
    ('COPPER',              'Cobre',                    'mg',  'MINERAL', 110, true),
    ('IRON',                'Ferro',                    'mg',  'MINERAL', 120, true),
    ('PHOSPHORUS',          'Fósforo',                  'mg',  'MINERAL', 130, true),
    ('MAGNESIUM',           'Magnésio',                 'mg',  'MINERAL', 140, true),
    ('MANGANESE',           'Manganês',                 'mg',  'MINERAL', 150, true),
    ('POTASSIUM',           'Potássio',                 'mg',  'MINERAL', 160, true),
    ('SODIUM',              'Sódio',                    'mg',  'MINERAL', 170, true),
    ('ZINC',                'Zinco',                    'mg',  'MINERAL', 180, true),
    ('NIACIN',              'Niacina (B3)',             'mg',  'VITAMIN', 200, true),
    ('RIBOFLAVIN',          'Riboflavina (B2)',         'mg',  'VITAMIN', 210, true),
    ('THIAMIN',             'Tiamina (B1)',             'mg',  'VITAMIN', 220, true),
    ('VITAMIN_A_RAE',       'Vitamina A (RAE)',         'mcg', 'VITAMIN', 230, true),
    ('VITAMIN_B6',          'Vitamina B6 (piridoxina)', 'mg',  'VITAMIN', 240, true),
    ('VITAMIN_C',           'Vitamina C',               'mg',  'VITAMIN', 250, true),
    ('RETINOL',             'Retinol',                  'mcg', 'VITAMIN', 260, false),
    ('VITAMIN_A_RE',        'Vitamina A (RE)',          'mcg', 'VITAMIN', 270, false),
    ('CHOLESTEROL',         'Colesterol',               'mg',  'LIPID',   300, true),
    ('SATURATED_FAT',       'Gordura saturada',         'g',   'LIPID',   310, true),
    ('MONOUNSATURATED_FAT', 'Gordura monoinsaturada',   'g',   'LIPID',   320, true),
    ('POLYUNSATURATED_FAT', 'Gordura poli-insaturada',  'g',   'LIPID',   330, true),
    ('TRANS_FAT_18_1',      'Gordura trans (18:1t)',    'g',   'LIPID',   340, true),
    ('TRANS_FAT_18_2',      'Gordura trans (18:2t)',    'g',   'LIPID',   350, true),
    ('MOISTURE',            'Umidade',                  '%',   'OTHER',   900, false),
    ('ASH',                 'Cinzas',                   'g',   'OTHER',   910, false);
