PRAGMA foreign_keys = ON;

-- Targeting: each exam can be restricted by education system (General/Azhar),
-- grade, or a specific group. Existing exams are made visible to all systems
-- so the new filter does not accidentally hide legacy exams.
UPDATE exams SET target_system='all' WHERE target_system IS NULL OR target_system='general';

CREATE INDEX IF NOT EXISTS idx_exams_target_system_grade
  ON exams(target_system,target_grade,grade_level);

CREATE INDEX IF NOT EXISTS idx_users_education_grade
  ON users(education_system,grade_level);
