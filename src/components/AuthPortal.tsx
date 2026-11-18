import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ArrowLeft,
  BookOpen,
  Compass,
  GraduationCap,
  KeyRound,
  LogIn,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { apiRequest, setAuthTokens, UserProfileData } from '../lib/api';
import { heroLearningWorldImg } from '../lib/assets';
import { usePageSeo } from '../lib/seo';
import { SocoMascot } from './SocoMascot';

interface AuthPortalProps {
  initialTab?: 'login' | 'register' | 'forgot';
  onAuthenticated: (user: UserProfileData) => void;
  sessionMessage?: string;
}

type AuthTab = 'login' | 'register' | 'forgot';

const USERNAME_REGEX = /^[a-z0-9_.]{3,32}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthPortal({ initialTab = 'login', onAuthenticated, sessionMessage }: AuthPortalProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState(sessionMessage || '');

  useEffect(() => {
    setTab(initialTab);
    setError('');
  }, [initialTab]);

  useEffect(() => {
    if (sessionMessage) {
      setInfoMsg(sessionMessage);
    }
  }, [sessionMessage]);

  usePageSeo({
    title:
      tab === 'register'
        ? 'Đăng ký tài khoản · SOCRATES KIDS AI'
        : tab === 'forgot'
        ? 'Khôi phục mật khẩu · SOCRATES KIDS AI'
        : 'Đăng nhập · SOCRATES KIDS AI',
    description:
      'Đăng nhập hoặc tạo tài khoản học sinh, giáo viên, phụ huynh trên nền tảng gia sư AI Socratic an toàn cho tiểu học lớp 1–5.',
    path: tab === 'register' ? '/dang-ky' : tab === 'forgot' ? '/quen-mat-khau' : '/dang-nhap',
  });

  // Login state
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');

  // Register state
  const [regRole, setRegRole] = useState<'student' | 'teacher' | 'parent'>('student');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regGrade, setRegGrade] = useState(4);
  const [regEmail, setRegEmail] = useState('');
  const [regSchool, setRegSchool] = useState('');
  const [regRelation, setRegRelation] = useState('Phụ huynh');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Forgot password state
  const [forgotId, setForgotId] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStage, setResetStage] = useState<'request' | 'confirm'>('request');

  function switchTab(nextTab: AuthTab) {
    setTab(nextTab);
    setError('');
    if (nextTab === 'login') navigate('/dang-nhap');
    else if (nextTab === 'register') navigate('/dang-ky');
    else navigate('/quen-mat-khau');
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfoMsg('');

    const cleanIdentifier = loginId.trim();
    if (!cleanIdentifier || !loginPw) {
      setError('Vui lòng nhập đầy đủ tên tài khoản (hoặc email) và mật khẩu.');
      return;
    }

    setLoading(true);
    try {
      const data = await apiRequest<{ token: string; refreshToken?: string; user: UserProfileData }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: cleanIdentifier, password: loginPw }),
      });
      setAuthTokens(data.token, data.refreshToken ?? null);
      onAuthenticated(data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Đăng nhập không thành công.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfoMsg('');

    if (!acceptedTerms) {
      setError(
        'Vui lòng đọc và đánh dấu đồng ý với Chính sách bảo mật, Điều khoản sử dụng và Chính sách dữ liệu trẻ em trước khi đăng ký.'
      );
      return;
    }

    const cleanDisplayName = regDisplayName.trim();
    const cleanUsername = regUsername.trim().toLowerCase();
    const cleanEmail = regEmail.trim().toLowerCase();

    if (cleanDisplayName.length < 2) {
      setError('Vui lòng nhập tên hiển thị (ít nhất 2 ký tự).');
      return;
    }
    if (!USERNAME_REGEX.test(cleanUsername)) {
      setError(
        'Tên tài khoản cần dài 3–32 ký tự, chỉ gồm chữ thường không dấu (a-z), số (0-9), dấu chấm (.) hoặc gạch dưới (_), không chứa dấu cách.'
      );
      return;
    }
    if (regRole !== 'student' && cleanEmail && !EMAIL_REGEX.test(cleanEmail)) {
      setError('Địa chỉ email không đúng định dạng. Vui lòng kiểm tra lại.');
      return;
    }
    if (regPassword.trim().length < 6) {
      setError('Mật khẩu quá yếu: cần có ít nhất 6 ký tự và không chỉ gồm khoảng trắng.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        role: regRole,
        displayName: cleanDisplayName,
        username: cleanUsername,
        password: regPassword,
        gradeLevel: regRole === 'student' ? regGrade : undefined,
        email: regRole !== 'student' && cleanEmail ? cleanEmail : undefined,
        schoolName: regRole === 'teacher' ? regSchool.trim() : undefined,
        relationshipLabel: regRole === 'parent' ? regRelation.trim() : undefined,
        acceptedTerms: true,
      };
      const data = await apiRequest<{ token: string; refreshToken?: string; user: UserProfileData }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setAuthTokens(data.token, data.refreshToken ?? null);
      onAuthenticated(data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Đăng ký chưa thành công.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    setLoading(true);
    try {
      if (resetStage === 'request') {
        const res = await apiRequest<{ message: string }>('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ identifier: forgotId }),
        });
        setInfoMsg(res.message);
        setResetStage('confirm');
      } else {
        const res = await apiRequest<{ message: string }>('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ identifier: forgotId, resetToken, newPassword }),
        });
        setInfoMsg(res.message);
        switchTab('login');
        setLoginId(forgotId);
        setResetStage('request');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể khôi phục mật khẩu.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F7FBFF] flex flex-col">
      <header className="bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <span className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
              <Compass className="w-5 h-5" aria-hidden="true" />
            </span>
            <span className="font-display text-lg font-extrabold tracking-tight text-slate-900">SOCRATES KIDS AI</span>
          </Link>

          <Link
            to="/"
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-bold inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Trang giới thiệu</span>
          </Link>
        </div>
      </header>

      <main
        id="main-content"
        className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch"
      >
        {/* Left Hero Showcase */}
        <section className="lg:col-span-6 flex flex-col justify-between bg-white border border-slate-200 rounded-3xl p-6 sm:p-8">
          <div>
            <p className="text-xs font-semibold text-sky-700 tracking-wide">
              Think. Explore. Learn. · Nền tảng học tập Tiểu học Việt Nam Lớp 1–5
            </p>
            <h1 className="mt-3 font-display text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight text-balance">
              Cùng SOCO tự khám phá tri thức thay vì chép đáp án có sẵn
            </h1>
            <p className="mt-3 text-slate-600 text-sm sm:text-base leading-relaxed">
              Gia sư AI Socratic đặt câu hỏi gợi mở phù hợp từng độ tuổi lớp 1 đến lớp 5, nhận diện bài tập qua ảnh chụp, kèm kho bài học GDPT 2018 và 10 trò chơi rèn tư duy.
            </p>

            <div className="mt-5">
              <SocoMascot
                emotion="happy"
                size="md"
                speech="Xin chào! Đăng nhập hoặc tạo tài khoản để cùng SOCO khám phá bài học mới hôm nay nhé!"
              />
            </div>
          </div>

          <div className="mt-6 rounded-2xl overflow-hidden border border-slate-200 aspect-video bg-sky-50">
            <img
              src={heroLearningWorldImg}
              alt="Bản đồ thế giới khám phá tri thức SOCRATES KIDS AI"
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <BookOpen className="w-4 h-4 text-sky-600" aria-hidden="true" />
                <span>Không đưa đáp án sẵn</span>
              </div>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">Dẫn dắt từng bước qua câu hỏi gợi mở 3 cấp độ.</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <GraduationCap className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                <span>Phân hóa Lớp 1 đến 5</span>
              </div>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">Chế độ chữ lớn và đọc to cho Lớp 1–2.</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <ShieldCheck className="w-4 h-4 text-orange-600" aria-hidden="true" />
                <span>An toàn cho trẻ em</span>
              </div>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">Tuân thủ Nghị định 13/2023/NĐ-CP.</p>
            </div>
          </div>
        </section>

        {/* Right Auth Panel */}
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div role="tablist" aria-label="Chọn chức năng tài khoản" className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'login'}
                onClick={() => switchTab('login')}
                className={`py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  tab === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'register'}
                onClick={() => switchTab('register')}
                className={`py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  tab === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Đăng ký
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'forgot'}
                onClick={() => switchTab('forgot')}
                className={`py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  tab === 'forgot' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Quên mật khẩu
              </button>
            </div>

            {error && (
              <div role="alert" className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
                {error}
              </div>
            )}
            {infoMsg && (
              <div role="status" className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 font-medium">
                {infoMsg}
              </div>
            )}

            {tab === 'login' && (
              <form onSubmit={handleLogin} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="login-identifier" className="block text-sm font-semibold text-slate-800 mb-1.5">
                    Tên tài khoản hoặc Email
                  </label>
                  <input
                    id="login-identifier"
                    type="text"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="username"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder="Nhập tên tài khoản hoặc email"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label htmlFor="login-password" className="block text-sm font-semibold text-slate-800 mb-1.5">
                    Mật khẩu
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={loginPw}
                    onChange={(e) => setLoginPw(e.target.value)}
                    placeholder="Nhập mật khẩu"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-bold text-base flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <LogIn className="w-5 h-5" aria-hidden="true" />
                  <span>{loading ? 'Đang đăng nhập...' : 'Vào Thế giới Học tập'}</span>
                </button>
              </form>
            )}

            {tab === 'register' && (
              <form onSubmit={handleRegister} className="mt-5 space-y-3.5">
                <div>
                  <span className="block text-sm font-semibold text-slate-800 mb-1.5">Bạn là ai?</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'student', label: 'Học sinh', icon: <GraduationCap className="w-4 h-4" aria-hidden="true" /> },
                      { id: 'teacher', label: 'Giáo viên', icon: <Users className="w-4 h-4" aria-hidden="true" /> },
                      { id: 'parent', label: 'Phụ huynh', icon: <UserCheck className="w-4 h-4" aria-hidden="true" /> },
                    ].map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        aria-pressed={regRole === r.id}
                        onClick={() => setRegRole(r.id as 'student' | 'teacher' | 'parent')}
                        className={`py-2.5 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                          regRole === r.id
                            ? 'bg-sky-50 border-sky-500 text-sky-900'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {r.icon}
                        <span>{r.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="reg-display-name" className="block text-xs font-semibold text-slate-700 mb-1">
                      Tên hiển thị
                    </label>
                    <input
                      id="reg-display-name"
                      type="text"
                      required
                      autoComplete="name"
                      value={regDisplayName}
                      onChange={(e) => setRegDisplayName(e.target.value)}
                      placeholder={regRole === 'student' ? 'Ví dụ: Bé Bảo Nam' : 'Họ và tên'}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  {regRole === 'student' ? (
                    <div>
                      <label htmlFor="reg-grade" className="block text-xs font-semibold text-slate-700 mb-1">
                        Lớp học
                      </label>
                      <select
                        id="reg-grade"
                        value={regGrade}
                        onChange={(e) => setRegGrade(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        {[1, 2, 3, 4, 5].map((g) => (
                          <option key={g} value={g}>
                            Lớp {g}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-700 mb-1">
                        Email
                      </label>
                      <input
                        id="reg-email"
                        type="email"
                        inputMode="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        autoComplete="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="email@example.com"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  )}
                </div>

                {regRole === 'teacher' && (
                  <div>
                    <label htmlFor="reg-school" className="block text-xs font-semibold text-slate-700 mb-1">
                      Trường Tiểu học
                    </label>
                    <input
                      id="reg-school"
                      type="text"
                      value={regSchool}
                      onChange={(e) => setRegSchool(e.target.value)}
                      placeholder="Tên trường đang giảng dạy"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                )}

                {regRole === 'parent' && (
                  <div>
                    <label htmlFor="reg-relation" className="block text-xs font-semibold text-slate-700 mb-1">
                      Vai trò với bé
                    </label>
                    <input
                      id="reg-relation"
                      type="text"
                      value={regRelation}
                      onChange={(e) => setRegRelation(e.target.value)}
                      placeholder="Mẹ / Bố / Người giám hộ"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="reg-username" className="block text-xs font-semibold text-slate-700 mb-1">
                    Tên tài khoản (chữ không dấu &amp; số)
                  </label>
                  <input
                    id="reg-username"
                    type="text"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="username"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="Ví dụ: baonam_lop3"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label htmlFor="reg-password" className="block text-xs font-semibold text-slate-700 mb-1">
                    Mật khẩu (ít nhất 6 ký tự)
                  </label>
                  <input
                    id="reg-password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Tạo mật khẩu dễ nhớ"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                {regRole === 'student' && (
                  <p className="text-xs text-slate-700 bg-sky-50 border border-sky-200 rounded-xl p-3">
                    Bảo vệ dữ liệu trẻ em (Nghị định 13/2023/NĐ-CP): Hệ thống không thu thập email hay số điện thoại của bé. Sau khi tạo tài khoản, phụ huynh có thể dùng mã liên kết trong hồ sơ để xác nhận đồng hành.
                  </p>
                )}

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 cursor-pointer">
                  <input
                    id="reg-accept-terms"
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 shrink-0"
                  />
                  <span>
                    Tôi đã đọc và đồng ý với{' '}
                    <Link to="/chinh-sach-bao-mat" className="text-sky-700 font-bold hover:underline">
                      Chính sách bảo mật
                    </Link>
                    ,{' '}
                    <Link to="/dieu-khoan-su-dung" className="text-sky-700 font-bold hover:underline">
                      Điều khoản sử dụng
                    </Link>{' '}
                    và{' '}
                    <Link to="/chinh-sach-du-lieu-tre-em" className="text-sky-700 font-bold hover:underline">
                      Chính sách dữ liệu trẻ em
                    </Link>
                    .
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-bold text-base flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-5 h-5" aria-hidden="true" />
                  <span>{loading ? 'Đang tạo tài khoản...' : 'Hoàn tất đăng ký'}</span>
                </button>
              </form>
            )}

            {tab === 'forgot' && (
              <form onSubmit={handleForgot} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="forgot-id" className="block text-sm font-semibold text-slate-800 mb-1.5">
                    Tên tài khoản hoặc Email đã đăng ký
                  </label>
                  <input
                    id="forgot-id"
                    type="text"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="username"
                    value={forgotId}
                    onChange={(e) => setForgotId(e.target.value)}
                    placeholder="Nhập tên tài khoản"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                {resetStage === 'confirm' && (
                  <>
                    <div>
                      <label htmlFor="reset-token" className="block text-sm font-semibold text-slate-800 mb-1.5">
                        Mã khôi phục
                      </label>
                      <input
                        id="reset-token"
                        type="text"
                        required
                        autoCapitalize="characters"
                        autoCorrect="off"
                        spellCheck={false}
                        value={resetToken}
                        onChange={(e) => setResetToken(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-mono-nums"
                      />
                    </div>
                    <div>
                      <label htmlFor="reset-new-pw" className="block text-sm font-semibold text-slate-800 mb-1.5">
                        Mật khẩu mới
                      </label>
                      <input
                        id="reset-new-pw"
                        type="password"
                        required
                        minLength={6}
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Ít nhất 6 ký tự"
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm"
                      />
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" aria-hidden="true" />
                  <span>{resetStage === 'request' ? 'Gửi yêu cầu khôi phục mật khẩu' : 'Cập nhật mật khẩu mới'}</span>
                </button>
              </form>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>Cần hỗ trợ tài khoản?</span>
            <div className="flex flex-wrap gap-3 font-semibold">
              <Link to="/chinh-sach-bao-mat" className="hover:text-sky-700">Bảo mật</Link>
              <Link to="/chinh-sach-du-lieu-tre-em" className="hover:text-sky-700">Dữ liệu trẻ em</Link>
              <Link to="/lien-he" className="hover:text-sky-700">Liên hệ</Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
