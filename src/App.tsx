import React, { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router';
import { Compass, LogOut, Menu, X } from 'lucide-react';
import { apiRequest, setAuthTokens, UserProfileData, UserRole } from './lib/api';
import { GradeModeProvider, useGradeMode } from './lib/gradeMode';
import { usePageSeo } from './lib/seo';
import { AuthPortal } from './components/AuthPortal';
import { LandingPage } from './components/LandingPage';
import { LegalPageView } from './components/LegalPages';
import { NotFoundPage } from './components/NotFoundPage';
import { OfflineIndicator, PWAInstallButton } from './components/PwaControls';
import { StudentWorld } from './components/StudentWorld';
import { SocraticTutorView } from './components/SocraticTutorView';
import { KnowledgeWorldView } from './components/KnowledgeWorldView';
import { PlayLearnView } from './components/PlayLearnView';
import { StudentAnalyticsAndBadges } from './components/StudentAnalyticsAndBadges';
import { TeacherCenterView } from './components/TeacherCenterView';
import { ParentCenterView } from './components/ParentCenterView';
import { AdminCenterView } from './components/AdminCenterView';

export function defaultPathForRole(role: UserRole): string {
  if (role === 'teacher') return '/giao-vien';
  if (role === 'parent') return '/phu-huynh';
  if (role === 'admin') return '/quan-tri';
  return '/hoc';
}

function getNavItemsForRole(role: UserRole): Array<{ to: string; label: string }> {
  if (role === 'student') {
    return [
      { to: '/hoc', label: 'Thế giới Học tập' },
      { to: '/gia-su', label: 'Gia sư SOCO' },
      { to: '/kho-tri-thuc', label: 'Kho Tri thức' },
      { to: '/tro-choi', label: 'Chơi & Học' },
      { to: '/thanh-tich', label: 'Thành tích & Tiến độ' },
    ];
  }
  if (role === 'teacher') {
    return [
      { to: '/giao-vien', label: 'Trung tâm Giáo viên' },
      { to: '/kho-tri-thuc', label: 'Kho Tri thức' },
      { to: '/tro-choi', label: 'Trò chơi Luyện tập' },
    ];
  }
  if (role === 'parent') {
    return [{ to: '/phu-huynh', label: 'Góc Phụ huynh' }];
  }
  return [
    { to: '/quan-tri', label: 'Quản trị Hệ thống' },
    { to: '/giao-vien', label: 'Giáo viên' },
    { to: '/kho-tri-thuc', label: 'Kho Tri thức' },
  ];
}

function getSeoForWorkspacePath(pathname: string): { title: string; description: string } {
  switch (pathname) {
    case '/hoc':
      return {
        title: 'Thế giới Học tập · SOCRATES KIDS AI',
        description: 'Bảng điều khiển học tập cá nhân hóa cho học sinh tiểu học lớp 1–5.',
      };
    case '/gia-su':
      return {
        title: 'Gia sư AI Socratic SOCO · SOCRATES KIDS AI',
        description: 'Trò chuyện hỏi đáp theo phương pháp Socratic và quét ảnh đề bài thông minh.',
      };
    case '/kho-tri-thuc':
      return {
        title: 'Kho Tri thức GDPT 2018 · SOCRATES KIDS AI',
        description: '100+ bài học Toán, Tiếng Việt, Khoa học từ Lớp 1 đến Lớp 5, hỗ trợ đọc ngoại tuyến.',
      };
    case '/tro-choi':
      return {
        title: 'Play & Learn — Chơi & Học · SOCRATES KIDS AI',
        description: '10 dạng trò chơi tư duy tương tác rèn kỹ năng tiểu học.',
      };
    case '/thanh-tich':
      return {
        title: 'Thành tích & Tiến độ · SOCRATES KIDS AI',
        description: 'Hồ sơ năng lực, nhật ký lỗi cần chú ý và huy hiệu kiên trì của em.',
      };
    case '/giao-vien':
      return {
        title: 'Trung tâm Giáo viên · SOCRATES KIDS AI',
        description: 'Quản lý lớp học, tạo bài tập AI, kiểm duyệt học liệu và báo cáo PDF/CSV.',
      };
    case '/phu-huynh':
      return {
        title: 'Góc Phụ huynh Đồng hành · SOCRATES KIDS AI',
        description: 'Theo dõi báo cáo tuần, tiến độ học tập và nhận gợi ý đồng hành cùng con tại nhà.',
      };
    case '/quan-tri':
      return {
        title: 'Quản trị Hệ thống · SOCRATES KIDS AI',
        description: 'Quản trị người dùng, kiểm duyệt nội dung, lưu trữ dữ liệu trẻ em và nhật ký AI.',
      };
    default:
      return {
        title: 'SOCRATES KIDS AI · Think. Explore. Learn.',
        description: 'Nền tảng gia sư AI Socratic an toàn cho học sinh tiểu học Việt Nam (Lớp 1–5).',
      };
  }
}

function TutorRouteWrapper({
  user,
  onUserUpdated,
}: {
  user: UserProfileData;
  onUserUpdated: (user: UserProfileData) => void;
}) {
  const [searchParams] = useSearchParams();
  const subjectIdParam = searchParams.get('subjectId');
  const sessionIdParam = searchParams.get('sessionId');
  const topicParam = searchParams.get('topic') || undefined;
  const scanParam = searchParams.get('scan') === '1';

  return (
    <SocraticTutorView
      user={user}
      onUserUpdated={onUserUpdated}
      initialSubjectId={subjectIdParam ? Number(subjectIdParam) : undefined}
      initialSessionId={sessionIdParam ? Number(sessionIdParam) : undefined}
      initialTopic={topicParam}
      autoOpenScanner={scanParam}
    />
  );
}

function KnowledgeRouteWrapper({
  user,
  onUserUpdated,
}: {
  user: UserProfileData;
  onUserUpdated: (user: UserProfileData) => void;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const subjectIdParam = searchParams.get('subjectId');

  return (
    <KnowledgeWorldView
      user={user}
      initialSubjectId={subjectIdParam ? Number(subjectIdParam) : undefined}
      onUserUpdated={onUserUpdated}
      onAskSoco={(subId, topicTitle) => {
        const qs = new URLSearchParams();
        qs.set('subjectId', String(subId));
        if (topicTitle) qs.set('topic', topicTitle);
        navigate(`/gia-su?${qs.toString()}`);
      }}
    />
  );
}

function GamesRouteWrapper({
  user,
  onUserUpdated,
}: {
  user: UserProfileData;
  onUserUpdated: (user: UserProfileData) => void;
}) {
  const [searchParams] = useSearchParams();
  const subjectIdParam = searchParams.get('subjectId');

  return (
    <PlayLearnView
      user={user}
      initialSubjectId={subjectIdParam ? Number(subjectIdParam) : undefined}
      onUserUpdated={onUserUpdated}
    />
  );
}

function StudentWorldRouteWrapper({
  user,
  onUserUpdated,
}: {
  user: UserProfileData;
  onUserUpdated: (user: UserProfileData) => void;
}) {
  const navigate = useNavigate();

  return (
    <StudentWorld
      user={user}
      onUserUpdated={onUserUpdated}
      onOpenTutor={(opts) => {
        const qs = new URLSearchParams();
        if (opts?.subjectId) qs.set('subjectId', String(opts.subjectId));
        if (opts?.sessionId) qs.set('sessionId', String(opts.sessionId));
        if (opts?.topic) qs.set('topic', opts.topic);
        if (opts?.openScanner) qs.set('scan', '1');
        const qStr = qs.toString();
        navigate(qStr ? `/gia-su?${qStr}` : '/gia-su');
      }}
      onOpenKnowledge={(subId) => {
        navigate(subId ? `/kho-tri-thuc?subjectId=${subId}` : '/kho-tri-thuc');
      }}
      onOpenGames={(subId) => {
        navigate(subId ? `/tro-choi?subjectId=${subId}` : '/tro-choi');
      }}
      onOpenBadges={() => navigate('/thanh-tich')}
    />
  );
}

function RoleProtected({
  user,
  allowedRoles,
  children,
}: {
  user: UserProfileData;
  allowedRoles: UserRole[];
  children: React.ReactNode;
}) {
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={defaultPathForRole(user.role)} replace />;
  }
  return <>{children}</>;
}

function WorkspaceShell({
  user,
  onUserUpdated,
  onLogout,
  children,
}: {
  user: UserProfileData;
  onUserUpdated: (user: UserProfileData) => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { isGrade12Mode } = useGradeMode();

  const seo = getSeoForWorkspacePath(location.pathname);
  usePageSeo({ ...seo, path: location.pathname });

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  const navItems = getNavItemsForRole(user.role);

  return (
    <div className={`min-h-screen bg-[#F7FBFF] flex flex-col ${isGrade12Mode && user.role === 'student' ? 'grade12-mode' : ''}`}>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
          <Link to={defaultPathForRole(user.role)} className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <span className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center">
              <Compass className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="font-display text-lg font-extrabold tracking-tight text-slate-900">SOCRATES KIDS AI</span>
          </Link>

          <nav aria-label="Điều hướng chính" className="hidden md:flex items-center gap-6 text-sm font-semibold">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                    isActive ? 'text-sky-700 border-sky-600' : 'text-slate-600 border-transparent hover:text-slate-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="hidden sm:block">
              <PWAInstallButton compact />
            </div>
            <span className="hidden lg:inline text-xs font-semibold text-slate-700 truncate max-w-[140px]">
              {user.display_name}
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Đăng xuất</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="md:hidden p-2 rounded-xl bg-slate-100 text-slate-700 cursor-pointer"
              aria-label={mobileMenuOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav aria-label="Điều hướng di động" className="md:hidden border-t border-slate-200 bg-white px-4 py-3 flex flex-wrap gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `px-3.5 py-2 rounded-xl text-xs font-bold ${
                    isActive ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-800'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <div className="w-full pt-1">
              <PWAInstallButton compact />
            </div>
          </nav>
        )}
      </header>

      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>

      <footer className="border-t border-slate-200 bg-white/90 py-4 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="text-center sm:text-left">
            SOCRATES KIDS AI · Think. Explore. Learn. · Nền tảng gia sư AI Socratic an toàn cho học sinh tiểu học Việt Nam (Lớp 1–5)
          </div>
          <nav aria-label="Liên kết pháp lý" className="flex flex-wrap justify-center gap-4 font-semibold">
            <Link to="/chinh-sach-bao-mat" className="hover:text-sky-700">Chính sách bảo mật</Link>
            <Link to="/dieu-khoan-su-dung" className="hover:text-sky-700">Điều khoản sử dụng</Link>
            <Link to="/chinh-sach-du-lieu-tre-em" className="hover:text-sky-700">Chính sách dữ liệu trẻ em</Link>
            <Link to="/lien-he" className="hover:text-sky-700">Liên hệ</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function AppRoutes({
  user,
  setUser,
  booting,
  sessionMessage,
  setSessionMessage,
}: {
  user: UserProfileData | null;
  setUser: React.Dispatch<React.SetStateAction<UserProfileData | null>>;
  booting: boolean;
  sessionMessage: string;
  setSessionMessage: React.Dispatch<React.SetStateAction<string>>;
}) {
  const navigate = useNavigate();

  function handleAuthenticated(loggedUser: UserProfileData) {
    setSessionMessage('');
    setUser(loggedUser);
    navigate(defaultPathForRole(loggedUser.role), { replace: true });
  }

  function handleLogout() {
    apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setAuthTokens(null, null);
    setSessionMessage('');
    setUser(null);
    navigate('/dang-nhap', { replace: true });
  }

  if (booting) {
    return (
      <div className="min-h-screen bg-[#F7FBFF] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white mx-auto flex items-center justify-center">
            <Compass className="w-6 h-6 animate-spin" aria-hidden="true" />
          </div>
          <div className="font-display font-bold text-slate-800">Đang mở Thế giới Học tập...</div>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Legal Pages accessible both logged-in and logged-out */}
      <Route path="/chinh-sach-bao-mat" element={<LegalPageView kind="privacy" />} />
      <Route path="/dieu-khoan-su-dung" element={<LegalPageView kind="terms" />} />
      <Route path="/chinh-sach-du-lieu-tre-em" element={<LegalPageView kind="children" />} />
      <Route path="/lien-he" element={<LegalPageView kind="contact" />} />

      {/* Public Landing & Auth Routes */}
      <Route
        path="/"
        element={user ? <Navigate to={defaultPathForRole(user.role)} replace /> : <LandingPage />}
      />
      <Route
        path="/dang-nhap"
        element={
          user ? (
            <Navigate to={defaultPathForRole(user.role)} replace />
          ) : (
            <AuthPortal initialTab="login" onAuthenticated={handleAuthenticated} sessionMessage={sessionMessage} />
          )
        }
      />
      <Route
        path="/dang-ky"
        element={
          user ? (
            <Navigate to={defaultPathForRole(user.role)} replace />
          ) : (
            <AuthPortal initialTab="register" onAuthenticated={handleAuthenticated} sessionMessage={sessionMessage} />
          )
        }
      />
      <Route
        path="/quen-mat-khau"
        element={
          user ? (
            <Navigate to={defaultPathForRole(user.role)} replace />
          ) : (
            <AuthPortal initialTab="forgot" onAuthenticated={handleAuthenticated} sessionMessage={sessionMessage} />
          )
        }
      />

      {/* Protected Workspace Routes */}
      <Route
        path="/hoc"
        element={
          !user ? (
            <Navigate to="/dang-nhap" replace />
          ) : (
            <WorkspaceShell user={user} onUserUpdated={setUser} onLogout={handleLogout}>
              <RoleProtected user={user} allowedRoles={['student']}>
                <StudentWorldRouteWrapper user={user} onUserUpdated={setUser} />
              </RoleProtected>
            </WorkspaceShell>
          )
        }
      />
      <Route
        path="/gia-su"
        element={
          !user ? (
            <Navigate to="/dang-nhap" replace />
          ) : (
            <WorkspaceShell user={user} onUserUpdated={setUser} onLogout={handleLogout}>
              <RoleProtected user={user} allowedRoles={['student']}>
                <TutorRouteWrapper user={user} onUserUpdated={setUser} />
              </RoleProtected>
            </WorkspaceShell>
          )
        }
      />
      <Route
        path="/kho-tri-thuc"
        element={
          !user ? (
            <Navigate to="/dang-nhap" replace />
          ) : (
            <WorkspaceShell user={user} onUserUpdated={setUser} onLogout={handleLogout}>
              <RoleProtected user={user} allowedRoles={['student', 'teacher', 'admin']}>
                <KnowledgeRouteWrapper user={user} onUserUpdated={setUser} />
              </RoleProtected>
            </WorkspaceShell>
          )
        }
      />
      <Route
        path="/tro-choi"
        element={
          !user ? (
            <Navigate to="/dang-nhap" replace />
          ) : (
            <WorkspaceShell user={user} onUserUpdated={setUser} onLogout={handleLogout}>
              <RoleProtected user={user} allowedRoles={['student', 'teacher', 'admin']}>
                <GamesRouteWrapper user={user} onUserUpdated={setUser} />
              </RoleProtected>
            </WorkspaceShell>
          )
        }
      />
      <Route
        path="/thanh-tich"
        element={
          !user ? (
            <Navigate to="/dang-nhap" replace />
          ) : (
            <WorkspaceShell user={user} onUserUpdated={setUser} onLogout={handleLogout}>
              <RoleProtected user={user} allowedRoles={['student']}>
                <StudentAnalyticsAndBadges user={user} />
              </RoleProtected>
            </WorkspaceShell>
          )
        }
      />
      <Route
        path="/giao-vien"
        element={
          !user ? (
            <Navigate to="/dang-nhap" replace />
          ) : (
            <WorkspaceShell user={user} onUserUpdated={setUser} onLogout={handleLogout}>
              <RoleProtected user={user} allowedRoles={['teacher', 'admin']}>
                <TeacherCenterView />
              </RoleProtected>
            </WorkspaceShell>
          )
        }
      />
      <Route
        path="/phu-huynh"
        element={
          !user ? (
            <Navigate to="/dang-nhap" replace />
          ) : (
            <WorkspaceShell user={user} onUserUpdated={setUser} onLogout={handleLogout}>
              <RoleProtected user={user} allowedRoles={['parent', 'admin']}>
                <ParentCenterView />
              </RoleProtected>
            </WorkspaceShell>
          )
        }
      />
      <Route
        path="/quan-tri"
        element={
          !user ? (
            <Navigate to="/dang-nhap" replace />
          ) : (
            <WorkspaceShell user={user} onUserUpdated={setUser} onLogout={handleLogout}>
              <RoleProtected user={user} allowedRoles={['admin']}>
                <AdminCenterView />
              </RoleProtected>
            </WorkspaceShell>
          )
        }
      />

      {/* 404 Catch-All */}
      <Route path="*" element={<NotFoundPage homePath={user ? defaultPathForRole(user.role) : '/'} />} />
    </Routes>
  );
}

export default function App() {
  const [user, setUser] = useState<UserProfileData | null>(null);
  const [booting, setBooting] = useState(true);
  const [sessionMessage, setSessionMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiRequest<{ user: UserProfileData }>('/api/auth/me')
      .then((res) => {
        if (!cancelled) {
          setUser(res.user);
          setSessionMessage('');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuthTokens(null, null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBooting(false);
        }
      });

    const onSessionExpired = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string }>;
      setAuthTokens(null, null);
      setUser(null);
      setSessionMessage(customEvent.detail?.message || 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    };

    window.addEventListener('socrates:session-expired', onSessionExpired);
    return () => {
      cancelled = true;
      window.removeEventListener('socrates:session-expired', onSessionExpired);
    };
  }, []);

  return (
    <BrowserRouter>
      <GradeModeProvider studentGrade={user?.profile?.grade_level}>
        <a href="#main-content" className="skip-to-content">
          Bỏ qua đến nội dung chính
        </a>
        <OfflineIndicator />
        <AppRoutes
          user={user}
          setUser={setUser}
          booting={booting}
          sessionMessage={sessionMessage}
          setSessionMessage={setSessionMessage}
        />
      </GradeModeProvider>
    </BrowserRouter>
  );
}
