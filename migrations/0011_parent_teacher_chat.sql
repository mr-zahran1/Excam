PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS parent_teacher_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER NOT NULL REFERENCES parent_accounts(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  teacher_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  sender_type TEXT NOT NULL CHECK(sender_type IN ('parent','teacher')),
  sender_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_parent_teacher_messages_conversation
  ON parent_teacher_messages(parent_id,student_id,created_at,id);
