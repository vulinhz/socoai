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

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = 'API_ERROR') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const ACCESS_TOKEN_KEY = 'socrates_access_token';
const REFRESH_TOKEN_KEY = 'socrates_refresh_token';
const LEGACY_TOKEN_KEY = 'socrates_session_token';

const rawApiUrl = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_URL || '';
export const API_BASE_URL = rawApiUrl.trim().replace(/\/+$/, '');

export function buildApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalized}` : normalized;
}

let inMemoryToken: string | null = null;
let inMemoryRefreshToken: string | null = null;

function readStorage(key: string): string | null {
  try {
    const val = window.localStorage.getItem(key);
    if (val) return val;
  } catch {
    // localStorage might be blocked in private browsing on mobile
  }
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value) {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore localStorage restriction
  }
  try {
    if (value) {
      window.sessionStorage.setItem(key, value);
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // ignore sessionStorage restriction
  }
}

export function getAuthToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  const stored = readStorage(ACCESS_TOKEN_KEY) || readStorage(LEGACY_TOKEN_KEY);
  if (stored) {
    inMemoryToken = stored;
    return stored;
  }
  return null;
}

export function getRefreshToken(): string | null {
  if (inMemoryRefreshToken) return inMemoryRefreshToken;
  const stored = readStorage(REFRESH_TOKEN_KEY);
  if (stored) {
    inMemoryRefreshToken = stored;
    return stored;
  }
  return null;
}

export function setAuthTokens(accessToken: string | null, refreshToken?: string | null) {
  inMemoryToken = accessToken;
  writeStorage(ACCESS_TOKEN_KEY, accessToken);
  if (!accessToken) {
    writeStorage(LEGACY_TOKEN_KEY, null);
  }

  if (refreshToken !== undefined) {
    inMemoryRefreshToken = refreshToken;
    writeStorage(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function setAuthToken(token: string | null) {
  setAuthTokens(token, token === null ? null : undefined);
}

let activeRefreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (activeRefreshPromise) return activeRefreshPromise;

  activeRefreshPromise = (async () => {
    try {
      const refreshToken = getRefreshToken();
      const res = await fetch(buildApiUrl('/api/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(refreshToken ? { refreshToken } : {}),
      });

      if (!res.ok) {
        setAuthTokens(null, null);
        return null;
      }

      const data = (await res.json().catch(() => null)) as { token?: string; refreshToken?: string } | null;
      if (!data?.token) {
        setAuthTokens(null, null);
        return null;
      }

      setAuthTokens(data.token, data.refreshToken ?? refreshToken ?? null);
      return data.token;
    } catch {
      return null;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

function mapNonJsonError(status: number): { message: string; code: string } {
  if (status === 404) {
    return {
      message: 'Không tìm thấy dịch vụ API trên máy chủ (404). Vui lòng kiểm tra cấu hình định tuyến API.',
      code: 'API_NOT_FOUND',
    };
  }
  if (status === 413) {
    return {
      message: 'Ảnh gửi lên có dung lượng quá lớn so với giới hạn máy chủ (413). Vui lòng chọn ảnh nhẹ hơn hoặc cắt gọn vùng đề bài.',
      code: 'PAYLOAD_TOO_LARGE',
    };
  }
  if (status === 502 || status === 503 || status === 504) {
    return {
      message: 'Máy chủ tạm thời không khả dụng hoặc quá thời gian xử lý. Vui lòng thử lại sau ít phút.',
      code: 'BACKEND_UNAVAILABLE',
    };
  }
  return {
    message: 'Máy chủ phản hồi không hợp lệ. Vui lòng thử lại sau ít phút.',
    code: 'INVALID_SERVER_RESPONSE',
  };
}

function mapStatusFallback(status: number): string {
  if (status === 400) return 'Thông tin gửi lên chưa hợp lệ. Vui lòng kiểm tra lại.';
  if (status === 401) return 'Phiên đăng nhập đã hết hạn hoặc chưa xác thực. Vui lòng đăng nhập lại.';
  if (status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
  if (status === 404) return 'Không tìm thấy dữ liệu được yêu cầu.';
  if (status === 409) return 'Thông tin đã tồn tại trong hệ thống.';
  if (status >= 500) return 'Hệ thống máy chủ tạm thời gặp sự cố. Vui lòng thử lại sau ít phút.';
  return `Yêu cầu chưa thành công (${status}).`;
}

const NO_REFRESH_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/logout',
];

export async function apiRequest<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
  const token = getAuthToken();
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(buildApiUrl(path), {
      ...options,
      credentials: 'include',
      headers,
    });
  } catch {
    throw new ApiError(
      'Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng (Wi-Fi/4G) và thử lại.',
      0,
      'NETWORK_ERROR'
    );
  }

  const rawText = await res.text();
  let data: Record<string, unknown> = {};
  let isJson = false;
  if (rawText) {
    try {
      const parsed = JSON.parse(rawText);
      if (parsed && typeof parsed === 'object') {
        data = parsed as Record<string, unknown>;
        isJson = true;
      }
    } catch {
      isJson = false;
    }
  } else {
    isJson = res.ok;
  }

  const cleanPath = path.split('?')[0];
  const isAuthBypass = NO_REFRESH_PATHS.some((p) => cleanPath.endsWith(p));

  if (res.status === 401 && !retried && !isAuthBypass) {
    const hadSessionTokens = Boolean(getAuthToken() || getRefreshToken());
    const errorCode = typeof data.code === 'string' ? data.code : '';
    const shouldAttemptRefresh = hadSessionTokens || errorCode === 'TOKEN_EXPIRED' || cleanPath.endsWith('/api/auth/me');

    if (shouldAttemptRefresh) {
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) {
        return apiRequest<T>(path, options, true);
      }

      if (hadSessionTokens && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('socrates:session-expired', {
            detail: { message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' },
          })
        );
      }
    }
  }

  if (!res.ok) {
    if (!isJson) {
      const mapped = mapNonJsonError(res.status);
      throw new ApiError(mapped.message, res.status, mapped.code);
    }

    const serverMsg = typeof data.error === 'string' && data.error.trim() ? data.error : mapStatusFallback(res.status);
    const serverCode = typeof data.code === 'string' ? data.code : `HTTP_${res.status}`;
    throw new ApiError(serverMsg, res.status, serverCode);
  }

  return data as T;
}
