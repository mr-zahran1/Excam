PRAGMA foreign_keys = ON;

-- Controls the student learning path before an exam starts.
-- direct = enter immediately (default), required_all = every listed resource must be opened first.
ALTER TABLE exams ADD COLUMN resource_gate TEXT NOT NULL DEFAULT 'direct' CHECK(resource_gate IN ('direct','required_all'));

-- Tracks resource opening per student/exam without storing the actual PDF/video files.
CREATE TABLE IF NOT EXISTS exam_resource_access (
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_index INTEGER NOT NULL,
  opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(exam_id,user_id,resource_index)
);

CREATE INDEX IF NOT EXISTS idx_exam_resource_access_user ON exam_resource_access(user_id,exam_id);
