import React, { useEffect, useState } from 'react';
import { Compass, LogOut, Menu, X } from 'lucide-react';
import { apiRequest, getAuthToken, setAuthToken, UserProfileData } from './lib/api';
import { AuthPortal } from './components/AuthPortal';
import { StudentWorld } from './components/StudentWorld';
import { SocraticTutorView } from './components/SocraticTutorView';
import { KnowledgeWorldView } from './components/KnowledgeWorldView';
import { PlayLearnView } from './components/PlayLearnView';
import { StudentAnalyticsAndBadges } from './components/StudentAnalyticsAndBadges';
import { TeacherCenterView } from './components/TeacherCenterView';
import { ParentCenterView } from './components/ParentCenterView';
import { AdminCenterView } from './components/AdminCenterView';

type AppPage =
  | 'student_world'
  | 'tutor'
  | 'knowledge'
  | 'games'
  | 'analytics'
  | 'teacher'
  | 'parent'
  | 'admin';

function defaultPageForRole(role: UserProfileData['role']): AppPage {
  if (role === 'teacher') return 'teacher';
  if (role === 'parent') return 'parent';
  if (role === 'admin') return 'admin';
  return 'student_world';
}

export default function App() {
  const [user, setUser] = useState<UserProfileData | null>(null);
  const [booting, setBooting] = useState(true);
  const [page, setPage] = useState<AppPage>('student_world');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Deep-link context into Tutor / Knowledge / Games
  const [tutorOpts, setTutorOpts] = useState<{
    subjectId?: number;
    sessionId?: number;
    topic?: string;
    openScanner?: boolean;
  }>({});
  const [subjectFilter, setSubjectFilter] = useState<number | undefined>(undefined);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setBooting(false);
      return;
    }
    apiRequest<{ user: UserProfileData }>('/api/auth/me')
      .then((res) => {
        setUser(res.user);
        setPage(defaultPageForRole(res.user.role));
      })
      .catch(() => {
        setAuthToken(null);
      })
      .finally(() => {
        setBooting(false);
      });
  }, []);

  function handleAuthenticated(loggedUser: UserProfileData) {
    setUser(loggedUser);
    setPage(defaultPageForRole(loggedUser.role));
  }

  function handleLogout() {
    setAuthToken(null);
    setUser(null);
    setTutorOpts({});
    setSubjectFilter(undefined);
  }

  if (booting) {
    return (
      <div className="min-h-screen bg-[#F7FBFF] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white mx-auto flex items-center justify-center">
            <Compass className="w-6 h-6 animate-spin" />
          </div>
          <div className="font-display font-bold text-slate-800">Đang mở Thế giới Học tập...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPortal onAuthenticated={handleAuthenticated} />;
  }

  const navItems: Array<{ id: AppPage; label: string }> =
    user.role === 'student'
      ? [
          { id: 'student_world', label: 'Thế giới Học tập' },
          { id: 'tutor', label: 'Gia sư SOCO' },
          { id: 'knowledge', label: 'Kho Tri thức' },
          { id: 'games', label: 'Chơi & Học' },
          { id: 'analytics', label: 'Thành tích & Tiến độ' },
        ]
      : user.role === 'teacher'
      ? [
          { id: 'teacher', label: 'Trung tâm Giáo viên' },
          { id: 'knowledge', label: 'Kho Tri thức' },
          { id: 'games', label: 'Trò chơi Luyện tập' },
        ]
      : user.role === 'parent'
      ? [{ id: 'parent', label: 'Góc Phụ huynh' }]
      : [
          { id: 'admin', label: 'Quản trị Hệ thống' },
          { id: 'teacher', label: 'Giáo viên' },
          { id: 'knowledge', label: 'Kho Tri thức' },
        ];

  return (
    <div className="min-h-screen bg-[#F7FBFF] flex flex-col">
      {/* Clean 3-zone Top Navigation Contract */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Title */}
          <button
            type="button"
            onClick={() => setPage(defaultPageForRole(user.role))}
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center">
              <Compass className="w-4 h-4" />
            </div>
            <span className="font-display text-lg font-extrabold tracking-tight text-slate-900">SOCRATES KIDS AI</span>
          </button>

          {/* Zone 2: Single-line Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'tutor') setTutorOpts({});
                  if (item.id !== 'knowledge' && item.id !== 'games') setSubjectFilter(undefined);
                  setPage(item.id);
                }}
                className={`py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer border-b-2 ${
                  page === item.id
                    ? 'text-sky-700 border-sky-600'
                    : 'text-slate-600 border-transparent hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Primary Account Action */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline text-xs font-semibold text-slate-600 truncate max-w-[140px]">
              {user.display_name}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="md:hidden p-2 rounded-xl bg-slate-100 text-slate-700 cursor-pointer"
              aria-label="Mở menu điều hướng"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 flex flex-wrap gap-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setPage(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold ${
                  page === item.id ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Main Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {page === 'student_world' && (
          <StudentWorld
            user={user}
            onUserUpdated={setUser}
            onOpenTutor={(opts) => {
              setTutorOpts(opts || {});
              setPage('tutor');
            }}
            onOpenKnowledge={(subId) => {
              setSubjectFilter(subId);
              setPage('knowledge');
            }}
            onOpenGames={(subId) => {
              setSubjectFilter(subId);
              setPage('games');
            }}
            onOpenBadges={() => setPage('analytics')}
          />
        )}

        {page === 'tutor' && (
          <SocraticTutorView
            user={user}
            onUserUpdated={setUser}
            initialSubjectId={tutorOpts.subjectId}
            initialSessionId={tutorOpts.sessionId}
            initialTopic={tutorOpts.topic}
            autoOpenScanner={tutorOpts.openScanner}
          />
        )}

        {page === 'knowledge' && (
          <KnowledgeWorldView
            user={user}
            initialSubjectId={subjectFilter}
            onUserUpdated={setUser}
            onAskSoco={(subId, topicTitle) => {
              setTutorOpts({ subjectId: subId, topic: topicTitle });
              setPage('tutor');
            }}
          />
        )}

        {page === 'games' && (
          <PlayLearnView user={user} initialSubjectId={subjectFilter} onUserUpdated={setUser} />
        )}

        {page === 'analytics' && <StudentAnalyticsAndBadges user={user} />}

        {page === 'teacher' && <TeacherCenterView />}

        {page === 'parent' && <ParentCenterView />}

        {page === 'admin' && <AdminCenterView />}
      </main>

      <footer className="border-t border-slate-200 bg-white/80 py-4 px-4 sm:px-6 text-center text-xs text-slate-500">
        SOCRATES KIDS AI · Think. Explore. Learn. · Nền tảng gia sư AI Socratic an toàn cho học sinh tiểu học Việt Nam (Lớp 1–5)
      </footer>
    </div>
  );
}
