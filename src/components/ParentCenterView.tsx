import React, { useEffect, useState } from 'react';
import { Clock, HeartHandshake, Link2, ShieldCheck, Sparkles, Trophy, AlertCircle } from 'lucide-react';
import { apiRequest } from '../lib/api';

interface LinkedChild {
  student_id: number;
  student_name: string;
  student_username: string;
  grade_level: number;
  grade_name: string;
  xp: number;
  level: number;
  streak_days: number;
  daily_goal_minutes: number;
  parental_consent_status: string;
  stats: {
    total_seconds: number;
    completed_count: number;
    avg_score: number;
  };
  mastery: Array<{
    id: number;
    subject_name: string;
    topic_name: string;
    mastery_score: number;
    confidence_level: string;
  }>;
  mistakes: Array<{
    id: number;
    subject_name: string;
    topic_name: string;
    mistake_type: string;
    description: string;
  }>;
}

export function ParentCenterView() {
  const [children, setChildren] = useState<LinkedChild[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkCode, setLinkCode] = useState('');
  const [linkMsg, setLinkMsg] = useState('');
  const [adviceByChild, setAdviceByChild] = useState<
    Record<number, { summary: string; homeActivities: Array<{ title: string; duration: string; howTo: string }> }>
  >({});
  const [loadingAdviceId, setLoadingAdviceId] = useState<number | null>(null);

  async function loadChildren() {
    setLoading(true);
    try {
      const res = await apiRequest<{ children: LinkedChild[] }>('/api/parent/overview');
      setChildren(res.children);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadChildren();
  }, []);

  async function handleLinkStudent(e: React.FormEvent) {
    e.preventDefault();
    setLinkMsg('');
    try {
      const res = await apiRequest<{ message: string }>('/api/parent/link-student', {
        method: 'POST',
        body: JSON.stringify({ linkCode }),
      });
      setLinkMsg(res.message);
      setLinkCode('');
      loadChildren();
    } catch (err: unknown) {
      setLinkMsg(err instanceof Error ? err.message : 'Không thể liên kết tài khoản.');
    }
  }

  async function requestAiAdvice(studentId: number) {
    setLoadingAdviceId(studentId);
    try {
      const res = await apiRequest<{
        advice: { summary: string; homeActivities: Array<{ title: string; duration: string; howTo: string }> };
      }>('/api/parent/ai-advice', {
        method: 'POST',
        body: JSON.stringify({ studentId }),
      });
      setAdviceByChild((prev) => ({ ...prev, [studentId]: res.advice }));
    } finally {
      setLoadingAdviceId(null);
    }
  }

  if (loading) {
    return <div className="h-96 rounded-3xl bg-white border border-slate-200 animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      {/* Header + Link Child Form */}
      <section className="bg-white border border-slate-200 rounded-3xl p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-7">
          <h1 className="font-display text-2xl font-extrabold text-slate-900">Góc Phụ huynh Đồng hành</h1>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Liên kết tài khoản an toàn để theo dõi thời gian học, tiến độ nắm vững kiến thức và nhận gợi ý hoạt động cùng con tại nhà.
          </p>
        </div>

        <form onSubmit={handleLinkStudent} className="lg:col-span-5 bg-[#F7FBFF] border border-slate-200 rounded-2xl p-4 space-y-2">
          <label className="block text-xs font-bold text-slate-700">Liên kết & Xác nhận bảo hộ bằng mã của con</label>
          <div className="flex gap-2">
            <input
              type="text"
              required
              value={linkCode}
              onChange={(e) => setLinkCode(e.target.value)}
              placeholder="Ví dụ: LINK-MA4A"
              className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono-nums uppercase bg-white"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Liên kết</span>
            </button>
          </div>
          {linkMsg && <p className="text-xs font-semibold text-sky-800">{linkMsg}</p>}
        </form>
      </section>

      {children.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center">
          <HeartHandshake className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-bold text-slate-800">Chưa có tài khoản học sinh nào được liên kết</p>
          <p className="text-xs text-slate-500 mt-1">
            Hãy nhập mã liên kết hiển thị ở đầu màn hình của bé (ví dụ: LINK-MA4A) để bắt đầu theo dõi.
          </p>
        </div>
      ) : (
        children.map((child) => {
          const studyMinutes = Math.round((child.stats?.total_seconds || 0) / 60);
          const advice = adviceByChild[child.student_id];
          return (
            <section key={child.student_id} className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Đã xác nhận bảo hộ phụ huynh · {child.grade_name}</span>
                  </div>
                  <h2 className="font-display text-2xl font-extrabold text-slate-900 mt-1">{child.student_name}</h2>
                </div>
                <button
                  type="button"
                  disabled={loadingAdviceId === child.student_id}
                  onClick={() => requestAiAdvice(child.student_id)}
                  className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {loadingAdviceId === child.student_id ? 'AI đang phân tích...' : 'Gợi ý đồng hành tại nhà bằng AI'}
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-800">
                    <Clock className="w-4 h-4" />
                    <span>Thời gian học đã ghi nhận</span>
                  </div>
                  <div className="font-display text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">{studyMinutes} phút</div>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                    <Trophy className="w-4 h-4" />
                    <span>Hoàn thành & Điểm TB</span>
                  </div>
                  <div className="font-display text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
                    {child.stats?.completed_count || 0} bài · {child.stats?.avg_score || 0}%
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                  <div className="text-xs font-semibold text-amber-800">Thói quen học tập</div>
                  <div className="font-display text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
                    {child.streak_days} ngày liên tiếp · Lv.{child.level}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-display text-base font-extrabold text-slate-900 mb-3">Mức độ nắm vững kiến thức</h3>
                  <div className="space-y-2.5">
                    {child.mastery.map((m) => (
                      <div key={m.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold text-slate-500">{m.subject_name}</div>
                          <div className="text-sm font-bold text-slate-900">{m.topic_name}</div>
                        </div>
                        <span className="font-mono-nums font-extrabold text-sm text-sky-700">{m.mastery_score}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-display text-base font-extrabold text-slate-900 mb-3 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                    <span>Kiến thức con đang cần hỗ trợ thêm</span>
                  </h3>
                  {child.mistakes.length === 0 ? (
                    <p className="text-sm text-slate-500">Hiện tại con chưa có lỗi lặp lại nào cần lo lắng.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {child.mistakes.map((mk) => (
                        <div key={mk.id} className="p-3 rounded-2xl bg-orange-50/70 border border-orange-200">
                          <div className="text-xs font-bold text-orange-900">
                            {mk.subject_name} · {mk.mistake_type}
                          </div>
                          <p className="text-xs text-slate-700 mt-1">{mk.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {advice && (
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-3">
                  <div className="font-display text-base font-extrabold text-emerald-950">
                    Đề xuất đồng hành tại nhà cùng {child.student_name}
                  </div>
                  <p className="text-sm text-slate-800 leading-relaxed">{advice.summary}</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    {advice.homeActivities.map((act, idx) => (
                      <div key={idx} className="p-3.5 rounded-2xl bg-white border border-emerald-200">
                        <div className="text-xs font-bold text-emerald-800">{act.duration}</div>
                        <div className="font-bold text-sm text-slate-900 mt-0.5">{act.title}</div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{act.howTo}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
