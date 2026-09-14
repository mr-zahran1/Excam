PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  system TEXT NOT NULL DEFAULT 'general' CHECK(system IN ('general','azhar')),
  grade TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, system, grade)
);

CREATE TABLE IF NOT EXISTS skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN education_system TEXT NOT NULL DEFAULT 'general' CHECK(education_system IN ('general','azhar'));
ALTER TABLE users ADD COLUMN grade_level TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL;

ALTER TABLE questions ADD COLUMN skill_id INTEGER REFERENCES skills(id) ON DELETE SET NULL;
ALTER TABLE questions ADD COLUMN topic TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_users_group ON users(group_id);
CREATE INDEX IF NOT EXISTS idx_questions_skill ON questions(skill_id);

INSERT OR IGNORE INTO skills(name,description) VALUES
('Vocabulary','Word meaning, synonyms, antonyms and usage'),
('Grammar','Grammar rules and accurate sentence structure'),
('Reading','Reading comprehension, main ideas and inference'),
('Writing','Written expression, organization and accuracy'),
('Listening','Listening comprehension and key information'),
('Language Functions','Everyday expressions and communication'),
('Translation','Meaning, accuracy and language transfer');
