import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from './db.ts';

export type UserRole = 'student' | 'teacher' | 'parent' | 'admin';

export interface AuthUserPayload {
  id: number;
  username: string;
  role: UserRole;
  displayName: string;
  tokenType?: 'access' | 'refresh';
}

export interface AuthRequest extends Request {
  user?: AuthUserPayload;
}

const JWT_SECRET = process.env.JWT_SECRET || 'socrates-kids-ai-dev-secret-2026';

export const ACCESS_COOKIE_NAME = 'socrates_access_token';
export const REFRESH_COOKIE_NAME = 'socrates_refresh_token';

export function signToken(payload: AuthUserPayload): string {
  return jwt.sign({ ...payload, tokenType: 'access' }, JWT_SECRET, { expiresIn: '1d' });
}

export function signRefreshToken(payload: AuthUserPayload): string {
  return jwt.sign({ ...payload, tokenType: 'refresh' }, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): AuthUserPayload {
  return jwt.verify(token, JWT_SECRET) as AuthUserPayload;
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const key = part.slice(0, idx).trim();
      const val = part.slice(idx + 1).trim();
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        cookies[key] = val;
      }
    }
  }
  return cookies;
}

export function isHttpsRequest(req: Request): boolean {
  const xfProto = req.headers['x-forwarded-proto'];
  if (typeof xfProto === 'string' && xfProto.split(',')[0].trim() === 'https') return true;
  if (req.secure) return true;
  if (process.env.VERCEL === '1' || process.env.NODE_ENV === 'production') return true;
  return false;
}

export function setAuthCookies(req: Request, res: Response, accessToken: string, refreshToken: string) {
  const secure = isHttpsRequest(req);
  res.cookie(ACCESS_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  });
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(req: Request, res: Response) {
  const secure = isHttpsRequest(req);
  res.clearCookie(ACCESS_COOKIE_NAME, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
  res.clearCookie(REFRESH_COOKIE_NAME, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const cookies = parseCookies(req.headers.cookie);
  let token: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (cookies[ACCESS_COOKIE_NAME]) {
    token = cookies[ACCESS_COOKIE_NAME];
  }

  if (!token) {
    return res.status(401).json({
      error: 'Vui lòng đăng nhập để tiếp tục.',
      code: 'UNAUTHORIZED',
    });
  }

  try {
    const decoded = verifyToken(token);
    if (decoded.tokenType === 'refresh') {
      return res.status(401).json({
        error: 'Token không hợp lệ cho phiên truy cập.',
        code: 'UNAUTHORIZED',
      });
    }

    const dbUser = db
      .prepare('SELECT id, username, role, display_name, status FROM users WHERE id = ?')
      .get(decoded.id) as { id: number; username: string; role: UserRole; display_name: string; status: string } | undefined;

    if (!dbUser) {
      return res.status(401).json({
        error: 'Tài khoản không tồn tại hoặc đã bị xóa.',
        code: 'UNAUTHORIZED',
      });
    }
    if (dbUser.status === 'suspended') {
      return res.status(403).json({
        error: 'Tài khoản này đang bị tạm khóa. Vui lòng liên hệ quản trị viên.',
        code: 'ACCOUNT_SUSPENDED',
      });
    }

    req.user = {
      id: dbUser.id,
      username: dbUser.username,
      role: dbUser.role,
      displayName: dbUser.display_name,
    };
    next();
  } catch (err: unknown) {
    const isExpired = err instanceof Error && err.name === 'TokenExpiredError';
    return res.status(401).json({
      error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      code: isExpired ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED',
    });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Chưa xác thực người dùng.', code: 'UNAUTHORIZED' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này.', code: 'FORBIDDEN' });
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
