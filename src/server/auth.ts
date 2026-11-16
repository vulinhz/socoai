import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from './db.ts';

export type UserRole = 'student' | 'teacher' | 'parent' | 'admin';

export interface AuthUserPayload {
  id: number;
  username: string;
  role: UserRole;
  displayName: string;
}

export interface AuthRequest extends Request {
  user?: AuthUserPayload;
}

const JWT_SECRET = process.env.JWT_SECRET || 'socrates-kids-ai-dev-secret-2026';

export function signToken(payload: AuthUserPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthUserPayload {
  return jwt.verify(token, JWT_SECRET) as AuthUserPayload;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Vui lòng đăng nhập để tiếp tục.' });
  }
  const token = authHeader.slice(7).trim();
  try {
    const decoded = verifyToken(token);
    const dbUser = db
      .prepare('SELECT id, username, role, display_name, status FROM users WHERE id = ?')
      .get(decoded.id) as { id: number; username: string; role: UserRole; display_name: string; status: string } | undefined;

    if (!dbUser || dbUser.status === 'suspended') {
      return res.status(401).json({ error: 'Tài khoản không tồn tại hoặc đang bị tạm khóa.' });
    }
    req.user = {
      id: dbUser.id,
      username: dbUser.username,
      role: dbUser.role,
      displayName: dbUser.display_name,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Chưa xác thực người dùng.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này.' });
    }
    next();
  };
}

export function awardStudentXpAndMissions(
  studentId: number,
  xpDelta: number,
  actionType: 'tutor_turn' | 'play_game' | 'complete_lesson' | 'scan_problem'
) {
  const profile = db
    .prepare('SELECT id, xp, level, streak_days, last_active_date FROM student_profiles WHERE user_id = ?')
    .get(studentId) as { id: number; xp: number; level: number; streak_days: number; last_active_date: string | null } | undefined;

  if (!profile) return;

  const today = new Date().toISOString().slice(0, 10);
  let newStreak = profile.streak_days;
  if (profile.last_active_date && profile.last_active_date !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    newStreak = profile.last_active_date === yesterday ? profile.streak_days + 1 : 1;
  }

  let totalXpEarned = xpDelta;

  // Update matching missions
  const missions = db
    .prepare('SELECT id, mission_type, target_action, target_count, xp_reward FROM missions WHERE target_action = ?')
    .all(actionType) as Array<{ id: number; mission_type: string; target_action: string; target_count: number; xp_reward: number }>;

  for (const m of missions) {
    const periodKey = m.mission_type === 'daily' ? today : 'week-current';
    const existing = db
      .prepare('SELECT id, current_count, completed FROM mission_progress WHERE student_id = ? AND mission_id = ? AND period_key = ?')
      .get(studentId, m.id, periodKey) as { id: number; current_count: number; completed: number } | undefined;

    if (!existing) {
      const nextCount = 1;
      const isNowDone = nextCount >= m.target_count ? 1 : 0;
      db.prepare(
        `INSERT INTO mission_progress (student_id, mission_id, current_count, completed, period_key) VALUES (?, ?, ?, ?, ?)`
      ).run(studentId, m.id, nextCount, isNowDone, periodKey);
      if (isNowDone) totalXpEarned += m.xp_reward;
    } else if (!existing.completed) {
      const nextCount = existing.current_count + 1;
      const isNowDone = nextCount >= m.target_count ? 1 : 0;
      db.prepare(
        `UPDATE mission_progress SET current_count = ?, completed = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(nextCount, isNowDone, existing.id);
      if (isNowDone) totalXpEarned += m.xp_reward;
    }
  }

  const newXp = profile.xp + totalXpEarned;
  const newLevel = Math.floor(newXp / 150) + 1;

  db.prepare(
    `UPDATE student_profiles SET xp = ?, level = ?, streak_days = ?, last_active_date = ?, updated_at = datetime('now') WHERE user_id = ?`
  ).run(newXp, newLevel, newStreak, today, studentId);

  // Unlock eligible achievements by XP threshold
  const eligible = db
    .prepare('SELECT id FROM achievements WHERE xp_threshold <= ?')
    .all(newXp) as Array<{ id: number }>;
  const insertAch = db.prepare(
    `INSERT OR IGNORE INTO student_achievements (student_id, achievement_id) VALUES (?, ?)`
  );
  for (const a of eligible) {
    insertAch.run(studentId, a.id);
  }
}
