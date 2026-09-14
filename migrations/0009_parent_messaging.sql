PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS parent_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK(sender_type IN ('parent','teacher')),
  admin_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  message TEXT NOT NULL CHECK(length(trim(message)) > 0 AND length(message) <= 2000),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_parent_messages_student ON parent_messages(student_id,id);
CREATE INDEX IF NOT EXISTS idx_parent_messages_unread ON parent_messages(student_id,sender_type,read_at);
