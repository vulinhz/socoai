export type UserRole = 'student' | 'teacher' | 'parent' | 'admin';

export interface UserProfileData {
  id: number;
  username: string;
  email: string | null;
  display_name: string;
  role: UserRole;
  avatar_url: string | null;
  is_verified: number;
  parental_consent_status: 'not_required' | 'pending' | 'approved';
  status: 'active' | 'suspended';
  created_at: string;
  profile: {
    id: number;
    user_id: number;
    grade_id?: number;
    grade_level?: number;
    grade_name?: string;
    xp?: number;
    level?: number;
    streak_days?: number;
    daily_goal_minutes?: number;
    link_code?: string;
    school_name?: string;
    specialization?: string;
    relationship_label?: string;
  } | null;
}

let inMemoryToken: string | null = null;

export function getAuthToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  try {
    const t = sessionStorage.getItem('socrates_session_token');
    inMemoryToken = t;
    return t;
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null) {
  inMemoryToken = token;
  try {
    if (token) {
      sessionStorage.setItem('socrates_session_token', token);
    } else {
      sessionStorage.removeItem('socrates_session_token');
    }
  } catch {
    // ignore storage restriction
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Lỗi máy chủ (${res.status})`);
  }
  return data as T;
}
