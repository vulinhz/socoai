import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { seedGdpt2018Curriculum } from './curriculum_gdpt2018.ts';

function resolveWritableDbPath(): { dbPath: string; persistentStorage: boolean } {
  if (process.env.DATABASE_PATH?.trim()) {
    const customPath = path.resolve(process.env.DATABASE_PATH.trim());
    const customDir = path.dirname(customPath);
    fs.mkdirSync(customDir, { recursive: true });
    return { dbPath: customPath, persistentStorage: true };
  }

  const localDataDir = path.resolve(process.cwd(), 'data');
  const localDbPath = path.join(localDataDir, 'socrates.db');

  if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    try {
      if (!fs.existsSync(localDataDir)) {
        fs.mkdirSync(localDataDir, { recursive: true });
      }
      fs.accessSync(localDataDir, fs.constants.W_OK);
      return { dbPath: localDbPath, persistentStorage: true };
    } catch {
      // Fall through to writable temp directory
    }
  }

  const tmpDataDir = path.join(os.tmpdir(), 'socrates-data');
  const tmpDbPath = path.join(tmpDataDir, 'socrates.db');
  if (!fs.existsSync(tmpDataDir)) {
    fs.mkdirSync(tmpDataDir, { recursive: true });
  }
  if (!fs.existsSync(tmpDbPath) && fs.existsSync(localDbPath)) {
    try {
      fs.copyFileSync(localDbPath, tmpDbPath);
    } catch (err) {
      console.warn('Could not copy bundled database to temp dir, initializing fresh DB:', err);
    }
  }
  return { dbPath: tmpDbPath, persistentStorage: false };
}

const resolvedStorage = resolveWritableDbPath();
export const hasPersistentStorage = resolvedStorage.persistentStorage;
export const db = new Database(resolvedStorage.dbPath);

try {
  db.pragma('journal_mode = WAL');
} catch {
  try {
    db.pragma('journal_mode = DELETE');
  } catch {
    // Ignore pragma failure on constrained filesystems
  }
}
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student', 'teacher', 'parent', 'admin')),
      avatar_url TEXT,
      is_verified INTEGER NOT NULL DEFAULT 0,
      verification_code TEXT,
      reset_token TEXT,
      reset_expires_at TEXT,
      parental_consent_status TEXT NOT NULL DEFAULT 'not_required' CHECK(parental_consent_status IN ('not_required', 'pending', 'approved')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level INTEGER NOT NULL UNIQUE CHECK(level BETWEEN 1 AND 5),
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      color_token TEXT NOT NULL,
      icon_name TEXT NOT NULL,
      grade_min INTEGER NOT NULL DEFAULT 1,
      grade_max INTEGER NOT NULL DEFAULT 5,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS student_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      grade_id INTEGER NOT NULL REFERENCES grades(id),
      xp INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      streak_days INTEGER NOT NULL DEFAULT 1,
      last_active_date TEXT,
      learning_style TEXT NOT NULL DEFAULT 'visual',
      daily_goal_minutes INTEGER NOT NULL DEFAULT 20,
      link_code TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS teacher_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      school_name TEXT NOT NULL DEFAULT 'Trường Tiểu học Chu Văn An',
      specialization TEXT NOT NULL DEFAULT 'Giáo dục Tiểu học',
      bio TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS parent_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      relationship_label TEXT NOT NULL DEFAULT 'Phụ huynh',
      notification_preference TEXT NOT NULL DEFAULT 'weekly_summary',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      grade_id INTEGER NOT NULL REFERENCES grades(id),
      name TEXT NOT NULL,
      join_code TEXT NOT NULL UNIQUE,
      academic_year TEXT NOT NULL DEFAULT '2026-2027',
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS class_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'pending')),
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(class_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS parent_student_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      link_code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      approved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(parent_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS curriculum_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grade_id INTEGER NOT NULL REFERENCES grades(id),
      subject_id INTEGER NOT NULL REFERENCES subjects(id),
      semester INTEGER NOT NULL CHECK(semester IN (1, 2)),
      title TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 1,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL REFERENCES curriculum_units(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      objectives TEXT NOT NULL,
      core_knowledge TEXT NOT NULL,
      illustration_url TEXT,
      examples_json TEXT NOT NULL DEFAULT '[]',
      interactive_check_json TEXT NOT NULL DEFAULT '{}',
      review_notes TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('published', 'draft')),
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS learning_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      material_type TEXT NOT NULL CHECK(material_type IN ('summary', 'worksheet', 'story', 'visual_guide')),
      content TEXT NOT NULL,
      approval_status TEXT NOT NULL DEFAULT 'approved' CHECK(approval_status IN ('approved', 'pending', 'rejected')),
      author_id INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
      grade_id INTEGER NOT NULL REFERENCES grades(id),
      subject_id INTEGER NOT NULL REFERENCES subjects(id),
      title TEXT NOT NULL,
      game_type TEXT NOT NULL CHECK(game_type IN (
        'quiz', 'matching', 'drag_drop', 'fill_blank', 'word_puzzle',
        'math_challenge', 'picture_recognition', 'memory', 'true_false', 'interactive_story'
      )),
      difficulty TEXT NOT NULL DEFAULT 'medium' CHECK(difficulty IN ('easy', 'medium', 'hard')),
      xp_reward INTEGER NOT NULL DEFAULT 30,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exercise_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      question_type TEXT NOT NULL,
      prompt TEXT NOT NULL,
      options_json TEXT NOT NULL DEFAULT '[]',
      correct_answer TEXT NOT NULL,
      explanation TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tutoring_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      grade_id INTEGER NOT NULL REFERENCES grades(id),
      subject_id INTEGER NOT NULL REFERENCES subjects(id),
      mode TEXT NOT NULL DEFAULT 'socratic' CHECK(mode IN ('socratic', 'hint', 'concept', 'challenge')),
      topic TEXT NOT NULL DEFAULT 'Khám phá bài học',
      difficulty TEXT NOT NULL DEFAULT 'medium',
      learning_objective TEXT,
      prerequisite_skills TEXT,
      source_type TEXT NOT NULL DEFAULT 'text' CHECK(source_type IN ('text', 'image', 'voice')),
      extracted_problem_text TEXT,
      image_preview_data TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tutoring_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES tutoring_sessions(id) ON DELETE CASCADE,
      sender TEXT NOT NULL CHECK(sender IN ('student', 'soco')),
      content TEXT NOT NULL,
      pedagogical_meta_json TEXT,
      hint_level INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS learning_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lesson_id INTEGER REFERENCES lessons(id) ON DELETE CASCADE,
      exercise_id INTEGER REFERENCES exercises(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('not_started', 'in_progress', 'completed')),
      time_spent_seconds INTEGER NOT NULL DEFAULT 0,
      score INTEGER NOT NULL DEFAULT 0,
      attempts INTEGER NOT NULL DEFAULT 1,
      last_accessed_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS skill_mastery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(id),
      grade_id INTEGER NOT NULL REFERENCES grades(id),
      topic_name TEXT NOT NULL,
      mastery_score INTEGER NOT NULL DEFAULT 0 CHECK(mastery_score BETWEEN 0 AND 100),
      confidence_level TEXT NOT NULL DEFAULT 'developing' CHECK(confidence_level IN ('needs_review', 'developing', 'mastered')),
      correct_count INTEGER NOT NULL DEFAULT 0,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      ai_help_level TEXT NOT NULL DEFAULT 'moderate' CHECK(ai_help_level IN ('minimal', 'moderate', 'high')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(student_id, subject_id, topic_name)
    );

    CREATE TABLE IF NOT EXISTS learning_mistakes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(id),
      topic_name TEXT NOT NULL,
      mistake_type TEXT NOT NULL,
      description TEXT NOT NULL,
      frequency INTEGER NOT NULL DEFAULT 1,
      last_occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      xp_threshold INTEGER NOT NULL DEFAULT 0,
      badge_icon TEXT NOT NULL,
      color_token TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS student_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
      earned_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(student_id, achievement_id)
    );

    CREATE TABLE IF NOT EXISTS missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      mission_type TEXT NOT NULL CHECK(mission_type IN ('daily', 'weekly')),
      target_action TEXT NOT NULL,
      target_count INTEGER NOT NULL DEFAULT 1,
      xp_reward INTEGER NOT NULL DEFAULT 25,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mission_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      current_count INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      period_key TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(student_id, mission_id, period_key)
    );

    CREATE TABLE IF NOT EXISTS teacher_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(id),
      title TEXT NOT NULL,
      instructions TEXT NOT NULL,
      due_date TEXT NOT NULL,
      exercise_id INTEGER REFERENCES exercises(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assignment_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL REFERENCES teacher_assignments(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      answer_summary TEXT,
      score INTEGER,
      status TEXT NOT NULL DEFAULT 'assigned' CHECK(status IN ('assigned', 'submitted', 'graded')),
      teacher_feedback TEXT,
      submitted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(assignment_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS ai_usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL,
      model_name TEXT NOT NULL,
      grade_level INTEGER,
      mode TEXT,
      prompt_tokens_est INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'success',
      safety_flagged INTEGER NOT NULL DEFAULT 0,
      latency_ms INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_student_profiles_grade ON student_profiles(grade_id);
    CREATE INDEX IF NOT EXISTS idx_class_members_student ON class_members(student_id);
    CREATE INDEX IF NOT EXISTS idx_parent_links_parent ON parent_student_links(parent_id);
    CREATE INDEX IF NOT EXISTS idx_parent_links_student ON parent_student_links(student_id);
    CREATE INDEX IF NOT EXISTS idx_units_grade_subject ON curriculum_units(grade_id, subject_id);
    CREATE INDEX IF NOT EXISTS idx_lessons_unit ON lessons(unit_id);
    CREATE INDEX IF NOT EXISTS idx_exercises_grade_subject ON exercises(grade_id, subject_id);
    CREATE INDEX IF NOT EXISTS idx_tutoring_sessions_student ON tutoring_sessions(student_id);
    CREATE INDEX IF NOT EXISTS idx_tutoring_messages_session ON tutoring_messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_learning_progress_student ON learning_progress(student_id);
    CREATE INDEX IF NOT EXISTS idx_skill_mastery_student ON skill_mastery(student_id);
    CREATE INDEX IF NOT EXISTS idx_learning_mistakes_student ON learning_mistakes(student_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_class ON teacher_assignments(class_id);
    CREATE INDEX IF NOT EXISTS idx_ai_logs_user_date ON ai_usage_logs(user_id, created_at);
  `);

  // Safe migrations for existing SQLite databases
  const ensureColumn = (table: string, col: string, definition: string) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === col)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${definition}`);
    }
  };

  ensureColumn('users', 'accepted_terms_at', 'TEXT');
  ensureColumn('lessons', 'review_status', `TEXT NOT NULL DEFAULT 'published'`);
  ensureColumn('lessons', 'is_ai_generated', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('exercises', 'review_status', `TEXT NOT NULL DEFAULT 'published'`);
  ensureColumn('exercises', 'is_ai_generated', 'INTEGER NOT NULL DEFAULT 0');

  db.exec(`
    UPDATE lessons
    SET review_status = CASE WHEN status = 'draft' THEN 'draft' ELSE 'published' END
    WHERE review_status IS NULL OR review_status = '';
  `);
}

export function cleanupExpiredConversations(): { deletedCount: number; retentionDays: number } {
  const row = db
    .prepare(`SELECT value FROM system_settings WHERE key = 'conversation_retention_days'`)
    .get() as { value: string } | undefined;
  const retentionDays = Math.min(3650, Math.max(1, Number(row?.value) || 90));
  const res = db
    .prepare(
      `DELETE FROM tutoring_sessions
       WHERE datetime(updated_at) < datetime('now', '-' || ? || ' days')`
    )
    .run(retentionDays);
  return { deletedCount: res.changes, retentionDays };
}

export function seedDatabase() {
  const existingGrades = db.prepare('SELECT COUNT(*) as cnt FROM grades').get() as { cnt: number };
  if (existingGrades.cnt > 0) {
    // Upgrade existing DBs cleanly with WebP asset paths, retention setting & full GDPT 2018 curriculum
    db.exec(`
      UPDATE lessons SET illustration_url = '/src/assets/images/lesson_math_fractions.webp' WHERE illustration_url LIKE '%lesson_math_fractions%';
      UPDATE lessons SET illustration_url = '/src/assets/images/lesson_vietnamese_story.webp' WHERE illustration_url LIKE '%lesson_vietnamese_story%';
      UPDATE lessons SET illustration_url = '/src/assets/images/lesson_science_nature.webp' WHERE illustration_url LIKE '%lesson_science_nature%';
      UPDATE lessons SET illustration_url = '/src/assets/images/hero_learning_world.webp' WHERE illustration_url LIKE '%hero_learning_world%';
      UPDATE exercise_questions SET options_json = REPLACE(options_json, 'lesson_science_nature_1794794875281.jpg', 'lesson_science_nature.webp')
      WHERE options_json LIKE '%lesson_science_nature_1794794875281.jpg%';
    `);
    db.prepare(
      `INSERT OR IGNORE INTO system_settings (key, value, description) VALUES (?, ?, ?)`
    ).run(
      'conversation_retention_days',
      '90',
      'Số ngày lưu trữ tối đa cho lịch sử hội thoại gia sư AI trước khi tự động xóa theo chính sách dữ liệu trẻ em.'
    );
    const existingTeacher = db.prepare(`SELECT id FROM users WHERE role = 'teacher' ORDER BY id ASC LIMIT 1`).get() as
      | { id: number }
      | undefined;
    seedGdpt2018Curriculum(db, existingTeacher?.id ?? null);
    cleanupExpiredConversations();
    return;
  }

  const insertGrade = db.prepare('INSERT INTO grades (level, name, description) VALUES (?, ?, ?)');
  const gradesData = [
    [1, 'Lớp 1', 'Khởi đầu tư duy số đếm, ghép vần Tiếng Việt và khám phá thế giới quanh em.'],
    [2, 'Lớp 2', 'Phát triển phép tính trong phạm vi 1000, đọc hiểu câu chuyện và tự nhiên xã hội.'],
    [3, 'Lớp 3', 'Làm quen bảng nhân chia, hình học cơ bản, viết đoạn văn và Tiếng Anh giao tiếp.'],
    [4, 'Lớp 4', 'Tư duy phân số, giải toán nhiều bước, khoa học tự nhiên và lịch sử địa lí Việt Nam.'],
    [5, 'Lớp 5', 'Số thập phân, tỉ số phần trăm, cảm thụ văn học sâu sắc và sẵn sàng chuyển cấp.'],
  ];
  for (const g of gradesData) insertGrade.run(...g);

  const insertSubject = db.prepare(
    'INSERT INTO subjects (code, name, description, color_token, icon_name, grade_min, grade_max) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const subjectsData = [
    ['math', 'Toán học', 'Số học, phép tính, hình học trực quan và giải toán tư duy logic.', 'sky', 'Calculator', 1, 5],
    ['vietnamese', 'Tiếng Việt', 'Đọc hiểu, luyện từ và câu, chính tả và tập làm văn giàu cảm xúc.', 'coral', 'BookOpen', 1, 5],
    ['science', 'Tự nhiên & Khoa học', 'Khám phá thực vật, động vật, nước, ánh sáng và môi trường sống.', 'mint', 'Leaf', 1, 5],
    ['english', 'Tiếng Anh', 'Từ vựng, mẫu câu giao tiếp hàng ngày và phản xạ ngôn ngữ tự nhiên.', 'lavender', 'Languages', 1, 5],
    ['ethics', 'Đạo đức & Kỹ năng', 'Lòng biết ơn, tinh thần hợp tác, an toàn mạng và thói quen tốt.', 'yellow', 'HeartHandshake', 1, 5],
    ['history_geo', 'Lịch sử & Địa lí', 'Cội nguồn dân tộc, danh lam thắng cảnh và địa lí các vùng miền Việt Nam.', 'sky', 'Compass', 4, 5],
    ['tech', 'Tin học & Công nghệ', 'Tư duy thuật toán cơ bản, sử dụng máy tính an toàn và sáng tạo.', 'lavender', 'Cpu', 3, 5],
  ];
  for (const s of subjectsData) insertSubject.run(...s);

  const hash = (pw: string) => bcrypt.hashSync(pw, 10);
  const insertUser = db.prepare(
    `INSERT INTO users (username, email, password_hash, display_name, role, is_verified, parental_consent_status, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const studentId = insertUser.run('minhanh4a', 'minhanh@student.socrates.vn', hash('Hocsinh123!'), 'Bé Minh Anh', 'student', 1, 'approved', 'active').lastInsertRowid as number;
  const student2Id = insertUser.run('giahan2b', null, hash('Hocsinh123!'), 'Bé Gia Hân', 'student', 1, 'approved', 'active').lastInsertRowid as number;
  const teacherId = insertUser.run('colan_gv', 'colan@teacher.socrates.vn', hash('Giaovien123!'), 'Cô Nguyễn Thị Lan', 'teacher', 1, 'not_required', 'active').lastInsertRowid as number;
  const parentId = insertUser.run('ph_minhanh', 'phuhuynh@socrates.vn', hash('Phuhuynh123!'), 'Anh Trần Minh Đức', 'parent', 1, 'not_required', 'active').lastInsertRowid as number;
  const adminId = insertUser.run('admin_soco', 'admin@socrates.vn', hash('AdminSoco123!'), 'Quản trị Hệ thống', 'admin', 1, 'not_required', 'active').lastInsertRowid as number;

  const todayStr = new Date().toISOString().slice(0, 10);
  db.prepare(
    `INSERT INTO student_profiles (user_id, grade_id, xp, level, streak_days, last_active_date, learning_style, daily_goal_minutes, link_code)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(studentId, 4, 340, 3, 5, todayStr, 'visual', 25, 'LINK-MA4A');

  db.prepare(
    `INSERT INTO student_profiles (user_id, grade_id, xp, level, streak_days, last_active_date, learning_style, daily_goal_minutes, link_code)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(student2Id, 2, 180, 2, 3, todayStr, 'interactive', 20, 'LINK-GH2B');

  db.prepare(
    `INSERT INTO teacher_profiles (user_id, school_name, specialization, bio) VALUES (?, ?, ?, ?)`
  ).run(teacherId, 'Trường Tiểu học Chu Văn An', 'Toán & Tiếng Việt Lớp 4', 'Giáo viên tiểu học 12 năm kinh nghiệm giảng dạy theo phương pháp gợi mở.');

  db.prepare(
    `INSERT INTO parent_profiles (user_id, relationship_label, notification_preference) VALUES (?, ?, ?)`
  ).run(parentId, 'Bố của Minh Anh', 'daily_digest');

  const classId = db.prepare(
    `INSERT INTO classes (teacher_id, grade_id, name, join_code, academic_year, description) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(teacherId, 4, 'Lớp 4A - Khám phá Tri thức', 'SOCO4A', '2026-2027', 'Lớp học Toán tư duy, Tiếng Việt và Khoa học dành cho học sinh lớp 4.').lastInsertRowid as number;

  db.prepare(`INSERT INTO class_members (class_id, student_id, status) VALUES (?, ?, 'active')`).run(classId, studentId);
  db.prepare(
    `INSERT INTO parent_student_links (parent_id, student_id, link_code, status, approved_at) VALUES (?, ?, ?, 'approved', datetime('now'))`
  ).run(parentId, studentId, 'LINK-MA4A');

  // Curriculum Units & Lessons across Grades 1-5
  const insertUnit = db.prepare(
    `INSERT INTO curriculum_units (grade_id, subject_id, semester, title, order_index, description) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insertLesson = db.prepare(
    `INSERT INTO lessons (unit_id, title, objectives, core_knowledge, illustration_url, examples_json, interactive_check_json, review_notes, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', ?)`
  );

  // Grade 1 Math
  const u1m = insertUnit.run(1, 1, 1, 'Các số đến 10 và Phép cộng trừ', 1, 'Nhận biết số lượng, so sánh và cộng trừ bằng hình ảnh trực quan.').lastInsertRowid as number;
  const l1m = insertLesson.run(
    u1m,
    'Phép cộng trong phạm vi 10 cùng những viên bi',
    'Biết gộp hai nhóm đồ vật để tìm tổng số lượng trong phạm vi 10.',
    'Khi gộp 2 nhóm đồ vật lại với nhau, ta dùng phép cộng (+). Ví dụ: có 3 quả táo và thêm 2 quả táo, đếm tất cả được 5 quả táo: 3 + 2 = 5.',
    '/src/assets/images/lesson_math_fractions.webp',
    JSON.stringify(['Lan có 4 bút chì màu, mẹ cho thêm 3 bút chì màu nữa. Lan có tất cả 4 + 3 = 7 bút chì màu.', 'Trên cành có 5 chú chim, bay tới thêm 2 chú chim. Tất cả có 5 + 2 = 7 chú chim.']),
    JSON.stringify({ question: 'Trong giỏ có 4 quả cam, bé bỏ thêm 2 quả cam. Hỏi có tất cả mấy quả cam?', options: ['5 quả cam', '6 quả cam', '7 quả cam'], answer: '6 quả cam', hint: 'Em hãy đếm tiếp từ 4 thêm 2 bước nhé: 4 -> 5 -> ...' }),
    'Nhớ đếm kỹ từng nhóm trước khi gộp lại nhé!',
    teacherId
  ).lastInsertRowid as number;

  // Grade 2 Math
  const u2m = insertUnit.run(2, 1, 1, 'Phép cộng trừ có nhớ trong phạm vi 100', 1, 'Đặt tính thẳng hàng và hiểu quy tắc nhớ 1 sang hàng chục.').lastInsertRowid as number;
  insertLesson.run(
    u2m,
    'Phép cộng có nhớ dạng 28 + 15',
    'Hiểu bản chất gộp 10 đơn vị thành 1 chục khi cộng các số có hai chữ số.',
    'Khi cộng hàng đơn vị: 8 + 5 = 13, viết 3 ở hàng đơn vị và nhớ 1 chục sang hàng chục. Sau đó cộng hàng chục: 2 + 1 + 1 (nhớ) = 4. Kết quả là 43.',
    '/src/assets/images/lesson_math_fractions.webp',
    JSON.stringify(['27 + 16: 7 + 6 = 13 (viết 3 nhớ 1); 2 + 1 + 1 = 4 -> 43.', '39 + 24: 9 + 4 = 13 (viết 3 nhớ 1); 3 + 2 + 1 = 6 -> 63.']),
    JSON.stringify({ question: 'Kết quả của 26 + 17 là bao nhiêu?', options: ['33', '43', '42'], answer: '43', hint: '6 + 7 = 13, viết 3 nhớ 1 sang hàng chục (2 + 1 + 1).' }),
    'Luôn đặt chữ số hàng đơn vị thẳng cột với hàng đơn vị!',
    teacherId
  );

  // Grade 3 Math
  const u3m = insertUnit.run(3, 1, 1, 'Bảng nhân chia & Chu vi hình học', 1, 'Hiểu ý nghĩa phép nhân là tổng các số hạng bằng nhau và tính chu vi.').lastInsertRowid as number;
  insertLesson.run(
    u3m,
    'Chu vi hình chữ nhật và hình vuông',
    'Biết tính tổng độ dài các cạnh bao quanh hình chữ nhật và hình vuông.',
    'Chu vi là tổng độ dài đường bao quanh hình. Hình chữ nhật có 2 chiều dài và 2 chiều rộng nên Chu vi = (Chiều dài + Chiều rộng) × 2 (cùng đơn vị đo).',
    '/src/assets/images/lesson_math_fractions.webp',
    JSON.stringify(['Mảnh vườn hình chữ nhật dài 8m, rộng 5m. Chu vi = (8 + 5) × 2 = 26m.', 'Khung ảnh hình vuông cạnh 6cm. Chu vi = 6 × 4 = 24cm.']),
    JSON.stringify({ question: 'Quyển vở hình chữ nhật dài 20cm, rộng 15cm. Chu vi quyển vở là:', options: ['35 cm', '70 cm', '300 cm'], answer: '70 cm', hint: 'Em nhớ cộng chiều dài và chiều rộng rồi nhân với 2 nhé!' }),
    'Kiểm tra xem chiều dài và chiều rộng đã cùng đơn vị đo chưa trước khi tính.',
    teacherId
  );

  // Grade 4 Math (Primary showcase for Minh Anh)
  const u4m = insertUnit.run(4, 1, 2, 'Phân số và Các phép tính với phân số', 1, 'Hiểu bản chất phân số là phần bằng nhau của một đơn vị, quy đồng và cộng trừ phân số.').lastInsertRowid as number;
  const l4m = insertLesson.run(
    u4m,
    'Khái niệm Phân số và Quy đồng mẫu số',
    'Hiểu tử số, mẫu số qua hình ảnh chia bánh và biết cách quy đồng hai phân số khác mẫu.',
    'Phân số gồm tử số (ở trên) và mẫu số (ở dưới, khác 0). Mẫu số cho biết một cái bánh được chia làm mấy phần bằng nhau; tử số cho biết ta lấy bao nhiêu phần như thế. Khi cộng hai phân số khác mẫu, ta cần đưa chúng về cùng một kích thước phần (quy đồng mẫu số).',
    '/src/assets/images/lesson_math_fractions.webp',
    JSON.stringify(['Chia chiếc bánh pizza thành 4 phần bằng nhau, lấy 3 phần ta có phân số 3/4.', 'Quy đồng 1/2 và 1/3 về mẫu số chung 6: 1/2 = 3/6 và 1/3 = 2/6.']),
    JSON.stringify({ question: 'Vì sao trước khi cộng 1/2 + 1/3 ta phải quy đồng mẫu số?', options: ['Để hai phân số có cùng kích thước phần bằng nhau', 'Để tử số lớn hơn mẫu số', 'Để bỏ mẫu số đi'], answer: 'Để hai phân số có cùng kích thước phần bằng nhau', hint: 'Hãy tưởng tượng 1/2 chiếc bánh và 1/3 chiếc bánh có kích thước miếng khác nhau.' }),
    'Nhân cả tử số và mẫu số với cùng một số tự nhiên khác 0 thì giá trị phân số không đổi.',
    teacherId
  ).lastInsertRowid as number;

  // Grade 4 Vietnamese
  const u4v = insertUnit.run(4, 2, 1, 'Đọc hiểu & Cảm thụ văn học dân gian', 1, 'Nhận biết biện pháp nhân hóa, so sánh và thông điệp nhân ái trong truyện Việt Nam.').lastInsertRowid as number;
  const l4v = insertLesson.run(
    u4v,
    'Biện pháp Nhân hóa trong văn miêu tả',
    'Nhận ra cách gọi, tả sự vật bằng từ ngữ vốn dùng cho con người để câu văn sinh động.',
    'Nhân hóa là cách gọi hoặc tả con vật, cây cối, đồ vật bằng những từ ngữ dùng để gọi hoặc tả con người (ví dụ: chị Ong nâu, bác Trống trường, cây bàng dang tay che nắng).',
    '/src/assets/images/lesson_vietnamese_story.webp',
    JSON.stringify(['"Ông mặt trời thức dậy từ sớm, rải nắng vàng xuống sân trường." -> Dùng từ "Ông", "thức dậy" như con người.', '"Chú chuồn chuồn nước tung tăng lướt trên mặt hồ."']),
    JSON.stringify({ question: 'Câu nào sau đây có sử dụng biện pháp nhân hóa?', options: ['Bông hoa cúc màu vàng tươi.', 'Chị gió nhẹ nhàng ru hàng tre ngủ.', 'Sân trường em rất rộng rãi.'], answer: 'Chị gió nhẹ nhàng ru hàng tre ngủ.', hint: 'Tìm câu có từ xưng hô hoặc hành động giống con người như "chị", "ru ngủ".' }),
    'Thử tự đặt một câu nhân hóa về chiếc cặp sách hoặc cây bút của em nhé!',
    teacherId
  ).lastInsertRowid as number;

  // Grade 4 Science
  const u4s = insertUnit.run(4, 3, 1, 'Nước, Thực vật và Chu trình Tự nhiên', 1, 'Tìm hiểu nhu cầu sống của thực vật và vòng tuần hoàn của nước trong tự nhiên.').lastInsertRowid as number;
  const l4s = insertLesson.run(
    u4s,
    'Vòng tuần hoàn của nước và Sự sống của cây xanh',
    'Giải thích được quá trình bay hơi, ngưng tụ tạo mây, mưa và vai trò của rễ, thân, lá cây.',
    'Dưới ánh nắng mặt trời, nước từ sông, hồ bay hơi lên cao, gặp lạnh ngưng tụ thành mây và rơi xuống thành mưa. Cây xanh hút nước và muối khoáng qua rễ, dẫn qua thân lên lá để quang hợp.',
    '/src/assets/images/lesson_science_nature.webp',
    JSON.stringify(['Khi phơi quần áo ướt dưới nắng, nước chuyển từ thể lỏng sang thể hơi (bay hơi).', 'Lá cây cần ánh sáng mặt trời, khí các-bô-níc và nước để tạo ra chất dinh dưỡng.']),
    JSON.stringify({ question: 'Bộ phận nào của cây có nhiệm vụ chính hút nước và muối khoáng từ đất?', options: ['Lá cây', 'Rễ cây', 'Hoa'], answer: 'Rễ cây', hint: 'Bộ phận nằm dưới lòng đất và lan rộng như mạng lưới.' }),
    'Tiết kiệm nước sạch mỗi ngày chính là bảo vệ vòng tuần hoàn sự sống!',
    teacherId
  ).lastInsertRowid as number;

  // Grade 5 Math
  const u5m = insertUnit.run(5, 1, 1, 'Số thập phân và Tỉ số phần trăm', 1, 'Hiểu cấu tạo số thập phân và ứng dụng tỉ số phần trăm trong đời sống.').lastInsertRowid as number;
  insertLesson.run(
    u5m,
    'Khái niệm Số thập phân và Giá trị hàng',
    'Đọc, viết số thập phân và phân biệt phần nguyên với phần thập phân.',
    'Mỗi số thập phân gồm hai phần: phần nguyên và phần thập phân, ngăn cách bởi dấu phẩy. Ví dụ: 3,45 gồm 3 đơn vị, 4 phần mười và 5 phần trăm.',
    '/src/assets/images/lesson_math_fractions.webp',
    JSON.stringify(['25/100 mét = 0,25 mét.', '1,5 giờ nghĩa là 1 giờ và 5/10 giờ (tức 1 giờ 30 phút).']),
    JSON.stringify({ question: 'Trong số 14,72, chữ số 7 nằm ở hàng nào?', options: ['Hàng chục', 'Hàng phần mười', 'Hàng phần trăm'], answer: 'Hàng phần mười', hint: 'Chữ số đầu tiên ngay bên phải dấu phẩy là hàng phần mười.' }),
    'Viết dấu phẩy thẳng cột khi cộng hoặc trừ các số thập phân!',
    teacherId
  );

  // Grade 4 English
  const u4e = insertUnit.run(4, 4, 1, 'My Daily Routine & Hobbies', 1, 'Hỏi đáp về thời gian biểu và sở thích hàng ngày bằng Tiếng Anh.').lastInsertRowid as number;
  insertLesson.run(
    u4e,
    'Talking about Daily Activities & Time',
    'Biết hỏi giờ và kể hoạt động hàng ngày: get up, have breakfast, go to school.',
    'Để hỏi giờ: "What time is it?" - "It is six thirty." Để nói thói quen: "I get up at six o’clock."',
    '/src/assets/images/hero_learning_world.webp',
    JSON.stringify(['"What time do you go to school?" -> "I go to school at seven o’clock."', '"I like reading science books after school."']),
    JSON.stringify({ question: 'Chọn câu trả lời đúng cho "What time do you get up?"', options: ['I get up at six o’clock.', 'I am nine years old.', 'It is a blue pen.'], answer: 'I get up at six o’clock.', hint: 'Câu hỏi về thời gian ("What time") thường trả lời kèm "at + giờ".' }),
    'Luyện nói to trước gương 3 câu về buổi sáng của em nhé!',
    teacherId
  );

  // Learning Materials (Approved & Pending for Admin review)
  const insertMat = db.prepare(
    `INSERT INTO learning_materials (lesson_id, title, material_type, content, approval_status, author_id) VALUES (?, ?, ?, ?, ?, ?)`
  );
  insertMat.run(l4m, 'Sơ đồ tư duy Quy đồng Phân số bằng Hình vẽ', 'visual_guide', 'Bước 1: Vẽ hai thanh bằng nhau. Bước 2: Chia thanh 1 và thanh 2 thành số phần nhỏ bằng nhau sao cho mẫu chung chia hết cho cả hai mẫu.', 'approved', teacherId);
  insertMat.run(l4v, 'Phiếu luyện đặt câu Nhân hóa chủ đề Thiên nhiên', 'worksheet', 'Viết 3 câu văn miêu tả cơn mưa mùa hè sử dụng ít nhất 2 từ ngữ chỉ hoạt động của con người.', 'approved', teacherId);
  insertMat.run(l4s, 'Thí nghiệm mini: Hơi nước ngưng tụ trên nắp ấm', 'summary', 'Hướng dẫn quan sát hiện tượng ngưng tụ cùng bố mẹ với ly nước đá để hiểu cách mây tạo thành mưa.', 'pending', teacherId);

  // Exercises & Questions covering ALL 10 Game Types!
  const insertExercise = db.prepare(
    `INSERT INTO exercises (lesson_id, grade_id, subject_id, title, game_type, difficulty, xp_reward, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertQuestion = db.prepare(
    `INSERT INTO exercise_questions (exercise_id, question_type, prompt, options_json, correct_answer, explanation, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  // 1. Quiz (Grade 4 Math)
  const exQuiz = insertExercise.run(l4m, 4, 1, 'Trắc nghiệm: Khám phá Phân số Lớp 4', 'quiz', 'medium', 40, teacherId).lastInsertRowid as number;
  insertQuestion.run(exQuiz, 'quiz', 'Chiếc bánh chia làm 8 phần bằng nhau, An ăn 3 phần. Phân số chỉ số phần bánh An đã ăn là:', JSON.stringify(['3/8', '8/3', '5/8', '3/5']), '3/8', 'Mẫu số là tổng số phần bằng nhau (8), tử số là số phần đã lấy (3).', 1);
  insertQuestion.run(exQuiz, 'quiz', 'Phân số nào dưới đây bằng phân số 1/2?', JSON.stringify(['2/3', '3/6', '4/6', '2/5']), '3/6', 'Nhân cả tử và mẫu của 1/2 với 3 ta được 3/6.', 2);

  // 2. Matching (Grade 4 Math/Science)
  const exMatch = insertExercise.run(l4m, 4, 1, 'Nối cặp: Phân số tương đương', 'matching', 'medium', 35, teacherId).lastInsertRowid as number;
  insertQuestion.run(
    exMatch,
    'matching',
    'Ghép mỗi phân số ở cột trái với phân số bằng nó ở cột phải:',
    JSON.stringify([
      { left: '1/2', right: '2/4' },
      { left: '1/3', right: '2/6' },
      { left: '3/4', right: '6/8' },
      { left: '2/5', right: '4/10' },
    ]),
    JSON.stringify({ '1/2': '2/4', '1/3': '2/6', '3/4': '6/8', '2/5': '4/10' }),
    'Nhân cả tử số và mẫu số với 2 để tìm phân số bằng nhau tương ứng.',
    1
  );

  // 3. Drag & Drop (Grade 4 Science)
  const exDrag = insertExercise.run(l4s, 4, 3, 'Kéo thả: Phân loại Quá trình Tự nhiên', 'drag_drop', 'medium', 35, teacherId).lastInsertRowid as number;
  insertQuestion.run(
    exDrag,
    'drag_drop',
    'Sắp xếp các bước đúng theo thứ tự của Vòng tuần hoàn Nước:',
    JSON.stringify(['Nước mưa rơi xuống sông hồ', 'Ánh nắng làm nước bay hơi', 'Hơi nước gặp lạnh tạo thành mây', 'Mây nặng dần rơi thành mưa']),
    JSON.stringify(['Ánh nắng làm nước bay hơi', 'Hơi nước gặp lạnh tạo thành mây', 'Mây nặng dần rơi thành mưa', 'Nước mưa rơi xuống sông hồ']),
    'Nước bay hơi nhờ mặt trời -> ngưng tụ thành mây -> mưa rơi xuống -> chảy về sông hồ.',
    1
  );

  // 4. Fill in the Blank (Grade 4 Vietnamese)
  const exFill = insertExercise.run(l4v, 4, 2, 'Điền từ: Biện pháp Nhân hóa', 'fill_blank', 'easy', 30, teacherId).lastInsertRowid as number;
  insertQuestion.run(
    exFill,
    'fill_blank',
    'Điền từ thích hợp để nhân hóa cảnh vật: "Sáng sớm, ____ mặt trời thức dậy mỉm cười với đàn chim."',
    JSON.stringify(['Ông', 'Cái', 'Chiếc']),
    'Ông',
    'Dùng danh từ xưng hô như người ("Ông") giúp câu văn gần gũi, sinh động.',
    1
  );
  insertQuestion.run(
    exFill,
    'fill_blank',
    'Điền động từ nhân hóa phù hợp: "Hàng tre xanh ____ theo điệu sáo chiều."',
    JSON.stringify(['nhảy múa', 'đứng yên', 'nằm ngang']),
    'nhảy múa',
    '"Nhảy múa" là hoạt động của con người được gán cho hàng tre.',
    2
  );

  // 5. Word Puzzle (Grade 4 English)
  const exWord = insertExercise.run(null, 4, 4, 'Ghép chữ Tiếng Anh: Hoạt động học tập', 'word_puzzle', 'easy', 30, teacherId).lastInsertRowid as number;
  insertQuestion.run(
    exWord,
    'word_puzzle',
    'Sắp xếp các chữ cái thành từ Tiếng Anh có nghĩa là "KHOA HỌC":',
    JSON.stringify(['C', 'S', 'E', 'I', 'C', 'N', 'E']),
    'SCIENCE',
    'SCIENCE (S-C-I-E-N-C-E) nghĩa là môn Khoa học.',
    1
  );

  // 6. Math Challenge (Grade 1-5 adaptable, Grade 4)
  const exMath = insertExercise.run(l4m, 4, 1, 'Thử thách Toán học: Tính nhẩm thông minh', 'math_challenge', 'hard', 50, teacherId).lastInsertRowid as number;
  insertQuestion.run(exMath, 'math_challenge', 'Tính nhanh giá trị biểu thức: 25 × 7 × 4 = ?', JSON.stringify([]), '700', 'Nhóm 25 × 4 = 100, sau đó 100 × 7 = 700.', 1);
  insertQuestion.run(exMath, 'math_challenge', 'Một hình chữ nhật có chiều dài 12 cm, chiều rộng 8 cm. Chu vi bằng bao nhiêu cm?', JSON.stringify([]), '40', 'Chu vi = (12 + 8) × 2 = 40 cm.', 2);

  // 7. Picture Recognition (Grade 4 Science)
  const exPic = insertExercise.run(l4s, 4, 3, 'Nhận diện Hình ảnh: Khám phá Cây xanh', 'picture_recognition', 'easy', 30, teacherId).lastInsertRowid as number;
  insertQuestion.run(
    exPic,
    'picture_recognition',
    'Quan sát bức tranh sơ đồ cây xanh và kính lúp: Mũi tên xanh đi lên từ rễ lên lá thể hiện điều gì?',
    JSON.stringify({ imageUrl: '/src/assets/images/lesson_science_nature.webp', choices: ['Nước và khoáng chất được rễ hút đưa lên nuôi cây', 'Cây đang rụng lá vào mùa đông', 'Ánh sáng đi xuống lòng đất'] }),
    'Nước và khoáng chất được rễ hút đưa lên nuôi cây',
    'Rễ cây hút nước từ đất và vận chuyển qua mạch gỗ trong thân lên lá.',
    1
  );

  // 8. Memory Game (Grade 4 English/Vietnamese)
  const exMem = insertExercise.run(null, 4, 4, 'Trò chơi Trí nhớ: Lật thẻ Anh - Việt', 'memory', 'medium', 40, teacherId).lastInsertRowid as number;
  insertQuestion.run(
    exMem,
    'memory',
    'Tìm các cặp thẻ Từ vựng Tiếng Anh và Nghĩa Tiếng Việt trùng khớp:',
    JSON.stringify([
      { id: 'p1', a: 'Library', b: 'Thư viện' },
      { id: 'p2', a: 'Compass', b: 'La bàn' },
      { id: 'p3', a: 'Notebook', b: 'Quyển vở' },
      { id: 'p4', a: 'Curious', b: 'Tò mò khám phá' },
    ]),
    '4_pairs',
    'Ghi nhớ vị trí từng cặp từ giúp em nhớ từ vựng lâu hơn!',
    1
  );

  // 9. True or False (Grade 1-4)
  const exTF = insertExercise.run(l1m, 1, 1, 'Đúng hay Sai: Tư duy Toán học', 'true_false', 'easy', 25, teacherId).lastInsertRowid as number;
  insertQuestion.run(exTF, 'true_false', 'Phân số 2/4 có giá trị bằng một nửa chiếc bánh (1/2). Đúng hay Sai?', JSON.stringify(['Đúng', 'Sai']), 'Đúng', 'Chia 4 phần lấy 2 phần chính là lấy một nửa chiếc bánh.', 1);
  insertQuestion.run(exTF, 'true_false', 'Số 0 có thể làm mẫu số của một phân số. Đúng hay Sai?', JSON.stringify(['Đúng', 'Sai']), 'Sai', 'Không thể chia một chiếc bánh thành 0 phần bằng nhau, nên mẫu số luôn khác 0.', 2);

  // 10. Interactive Story (Grade 4 Ethics/Vietnamese)
  const exStory = insertExercise.run(l4v, 4, 5, 'Truyện Tương tác: Bí ẩn Khu vườn Tri thức', 'interactive_story', 'medium', 45, teacherId).lastInsertRowid as number;
  insertQuestion.run(
    exStory,
    'interactive_story',
    'Trên đường đi học, Minh Anh thấy một bạn lớp 1 làm rơi tập vở xuống vũng nước nhỏ. Em sẽ chọn cách xử lý nào?',
    JSON.stringify([
      { text: 'Chạy tới nhặt giúp em nhỏ, lau khô bìa vở rồi hỏi xem em có cần giúp đỡ không.', isBest: true, feedback: 'Tuyệt vời! Sự giúp đỡ kịp thời và ân cần giúp em nhỏ bớt lo lắng.' },
      { text: 'Đứng nhìn vì sợ mình bị muộn giờ vào lớp.', isBest: false, feedback: 'Chúng ta chỉ mất khoảng 30 giây để giúp bạn thôi, lòng tốt luôn đáng quý hơn sự vội vàng!' },
      { text: 'Cười bạn vì làm rơi đồ.', isBest: false, feedback: 'Khi bạn gặp khó khăn, lời động viên và giúp đỡ sẽ tốt hơn nhiều.' }
    ]),
    'Chạy tới nhặt giúp em nhỏ, lau khô bìa vở rồi hỏi xem em có cần giúp đỡ không.',
    'Lòng nhân ái và sẵn sàng giúp đỡ người nhỏ tuổi hơn là phẩm chất đáng quý của học sinh tiểu học.',
    1
  );

  // Achievements
  const insertAch = db.prepare(
    `INSERT INTO achievements (code, title, description, category, xp_threshold, badge_icon, color_token) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const ach1 = insertAch.run('first_spark', 'Tia sáng Tò mò', 'Hoàn thành buổi trò chuyện khám phá đầu tiên cùng SOCO.', 'curiosity', 50, 'Sparkles', 'yellow').lastInsertRowid as number;
  const ach2 = insertAch.run('persistent_thinker', 'Nhà Tư duy Kiên trì', 'Tự tìm ra lời giải qua câu hỏi gợi mở mà không bỏ cuộc.', 'persistence', 150, 'Compass', 'sky').lastInsertRowid as number;
  const ach3 = insertAch.run('knowledge_explorer', 'Nhà Thám hiểm Kiến thức', 'Hoàn thành bài học và trò chơi luyện tập trong Kho Tri thức.', 'learning', 300, 'BookOpen', 'mint').lastInsertRowid as number;
  insertAch.run('careful_observer', 'Đôi mắt Tinh anh', 'Kiểm tra và chỉnh sửa cẩn thận đề bài sau khi quét ảnh.', 'carefulness', 450, 'ScanSearch', 'lavender');
  insertAch.run('streak_champion', 'Ngọn lửa Bền bỉ', 'Duy trì thói quen học tập đều đặn nhiều ngày liên tiếp.', 'habit', 600, 'Flame', 'coral');

  db.prepare(`INSERT INTO student_achievements (student_id, achievement_id) VALUES (?, ?)`).run(studentId, ach1);
  db.prepare(`INSERT INTO student_achievements (student_id, achievement_id) VALUES (?, ?)`).run(studentId, ach2);
  db.prepare(`INSERT INTO student_achievements (student_id, achievement_id) VALUES (?, ?)`).run(studentId, ach3);

  // Missions
  const insertMission = db.prepare(
    `INSERT INTO missions (title, description, mission_type, target_action, target_count, xp_reward) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const m1 = insertMission.run('Hỏi SOCO 1 điều em tò mò', 'Mở gia sư SOCO và trao đổi ít nhất 1 lượt suy nghĩ.', 'daily', 'tutor_turn', 1, 30).lastInsertRowid as number;
  const m2 = insertMission.run('Chinh phục 1 trò chơi Play & Learn', 'Hoàn thành một trò chơi luyện tập bất kỳ.', 'daily', 'play_game', 1, 35).lastInsertRowid as number;
  const m3 = insertMission.run('Đọc trọn vẹn 1 bài trong Kho Tri thức', 'Khám phá kiến thức mới và làm câu hỏi kiểm tra.', 'weekly', 'complete_lesson', 2, 80).lastInsertRowid as number;

  db.prepare(`INSERT INTO mission_progress (student_id, mission_id, current_count, completed, period_key) VALUES (?, ?, ?, ?, ?)`).run(studentId, m1, 1, 1, todayStr);
  db.prepare(`INSERT INTO mission_progress (student_id, mission_id, current_count, completed, period_key) VALUES (?, ?, ?, ?, ?)`).run(studentId, m2, 0, 0, todayStr);
  db.prepare(`INSERT INTO mission_progress (student_id, mission_id, current_count, completed, period_key) VALUES (?, ?, ?, ?, ?)`).run(studentId, m3, 1, 0, 'week-current');

  // Teacher Assignments
  const assign1 = db.prepare(
    `INSERT INTO teacher_assignments (class_id, teacher_id, subject_id, title, instructions, due_date, exercise_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(classId, teacherId, 1, 'Ôn tập Phân số bằng nhau', 'Các con hoàn thành trò chơi Trắc nghiệm Phân số và hỏi SOCO nếu gặp câu khó nhé!', '2026-11-22', exQuiz).lastInsertRowid as number;

  db.prepare(
    `INSERT INTO assignment_submissions (assignment_id, student_id, answer_summary, score, status) VALUES (?, ?, ?, ?, 'assigned')`
  ).run(assign1, studentId, null, null);

  // Initial Skill Mastery, Mistakes, Progress & Tutoring Session for realistic analytics
  db.prepare(
    `INSERT INTO skill_mastery (student_id, subject_id, grade_id, topic_name, mastery_score, confidence_level, correct_count, attempt_count, ai_help_level)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(studentId, 1, 4, 'Khái niệm phân số cơ bản', 82, 'mastered', 9, 11, 'minimal');
  db.prepare(
    `INSERT INTO skill_mastery (student_id, subject_id, grade_id, topic_name, mastery_score, confidence_level, correct_count, attempt_count, ai_help_level)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(studentId, 1, 4, 'Quy đồng và cộng phân số khác mẫu', 58, 'developing', 4, 7, 'moderate');
  db.prepare(
    `INSERT INTO skill_mastery (student_id, subject_id, grade_id, topic_name, mastery_score, confidence_level, correct_count, attempt_count, ai_help_level)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(studentId, 2, 4, 'Biện pháp nhân hóa và so sánh', 76, 'developing', 6, 8, 'minimal');
  db.prepare(
    `INSERT INTO skill_mastery (student_id, subject_id, grade_id, topic_name, mastery_score, confidence_level, correct_count, attempt_count, ai_help_level)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(studentId, 3, 4, 'Vòng tuần hoàn của nước', 88, 'mastered', 7, 8, 'minimal');

  db.prepare(
    `INSERT INTO learning_mistakes (student_id, subject_id, topic_name, mistake_type, description, frequency, resolved)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(studentId, 1, 'Quy đồng và cộng phân số khác mẫu', 'Cộng thẳng tử và mẫu', 'Khi tính 1/2 + 1/3 có xu hướng cộng 1+1 và 2+3 thành 2/5 thay vì quy đồng mẫu số.', 2, 0);

  db.prepare(
    `INSERT INTO learning_progress (student_id, lesson_id, status, time_spent_seconds, score, attempts) VALUES (?, ?, 'completed', 540, 90, 1)`
  ).run(studentId, l4v);
  db.prepare(
    `INSERT INTO learning_progress (student_id, lesson_id, status, time_spent_seconds, score, attempts) VALUES (?, ?, 'completed', 480, 95, 1)`
  ).run(studentId, l4s);

  const sessId = db.prepare(
    `INSERT INTO tutoring_sessions (student_id, grade_id, subject_id, mode, topic, difficulty, learning_objective, prerequisite_skills, source_type, extracted_problem_text, status)
     VALUES (?, ?, ?, 'socratic', 'Cộng phân số khác mẫu số', 'medium', 'Hiểu bản chất quy đồng trước khi cộng hai phân số', 'Khái niệm tử số, mẫu số và phân số bằng nhau', 'text', 'Tính 1/2 + 1/3', 'active')`
  ).run(studentId, 4, 1).lastInsertRowid as number;

  db.prepare(
    `INSERT INTO tutoring_messages (session_id, sender, content, pedagogical_meta_json, hint_level) VALUES (?, 'student', ?, NULL, 0)`
  ).run(sessId, 'SOCO ơi, bài 1/2 + 1/3 có phải bằng 2/5 không ạ?');
  db.prepare(
    `INSERT INTO tutoring_messages (session_id, sender, content, pedagogical_meta_json, hint_level) VALUES (?, 'soco', ?, ?, 0)`
  ).run(
    sessId,
    'Chào Minh Anh! SOCO rất khen em đã mạnh dạn đưa ra suy nghĩ của mình. Trước khi kiểm tra đáp án nhé, em hãy tưởng tượng có hai chiếc bánh pizza bằng nhau: một chiếc cắt làm 2 phần, một chiếc cắt làm 3 phần. Theo em, một miếng của chiếc bánh cắt đôi (1/2) và một miếng của chiếc bánh cắt ba (1/3) có kích thước bằng nhau không?',
    JSON.stringify({
      questionGoal: 'Giúp học sinh nhận ra các phần chưa có cùng kích thước nên chưa thể cộng trực tiếp',
      testedSkill: 'So sánh trực quan kích thước phần của phân số khác mẫu',
      understandingLevel: 2,
      detectedMistake: 'Cộng trực tiếp tử với tử, mẫu với mẫu',
      mistakeCategory: 'Cộng thẳng tử và mẫu',
      nextStepHint: 'Hướng tới việc chia lại các miếng bánh thành phần bằng nhau (mẫu chung 6)'
    })
  );

  // System Settings for Admin
  const insertSetting = db.prepare('INSERT INTO system_settings (key, value, description) VALUES (?, ?, ?)');
  insertSetting.run('daily_ai_limit_per_student', '40', 'Số lượt tương tác AI tối đa mỗi ngày cho mỗi tài khoản học sinh để đảm bảo học tập lành mạnh.');
  insertSetting.run('safety_filter_enabled', 'true', 'Bật kiểm duyệt an toàn nội dung giáo dục và hình ảnh tải lên cho trẻ em.');
  insertSetting.run('socratic_strictness', 'high', 'Mức độ giữ nguyên tắc Socratic: không đưa đáp án trực tiếp khi học sinh hỏi bài.');
  insertSetting.run('conversation_retention_days', '90', 'Số ngày lưu trữ tối đa cho lịch sử hội thoại gia sư AI trước khi tự động xóa theo chính sách dữ liệu trẻ em.');

  // Seed 100 GDPT 2018 Toán & Tiếng Việt lessons across Grades 1–5 + calibrated games
  seedGdpt2018Curriculum(db, teacherId);
  cleanupExpiredConversations();
}

initDatabase();
seedDatabase();
