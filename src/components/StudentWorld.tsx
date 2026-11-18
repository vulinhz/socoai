import React, { useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  Calculator,
  Compass,
  Flame,
  Gamepad2,
  HeartHandshake,
  Languages,
  Leaf,
  MessageSquare,
  PlusCircle,
  ScanSearch,
  Sparkles,
  Trophy,
  Cpu,
  Clock,
  CheckCircle2,
  Volume2,
} from 'lucide-react';
import { apiRequest, UserProfileData } from '../lib/api';
import { heroLearningWorldImg } from '../lib/assets';
import { useGradeMode } from '../lib/gradeMode';
import { SocoMascot } from './SocoMascot';

interface StudentWorldProps {
  user: UserProfileData;
  onUserUpdated: (user: UserProfileData) => void;
  onOpenTutor: (opts?: { subjectId?: number; topic?: string; sessionId?: number; openScanner?: boolean }) => void;
  onOpenKnowledge: (subjectId?: number) => void;
  onOpenGames: (subjectId?: number) => void;
  onOpenBadges: () => void;
}

interface DashboardData {
  user: UserProfileData;
  subjects: Array<{
    id: number;
    code: string;
    name: string;
    description: string;
    color_token: string;
    icon_name: string;
  }>;
  missions: Array<{
    id: number;
    title: string;
    description: string;
    mission_type: string;
    target_count: number;
    xp_reward: number;
    current_count: number;
    completed: number;
  }>;
  sessions: Array<{
    id: number;
    topic: string;
    mode: string;
    subject_name: string;
    grade_level: number;
    status: string;
    updated_at: string;
  }>;
  achievements: Array<{
    id: number;
    title: string;
    description: string;
    earned_at: string | null;
    color_token: string;
  }>;
  assignments: Array<{
    id: number;
    title: string;
    class_name: string;
    subject_name: string;
    due_date: string;
    submission_status: string;
    score: number | null;
  }>;
  stats: {
    completed_count: number;
    total_seconds: number;
    avg_score: number;
  };
  classes: Array<{
    id: number;
    name: string;
    join_code: string;
    teacher_name: string;
  }>;
}

const SUBJECT_STYLES: Record<string, string> = {
  sky: 'bg-sky-50 border-sky-200 hover:border-sky-400 text-sky-900',
  coral: 'bg-orange-50 border-orange-200 hover:border-orange-400 text-orange-950',
  mint: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400 text-emerald-950',
  lavender: 'bg-violet-50 border-violet-200 hover:border-violet-400 text-violet-950',
  yellow: 'bg-amber-50 border-amber-200 hover:border-amber-400 text-amber-950',
};

function renderSubjectIcon(name: string) {
  switch (name) {
    case 'Calculator':
      return <Calculator className="w-5 h-5 text-sky-600" aria-hidden="true" />;
    case 'BookOpen':
      return <BookOpen className="w-5 h-5 text-orange-600" aria-hidden="true" />;
    case 'Leaf':
      return <Leaf className="w-5 h-5 text-emerald-600" aria-hidden="true" />;
    case 'Languages':
      return <Languages className="w-5 h-5 text-violet-600" aria-hidden="true" />;
    case 'HeartHandshake':
      return <HeartHandshake className="w-5 h-5 text-amber-600" aria-hidden="true" />;
    case 'Cpu':
      return <Cpu className="w-5 h-5 text-violet-600" aria-hidden="true" />;
    default:
      return <Compass className="w-5 h-5 text-sky-600" aria-hidden="true" />;
  }
}

export function StudentWorld({
  onUserUpdated,
  onOpenTutor,
  onOpenKnowledge,
  onOpenGames,
  onOpenBadges,
}: StudentWorldProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinMsg, setJoinMsg] = useState('');

  const { isGrade12Mode, toggleGrade12Mode, speakVietnamese, speechSupported } = useGradeMode();

  async function loadDashboard() {
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest<DashboardData>('/api/student/dashboard');
      setData(res);
      if (res.user) onUserUpdated(res.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể tải Thế giới học tập.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function handleChangeGrade(newGrade: number) {
    try {
      const res = await apiRequest<{ user: UserProfileData }>('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ gradeLevel: newGrade }),
      });
      onUserUpdated(res.user);
      loadDashboard();
    } catch {
      // ignore
    }
  }

  async function handleJoinClass(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoinMsg('');
    try {
      const res = await apiRequest<{ message: string }>('/api/student/join-class', {
        method: 'POST',
        body: JSON.stringify({ joinCode }),
      });
      setJoinMsg(res.message);
      setJoinCode('');
      loadDashboard();
    } catch (err: unknown) {
      setJoinMsg(err instanceof Error ? err.message : 'Không tìm thấy mã lớp.');
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-44 rounded-3xl bg-white border border-slate-200" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 rounded-3xl bg-white border border-slate-200" />
          <div className="h-80 rounded-3xl bg-white border border-slate-200" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white border border-red-200 rounded-3xl p-8 text-center">
        <p className="text-red-700 font-semibold">{error || 'Chưa có dữ liệu học tập.'}</p>
        <button
          type="button"
          onClick={loadDashboard}
          className="mt-4 px-5 py-2.5 rounded-xl bg-sky-600 text-white font-semibold text-sm cursor-pointer"
        >
          Thử tải lại
        </button>
      </div>
    );
  }

  const profile = data.user.profile;
  const xp = profile?.xp ?? 0;
  const level = profile?.level ?? 1;
  const xpInLevel = xp % 150;
  const xpPct = Math.round((xpInLevel / 150) * 100);
  const gradeLevel = profile?.grade_level ?? 4;
  const earnedBadges = data.achievements.filter((a) => a.earned_at);
  const studyMinutes = Math.round((data.stats?.total_seconds || 0) / 60);

  const greetingSpeech = isGrade12Mode
    ? `Chào ${data.user.display_name}! Hôm nay mình cùng học vui nhé. Nhấn nút xanh để hỏi SOCO nào!`
    : `Chào ${data.user.display_name}! Hôm nay là ngày thứ ${profile?.streak_days ?? 1} em kiên trì khám phá tri thức. Mình đang ở cấp độ ${level} — sẵn sàng chinh phục thử thách mới chưa?`;

  return (
    <div className="space-y-6">
      {/* Hero Greeting & Primary CTA */}
      <section className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
              <span>{data.user.display_name}</span>
              <span aria-hidden="true">·</span>
              <label htmlFor="student-grade-select" className="inline-flex items-center gap-1.5 text-slate-700">
                <span>Đang học:</span>
                <select
                  id="student-grade-select"
                  value={gradeLevel}
                  onChange={(e) => handleChangeGrade(Number(e.target.value))}
                  className="bg-sky-50 border border-sky-200 rounded-lg px-2 py-1 text-xs font-bold text-sky-900 cursor-pointer"
                >
                  {[1, 2, 3, 4, 5].map((g) => (
                    <option key={g} value={g}>
                      Lớp {g}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                aria-pressed={isGrade12Mode}
                onClick={toggleGrade12Mode}
                className={`px-3 py-1 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                  isGrade12Mode
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                    : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Chế độ Lớp 1–2: {isGrade12Mode ? 'Đang bật (Chữ lớn)' : 'Tắt'}
              </button>

              {profile?.link_code && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    Mã liên kết phụ huynh: <strong className="font-mono-nums text-slate-800">{profile.link_code}</strong>
                  </span>
                </>
              )}
            </div>

            <div className="space-y-2">
              <SocoMascot emotion="happy" size="lg" speech={greetingSpeech} />
              {speechSupported && (
                <button
                  type="button"
                  onClick={() => speakVietnamese(greetingSpeech)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 hover:text-sky-900 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" aria-hidden="true" />
                  <span>Nghe SOCO chào hỏi</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onOpenTutor()}
                className="px-6 py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-base flex items-center gap-2.5 shadow-xs transition-colors cursor-pointer"
              >
                <MessageSquare className="w-5 h-5" aria-hidden="true" />
                <span>{isGrade12Mode ? 'Hỏi SOCO ngay' : 'Bắt đầu học cùng SOCO'}</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenTutor({ openScanner: true })}
                className="px-5 py-3.5 rounded-2xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-950 font-bold text-sm flex items-center gap-2 transition-colors cursor-pointer"
              >
                <ScanSearch className="w-4 h-4 text-orange-600" aria-hidden="true" />
                <span>Chụp ảnh bài tập</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenGames()}
                className="px-5 py-3.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-950 font-bold text-sm flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Gamepad2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                <span>Chơi &amp; Học</span>
              </button>
            </div>
          </div>

          {/* Right XP / Streak / Study Time Summary */}
          <div className="lg:col-span-4 bg-[#F7FBFF] border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-600">Cấp độ Khám phá</div>
                <div className="font-display text-2xl font-extrabold text-slate-900 tabular-nums">
                  Level {level} · {xp} XP
                </div>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Trophy className="w-6 h-6" aria-hidden="true" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-600 mb-1.5 tabular-nums">
                <span>Tiến tới Level {level + 1}</span>
                <span className="font-bold">{xpInLevel}/150 XP</span>
              </div>
              <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-sky-600 rounded-full transition-all" style={{ width: `${xpPct}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-center">
              <div>
                <div className="inline-flex items-center gap-1 text-base font-extrabold text-orange-600 tabular-nums">
                  <Flame className="w-4 h-4" aria-hidden="true" />
                  <span>{profile?.streak_days ?? 1}</span>
                </div>
                <div className="text-[11px] text-slate-600">Ngày liên tiếp</div>
              </div>
              <div>
                <div className="inline-flex items-center gap-1 text-base font-extrabold text-sky-700 tabular-nums">
                  <Clock className="w-4 h-4" aria-hidden="true" />
                  <span>{studyMinutes}p</span>
                </div>
                <div className="text-[11px] text-slate-600">Thời gian học</div>
              </div>
              <div>
                <div className="inline-flex items-center gap-1 text-base font-extrabold text-emerald-700 tabular-nums">
                  <Award className="w-4 h-4" aria-hidden="true" />
                  <span>{earnedBadges.length}</span>
                </div>
                <div className="text-[11px] text-slate-600">Huy hiệu</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Knowledge World Map + Subject Islands */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="font-display text-xl font-extrabold text-slate-900">Bản đồ Thế giới Học tập Lớp {gradeLevel}</h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  {isGrade12Mode ? 'Chọn môn em thích để học hoặc hỏi SOCO' : 'Chọn một khu vực môn học để mở bài giảng hoặc hỏi SOCO'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenKnowledge()}
                className="text-sm font-bold text-sky-700 hover:underline whitespace-nowrap cursor-pointer"
              >
                Mở toàn bộ Kho Tri thức →
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden border border-slate-200 aspect-16/9 mb-5 bg-sky-50">
              <img
                src={heroLearningWorldImg}
                alt={`Bản đồ các đảo môn học tiểu học Lớp ${gradeLevel}`}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {data.subjects.map((sub) => {
                const style = SUBJECT_STYLES[sub.color_token] || SUBJECT_STYLES.sky;
                return (
                  <div key={sub.id} className={`rounded-2xl border p-4 transition-colors ${style}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-bold text-sm">
                        {renderSubjectIcon(sub.icon_name)}
                        <span>{sub.name}</span>
                      </div>
                    </div>
                    {!isGrade12Mode && <p className="mt-1.5 text-xs opacity-80 line-clamp-2">{sub.description}</p>}
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenKnowledge(sub.id)}
                        className="px-3 py-1.5 rounded-lg bg-white/95 hover:bg-white text-slate-900 text-xs font-bold border border-slate-200 cursor-pointer"
                      >
                        Học bài
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenTutor({ subjectId: sub.id })}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                      >
                        Hỏi SOCO
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Today's Missions + Teacher Assignments + Classes */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-extrabold text-slate-900">Nhiệm vụ hôm nay</h2>
              <button
                type="button"
                onClick={onOpenBadges}
                className="text-xs font-bold text-sky-700 hover:underline cursor-pointer"
              >
                Xem tất cả
              </button>
            </div>

            <div className="space-y-3">
              {data.missions.map((m) => (
                <div key={m.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-bold text-slate-900">{m.title}</div>
                    {m.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-label="Đã hoàn thành" />
                    ) : (
                      <span className="text-xs font-bold text-amber-800 tabular-nums shrink-0">+{m.xp_reward} XP</span>
                    )}
                  </div>
                  {!isGrade12Mode && <p className="text-xs text-slate-600 mt-1">{m.description}</p>}
                  <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-slate-600 tabular-nums">
                    <span>{m.mission_type === 'daily' ? 'Hằng ngày' : 'Hằng tuần'}</span>
                    <span>
                      {Math.min(m.current_count, m.target_count)}/{m.target_count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6">
            <h2 className="font-display text-lg font-extrabold text-slate-900 mb-3">Bài tập từ Thầy Cô</h2>

            {data.assignments.length === 0 ? (
              <p className="text-xs text-slate-600">
                Chưa có bài tập nào được giao. Em có thể nhập mã lớp bên dưới để tham gia lớp học.
              </p>
            ) : (
              <div className="space-y-2.5 mb-4">
                {data.assignments.map((a) => (
                  <div key={a.id} className="p-3 rounded-2xl bg-sky-50/70 border border-sky-200">
                    <div className="text-sm font-bold text-slate-900">{a.title}</div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      {a.class_name} · Hạn: {a.due_date}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-sky-900">
                        {a.submission_status === 'assigned'
                          ? 'Chưa làm'
                          : a.submission_status === 'submitted'
                          ? `Đã nộp (${a.score ?? 0}%)`
                          : `Đã chấm: ${a.score ?? 0}%`}
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenGames()}
                        className="text-xs font-bold text-sky-700 hover:underline cursor-pointer"
                      >
                        Làm bài →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleJoinClass} className="pt-3 border-t border-slate-100">
              <label htmlFor="join-class-code" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tham gia lớp học bằng mã lớp
              </label>
              <div className="flex gap-2">
                <input
                  id="join-class-code"
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Ví dụ: SOCO4A"
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-300 text-xs uppercase font-mono-nums"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Vào lớp</span>
                </button>
              </div>
              {joinMsg && <p className="mt-1.5 text-xs text-sky-800 font-medium">{joinMsg}</p>}
              {data.classes.length > 0 && (
                <div className="mt-2 text-xs text-slate-600">
                  Lớp đang học: {data.classes.map((c) => `${c.name} (${c.teacher_name})`).join(', ')}
                </div>
              )}
            </form>
          </div>
        </div>
      </section>

      {/* Bottom Row: Recent Tutoring Sessions + Badges */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-extrabold text-slate-900">Lịch sử học cùng SOCO</h2>
            <button
              type="button"
              onClick={() => onOpenTutor()}
              className="text-xs font-bold text-sky-700 hover:underline cursor-pointer"
            >
              Mở cuộc trò chuyện mới
            </button>
          </div>
          {data.sessions.length === 0 ? (
            <p className="text-sm text-slate-600">Em chưa có buổi học nào với SOCO. Hãy bắt đầu câu hỏi đầu tiên nhé!</p>
          ) : (
            <div className="space-y-2.5">
              {data.sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onOpenTutor({ sessionId: s.id })}
                  className="w-full text-left p-3.5 rounded-2xl border border-slate-200 hover:border-sky-400 hover:bg-sky-50/40 transition-colors flex items-center justify-between gap-4 cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-slate-900 truncate">{s.topic}</div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      {s.subject_name} · Lớp {s.grade_level} · Chế độ {s.mode}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-sky-700 shrink-0">Tiếp tục →</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-extrabold text-slate-900">Bộ sưu tập Huy hiệu</h2>
            <button
              type="button"
              onClick={onOpenBadges}
              className="text-xs font-bold text-sky-700 hover:underline cursor-pointer"
            >
              Xem bộ sưu tập →
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.achievements.slice(0, 4).map((a) => (
              <div
                key={a.id}
                className={`p-3.5 rounded-2xl border ${
                  a.earned_at ? 'bg-amber-50/70 border-amber-200' : 'bg-slate-50 border-slate-200 opacity-75'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                  <Sparkles className={`w-4 h-4 ${a.earned_at ? 'text-amber-600' : 'text-slate-400'}`} aria-hidden="true" />
                  <span>{a.title}</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">{a.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
