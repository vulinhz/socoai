import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from './db.ts';
import {
  authenticate,
  AuthRequest,
  awardStudentXpAndMissions,
  requireRole,
  signToken,
  UserRole,
} from './auth.ts';
import {
  generateParentCompanionAdvice,
  generateSocraticTurn,
  generateTeacherClassInsights,
  scanProblemImage,
} from './ai.ts';

export const apiRouter = Router();

function getSetting(key: string, fallback: string): string {
  const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : fallback;
}

function getFullUserPayload(userId: number) {
  const user = db
    .prepare(
      `SELECT id, username, email, display_name, role, avatar_url, is_verified, parental_consent_status, status, created_at
       FROM users WHERE id = ?`
    )
    .get(userId) as Record<string, unknown> | undefined;

  if (!user) return null;

  let roleProfile: Record<string, unknown> | null = null;
  if (user.role === 'student') {
    roleProfile = db
      .prepare(
        `SELECT sp.*, g.level as grade_level, g.name as grade_name
         FROM student_profiles sp
         JOIN grades g ON sp.grade_id = g.id
         WHERE sp.user_id = ?`
      )
      .get(userId) as Record<string, unknown> | null;
  } else if (user.role === 'teacher') {
    roleProfile = db.prepare('SELECT * FROM teacher_profiles WHERE user_id = ?').get(userId) as Record<string, unknown> | null;
  } else if (user.role === 'parent') {
    roleProfile = db.prepare('SELECT * FROM parent_profiles WHERE user_id = ?').get(userId) as Record<string, unknown> | null;
  }

  return { ...user, profile: roleProfile };
}

// ==================== AUTH ROUTES ====================

apiRouter.post('/auth/register', (req, res) => {
  try {
    const { username, password, displayName, role, gradeLevel, email, schoolName, relationshipLabel } = req.body || {};

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return res.status(400).json({ error: 'Tên tài khoản cần có ít nhất 3 ký tự.' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu cần có ít nhất 6 ký tự.' });
    }
    if (!displayName || typeof displayName !== 'string' || displayName.trim().length < 2) {
      return res.status(400).json({ error: 'Vui lòng nhập tên hiển thị.' });
    }

    const validRoles: UserRole[] = ['student', 'teacher', 'parent'];
    const targetRole: UserRole = validRoles.includes(role) ? role : 'student';

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername.length < 3) {
      return res.status(400).json({ error: 'Tên tài khoản chỉ gồm chữ cái không dấu, số và dấu gạch dưới (_).' });
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
    if (existingUser) {
      return res.status(409).json({ error: 'Tên tài khoản này đã được sử dụng. Hãy chọn tên khác nhé!' });
    }

    const cleanEmail = email && typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
    if (cleanEmail) {
      const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
      if (existingEmail) {
        return res.status(409).json({ error: 'Email này đã được đăng ký.' });
      }
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    const parentalConsentStatus = targetRole === 'student' ? 'pending' : 'not_required';

    const userId = db
      .prepare(
        `INSERT INTO users (username, email, password_hash, display_name, role, is_verified, verification_code, parental_consent_status, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`
      )
      .run(
        cleanUsername,
        cleanEmail,
        passwordHash,
        displayName.trim(),
        targetRole,
        targetRole === 'student' ? 1 : 0,
        verificationCode,
        parentalConsentStatus
      ).lastInsertRowid as number;

    if (targetRole === 'student') {
      const level = Math.min(5, Math.max(1, Number(gradeLevel) || 4));
      const gradeRow = db.prepare('SELECT id FROM grades WHERE level = ?').get(level) as { id: number };
      const linkCode = 'LINK-' + crypto.randomBytes(3).toString('hex').toUpperCase();
      db.prepare(
        `INSERT INTO student_profiles (user_id, grade_id, xp, level, streak_days, last_active_date, link_code)
         VALUES (?, ?, 50, 1, 1, ?, ?)`
      ).run(userId, gradeRow.id, new Date().toISOString().slice(0, 10), linkCode);
    } else if (targetRole === 'teacher') {
      db.prepare(`INSERT INTO teacher_profiles (user_id, school_name) VALUES (?, ?)`).run(
        userId,
        (schoolName && String(schoolName).trim()) || 'Trường Tiểu học'
      );
    } else if (targetRole === 'parent') {
      db.prepare(`INSERT INTO parent_profiles (user_id, relationship_label) VALUES (?, ?)`).run(
        userId,
        (relationshipLabel && String(relationshipLabel).trim()) || 'Phụ huynh'
      );
    }

    const user = getFullUserPayload(userId);
    const token = signToken({
      id: userId,
      username: cleanUsername,
      role: targetRole,
      displayName: displayName.trim(),
    });

    res.status(201).json({
      token,
      user,
      verificationHint: targetRole !== 'student' ? verificationCode : undefined,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Không thể tạo tài khoản lúc này. Vui lòng thử lại.' });
  }
});

apiRouter.post('/auth/login', (req, res) => {
  try {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập tên tài khoản (hoặc email) và mật khẩu.' });
    }
    const cleanId = String(identifier).trim().toLowerCase();
    const userRow = db
      .prepare('SELECT id, username, password_hash, display_name, role, status FROM users WHERE username = ? OR email = ?')
      .get(cleanId, cleanId) as
      | { id: number; username: string; password_hash: string; display_name: string; role: UserRole; status: string }
      | undefined;

    if (!userRow || !bcrypt.compareSync(String(password), userRow.password_hash)) {
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu chưa đúng.' });
    }
    if (userRow.status === 'suspended') {
      return res.status(403).json({ error: 'Tài khoản này hiện đang tạm khóa. Vui lòng liên hệ quản trị viên.' });
    }

    const token = signToken({
      id: userRow.id,
      username: userRow.username,
      role: userRow.role,
      displayName: userRow.display_name,
    });
    const user = getFullUserPayload(userRow.id);
    res.json({ token, user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Đăng nhập thất bại. Vui lòng thử lại.' });
  }
});

apiRouter.get('/auth/me', authenticate, (req: AuthRequest, res: Response) => {
  const user = getFullUserPayload(req.user!.id);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
  res.json({ user });
});

apiRouter.post('/auth/verify', authenticate, (req: AuthRequest, res: Response) => {
  const { code } = req.body || {};
  const row = db.prepare('SELECT verification_code FROM users WHERE id = ?').get(req.user!.id) as { verification_code: string | null } | undefined;
  if (!row || (row.verification_code && row.verification_code !== String(code).trim())) {
    return res.status(400).json({ error: 'Mã xác minh chưa chính xác.' });
  }
  db.prepare(`UPDATE users SET is_verified = 1, verification_code = NULL, updated_at = datetime('now') WHERE id = ?`).run(req.user!.id);
  res.json({ user: getFullUserPayload(req.user!.id), message: 'Tài khoản đã được xác minh thành công!' });
});

apiRouter.post('/auth/forgot-password', (req, res) => {
  const { identifier } = req.body || {};
  if (!identifier) return res.status(400).json({ error: 'Vui lòng nhập tên tài khoản hoặc email.' });
  const cleanId = String(identifier).trim().toLowerCase();
  const row = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(cleanId, cleanId) as { id: number } | undefined;
  if (!row) {
    return res.status(404).json({ error: 'Không tìm thấy tài khoản phù hợp.' });
  }
  const resetToken = crypto.randomBytes(3).toString('hex').toUpperCase();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  db.prepare(`UPDATE users SET reset_token = ?, reset_expires_at = ?, updated_at = datetime('now') WHERE id = ?`).run(
    resetToken,
    expiresAt,
    row.id
  );
  res.json({
    message: 'Mã khôi phục mật khẩu đã được tạo (hiệu lực 30 phút).',
    resetTokenPreview: resetToken,
  });
});

apiRouter.post('/auth/reset-password', (req, res) => {
  const { identifier, resetToken, newPassword } = req.body || {};
  if (!identifier || !resetToken || !newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ mã khôi phục và mật khẩu mới (ít nhất 6 ký tự).' });
  }
  const cleanId = String(identifier).trim().toLowerCase();
  const row = db
    .prepare('SELECT id, reset_token, reset_expires_at FROM users WHERE username = ? OR email = ?')
    .get(cleanId, cleanId) as { id: number; reset_token: string | null; reset_expires_at: string | null } | undefined;

  if (!row || !row.reset_token || row.reset_token !== String(resetToken).trim().toUpperCase()) {
    return res.status(400).json({ error: 'Mã khôi phục không hợp lệ.' });
  }
  if (row.reset_expires_at && new Date(row.reset_expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: 'Mã khôi phục đã hết hạn.' });
  }
  const hash = bcrypt.hashSync(String(newPassword), 10);
  db.prepare(`UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires_at = NULL, updated_at = datetime('now') WHERE id = ?`).run(
    hash,
    row.id
  );
  res.json({ message: 'Đổi mật khẩu thành công! Em có thể đăng nhập ngay.' });
});

apiRouter.patch('/auth/profile', authenticate, (req: AuthRequest, res: Response) => {
  const { displayName, gradeLevel, dailyGoalMinutes, avatarUrl } = req.body || {};
  if (displayName && String(displayName).trim().length >= 2) {
    db.prepare(`UPDATE users SET display_name = ?, updated_at = datetime('now') WHERE id = ?`).run(
      String(displayName).trim(),
      req.user!.id
    );
  }
  if (avatarUrl !== undefined) {
    db.prepare(`UPDATE users SET avatar_url = ?, updated_at = datetime('now') WHERE id = ?`).run(avatarUrl, req.user!.id);
  }
  if (req.user!.role === 'student') {
    if (gradeLevel) {
      const lvl = Math.min(5, Math.max(1, Number(gradeLevel)));
      const gradeRow = db.prepare('SELECT id FROM grades WHERE level = ?').get(lvl) as { id: number } | undefined;
      if (gradeRow) {
        db.prepare(`UPDATE student_profiles SET grade_id = ?, updated_at = datetime('now') WHERE user_id = ?`).run(
          gradeRow.id,
          req.user!.id
        );
      }
    }
    if (dailyGoalMinutes) {
      db.prepare(`UPDATE student_profiles SET daily_goal_minutes = ?, updated_at = datetime('now') WHERE user_id = ?`).run(
        Math.min(120, Math.max(10, Number(dailyGoalMinutes))),
        req.user!.id
      );
    }
  }
  res.json({ user: getFullUserPayload(req.user!.id) });
});

// ==================== CURRICULUM & KNOWLEDGE WORLD ====================

apiRouter.get('/curriculum/meta', (_req, res) => {
  const grades = db.prepare('SELECT * FROM grades ORDER BY level ASC').all();
  const subjects = db.prepare('SELECT * FROM subjects ORDER BY id ASC').all();
  res.json({ grades, subjects });
});

apiRouter.get('/curriculum/lessons', authenticate, (req: AuthRequest, res: Response) => {
  const gradeLevel = req.query.gradeLevel ? Number(req.query.gradeLevel) : null;
  const subjectId = req.query.subjectId ? Number(req.query.subjectId) : null;
  const semester = req.query.semester ? Number(req.query.semester) : null;
  const search = req.query.search ? String(req.query.search).trim().toLowerCase() : '';

  let sql = `
    SELECT l.*, cu.title as unit_title, cu.semester, cu.grade_id, cu.subject_id,
           g.level as grade_level, g.name as grade_name,
           s.name as subject_name, s.code as subject_code, s.color_token, s.icon_name
    FROM lessons l
    JOIN curriculum_units cu ON l.unit_id = cu.id
    JOIN grades g ON cu.grade_id = g.id
    JOIN subjects s ON cu.subject_id = s.id
    WHERE (l.status = 'published' OR l.created_by = ?)
  `;
  const params: unknown[] = [req.user!.id];

  if (gradeLevel) {
    sql += ' AND g.level = ?';
    params.push(gradeLevel);
  }
  if (subjectId) {
    sql += ' AND cu.subject_id = ?';
    params.push(subjectId);
  }
  if (semester) {
    sql += ' AND cu.semester = ?';
    params.push(semester);
  }
  if (search) {
    sql += ' AND (LOWER(l.title) LIKE ? OR LOWER(l.core_knowledge) LIKE ? OR LOWER(cu.title) LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY g.level ASC, cu.semester ASC, cu.order_index ASC, l.id ASC';

  const lessons = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;

  const progressRows = db
    .prepare('SELECT lesson_id, status, score, time_spent_seconds FROM learning_progress WHERE student_id = ? AND lesson_id IS NOT NULL')
    .all(req.user!.id) as Array<{ lesson_id: number; status: string; score: number; time_spent_seconds: number }>;
  const progressMap = new Map(progressRows.map((p) => [p.lesson_id, p]));

  const materials = db
    .prepare(`SELECT * FROM learning_materials WHERE approval_status = 'approved'`)
    .all() as Array<Record<string, unknown>>;

  const enriched = lessons.map((l) => ({
    ...l,
    examples: JSON.parse(String(l.examples_json || '[]')),
    interactiveCheck: JSON.parse(String(l.interactive_check_json || '{}')),
    progress: progressMap.get(Number(l.id)) || null,
    materials: materials.filter((m) => m.lesson_id === l.id),
  }));

  res.json({ lessons: enriched });
});

apiRouter.post('/curriculum/lessons/:id/complete', authenticate, requireRole('student', 'admin'), (req: AuthRequest, res: Response) => {
  const lessonId = Number(req.params.id);
  const { score = 100, timeSpentSeconds = 180 } = req.body || {};

  const lesson = db
    .prepare(
      `SELECT l.id, l.title, cu.subject_id, cu.grade_id
       FROM lessons l JOIN curriculum_units cu ON l.unit_id = cu.id
       WHERE l.id = ?`
    )
    .get(lessonId) as { id: number; title: string; subject_id: number; grade_id: number } | undefined;

  if (!lesson) return res.status(404).json({ error: 'Không tìm thấy bài học.' });

  const existing = db
    .prepare('SELECT id, attempts, time_spent_seconds FROM learning_progress WHERE student_id = ? AND lesson_id = ?')
    .get(req.user!.id, lessonId) as { id: number; attempts: number; time_spent_seconds: number } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE learning_progress
       SET status = 'completed', score = MAX(score, ?), time_spent_seconds = time_spent_seconds + ?, attempts = attempts + 1, last_accessed_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`
    ).run(Number(score), Number(timeSpentSeconds), existing.id);
  } else {
    db.prepare(
      `INSERT INTO learning_progress (student_id, lesson_id, status, time_spent_seconds, score, attempts)
       VALUES (?, ?, 'completed', ?, ?, 1)`
    ).run(req.user!.id, lessonId, Number(timeSpentSeconds), Number(score));
  }

  // Upsert skill_mastery
  const masteryDelta = Number(score) >= 80 ? 80 : 60;
  db.prepare(
    `INSERT INTO skill_mastery (student_id, subject_id, grade_id, topic_name, mastery_score, confidence_level, correct_count, attempt_count, ai_help_level)
     VALUES (?, ?, ?, ?, ?, ?, 1, 1, 'minimal')
     ON CONFLICT(student_id, subject_id, topic_name) DO UPDATE SET
       mastery_score = MIN(100, ROUND((mastery_score + excluded.mastery_score) / 2.0)),
       confidence_level = CASE WHEN MIN(100, ROUND((mastery_score + excluded.mastery_score) / 2.0)) >= 80 THEN 'mastered' WHEN MIN(100, ROUND((mastery_score + excluded.mastery_score) / 2.0)) >= 55 THEN 'developing' ELSE 'needs_review' END,
       correct_count = correct_count + 1,
       attempt_count = attempt_count + 1,
       updated_at = datetime('now')`
  ).run(req.user!.id, lesson.subject_id, lesson.grade_id, lesson.title, masteryDelta, masteryDelta >= 80 ? 'mastered' : 'developing');

  awardStudentXpAndMissions(req.user!.id, 30, 'complete_lesson');

  res.json({ message: 'Hoàn thành bài học! Em vừa nhận thêm 30 XP.', user: getFullUserPayload(req.user!.id) });
});

// ==================== STUDENT DASHBOARD & ANALYTICS ====================

apiRouter.get('/student/dashboard', authenticate, requireRole('student', 'admin'), (req: AuthRequest, res: Response) => {
  const user = getFullUserPayload(req.user!.id);
  const subjects = db.prepare('SELECT * FROM subjects ORDER BY id ASC').all();
  const today = new Date().toISOString().slice(0, 10);

  const missions = db
    .prepare(
      `SELECT m.*, COALESCE(mp.current_count, 0) as current_count, COALESCE(mp.completed, 0) as completed
       FROM missions m
       LEFT JOIN mission_progress mp ON mp.mission_id = m.id AND mp.student_id = ? AND (mp.period_key = ? OR mp.period_key = 'week-current')
       ORDER BY m.mission_type ASC, m.id ASC`
    )
    .all(req.user!.id, today);

  const sessions = db
    .prepare(
      `SELECT ts.*, s.name as subject_name, s.color_token, g.level as grade_level
       FROM tutoring_sessions ts
       JOIN subjects s ON ts.subject_id = s.id
       JOIN grades g ON ts.grade_id = g.id
       WHERE ts.student_id = ?
       ORDER BY ts.updated_at DESC
       LIMIT 6`
    )
    .all(req.user!.id);

  const achievements = db
    .prepare(
      `SELECT a.*, sa.earned_at
       FROM achievements a
       LEFT JOIN student_achievements sa ON sa.achievement_id = a.id AND sa.student_id = ?
       ORDER BY sa.earned_at DESC NULLS LAST, a.xp_threshold ASC`
    )
    .all(req.user!.id);

  const assignments = db
    .prepare(
      `SELECT ta.*, c.name as class_name, s.name as subject_name, asub.status as submission_status, asub.score, asub.teacher_feedback
       FROM assignment_submissions asub
       JOIN teacher_assignments ta ON asub.assignment_id = ta.id
       JOIN classes c ON ta.class_id = c.id
       JOIN subjects s ON ta.subject_id = s.id
       WHERE asub.student_id = ?
       ORDER BY ta.due_date ASC`
    )
    .all(req.user!.id);

  const stats = db
    .prepare(
      `SELECT
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
         COALESCE(SUM(time_spent_seconds), 0) as total_seconds,
         COALESCE(ROUND(AVG(CASE WHEN score > 0 THEN score END)), 0) as avg_score
       FROM learning_progress WHERE student_id = ?`
    )
    .get(req.user!.id);

  const classes = db
    .prepare(
      `SELECT c.id, c.name, c.join_code, u.display_name as teacher_name
       FROM class_members cm
       JOIN classes c ON cm.class_id = c.id
       JOIN users u ON c.teacher_id = u.id
       WHERE cm.student_id = ?`
    )
    .all(req.user!.id);

  res.json({ user, subjects, missions, sessions, achievements, assignments, stats, classes });
});

apiRouter.post('/student/join-class', authenticate, requireRole('student'), (req: AuthRequest, res: Response) => {
  const { joinCode } = req.body || {};
  if (!joinCode) return res.status(400).json({ error: 'Vui lòng nhập mã lớp học.' });
  const cls = db.prepare('SELECT id, name FROM classes WHERE UPPER(join_code) = UPPER(?)').get(String(joinCode).trim()) as
    | { id: number; name: string }
    | undefined;
  if (!cls) return res.status(404).json({ error: 'Không tìm thấy lớp học với mã này.' });

  db.prepare(`INSERT OR IGNORE INTO class_members (class_id, student_id, status) VALUES (?, ?, 'active')`).run(cls.id, req.user!.id);

  // Also link any existing assignments of this class
  const assignments = db.prepare('SELECT id FROM teacher_assignments WHERE class_id = ?').all(cls.id) as Array<{ id: number }>;
  const insSub = db.prepare(`INSERT OR IGNORE INTO assignment_submissions (assignment_id, student_id, status) VALUES (?, ?, 'assigned')`);
  for (const a of assignments) insSub.run(a.id, req.user!.id);

  res.json({ message: `Em đã tham gia ${cls.name} thành công!` });
});

apiRouter.get('/student/analytics', authenticate, requireRole('student', 'admin'), (req: AuthRequest, res: Response) => {
  const mastery = db
    .prepare(
      `SELECT sm.*, s.name as subject_name, s.color_token
       FROM skill_mastery sm
       JOIN subjects s ON sm.subject_id = s.id
       WHERE sm.student_id = ?
       ORDER BY sm.mastery_score ASC`
    )
    .all(req.user!.id);

  const mistakes = db
    .prepare(
      `SELECT lm.*, s.name as subject_name
       FROM learning_mistakes lm
       JOIN subjects s ON lm.subject_id = s.id
       WHERE lm.student_id = ?
       ORDER BY lm.resolved ASC, lm.frequency DESC`
    )
    .all(req.user!.id);

  const progress = db
    .prepare(
      `SELECT lp.*, COALESCE(l.title, e.title) as item_title,
              CASE WHEN lp.lesson_id IS NOT NULL THEN 'lesson' ELSE 'exercise' END as item_type
       FROM learning_progress lp
       LEFT JOIN lessons l ON lp.lesson_id = l.id
       LEFT JOIN exercises e ON lp.exercise_id = e.id
       WHERE lp.student_id = ?
       ORDER BY lp.last_accessed_at DESC`
    )
    .all(req.user!.id);

  const aiCount = db
    .prepare('SELECT COUNT(*) as total_turns FROM ai_usage_logs WHERE user_id = ?')
    .get(req.user!.id) as { total_turns: number };

  res.json({ mastery, mistakes, progress, aiStats: aiCount });
});

apiRouter.post('/student/mistakes/:id/resolve', authenticate, requireRole('student'), (req: AuthRequest, res: Response) => {
  db.prepare(`UPDATE learning_mistakes SET resolved = 1, updated_at = datetime('now') WHERE id = ? AND student_id = ?`).run(
    Number(req.params.id),
    req.user!.id
  );
  res.json({ ok: true });
});

// ==================== AI IMAGE SCANNER & SOCRATIC TUTOR ====================

apiRouter.post('/ai/scan-problem', authenticate, async (req: AuthRequest, res: Response) => {
  const start = Date.now();
  try {
    const { imageData, mimeType, gradeHint, subjectHint } = req.body || {};
    if (!imageData || typeof imageData !== 'string') {
      return res.status(400).json({ error: 'Vui lòng chọn hoặc chụp một bức ảnh đề bài.' });
    }

    const safetyEnabled = getSetting('safety_filter_enabled', 'true') === 'true';
    const result = await scanProblemImage(imageData, mimeType || 'image/jpeg', gradeHint ? Number(gradeHint) : undefined, subjectHint);

    if (safetyEnabled && !result.safetyPassed) {
      db.prepare(
        `INSERT INTO ai_usage_logs (user_id, endpoint, model_name, grade_level, status, safety_flagged, latency_ms)
         VALUES (?, '/api/ai/scan-problem', 'gemini-4-hydrogen', ?, 'blocked_safety', 1, ?)`
      ).run(req.user!.id, gradeHint || null, Date.now() - start);
      return res.status(400).json({
        error: 'Hình ảnh chưa phù hợp với nội dung học tập tiểu học. Em hãy chụp lại trang vở hoặc sách giáo khoa nhé!',
      });
    }

    db.prepare(
      `INSERT INTO ai_usage_logs (user_id, endpoint, model_name, grade_level, status, safety_flagged, latency_ms)
       VALUES (?, '/api/ai/scan-problem', 'gemini-4-hydrogen', ?, 'success', 0, ?)`
    ).run(req.user!.id, result.detectedGrade, Date.now() - start);

    if (req.user!.role === 'student') {
      awardStudentXpAndMissions(req.user!.id, 10, 'scan_problem');
    }

    res.json({ result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Scan problem error:', msg);
    if (msg.includes('GEMINI_API_KEY_MISSING')) {
      return res.status(503).json({ error: 'Hệ thống AI chưa được cấu hình khóa API trên máy chủ.' });
    }
    res.status(500).json({ error: 'SOCO chưa đọc được ảnh lúc này. Em hãy thử lại hoặc gõ đề bài nhé!' });
  }
});

apiRouter.get('/ai/sessions', authenticate, (req: AuthRequest, res: Response) => {
  const sessions = db
    .prepare(
      `SELECT ts.*, s.name as subject_name, s.color_token, g.level as grade_level
       FROM tutoring_sessions ts
       JOIN subjects s ON ts.subject_id = s.id
       JOIN grades g ON ts.grade_id = g.id
       WHERE ts.student_id = ?
       ORDER BY ts.updated_at DESC`
    )
    .all(req.user!.id);
  res.json({ sessions });
});

apiRouter.get('/ai/sessions/:id', authenticate, (req: AuthRequest, res: Response) => {
  const sessionId = Number(req.params.id);
  const session = db
    .prepare(
      `SELECT ts.*, s.name as subject_name, s.color_token, g.level as grade_level
       FROM tutoring_sessions ts
       JOIN subjects s ON ts.subject_id = s.id
       JOIN grades g ON ts.grade_id = g.id
       WHERE ts.id = ? AND ts.student_id = ?`
    )
    .get(sessionId, req.user!.id);

  if (!session) return res.status(404).json({ error: 'Không tìm thấy phiên học này.' });

  const messages = db
    .prepare('SELECT * FROM tutoring_messages WHERE session_id = ? ORDER BY id ASC')
    .all(sessionId) as Array<Record<string, unknown>>;

  res.json({
    session,
    messages: messages.map((m) => ({
      ...m,
      pedagogicalMeta: m.pedagogical_meta_json ? JSON.parse(String(m.pedagogical_meta_json)) : null,
    })),
  });
});

apiRouter.post('/ai/sessions', authenticate, (req: AuthRequest, res: Response) => {
  const { gradeLevel = 4, subjectId = 1, mode = 'socratic', topic = 'Khám phá kiến thức', sourceType = 'text', extractedProblemText = '' } =
    req.body || {};

  const gradeRow = db.prepare('SELECT id FROM grades WHERE level = ?').get(Math.min(5, Math.max(1, Number(gradeLevel)))) as { id: number };
  const validModes = ['socratic', 'hint', 'concept', 'challenge'];
  const safeMode = validModes.includes(mode) ? mode : 'socratic';

  const sessionId = db
    .prepare(
      `INSERT INTO tutoring_sessions (student_id, grade_id, subject_id, mode, topic, source_type, extracted_problem_text)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.user!.id, gradeRow.id, Number(subjectId), safeMode, String(topic).slice(0, 120), sourceType, extractedProblemText).lastInsertRowid as number;

  const session = db
    .prepare(
      `SELECT ts.*, s.name as subject_name, s.color_token, g.level as grade_level
       FROM tutoring_sessions ts
       JOIN subjects s ON ts.subject_id = s.id
       JOIN grades g ON ts.grade_id = g.id
       WHERE ts.id = ?`
    )
    .get(sessionId);

  res.status(201).json({ session });
});

apiRouter.post('/ai/tutor', authenticate, async (req: AuthRequest, res: Response) => {
  const start = Date.now();
  try {
    const {
      sessionId,
      message,
      mode = 'socratic',
      hintLevel = 1,
      revealSolutionRequested = false,
      gradeLevel = 4,
      subjectId = 1,
      topic = 'Khám phá bài học',
      problemText = '',
      sourceType = 'text',
    } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Em hãy nhập câu hỏi hoặc câu trả lời cho SOCO nhé!' });
    }

    // Check daily quota for students
    const dailyLimit = Number(getSetting('daily_ai_limit_per_student', '40'));
    const todayCount = (
      db
        .prepare(`SELECT COUNT(*) as cnt FROM ai_usage_logs WHERE user_id = ? AND date(created_at) = date('now')`)
        .get(req.user!.id) as { cnt: number }
    ).cnt;

    if (req.user!.role === 'student' && todayCount >= dailyLimit) {
      return res.status(429).json({
        error: `Hôm nay em đã trò chuyện ${dailyLimit} lượt cùng SOCO rồi. Hãy nghỉ ngơi bảo vệ mắt và quay lại vào ngày mai nhé!`,
      });
    }

    let activeSessionId = sessionId ? Number(sessionId) : null;
    const gradeRow = db.prepare('SELECT id, level FROM grades WHERE level = ?').get(Math.min(5, Math.max(1, Number(gradeLevel)))) as {
      id: number;
      level: number;
    };
    const subjectRow = db.prepare('SELECT id, name FROM subjects WHERE id = ?').get(Number(subjectId)) as
      | { id: number; name: string }
      | undefined;

    if (!activeSessionId) {
      activeSessionId = db
        .prepare(
          `INSERT INTO tutoring_sessions (student_id, grade_id, subject_id, mode, topic, source_type, extracted_problem_text)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          req.user!.id,
          gradeRow.id,
          subjectRow ? subjectRow.id : 1,
          mode,
          topic,
          sourceType,
          problemText || message.trim()
        ).lastInsertRowid as number;
    } else {
      const owns = db
        .prepare('SELECT id FROM tutoring_sessions WHERE id = ? AND student_id = ?')
        .get(activeSessionId, req.user!.id);
      if (!owns) return res.status(403).json({ error: 'Không có quyền truy cập phiên học này.' });
    }

    const historyRows = db
      .prepare('SELECT sender, content FROM tutoring_messages WHERE session_id = ? ORDER BY id ASC')
      .all(activeSessionId) as Array<{ sender: 'student' | 'soco'; content: string }>;

    // Persist student message
    db.prepare(`INSERT INTO tutoring_messages (session_id, sender, content, hint_level) VALUES (?, 'student', ?, ?)`).run(
      activeSessionId,
      message.trim(),
      Number(hintLevel) || 0
    );

    const socraticStrictness = getSetting('socratic_strictness', 'high');
    const aiOut = await generateSocraticTurn({
      studentName: req.user!.displayName,
      gradeLevel: gradeRow.level,
      subjectName: subjectRow ? subjectRow.name : 'Toán học',
      mode,
      hintLevel: Number(hintLevel) || 1,
      revealSolutionRequested: Boolean(revealSolutionRequested),
      topic,
      problemText: problemText || message.trim(),
      history: historyRows,
      studentMessage: message.trim(),
      socraticStrictness,
    });

    // Save SOCO message
    const socoMsgId = db
      .prepare(
        `INSERT INTO tutoring_messages (session_id, sender, content, pedagogical_meta_json, hint_level)
         VALUES (?, 'soco', ?, ?, ?)`
      )
      .run(
        activeSessionId,
        aiOut.reply,
        JSON.stringify({
          ...aiOut.pedagogicalAnalysis,
          socoEmotion: aiOut.socoEmotion,
          similarChallengeProblem: aiOut.similarChallengeProblem,
          isSolvedByStudent: aiOut.isSolvedByStudent,
          prerequisites: aiOut.prerequisites,
        }),
        mode === 'hint' ? Number(hintLevel) || 1 : 0
      ).lastInsertRowid as number;

    // Update session metadata
    db.prepare(
      `UPDATE tutoring_sessions
       SET mode = ?, topic = ?, difficulty = ?, learning_objective = ?, prerequisite_skills = ?, status = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      mode,
      aiOut.topic || topic,
      aiOut.difficulty,
      aiOut.learningObjective,
      aiOut.prerequisites.join(' · '),
      aiOut.isSolvedByStudent ? 'completed' : 'active',
      activeSessionId
    );

    // Record detected mistake and skill mastery if student
    if (req.user!.role === 'student') {
      const subId = subjectRow ? subjectRow.id : 1;
      const understandingPct = aiOut.pedagogicalAnalysis.understandingLevel * 20;
      const helpLevel = mode === 'hint' && Number(hintLevel) >= 2 ? 'high' : mode === 'socratic' ? 'minimal' : 'moderate';
      db.prepare(
        `INSERT INTO skill_mastery (student_id, subject_id, grade_id, topic_name, mastery_score, confidence_level, correct_count, attempt_count, ai_help_level)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
         ON CONFLICT(student_id, subject_id, topic_name) DO UPDATE SET
           mastery_score = MIN(100, ROUND((mastery_score * 0.7) + (excluded.mastery_score * 0.3))),
           confidence_level = CASE WHEN ROUND((mastery_score * 0.7) + (excluded.mastery_score * 0.3)) >= 80 THEN 'mastered' WHEN ROUND((mastery_score * 0.7) + (excluded.mastery_score * 0.3)) >= 55 THEN 'developing' ELSE 'needs_review' END,
           correct_count = correct_count + CASE WHEN ? THEN 1 ELSE 0 END,
           attempt_count = attempt_count + 1,
           ai_help_level = excluded.ai_help_level,
           updated_at = datetime('now')`
      ).run(
        req.user!.id,
        subId,
        gradeRow.id,
        aiOut.topic || topic,
        understandingPct,
        understandingPct >= 80 ? 'mastered' : understandingPct >= 55 ? 'developing' : 'needs_review',
        aiOut.isSolvedByStudent ? 1 : 0,
        helpLevel,
        aiOut.isSolvedByStudent ? 1 : 0
      );

      if (aiOut.pedagogicalAnalysis.detectedMistake && aiOut.pedagogicalAnalysis.mistakeCategory) {
        const existingMistake = db
          .prepare('SELECT id FROM learning_mistakes WHERE student_id = ? AND subject_id = ? AND mistake_type = ? AND resolved = 0')
          .get(req.user!.id, subId, aiOut.pedagogicalAnalysis.mistakeCategory) as { id: number } | undefined;
        if (existingMistake) {
          db.prepare(
            `UPDATE learning_mistakes SET frequency = frequency + 1, description = ?, last_occurred_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
          ).run(aiOut.pedagogicalAnalysis.detectedMistake, existingMistake.id);
        } else {
          db.prepare(
            `INSERT INTO learning_mistakes (student_id, subject_id, topic_name, mistake_type, description) VALUES (?, ?, ?, ?, ?)`
          ).run(req.user!.id, subId, aiOut.topic || topic, aiOut.pedagogicalAnalysis.mistakeCategory, aiOut.pedagogicalAnalysis.detectedMistake);
        }
      }

      awardStudentXpAndMissions(req.user!.id, aiOut.isSolvedByStudent ? 25 : 10, 'tutor_turn');
    }

    db.prepare(
      `INSERT INTO ai_usage_logs (user_id, endpoint, model_name, grade_level, mode, prompt_tokens_est, status, safety_flagged, latency_ms)
       VALUES (?, '/api/ai/tutor', 'gemini-4-hydrogen', ?, ?, ?, 'success', ?, ?)`
    ).run(req.user!.id, gradeRow.level, mode, Math.ceil(message.length / 4), aiOut.safetyFlagged ? 1 : 0, Date.now() - start);

    res.json({
      sessionId: activeSessionId,
      messageId: socoMsgId,
      aiResponse: aiOut,
      user: getFullUserPayload(req.user!.id),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Socratic tutor error:', msg);
    db.prepare(
      `INSERT INTO ai_usage_logs (user_id, endpoint, model_name, status, latency_ms) VALUES (?, '/api/ai/tutor', 'gemini-4-hydrogen', 'error', ?)`
    ).run(req.user!.id, Date.now() - start);

    if (msg.includes('GEMINI_API_KEY_MISSING')) {
      return res.status(503).json({ error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ.' });
    }
    res.status(500).json({ error: 'Kết nối với SOCO đang tạm gián đoạn. Em hãy thử gửi lại nhé!' });
  }
});

// ==================== PLAY & LEARN GAMES ====================

apiRouter.get('/games', authenticate, (req: AuthRequest, res: Response) => {
  const gradeLevel = req.query.gradeLevel ? Number(req.query.gradeLevel) : null;
  const subjectId = req.query.subjectId ? Number(req.query.subjectId) : null;
  const gameType = req.query.gameType ? String(req.query.gameType) : null;

  let sql = `
    SELECT e.*, g.level as grade_level, g.name as grade_name, s.name as subject_name, s.color_token
    FROM exercises e
    JOIN grades g ON e.grade_id = g.id
    JOIN subjects s ON e.subject_id = s.id
    WHERE 1=1
  `;
  const params: unknown[] = [];
  if (gradeLevel) {
    sql += ' AND g.level = ?';
    params.push(gradeLevel);
  }
  if (subjectId) {
    sql += ' AND e.subject_id = ?';
    params.push(subjectId);
  }
  if (gameType) {
    sql += ' AND e.game_type = ?';
    params.push(gameType);
  }
  sql += ' ORDER BY e.id ASC';

  const exercises = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
  const questions = db.prepare('SELECT * FROM exercise_questions ORDER BY order_index ASC').all() as Array<Record<string, unknown>>;

  const enriched = exercises.map((ex) => ({
    ...ex,
    questions: questions
      .filter((q) => q.exercise_id === ex.id)
      .map((q) => ({
        ...q,
        options: JSON.parse(String(q.options_json || '[]')),
      })),
  }));

  res.json({ games: enriched });
});

apiRouter.post('/games/:id/submit', authenticate, (req: AuthRequest, res: Response) => {
  const exerciseId = Number(req.params.id);
  const { score = 100, timeSpentSeconds = 90, wrongTopics = [] } = req.body || {};

  const ex = db.prepare('SELECT * FROM exercises WHERE id = ?').get(exerciseId) as
    | { id: number; title: string; grade_id: number; subject_id: number; xp_reward: number }
    | undefined;
  if (!ex) return res.status(404).json({ error: 'Không tìm thấy trò chơi.' });

  const existing = db
    .prepare('SELECT id FROM learning_progress WHERE student_id = ? AND exercise_id = ?')
    .get(req.user!.id, exerciseId) as { id: number } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE learning_progress
       SET status = 'completed', score = MAX(score, ?), time_spent_seconds = time_spent_seconds + ?, attempts = attempts + 1, last_accessed_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`
    ).run(Number(score), Number(timeSpentSeconds), existing.id);
  } else {
    db.prepare(
      `INSERT INTO learning_progress (student_id, exercise_id, status, time_spent_seconds, score, attempts)
       VALUES (?, ?, 'completed', ?, ?, 1)`
    ).run(req.user!.id, exerciseId, Number(timeSpentSeconds), Number(score));
  }

  // Update assignment submission if linked
  const linkedAssign = db
    .prepare('SELECT id FROM teacher_assignments WHERE exercise_id = ?')
    .all(exerciseId) as Array<{ id: number }>;
  for (const a of linkedAssign) {
    db.prepare(
      `UPDATE assignment_submissions
       SET status = 'submitted', score = ?, answer_summary = ?, submitted_at = datetime('now'), updated_at = datetime('now')
       WHERE assignment_id = ? AND student_id = ?`
    ).run(Number(score), `Hoàn thành trò chơi đạt ${score}%`, a.id, req.user!.id);
  }

  // Record skill mastery & any wrong topics
  if (req.user!.role === 'student') {
    const masteryVal = Math.min(100, Math.max(40, Number(score)));
    db.prepare(
      `INSERT INTO skill_mastery (student_id, subject_id, grade_id, topic_name, mastery_score, confidence_level, correct_count, attempt_count, ai_help_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'minimal')
       ON CONFLICT(student_id, subject_id, topic_name) DO UPDATE SET
         mastery_score = ROUND((mastery_score + excluded.mastery_score) / 2.0),
         confidence_level = CASE WHEN ROUND((mastery_score + excluded.mastery_score) / 2.0) >= 80 THEN 'mastered' WHEN ROUND((mastery_score + excluded.mastery_score) / 2.0) >= 55 THEN 'developing' ELSE 'needs_review' END,
         correct_count = correct_count + CASE WHEN ? >= 70 THEN 1 ELSE 0 END,
         attempt_count = attempt_count + 1,
         updated_at = datetime('now')`
    ).run(
      req.user!.id,
      ex.subject_id,
      ex.grade_id,
      ex.title,
      masteryVal,
      masteryVal >= 80 ? 'mastered' : masteryVal >= 55 ? 'developing' : 'needs_review',
      Number(score) >= 70 ? 1 : 0,
      Number(score)
    );

    if (Array.isArray(wrongTopics) && wrongTopics.length > 0) {
      for (const wt of wrongTopics.slice(0, 3)) {
        db.prepare(
          `INSERT INTO learning_mistakes (student_id, subject_id, topic_name, mistake_type, description)
           VALUES (?, ?, ?, ?, ?)`
        ).run(req.user!.id, ex.subject_id, ex.title, 'Nhầm lẫn trong luyện tập', String(wt));
      }
    }

    const earnedXp = Math.round((ex.xp_reward * Math.max(40, Number(score))) / 100);
    awardStudentXpAndMissions(req.user!.id, earnedXp, 'play_game');
  }

  res.json({
    message: 'Đã lưu kết quả trò chơi!',
    user: getFullUserPayload(req.user!.id),
  });
});

// ==================== TEACHER CENTER ====================

apiRouter.get('/teacher/overview', authenticate, requireRole('teacher', 'admin'), (req: AuthRequest, res: Response) => {
  const teacherId = req.user!.id;
  const classes = db
    .prepare(
      `SELECT c.*, g.level as grade_level, g.name as grade_name,
              (SELECT COUNT(*) FROM class_members cm WHERE cm.class_id = c.id) as student_count
       FROM classes c
       JOIN grades g ON c.grade_id = g.id
       WHERE c.teacher_id = ?
       ORDER BY c.id DESC`
    )
    .all(teacherId) as Array<Record<string, unknown>>;

  const classIds = classes.map((c) => Number(c.id));
  let students: Array<Record<string, unknown>> = [];
  if (classIds.length > 0) {
    students = db
      .prepare(
        `SELECT u.id, u.username, u.display_name, cm.class_id, c.name as class_name,
                sp.xp, sp.level, sp.streak_days, g.level as grade_level,
                COALESCE((SELECT ROUND(AVG(mastery_score)) FROM skill_mastery sm WHERE sm.student_id = u.id), 0) as avg_mastery,
                COALESCE((SELECT COUNT(*) FROM learning_progress lp WHERE lp.student_id = u.id AND lp.status = 'completed'), 0) as completed_items
         FROM class_members cm
         JOIN users u ON cm.student_id = u.id
         JOIN classes c ON cm.class_id = c.id
         JOIN student_profiles sp ON sp.user_id = u.id
         JOIN grades g ON sp.grade_id = g.id
         WHERE c.teacher_id = ?`
      )
      .all(teacherId) as Array<Record<string, unknown>>;
  }

  const assignments = db
    .prepare(
      `SELECT ta.*, c.name as class_name, s.name as subject_name
       FROM teacher_assignments ta
       JOIN classes c ON ta.class_id = c.id
       JOIN subjects s ON ta.subject_id = s.id
       WHERE ta.teacher_id = ?
       ORDER BY ta.id DESC`
    )
    .all(teacherId);

  const submissions = db
    .prepare(
      `SELECT asub.*, u.display_name as student_name, ta.title as assignment_title
       FROM assignment_submissions asub
       JOIN teacher_assignments ta ON asub.assignment_id = ta.id
       JOIN users u ON asub.student_id = u.id
       WHERE ta.teacher_id = ?
       ORDER BY asub.updated_at DESC`
    )
    .all(teacherId);

  const commonMistakes = db
    .prepare(
      `SELECT lm.mistake_type, lm.topic_name, s.name as subject_name, SUM(lm.frequency) as total_occurrences
       FROM learning_mistakes lm
       JOIN subjects s ON lm.subject_id = s.id
       JOIN class_members cm ON cm.student_id = lm.student_id
       JOIN classes c ON cm.class_id = c.id
       WHERE c.teacher_id = ? AND lm.resolved = 0
       GROUP BY lm.mistake_type, lm.topic_name, s.name
       ORDER BY total_occurrences DESC
       LIMIT 10`
    )
    .all(teacherId);

  const lessons = db
    .prepare(
      `SELECT l.id, l.title, l.status, cu.title as unit_title, g.level as grade_level, s.name as subject_name
       FROM lessons l
       JOIN curriculum_units cu ON l.unit_id = cu.id
       JOIN grades g ON cu.grade_id = g.id
       JOIN subjects s ON cu.subject_id = s.id
       ORDER BY l.id DESC`
    )
    .all();

  const materials = db
    .prepare(
      `SELECT lm.*, l.title as lesson_title
       FROM learning_materials lm
       JOIN lessons l ON lm.lesson_id = l.id
       WHERE lm.author_id = ?
       ORDER BY lm.id DESC`
    )
    .all(teacherId);

  const units = db
    .prepare(
      `SELECT cu.*, g.level as grade_level, s.name as subject_name
       FROM curriculum_units cu
       JOIN grades g ON cu.grade_id = g.id
       JOIN subjects s ON cu.subject_id = s.id
       ORDER BY g.level ASC, cu.subject_id ASC`
    )
    .all();

  res.json({ classes, students, assignments, submissions, commonMistakes, lessons, materials, units });
});

apiRouter.post('/teacher/classes', authenticate, requireRole('teacher', 'admin'), (req: AuthRequest, res: Response) => {
  const { name, gradeLevel = 4, description = '' } = req.body || {};
  if (!name || String(name).trim().length < 2) {
    return res.status(400).json({ error: 'Vui lòng nhập tên lớp học.' });
  }
  const gradeRow = db.prepare('SELECT id FROM grades WHERE level = ?').get(Math.min(5, Math.max(1, Number(gradeLevel)))) as { id: number };
  const joinCode = 'L' + gradeLevel + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();

  const id = db
    .prepare(`INSERT INTO classes (teacher_id, grade_id, name, join_code, description) VALUES (?, ?, ?, ?, ?)`)
    .run(req.user!.id, gradeRow.id, String(name).trim(), joinCode, String(description).trim()).lastInsertRowid;

  res.status(201).json({ id, joinCode, message: `Đã tạo lớp thành công! Mã tham gia lớp: ${joinCode}` });
});

apiRouter.post('/teacher/assignments', authenticate, requireRole('teacher', 'admin'), (req: AuthRequest, res: Response) => {
  const { classId, subjectId, title, instructions, dueDate, exerciseId } = req.body || {};
  if (!classId || !title || !dueDate) {
    return res.status(400).json({ error: 'Vui lòng chọn lớp, nhập tiêu đề và hạn nộp.' });
  }
  const assignId = db
    .prepare(
      `INSERT INTO teacher_assignments (class_id, teacher_id, subject_id, title, instructions, due_date, exercise_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      Number(classId),
      req.user!.id,
      Number(subjectId) || 1,
      String(title).trim(),
      String(instructions || '').trim(),
      String(dueDate),
      exerciseId ? Number(exerciseId) : null
    ).lastInsertRowid;

  const members = db.prepare('SELECT student_id FROM class_members WHERE class_id = ?').all(Number(classId)) as Array<{ student_id: number }>;
  const ins = db.prepare(`INSERT OR IGNORE INTO assignment_submissions (assignment_id, student_id, status) VALUES (?, ?, 'assigned')`);
  for (const m of members) ins.run(assignId, m.student_id);

  res.status(201).json({ id: assignId, message: 'Đã giao nhiệm vụ tới học sinh trong lớp!' });
});

apiRouter.post('/teacher/submissions/:id/grade', authenticate, requireRole('teacher', 'admin'), (req: AuthRequest, res: Response) => {
  const { score, teacherFeedback } = req.body || {};
  db.prepare(
    `UPDATE assignment_submissions SET score = ?, teacher_feedback = ?, status = 'graded', updated_at = datetime('now') WHERE id = ?`
  ).run(Number(score) || 100, String(teacherFeedback || 'Rất tốt!'), Number(req.params.id));
  res.json({ message: 'Đã lưu nhận xét cho học sinh.' });
});

apiRouter.post('/teacher/lessons', authenticate, requireRole('teacher', 'admin'), (req: AuthRequest, res: Response) => {
  const { unitId, title, objectives, coreKnowledge, reviewNotes, status = 'published' } = req.body || {};
  if (!unitId || !title || !coreKnowledge) {
    return res.status(400).json({ error: 'Vui lòng chọn chủ đề, nhập tên bài và kiến thức trọng tâm.' });
  }
  const id = db
    .prepare(
      `INSERT INTO lessons (unit_id, title, objectives, core_knowledge, illustration_url, review_notes, status, created_by)
       VALUES (?, ?, ?, ?, '/src/assets/images/hero_learning_world_1794794874331.jpg', ?, ?, ?)`
    )
    .run(
      Number(unitId),
      String(title).trim(),
      String(objectives || 'Hiểu và vận dụng kiến thức bài học').trim(),
      String(coreKnowledge).trim(),
      String(reviewNotes || 'Ôn lại ví dụ và tự đặt 1 câu hỏi cho SOCO.').trim(),
      status === 'draft' ? 'draft' : 'published',
      req.user!.id
    ).lastInsertRowid;
  res.status(201).json({ id, message: 'Đã thêm bài học mới vào Kho Tri thức.' });
});

apiRouter.post('/teacher/materials', authenticate, requireRole('teacher', 'admin'), (req: AuthRequest, res: Response) => {
  const { lessonId, title, materialType = 'worksheet', content } = req.body || {};
  if (!lessonId || !title || !content) {
    return res.status(400).json({ error: 'Vui lòng điền đủ thông tin học liệu.' });
  }
  const id = db
    .prepare(
      `INSERT INTO learning_materials (lesson_id, title, material_type, content, approval_status, author_id)
       VALUES (?, ?, ?, ?, 'pending', ?)`
    )
    .run(Number(lessonId), String(title).trim(), materialType, String(content).trim(), req.user!.id).lastInsertRowid;
  res.status(201).json({ id, message: 'Đã gửi học liệu chờ quản trị viên duyệt.' });
});

apiRouter.post('/teacher/exercises', authenticate, requireRole('teacher', 'admin'), (req: AuthRequest, res: Response) => {
  const { gradeId, subjectId, title, prompt, options, correctAnswer, explanation } = req.body || {};
  if (!title || !prompt || !correctAnswer) {
    return res.status(400).json({ error: 'Vui lòng nhập tiêu đề, câu hỏi và đáp án đúng.' });
  }
  const exId = db
    .prepare(
      `INSERT INTO exercises (grade_id, subject_id, title, game_type, difficulty, xp_reward, created_by)
       VALUES (?, ?, ?, 'quiz', 'medium', 35, ?)`
    )
    .run(Number(gradeId) || 4, Number(subjectId) || 1, String(title).trim(), req.user!.id).lastInsertRowid as number;

  db.prepare(
    `INSERT INTO exercise_questions (exercise_id, question_type, prompt, options_json, correct_answer, explanation, order_index)
     VALUES (?, 'quiz', ?, ?, ?, ?, 1)`
  ).run(
    exId,
    String(prompt).trim(),
    JSON.stringify(Array.isArray(options) ? options : String(options || '').split(',').map((s) => s.trim()).filter(Boolean)),
    String(correctAnswer).trim(),
    String(explanation || 'Giải thích bởi giáo viên.').trim()
  );

  res.status(201).json({ id: exId, message: 'Đã tạo bài tập mới thành công!' });
});

apiRouter.post('/teacher/ai-insights', authenticate, requireRole('teacher', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { className, gradeLevel, studentCount, commonMistakes, avgScore } = req.body || {};
    const insights = await generateTeacherClassInsights({
      className: className || 'Lớp học của tôi',
      gradeLevel: Number(gradeLevel) || 4,
      studentCount: Number(studentCount) || 1,
      commonMistakes: String(commonMistakes || ''),
      avgScore: Number(avgScore) || 75,
    });
    res.json({ insights });
  } catch (err) {
    console.error('Teacher insights error:', err);
    res.status(500).json({ error: 'Không thể tạo phân tích AI lúc này.' });
  }
});

// ==================== PARENT CENTER ====================

apiRouter.get('/parent/overview', authenticate, requireRole('parent', 'admin'), (req: AuthRequest, res: Response) => {
  const links = db
    .prepare(
      `SELECT psl.*, u.display_name as student_name, u.username as student_username, u.parental_consent_status,
              sp.xp, sp.level, sp.streak_days, sp.daily_goal_minutes, g.level as grade_level, g.name as grade_name
       FROM parent_student_links psl
       JOIN users u ON psl.student_id = u.id
       JOIN student_profiles sp ON sp.user_id = u.id
       JOIN grades g ON sp.grade_id = g.id
       WHERE psl.parent_id = ?
       ORDER BY psl.id DESC`
    )
    .all(req.user!.id) as Array<Record<string, unknown>>;

  const children = links.map((child) => {
    const sid = Number(child.student_id);
    const stats = db
      .prepare(
        `SELECT COALESCE(SUM(time_spent_seconds), 0) as total_seconds,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
                COALESCE(ROUND(AVG(CASE WHEN score > 0 THEN score END)), 0) as avg_score
         FROM learning_progress WHERE student_id = ?`
      )
      .get(sid);

    const mastery = db
      .prepare(
        `SELECT sm.*, s.name as subject_name
         FROM skill_mastery sm
         JOIN subjects s ON sm.subject_id = s.id
         WHERE sm.student_id = ?
         ORDER BY sm.mastery_score ASC`
      )
      .all(sid);

    const mistakes = db
      .prepare(
        `SELECT lm.*, s.name as subject_name
         FROM learning_mistakes lm
         JOIN subjects s ON lm.subject_id = s.id
         WHERE lm.student_id = ? AND lm.resolved = 0
         ORDER BY lm.frequency DESC`
      )
      .all(sid);

    return { ...child, stats, mastery, mistakes };
  });

  res.json({ children });
});

apiRouter.post('/parent/link-student', authenticate, requireRole('parent'), (req: AuthRequest, res: Response) => {
  const { linkCode } = req.body || {};
  if (!linkCode) return res.status(400).json({ error: 'Vui lòng nhập mã liên kết của con.' });

  const studentProfile = db
    .prepare(
      `SELECT sp.user_id, u.display_name
       FROM student_profiles sp JOIN users u ON sp.user_id = u.id
       WHERE UPPER(sp.link_code) = UPPER(?)`
    )
    .get(String(linkCode).trim()) as { user_id: number; display_name: string } | undefined;

  if (!studentProfile) {
    return res.status(404).json({ error: 'Không tìm thấy tài khoản học sinh với mã liên kết này.' });
  }

  db.prepare(
    `INSERT INTO parent_student_links (parent_id, student_id, link_code, status, approved_at)
     VALUES (?, ?, ?, 'approved', datetime('now'))
     ON CONFLICT(parent_id, student_id) DO UPDATE SET status = 'approved', approved_at = datetime('now'), updated_at = datetime('now')`
  ).run(req.user!.id, studentProfile.user_id, String(linkCode).trim().toUpperCase());

  db.prepare(`UPDATE users SET parental_consent_status = 'approved', updated_at = datetime('now') WHERE id = ?`).run(
    studentProfile.user_id
  );

  res.json({ message: `Đã liên kết và xác nhận bảo hộ thành công cho ${studentProfile.display_name}!` });
});

apiRouter.post('/parent/ai-advice', authenticate, requireRole('parent', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.body || {};
    const sid = Number(studentId);
    const link = db
      .prepare('SELECT id FROM parent_student_links WHERE parent_id = ? AND student_id = ? AND status = "approved"')
      .get(req.user!.id, sid);

    if (!link && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Bạn chưa được liên kết với học sinh này.' });
    }

    const child = db
      .prepare(
        `SELECT u.display_name, g.level as grade_level,
                COALESCE((SELECT SUM(time_spent_seconds) FROM learning_progress WHERE student_id = u.id), 0) as total_seconds
         FROM users u
         JOIN student_profiles sp ON sp.user_id = u.id
         JOIN grades g ON sp.grade_id = g.id
         WHERE u.id = ?`
      )
      .get(sid) as { display_name: string; grade_level: number; total_seconds: number } | undefined;

    if (!child) return res.status(404).json({ error: 'Không tìm thấy học sinh.' });

    const masteryRows = db
      .prepare(
        `SELECT s.name as subject_name, sm.topic_name, sm.mastery_score
         FROM skill_mastery sm JOIN subjects s ON sm.subject_id = s.id WHERE sm.student_id = ?`
      )
      .all(sid) as Array<{ subject_name: string; topic_name: string; mastery_score: number }>;

    const mistakeRows = db
      .prepare('SELECT topic_name, mistake_type FROM learning_mistakes WHERE student_id = ? AND resolved = 0')
      .all(sid) as Array<{ topic_name: string; mistake_type: string }>;

    const advice = await generateParentCompanionAdvice({
      studentName: child.display_name,
      gradeLevel: child.grade_level,
      masterySummary: masteryRows.map((m) => `${m.subject_name} (${m.topic_name}): ${m.mastery_score}%`).join('; ') || 'Mới bắt đầu học',
      mistakesSummary: mistakeRows.map((m) => `${m.topic_name}: ${m.mistake_type}`).join('; '),
      studyMinutes: Math.round(child.total_seconds / 60),
    });

    res.json({ advice });
  } catch (err) {
    console.error('Parent advice error:', err);
    res.status(500).json({ error: 'Không thể tạo gợi ý đồng hành lúc này.' });
  }
});

// ==================== ADMIN CENTER ====================

apiRouter.get('/admin/overview', authenticate, requireRole('admin'), (_req: AuthRequest, res: Response) => {
  const users = db
    .prepare(
      `SELECT id, username, email, display_name, role, is_verified, parental_consent_status, status, created_at
       FROM users ORDER BY id DESC`
    )
    .all();

  const classes = db
    .prepare(
      `SELECT c.*, u.display_name as teacher_name, g.name as grade_name,
              (SELECT COUNT(*) FROM class_members cm WHERE cm.class_id = c.id) as student_count
       FROM classes c
       JOIN users u ON c.teacher_id = u.id
       JOIN grades g ON c.grade_id = g.id
       ORDER BY c.id DESC`
    )
    .all();

  const materials = db
    .prepare(
      `SELECT lm.*, l.title as lesson_title, u.display_name as author_name
       FROM learning_materials lm
       JOIN lessons l ON lm.lesson_id = l.id
       LEFT JOIN users u ON lm.author_id = u.id
       ORDER BY CASE WHEN lm.approval_status = 'pending' THEN 0 ELSE 1 END, lm.id DESC`
    )
    .all();

  const questions = db
    .prepare(
      `SELECT eq.id, eq.prompt, eq.question_type, eq.correct_answer, e.title as exercise_title, g.level as grade_level, s.name as subject_name
       FROM exercise_questions eq
       JOIN exercises e ON eq.exercise_id = e.id
       JOIN grades g ON e.grade_id = g.id
       JOIN subjects s ON e.subject_id = s.id
       ORDER BY eq.id DESC
       LIMIT 30`
    )
    .all();

  const settings = db.prepare('SELECT * FROM system_settings ORDER BY key ASC').all();
  const aiLogs = db
    .prepare(
      `SELECT l.*, u.username, u.role
       FROM ai_usage_logs l
       JOIN users u ON l.user_id = u.id
       ORDER BY l.id DESC
       LIMIT 30`
    )
    .all();

  res.json({ users, classes, materials, questions, settings, aiLogs });
});

apiRouter.patch('/admin/users/:id', authenticate, requireRole('admin'), (req: AuthRequest, res: Response) => {
  const targetId = Number(req.params.id);
  const { status, isVerified } = req.body || {};
  if (targetId === req.user!.id && status === 'suspended') {
    return res.status(400).json({ error: 'Không thể tự khóa tài khoản quản trị đang đăng nhập.' });
  }
  if (status && ['active', 'suspended'].includes(status)) {
    db.prepare(`UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, targetId);
  }
  if (isVerified !== undefined) {
    db.prepare(`UPDATE users SET is_verified = ?, updated_at = datetime('now') WHERE id = ?`).run(isVerified ? 1 : 0, targetId);
  }
  res.json({ message: 'Đã cập nhật trạng thái tài khoản.' });
});

apiRouter.patch('/admin/materials/:id', authenticate, requireRole('admin'), (req: AuthRequest, res: Response) => {
  const { approvalStatus } = req.body || {};
  if (!['approved', 'rejected', 'pending'].includes(approvalStatus)) {
    return res.status(400).json({ error: 'Trạng thái duyệt không hợp lệ.' });
  }
  db.prepare(`UPDATE learning_materials SET approval_status = ?, updated_at = datetime('now') WHERE id = ?`).run(
    approvalStatus,
    Number(req.params.id)
  );
  res.json({ message: 'Đã cập nhật trạng thái duyệt học liệu.' });
});

apiRouter.delete('/admin/questions/:id', authenticate, requireRole('admin'), (req: AuthRequest, res: Response) => {
  db.prepare('DELETE FROM exercise_questions WHERE id = ?').run(Number(req.params.id));
  res.json({ message: 'Đã xóa câu hỏi khỏi ngân hàng câu hỏi.' });
});

apiRouter.patch('/admin/settings', authenticate, requireRole('admin'), (req: AuthRequest, res: Response) => {
  const { key, value } = req.body || {};
  if (!key || value === undefined) return res.status(400).json({ error: 'Thiếu thông số cấu hình.' });
  db.prepare(`UPDATE system_settings SET value = ?, updated_at = datetime('now') WHERE key = ?`).run(String(value), String(key));
  res.json({ message: 'Đã lưu cấu hình hệ thống.' });
});
