ALTER TABLE exams ADD COLUMN grade_level TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_exams_grade ON exams(grade_level,created_at);
CREATE INDEX IF NOT EXISTS idx_groups_grade ON groups(grade,name);
