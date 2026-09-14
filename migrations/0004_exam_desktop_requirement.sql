ALTER TABLE exams ADD COLUMN desktop_required INTEGER NOT NULL DEFAULT 0 CHECK(desktop_required IN (0,1));
