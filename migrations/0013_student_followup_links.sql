PRAGMA foreign_keys = ON;

-- One private, revocable-style token per student for simple parent follow-up.
-- No parent account, parent password, or parent login is required.
CREATE TABLE IF NOT EXISTS student_followup_links (
  student_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_followup_token
  ON student_followup_links(token);
