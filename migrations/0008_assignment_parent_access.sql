PRAGMA foreign_keys = ON;

ALTER TABLE exams ADD COLUMN target_type TEXT NOT NULL DEFAULT 'all';
ALTER TABLE exams ADD COLUMN target_system TEXT NOT NULL DEFAULT 'general';
ALTER TABLE exams ADD COLUMN target_grade TEXT NOT NULL DEFAULT '';
ALTER TABLE exams ADD COLUMN target_group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL;

ALTER TABLE users ADD COLUMN parent_access_token TEXT;

CREATE INDEX IF NOT EXISTS idx_exams_target_group ON exams(target_group_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_parent_token ON users(parent_access_token);
