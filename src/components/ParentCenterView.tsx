import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  Clock,
  Download,
  FileText,
  HeartHandshake,
  Link2,
  ShieldCheck,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { exportVietnamesePdfReport } from '../lib/pdfExport';

interface WeeklyReportSummary {
  periodLabel: string;
  studyMinutes7d: number;
  lessonsCompleted7d: number;
  gamesCompleted7d: number;
  tutorSessions7d: number;
  avgScore7d: number;
  strongestTopics: string[];
  focusTopics: string[];
  recommendation: string;
}

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
  weeklyReport?: WeeklyReportSummary;
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
  const [exportingPdfId, setExportingPdfId] = useState<number | null>(null);

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

  function exportChildWeeklyCsv(child: LinkedChild) {
    const w = child.weeklyReport;
    const rows = [
      ['Học sinh', 'Lớp', 'Thời gian tuần (phút)', 'Bài học xong (7 ngày)', 'Trò chơi xong (7 ngày)', 'Phiên hỏi SOCO (7 ngày)', 'Điểm TB tuần (%)'],
      [
        child.student_name,
        child.grade_name,
        String(w?.studyMinutes7d || 0),
        String(w?.lessonsCompleted7d || 0),
        String(w?.gamesCompleted7d || 0),
        String(w?.tutorSessions7d || 0),
        String(w?.avgScore7d || 0),
      ],
      [],
      ['Môn học', 'Chủ đề', 'Độ thành thạo (%)', 'Mức độ'],
      ...child.mastery.map((m) => [m.subject_name, m.topic_name, String(m.mastery_score), m.confidence_level]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bao-cao-tuan-${child.student_username}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportChildWeeklyPdf(child: LinkedChild) {
    setExportingPdfId(child.student_id);
    try {
      const w = child.weeklyReport;
      const advice = adviceByChild[child.student_id];
      await exportVietnamesePdfReport({
        filename: `bao-cao-tuan-${child.student_username}.pdf`,
        title: `BÁO CÁO TUẦN HỌC TẬP: ${child.student_name.toUpperCase()}`,
        subtitle: `SOCRATES KIDS AI · ${child.grade_name} · ${w?.periodLabel || '7 ngày gần nhất'}`,
        metaLines: [
          `Ngày xuất báo cáo: ${new Date().toLocaleDateString('vi-VN')} · Chuỗi kiên trì: ${child.streak_days} ngày · Level ${child.level} (${child.xp} XP)`,
          `Tuần qua: ${w?.studyMinutes7d || 0} phút học · ${w?.lessonsCompleted7d || 0} bài học · ${w?.gamesCompleted7d || 0} trò chơi · ${w?.tutorSessions7d || 0} phiên hỏi SOCO`,
        ],
        sections: [
          {
            heading: '1. Tổng kết tuần & Khuyến nghị đồng hành',
            lines: [
              `Điểm trung bình tuần qua: ${w?.avgScore7d || 0}%`,
              `Điểm mạnh nổi bật: ${w?.strongestTopics?.length ? w.strongestTopics.join('; ') : 'Đang tích lũy dữ liệu'}`,
              `Chủ đề cần ôn nhẹ: ${w?.focusTopics?.length ? w.focusTopics.join('; ') : 'Chưa có chủ đề yếu'}`,
              `Gợi ý cho phụ huynh: ${w?.recommendation || ''}`,
            ],
          },
          ...(advice
            ? [
                {
                  heading: '2. Hoạt động gợi ý tại nhà từ AI',
                  lines: [
                    advice.summary,
                    ...advice.homeActivities.map((act, idx) => `${idx + 1}. ${act.title} (${act.duration}): ${act.howTo}`),
                  ],
                },
              ]
            : []),
        ],
        table: {
          headers: ['Môn học', 'Chủ đề', 'Thành thạo', 'Đánh giá'],
          columnWidths: [220, 480, 160, 228],
          rows:
            child.mastery.length > 0
              ? child.mastery.map((m) => [
                  m.subject_name,
                  m.topic_name,
                  `${m.mastery_score}%`,
                  m.confidence_level === 'mastered'
                    ? 'Thành thạo'
                    : m.confidence_level === 'developing'
                    ? 'Đang tiến bộ'
                    : 'Cần ôn tập',
                ])
              : [['Chưa có dữ liệu', '-', '-', '-']],
        },
      });
    } finally {
      setExportingPdfId(null);
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
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            Liên kết tài khoản an toàn để xem báo cáo tuần 7 ngày, tiến độ nắm vững kiến thức, xuất PDF/CSV và nhận gợi ý hoạt động cùng con tại nhà.
          </p>
        </div>

        <form onSubmit={handleLinkStudent} className="lg:col-span-5 bg-[#F7FBFF] border border-slate-200 rounded-2xl p-4 space-y-2">
          <label htmlFor="parent-link-code" className="block text-xs font-bold text-slate-800">
            Liên kết &amp; Xác nhận bảo hộ bằng mã của con
          </label>
          <div className="flex gap-2">
            <input
              id="parent-link-code"
              type="text"
              required
              value={linkCode}
              onChange={(e) => setLinkCode(e.target.value)}
              placeholder="Ví dụ: LINK-MA4A"
              className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono-nums uppercase bg-white"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Liên kết</span>
            </button>
          </div>
          {linkMsg && <p className="text-xs font-semibold text-sky-800">{linkMsg}</p>}
        </form>
      </section>

      {children.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center">
          <HeartHandshake className="w-10 h-10 text-slate-300 mx-auto mb-3" aria-hidden="true" />
          <p className="font-bold text-slate-800">Chưa có tài khoản học sinh nào được liên kết</p>
          <p className="text-xs text-slate-600 mt-1">
            Hãy nhập mã liên kết hiển thị ở đầu màn hình của bé để bắt đầu theo dõi.
          </p>
        </div>
      ) : (
        children.map((child) => {
          const studyMinutes = Math.round((child.stats?.total_seconds || 0) / 60);
          const advice = adviceByChild[child.student_id];
          const weekly = child.weeklyReport;
          return (
            <section key={child.student_id} className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                    <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                    <span>Đã xác nhận bảo hộ phụ huynh · {child.grade_name}</span>
                  </div>
                  <h2 className="font-display text-2xl font-extrabold text-slate-900 mt-1">{child.student_name}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={exportingPdfId === child.student_id}
                    onClick={() => exportChildWeeklyPdf(child)}
                    className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" aria-hidden="true" />
                    <span>{exportingPdfId === child.student_id ? 'Đang xuất PDF...' : 'Xuất Báo cáo Tuần (PDF)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportChildWeeklyCsv(child)}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" aria-hidden="true" />
                    <span>Xuất CSV</span>
                  </button>
                  <button
                    type="button"
                    disabled={loadingAdviceId === child.student_id}
                    onClick={() => requestAiAdvice(child.student_id)}
                    className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" aria-hidden="true" />
                    <span>{loadingAdviceId === child.student_id ? 'AI đang phân tích...' : 'Gợi ý đồng hành bằng AI'}</span>
                  </button>
                </div>
              </div>

              {/* Overall KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-900">
                    <Clock className="w-4 h-4" aria-hidden="true" />
                    <span>Tổng thời gian học đã ghi nhận</span>
                  </div>
                  <div className="font-display text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">{studyMinutes} phút</div>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900">
                    <Trophy className="w-4 h-4" aria-hidden="true" />
                    <span>Hoàn thành &amp; Điểm TB</span>
                  </div>
                  <div className="font-display text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
                    {child.stats?.completed_count || 0} bài · {child.stats?.avg_score || 0}%
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                  <div className="text-xs font-semibold text-amber-900">Thói quen học tập</div>
                  <div className="font-display text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
                    {child.streak_days} ngày liên tiếp · Lv.{child.level}
                  </div>
                </div>
              </div>

              {/* Weekly Report Card */}
              {weekly && (
                <div className="p-5 rounded-2xl bg-[#F7FBFF] border border-sky-200 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <CalendarDays className="w-5 h-5 text-sky-700" aria-hidden="true" />
                      <span>Báo cáo Tuần của con ({weekly.periodLabel})</span>
                    </h3>
                    <span className="text-xs font-bold text-sky-800 tabular-nums">Điểm TB tuần: {weekly.avgScore7d}%</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <div className="font-display text-xl font-extrabold text-sky-800 tabular-nums">{weekly.studyMinutes7d}p</div>
                      <div className="text-[11px] text-slate-600">Thời gian học 7 ngày</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <div className="font-display text-xl font-extrabold text-emerald-800 tabular-nums">
                        {weekly.lessonsCompleted7d}
                      </div>
                      <div className="text-[11px] text-slate-600">Bài giảng hoàn thành</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <div className="font-display text-xl font-extrabold text-orange-700 tabular-nums">
                        {weekly.gamesCompleted7d}
                      </div>
                      <div className="text-[11px] text-slate-600">Trò chơi luyện tập</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <div className="font-display text-xl font-extrabold text-violet-800 tabular-nums">
                        {weekly.tutorSessions7d}
                      </div>
                      <div className="text-[11px] text-slate-600">Phiên hỏi SOCO</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <div className="font-bold text-emerald-800">Điểm nổi bật tuần này:</div>
                      <p className="text-slate-700 mt-1">
                        {weekly.strongestTopics.length > 0 ? weekly.strongestTopics.join(' · ') : 'Con đang xây dựng nền tảng mới.'}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-slate-200">
                      <div className="font-bold text-orange-800">Gợi ý đồng hành tuần tới:</div>
                      <p className="text-slate-700 mt-1">{weekly.recommendation}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-display text-base font-extrabold text-slate-900 mb-3">Mức độ nắm vững kiến thức</h3>
                  <div className="space-y-2.5">
                    {child.mastery.map((m) => (
                      <div key={m.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold text-slate-600">{m.subject_name}</div>
                          <div className="text-sm font-bold text-slate-900">{m.topic_name}</div>
                        </div>
                        <span className="font-mono-nums font-extrabold text-sm text-sky-800">{m.mastery_score}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-display text-base font-extrabold text-slate-900 mb-3 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-orange-600" aria-hidden="true" />
                    <span>Kiến thức con đang cần hỗ trợ thêm</span>
                  </h3>
                  {child.mistakes.length === 0 ? (
                    <p className="text-sm text-slate-600">Hiện tại con chưa có lỗi lặp lại nào cần lo lắng.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {child.mistakes.map((mk) => (
                        <div key={mk.id} className="p-3 rounded-2xl bg-orange-50/70 border border-orange-200">
                          <div className="text-xs font-bold text-orange-950">
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
