import React, { useEffect, useState } from 'react';
import { Award, BarChart3, CheckCircle2, Clock, Flame, RefreshCw, Sparkles, Target, AlertCircle } from 'lucide-react';
import { apiRequest, UserProfileData } from '../lib/api';

interface AnalyticsPayload {
  mastery: Array<{
    id: number;
    subject_name: string;
    topic_name: string;
    mastery_score: number;
    confidence_level: 'needs_review' | 'developing' | 'mastered';
    correct_count: number;
    attempt_count: number;
    ai_help_level: 'minimal' | 'moderate' | 'high';
  }>;
  mistakes: Array<{
    id: number;
    subject_name: string;
    topic_name: string;
    mistake_type: string;
    description: string;
    frequency: number;
    resolved: number;
  }>;
  progress: Array<{
    id: number;
    item_title: string;
    item_type: string;
    status: string;
    time_spent_seconds: number;
    score: number;
    attempts: number;
  }>;
  aiStats: { total_turns: number };
}

interface DashboardAchievementsPayload {
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
  achievements: Array<{
    id: number;
    title: string;
    description: string;
    category: string;
    xp_threshold: number;
    earned_at: string | null;
  }>;
}

export function StudentAnalyticsAndBadges({ user }: { user: UserProfileData }) {
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [badgesData, setBadgesData] = useState<DashboardAchievementsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    try {
      const [a, d] = await Promise.all([
        apiRequest<AnalyticsPayload>('/api/student/analytics'),
        apiRequest<DashboardAchievementsPayload>('/api/student/dashboard'),
      ]);
      setAnalytics(a);
      setBadgesData(d);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function resolveMistake(id: number) {
    await apiRequest(`/api/student/mistakes/${id}/resolve`, { method: 'POST' });
    loadAll();
  }

  if (loading || !analytics || !badgesData) {
    return <div className="h-96 rounded-3xl bg-white border border-slate-200 animate-pulse" />;
  }

  const totalMinutes = Math.round(
    analytics.progress.reduce((acc, p) => acc + (p.time_spent_seconds || 0), 0) / 60
  );
  const completedCount = analytics.progress.filter((p) => p.status === 'completed').length;
  const avgScore = analytics.progress.length
    ? Math.round(analytics.progress.reduce((acc, p) => acc + (p.score || 0), 0) / analytics.progress.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-3xl p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Clock className="w-4 h-4 text-sky-600" />
            <span>Tổng thời gian học</span>
          </div>
          <div className="font-display text-2xl font-extrabold text-slate-900 mt-2 tabular-nums">{totalMinutes} phút</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-3xl p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Bài & Trò chơi hoàn thành</span>
          </div>
          <div className="font-display text-2xl font-extrabold text-slate-900 mt-2 tabular-nums">{completedCount}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-3xl p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Target className="w-4 h-4 text-orange-500" />
            <span>Tỉ lệ chính xác trung bình</span>
          </div>
          <div className="font-display text-2xl font-extrabold text-slate-900 mt-2 tabular-nums">{avgScore}%</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-3xl p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Flame className="w-4 h-4 text-amber-600" />
            <span>Lượt thảo luận cùng SOCO</span>
          </div>
          <div className="font-display text-2xl font-extrabold text-slate-900 mt-2 tabular-nums">
            {analytics.aiStats.total_turns} lượt
          </div>
        </div>
      </section>

      {/* Skill Mastery & Mistakes */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-xl font-extrabold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-sky-600" />
                <span>Hồ sơ Năng lực theo Chủ đề</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Đánh giá kết hợp độ chính xác, số lần luyện tập và mức độ cần trợ giúp từ AI
              </p>
            </div>
            <button type="button" onClick={loadAll} className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 cursor-pointer">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {analytics.mastery.length === 0 ? (
            <p className="text-sm text-slate-500">Hãy hoàn thành một bài học hoặc trò chơi để xây dựng hồ sơ năng lực.</p>
          ) : (
            <div className="space-y-3">
              {analytics.mastery.map((m) => (
                <div key={m.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-slate-500">
                        {m.subject_name} · Trợ giúp AI:{' '}
                        {m.ai_help_level === 'minimal' ? 'Ít' : m.ai_help_level === 'moderate' ? 'Vừa' : 'Nhiều'}
                      </div>
                      <div className="font-bold text-sm text-slate-900 mt-0.5">{m.topic_name}</div>
                    </div>
                    <span
                      className={`text-xs font-extrabold px-2.5 py-1 rounded-lg ${
                        m.confidence_level === 'mastered'
                          ? 'bg-emerald-100 text-emerald-800'
                          : m.confidence_level === 'developing'
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {m.confidence_level === 'mastered'
                        ? 'Đã thành thạo'
                        : m.confidence_level === 'developing'
                        ? 'Đang tiến bộ'
                        : 'Cần ôn tập'}
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-center gap-3">
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          m.mastery_score >= 80 ? 'bg-emerald-500' : m.mastery_score >= 55 ? 'bg-sky-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${m.mastery_score}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono-nums font-bold text-slate-800">{m.mastery_score}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mistakes Tracker */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6">
          <h2 className="font-display text-xl font-extrabold text-slate-900 flex items-center gap-2 mb-1">
            <AlertCircle className="w-5 h-5 text-orange-500" />
            <span>Nhật ký Lỗi cần chú ý</span>
          </h2>
          <p className="text-xs text-slate-500 mb-4">Ghi nhận lỗi tư duy để SOCO giúp em khắc phục dứt điểm</p>

          {analytics.mistakes.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có lỗi sai lặp lại nào được ghi nhận.</p>
          ) : (
            <div className="space-y-3">
              {analytics.mistakes.map((mk) => (
                <div
                  key={mk.id}
                  className={`p-4 rounded-2xl border ${
                    mk.resolved ? 'bg-slate-50 border-slate-200 opacity-65' : 'bg-orange-50/70 border-orange-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs font-bold text-orange-900">
                      {mk.subject_name} · {mk.mistake_type} ({mk.frequency} lần)
                    </div>
                    {!mk.resolved && (
                      <button
                        type="button"
                        onClick={() => resolveMistake(mk.id)}
                        className="text-[11px] font-bold text-sky-700 hover:underline shrink-0 cursor-pointer"
                      >
                        Đã hiểu lỗi này
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-700 mt-1 leading-relaxed">{mk.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Achievements & Missions (No stressful public ranking!) */}
      <section className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-600" />
              <span>Thành tích & Nhiệm vụ Kiên trì ({user.profile?.xp || 0} XP · Level {user.profile?.level || 1})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Phần thưởng ghi nhận nỗ lực, sự tò mò và tiến bộ của riêng em — không so sánh gây áp lực
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {badgesData.missions.map((m) => (
            <div key={m.id} className="p-4 rounded-2xl bg-[#F7FBFF] border border-slate-200">
              <div className="text-xs font-bold text-sky-700">
                {m.mission_type === 'daily' ? 'Nhiệm vụ hằng ngày' : 'Thử thách tuần'} · +{m.xp_reward} XP
              </div>
              <div className="font-bold text-sm text-slate-900 mt-1">{m.title}</div>
              <p className="text-xs text-slate-600 mt-1">{m.description}</p>
              <div className="mt-3 flex items-center justify-between text-xs font-bold tabular-nums">
                <span>Tiến độ</span>
                <span className={m.completed ? 'text-emerald-700' : 'text-slate-700'}>
                  {Math.min(m.current_count, m.target_count)}/{m.target_count} {m.completed ? '(Hoàn thành)' : ''}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
          {badgesData.achievements.map((a) => (
            <div
              key={a.id}
              className={`p-4 rounded-2xl border ${
                a.earned_at ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200 opacity-60'
              }`}
            >
              <Sparkles className={`w-5 h-5 mb-2 ${a.earned_at ? 'text-amber-600' : 'text-slate-400'}`} />
              <div className="font-bold text-sm text-slate-900">{a.title}</div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{a.description}</p>
              <div className="mt-2 text-[11px] font-bold text-slate-500 tabular-nums">
                {a.earned_at ? 'Đã mở khóa' : `Cần ${a.xp_threshold} XP`}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
