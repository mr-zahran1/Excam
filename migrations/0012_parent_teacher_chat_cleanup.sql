PRAGMA foreign_keys = ON;

-- The final parent follow-up design is Parent <-> Teacher only.
-- parent_teacher_messages is the canonical conversation table.
-- Remove the obsolete Parent <-> Student chat table from migration 0010.
DROP TABLE IF EXISTS parent_messages;

CREATE INDEX IF NOT EXISTS idx_parent_teacher_messages_parent_student
  ON parent_teacher_messages(parent_id,student_id,created_at,id);
