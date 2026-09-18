PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS learning_resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('video','pdf')),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT DEFAULT '',
  grade_level TEXT NOT NULL DEFAULT '',
  education_system TEXT NOT NULL DEFAULT 'general' CHECK(education_system IN ('general','azhar','all')),
  group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  created_by INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_learning_resources_target ON learning_resources(type,grade_level,education_system,group_id,status);

CREATE TABLE IF NOT EXISTS exam_resources (
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  resource_id INTEGER NOT NULL REFERENCES learning_resources(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 1,
  required INTEGER NOT NULL DEFAULT 1 CHECK(required IN (0,1)),
  PRIMARY KEY(exam_id,resource_id),
  UNIQUE(exam_id,sort_order)
);

CREATE INDEX IF NOT EXISTS idx_exam_resources_resource ON exam_resources(resource_id);

CREATE TABLE IF NOT EXISTS learning_resource_access (
  resource_id INTEGER NOT NULL REFERENCES learning_resources(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(resource_id,user_id)
);

CREATE INDEX IF NOT EXISTS idx_learning_resource_access_user ON learning_resource_access(user_id,resource_id);
