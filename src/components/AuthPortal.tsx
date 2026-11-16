import React, { useState } from 'react';
import {
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
import { apiRequest, setAuthToken, UserProfileData, UserRole } from '../lib/api';
import { SocoMascot } from './SocoMascot';

interface AuthPortalProps {
  onAuthenticated: (user: UserProfileData) => void;
}

type AuthTab = 'login' | 'register' | 'forgot';

export function AuthPortal({ onAuthenticated }: AuthPortalProps) {
  const [tab, setTab] = useState<AuthTab>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

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

  // Forgot password state
  const [forgotId, setForgotId] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStage, setResetStage] = useState<'request' | 'confirm'>('request');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    setLoading(true);
    try {
      const data = await apiRequest<{ token: string; user: UserProfileData }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: loginId, password: loginPw }),
      });
      setAuthToken(data.token);
      onAuthenticated(data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Đăng nhập không thành công.');
    } finally {
      setLoading(false);
    }
  }

  async function quickLogin(username: string, password: string) {
    setError('');
    setInfoMsg('');
    setLoading(true);
    try {
      const data = await apiRequest<{ token: string; user: UserProfileData }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: username, password }),
      });
      setAuthToken(data.token);
      onAuthenticated(data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể đăng nhập.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    setLoading(true);
    try {
      const payload = {
        role: regRole,
        displayName: regDisplayName,
        username: regUsername,
        password: regPassword,
        gradeLevel: regRole === 'student' ? regGrade : undefined,
        email: regRole !== 'student' ? regEmail : undefined,
        schoolName: regRole === 'teacher' ? regSchool : undefined,
        relationshipLabel: regRole === 'parent' ? regRelation : undefined,
      };
      const data = await apiRequest<{ token: string; user: UserProfileData; verificationHint?: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setAuthToken(data.token);
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
        const res = await apiRequest<{ message: string; resetTokenPreview: string }>('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ identifier: forgotId }),
        });
        setInfoMsg(`${res.message} Mã khôi phục của bạn là: ${res.resetTokenPreview}`);
        setResetToken(res.resetTokenPreview);
        setResetStage('confirm');
      } else {
        const res = await apiRequest<{ message: string }>('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ identifier: forgotId, resetToken, newPassword }),
        });
        setInfoMsg(res.message);
        setTab('login');
        setLoginId(forgotId);
        setResetStage('request');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể khôi phục mật khẩu.');
    } finally {
      setLoading(false);
    }
  }

  const demoAccounts: Array<{ label: string; role: UserRole; user: string; pass: string; desc: string }> = [
    { label: 'Học sinh Lớp 4', role: 'student', user: 'minhanh4a', pass: 'Hocsinh123!', desc: 'Bé Minh Anh' },
    { label: 'Giáo viên', role: 'teacher', user: 'colan_gv', pass: 'Giaovien123!', desc: 'Cô Lan (Lớp 4A)' },
    { label: 'Phụ huynh', role: 'parent', user: 'ph_minhanh', pass: 'Phuhuynh123!', desc: 'Bố Minh Anh' },
    { label: 'Quản trị viên', role: 'admin', user: 'admin_soco', pass: 'AdminSoco123!', desc: 'Quản trị hệ thống' },
  ];

  return (
    <div className="min-h-screen bg-[#F7FBFF] flex flex-col">
      {/* Clean 3-zone top bar */}
      <header className="bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
              <Compass className="w-5 h-5" />
            </div>
            <span className="font-display text-lg font-extrabold tracking-tight text-slate-900">SOCRATES KIDS AI</span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-sky-700 transition-colors whitespace-nowrap shrink-0">
              Phương pháp Socratic
            </a>
            <a href="#features" className="hover:text-sky-700 transition-colors whitespace-nowrap shrink-0">
              Chương trình Lớp 1–5
            </a>
            <a href="#features" className="hover:text-sky-700 transition-colors whitespace-nowrap shrink-0">
              An toàn Trẻ em
            </a>
          </nav>

          <button
            type="button"
            onClick={() => setTab('register')}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Tạo tài khoản mới
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left Hero Showcase */}
        <section className="lg:col-span-7 flex flex-col justify-between bg-white border border-slate-200 rounded-3xl p-6 sm:p-8">
          <div>
            <p className="text-xs font-semibold text-sky-700 tracking-wide">
              Think. Explore. Learn. · Nền tảng học tập Tiểu học Việt Nam Lớp 1–5
            </p>
            <h1 className="mt-3 font-display text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight text-balance">
              Cùng SOCO tự khám phá tri thức thay vì chép đáp án có sẵn
            </h1>
            <p className="mt-3 text-slate-600 text-base leading-relaxed max-w-2xl">
              Gia sư AI Socratic đặt câu hỏi gợi mở phù hợp từng độ tuổi lớp 1 đến lớp 5, nhận diện bài tập qua ảnh chụp, kèm kho bài học trực quan và 10 trò chơi rèn tư duy.
            </p>

            <div className="mt-6">
              <SocoMascot
                emotion="happy"
                size="md"
                speech="Xin chào! Mình là SOCO. Hôm nay em muốn cùng mình khám phá phép tính, câu chuyện Tiếng Việt hay thí nghiệm Khoa học nào?"
              />
            </div>
          </div>

          <div className="mt-6 rounded-2xl overflow-hidden border border-slate-200 aspect-video bg-sky-50">
            <img
              src="/src/assets/images/hero_learning_world_1794794874331.jpg"
              alt="Bản đồ thế giới khám phá tri thức SOCRATES KIDS AI"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>

          <div id="features" className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <BookOpen className="w-4 h-4 text-sky-600" />
                <span>Không đưa đáp án sẵn</span>
              </div>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Dẫn dắt từng bước qua câu hỏi gợi mở và 3 cấp độ gợi ý khoa học.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <GraduationCap className="w-4 h-4 text-emerald-600" />
                <span>Phân hóa Lớp 1 đến 5</span>
              </div>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Từ ngôn ngữ trực quan cho lớp 1–2 tới phân tích nhiều bước cho lớp 4–5.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <ShieldCheck className="w-4 h-4 text-orange-500" />
                <span>An toàn cho trẻ em</span>
              </div>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Không thu thập thông tin nhạy cảm, có liên kết bảo hộ từ phụ huynh.
              </p>
            </div>
          </div>
        </section>

        {/* Right Auth Panel */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col justify-between">
          <div>
            {/* Segmented Control */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setError('');
                }}
                className={`py-2 px-3 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  tab === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setError('');
                }}
                className={`py-2 px-3 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  tab === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Đăng ký
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('forgot');
                  setError('');
                }}
                className={`py-2 px-3 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  tab === 'forgot' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Quên mật khẩu
              </button>
            </div>

            {error && (
              <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
                {error}
              </div>
            )}
            {infoMsg && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 font-medium">
                {infoMsg}
              </div>
            )}

            {tab === 'login' && (
              <form onSubmit={handleLogin} className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                    Tên tài khoản hoặc Email
                  </label>
                  <input
                    type="text"
                    required
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder="Ví dụ: minhanh4a"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">Mật khẩu</label>
                  <input
                    type="password"
                    required
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
                  <LogIn className="w-5 h-5" />
                  <span>{loading ? 'Đang đăng nhập...' : 'Vào Thế giới Học tập'}</span>
                </button>
              </form>
            )}

            {tab === 'register' && (
              <form onSubmit={handleRegister} className="mt-5 space-y-3.5">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">Bạn là ai?</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'student', label: 'Học sinh', icon: <GraduationCap className="w-4 h-4" /> },
                      { id: 'teacher', label: 'Giáo viên', icon: <Users className="w-4 h-4" /> },
                      { id: 'parent', label: 'Phụ huynh', icon: <UserCheck className="w-4 h-4" /> },
                    ].map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setRegRole(r.id as 'student' | 'teacher' | 'parent')}
                        className={`py-2.5 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                          regRole === r.id
                            ? 'bg-sky-50 border-sky-500 text-sky-800'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
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
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tên hiển thị</label>
                    <input
                      type="text"
                      required
                      value={regDisplayName}
                      onChange={(e) => setRegDisplayName(e.target.value)}
                      placeholder={regRole === 'student' ? 'Ví dụ: Bé Bảo Nam' : 'Họ và tên'}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  {regRole === 'student' ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Lớp học</label>
                      <select
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
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                      <input
                        type="email"
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
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Trường Tiểu học</label>
                    <input
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
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Vai trò với bé</label>
                    <input
                      type="text"
                      value={regRelation}
                      onChange={(e) => setRegRelation(e.target.value)}
                      placeholder="Mẹ / Bố / Người giám hộ"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tên tài khoản (chữ không dấu & số)
                  </label>
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="Ví dụ: baonam_lop3"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mật khẩu (ít nhất 6 ký tự)</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Tạo mật khẩu dễ nhớ"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                {regRole === 'student' && (
                  <p className="text-xs text-slate-600 bg-sky-50 border border-sky-100 rounded-xl p-3">
                    Bảo vệ dữ liệu trẻ em: Hệ thống không yêu cầu email hay số điện thoại của bé. Sau khi tạo tài khoản, phụ huynh có thể nhập mã liên kết trong hồ sơ để xác nhận đồng hành.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold text-base flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-5 h-5" />
                  <span>{loading ? 'Đang tạo tài khoản...' : 'Hoàn tất đăng ký'}</span>
                </button>
              </form>
            )}

            {tab === 'forgot' && (
              <form onSubmit={handleForgot} className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                    Tên tài khoản hoặc Email đã đăng ký
                  </label>
                  <input
                    type="text"
                    required
                    value={forgotId}
                    onChange={(e) => setForgotId(e.target.value)}
                    placeholder="Nhập tên tài khoản"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                {resetStage === 'confirm' && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1.5">Mã khôi phục</label>
                      <input
                        type="text"
                        required
                        value={resetToken}
                        onChange={(e) => setResetToken(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-mono-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1.5">Mật khẩu mới</label>
                      <input
                        type="password"
                        required
                        minLength={6}
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
                  <KeyRound className="w-4 h-4" />
                  <span>{resetStage === 'request' ? 'Tạo mã khôi phục mật khẩu' : 'Cập nhật mật khẩu mới'}</span>
                </button>
              </form>
            )}
          </div>

          {/* Real Role-Based Sample Logins */}
          <div className="mt-8 pt-5 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-500 mb-2.5">
              Trải nghiệm nhanh theo 4 vai trò (tài khoản thật trong cơ sở dữ liệu):
            </p>
            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.user}
                  type="button"
                  disabled={loading}
                  onClick={() => quickLogin(acc.user, acc.pass)}
                  className="text-left p-2.5 rounded-xl border border-slate-200 hover:border-sky-400 hover:bg-sky-50/50 transition-colors cursor-pointer"
                >
                  <div className="text-xs font-bold text-slate-900">{acc.label}</div>
                  <div className="text-[11px] text-slate-500 truncate">{acc.desc} · {acc.user}</div>
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
