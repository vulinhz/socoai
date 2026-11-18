import React, { useEffect, useState } from 'react';
import {
  BookPlus,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  Plus,
  Sparkles,
  Users,
  WifiOff,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { exportVietnamesePdfReport } from '../lib/pdfExport';
import { BulkImportPanel, ReviewExerciseItem, ReviewLessonItem } from './BulkImportPanel';
import { useOnlineStatus } from './PwaControls';

interface TeacherOverviewData {
  classes: Array<{ id: number; name: string; grade_level: number; grade_name: string; join_code: string; student_count: number }>;
  students: Array<{
    id: number;
    username: string;
    display_name: string;
    class_name: string;
    xp: number;
    level: number;
    streak_days: number;
    avg_mastery: number;
    completed_items: number;
    weekly_minutes?: number;
    weekly_ai_sessions?: number;
  }>;
  assignments: Array<{ id: number; title: string; class_name: string; subject_name: string; due_date: string }>;
  submissions: Array<{
    id: number;
    student_name: string;
    assignment_title: string;
    status: string;
    score: number | null;
    teacher_feedback: string | null;
  }>;
  commonMistakes: Array<{ mistake_type: string; topic_name: string; subject_name: string; total_occurrences: number }>;
  lessons: ReviewLessonItem[];
  exercises?: Array<
    ReviewExerciseItem & {
      questions?: Array<{
        id: number;
        prompt: string;
        options: string[];
        correct_answer: string;
        explanation: string;
      }>;
    }
  >;
  materials: Array<{ id: number; title: string; lesson_title: string; approval_status: string; material_type: string }>;
  units: Array<{ id: number; title: string; grade_level: number; subject_name: string }>;
}

interface AiGeneratedDraftResponse {
  exerciseId: number;
  reviewStatus: string;
  isAiGenerated: boolean;
  message: string;
  draft: {
    title: string;
    difficulty: string;
    questions: Array<{ prompt: string; options: string[]; correctAnswer: string; explanation: string }>;
  };
}

export function TeacherCenterView() {
  const isOnline = useOnlineStatus();
  const [data, setData] = useState<TeacherOverviewData | null>(null);
  const [subjects, setSubjects] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'classes' | 'assignments' | 'content'>('classes');
  const [msg, setMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Create class form
  const [className, setClassName] = useState('');
  const [classGrade, setClassGrade] = useState(4);

  // Create assignment form
  const [assignClassId, setAssignClassId] = useState<number>(0);
  const [assignSubjectId, setAssignSubjectId] = useState<number>(1);
  const [assignExerciseId, setAssignExerciseId] = useState<string>('');
  const [assignTitle, setAssignTitle] = useState('');
  const [assignInstructions, setAssignInstructions] = useState('');
  const [assignDueDate, setAssignDueDate] = useState('2026-11-30');

  // Create lesson form
  const [lessonUnitId, setLessonUnitId] = useState<number>(0);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonObjectives, setLessonObjectives] = useState('');
  const [lessonKnowledge, setLessonKnowledge] = useState('');

  // Create material form
  const [matLessonId, setMatLessonId] = useState<number>(0);
  const [matTitle, setMatTitle] = useState('');
  const [matContent, setMatContent] = useState('');

  // AI Exercise Generator state
  const [aiExGrade, setAiExGrade] = useState<number>(4);
  const [aiExSubjectId, setAiExSubjectId] = useState<number>(1);
  const [aiExTopic, setAiExTopic] = useState('');
  const [aiExDifficulty, setAiExDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [aiExCount, setAiExCount] = useState<number>(4);
  const [generatingEx, setGeneratingEx] = useState(false);
  const [latestAiDraft, setLatestAiDraft] = useState<AiGeneratedDraftResponse | null>(null);

  // AI Class Insights
  const [aiInsights, setAiInsights] = useState<{ overview: string; actionPlan: string[] } | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [ov, meta] = await Promise.all([
        apiRequest<TeacherOverviewData>('/api/teacher/overview'),
        apiRequest<{ subjects: Array<{ id: number; name: string }> }>('/api/curriculum/meta'),
      ]);
      setData(ov);
      setSubjects(meta.subjects);
      if (ov.classes.length > 0 && !assignClassId) setAssignClassId(ov.classes[0].id);
      if (ov.units.length > 0 && !lessonUnitId) setLessonUnitId(ov.units[0].id);
      if (ov.lessons.length > 0 && !matLessonId) setMatLessonId(ov.lessons[0].id);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleCreateClass(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await apiRequest<{ message: string }>('/api/teacher/classes', {
        method: 'POST',
        body: JSON.stringify({ name: className, gradeLevel: classGrade }),
      });
      setMsg(res.message);
      setClassName('');
      loadAll();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Không tạo được lớp học.');
    }
  }

  async function handleCreateAssignment(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await apiRequest<{ message: string }>('/api/teacher/assignments', {
        method: 'POST',
        body: JSON.stringify({
          classId: assignClassId,
          subjectId: assignSubjectId,
          exerciseId: assignExerciseId ? Number(assignExerciseId) : undefined,
          title: assignTitle,
          instructions: assignInstructions,
          dueDate: assignDueDate,
        }),
      });
      setMsg(res.message);
      setAssignTitle('');
      setAssignInstructions('');
      setAssignExerciseId('');
      loadAll();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Không giao được nhiệm vụ.');
    }
  }

  async function handleCreateLesson(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await apiRequest<{ message: string }>('/api/teacher/lessons', {
        method: 'POST',
        body: JSON.stringify({
          unitId: lessonUnitId,
          title: lessonTitle,
          objectives: lessonObjectives,
          coreKnowledge: lessonKnowledge,
          status: 'draft',
        }),
      });
      setMsg(res.message);
      setLessonTitle('');
      setLessonObjectives('');
      setLessonKnowledge('');
      loadAll();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể lưu bài học.');
    }
  }

  async function handleCreateMaterial(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await apiRequest<{ message: string }>('/api/teacher/materials', {
        method: 'POST',
        body: JSON.stringify({ lessonId: matLessonId, title: matTitle, materialType: 'worksheet', content: matContent }),
      });
      setMsg(res.message);
      setMatTitle('');
      setMatContent('');
      loadAll();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Không gửi được học liệu.');
    }
  }

  async function handleGenerateAiExercise(e: React.FormEvent) {
    e.preventDefault();
    if (!isOnline) {
      setErrorMsg('Chức năng Tạo bài tập bằng AI cần kết nối mạng.');
      return;
    }
    setErrorMsg('');
    setMsg('');
    setGeneratingEx(true);
    try {
      const res = await apiRequest<AiGeneratedDraftResponse>('/api/teacher/ai-generate-exercise', {
        method: 'POST',
        body: JSON.stringify({
          gradeLevel: aiExGrade,
          subjectId: aiExSubjectId,
          topic: aiExTopic,
          difficulty: aiExDifficulty,
          questionCount: aiExCount,
        }),
      });
      setLatestAiDraft(res);
      setMsg(res.message);
      setAiExTopic('');
      loadAll();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Không tạo được bản nháp bài tập AI.');
    } finally {
      setGeneratingEx(false);
    }
  }

  async function handleReviewAiDraft(exerciseId: number, reviewStatus: 'approved' | 'published') {
    setErrorMsg('');
    try {
      const res = await apiRequest<{ message: string }>(`/api/content/exercises/${exerciseId}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ reviewStatus }),
      });
      setMsg(res.message);
      if (latestAiDraft && latestAiDraft.exerciseId === exerciseId) {
        setLatestAiDraft({ ...latestAiDraft, reviewStatus });
      }
      loadAll();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Không cập nhật được trạng thái duyệt.');
    }
  }

  async function handleGrade(subId: number) {
    await apiRequest(`/api/teacher/submissions/${subId}/grade`, {
      method: 'POST',
      body: JSON.stringify({ score: 95, teacherFeedback: 'Cô khen con trình bày cẩn thận và tư duy tốt!' }),
    });
    setMsg('Đã chấm và gửi nhận xét cho học sinh.');
    loadAll();
  }

  async function handleAiInsights() {
    if (!data || data.classes.length === 0) return;
    if (!isOnline) {
      setErrorMsg('Phân tích lỗi sai bằng AI cần kết nối mạng.');
      return;
    }
    setLoadingAi(true);
    setErrorMsg('');
    try {
      const cls = data.classes[0];
      const avg = data.students.length
        ? Math.round(data.students.reduce((a, s) => a + (s.avg_mastery || 0), 0) / data.students.length)
        : 75;
      const mistakesStr = data.commonMistakes
        .map((m) => `${m.subject_name} - ${m.mistake_type} (${m.total_occurrences} lượt)`)
        .join('; ');
      const res = await apiRequest<{ insights: { overview: string; actionPlan: string[] } }>('/api/teacher/ai-insights', {
        method: 'POST',
        body: JSON.stringify({
          className: cls.name,
          gradeLevel: cls.grade_level,
          studentCount: cls.student_count,
          commonMistakes: mistakesStr,
          avgScore: avg,
        }),
      });
      setAiInsights(res.insights);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể phân tích bằng AI.');
    } finally {
      setLoadingAi(false);
    }
  }

  function exportReportCsv() {
    if (!data) return;
    const rows = [
      ['Học sinh', 'Lớp', 'Level', 'XP', 'Độ thành thạo TB (%)', 'Phút học tuần này', 'Bài hoàn thành'],
      ...data.students.map((s) => [
        s.display_name,
        s.class_name,
        String(s.level),
        String(s.xp),
        String(s.avg_mastery),
        String(s.weekly_minutes || 0),
        String(s.completed_items),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bao-cao-nang-luc-lop.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportReportPdf() {
    if (!data) return;
    setExportingPdf(true);
    try {
      const avgMastery = data.students.length
        ? Math.round(data.students.reduce((acc, s) => acc + (s.avg_mastery || 0), 0) / data.students.length)
        : 0;

      await exportVietnamesePdfReport({
        filename: 'bao-cao-nang-luc-lop.pdf',
        title: 'BÁO CÁO TIẾN ĐỘ & NĂNG LỰC LỚP HỌC',
        subtitle: 'SOCRATES KIDS AI · Dành cho Giáo viên Tiểu học',
        metaLines: [
          `Ngày xuất báo cáo: ${new Date().toLocaleDateString('vi-VN')}`,
          `Số lớp phụ trách: ${data.classes.length} · Tổng số học sinh: ${data.students.length} · Thành thạo TB: ${avgMastery}%`,
        ],
        sections: [
          {
            heading: '1. Tổng hợp lỗi thường gặp trong lớp',
            lines:
              data.commonMistakes.length === 0
                ? ['Chưa ghi nhận lỗi sai lặp lại nào trong 7 ngày qua.']
                : data.commonMistakes.map(
                    (m) => `• ${m.subject_name} (${m.topic_name}): ${m.mistake_type} — ${m.total_occurrences} lượt`
                  ),
          },
          ...(aiInsights
            ? [
                {
                  heading: '2. Đề xuất giảng dạy từ Gemini AI',
                  lines: [aiInsights.overview, ...aiInsights.actionPlan.map((step, i) => `${i + 1}. ${step}`)],
                },
              ]
            : []),
        ],
        table: {
          headers: ['Học sinh', 'Lớp', 'Cấp độ / XP', 'Thành thạo', 'Tuần (phút)', 'Hoàn thành'],
          columnWidths: [250, 220, 180, 150, 150, 138],
          rows: data.students.map((s) => [
            s.display_name,
            s.class_name,
            `Lv.${s.level} (${s.xp})`,
            `${s.avg_mastery}%`,
            `${s.weekly_minutes || 0}p`,
            String(s.completed_items),
          ]),
        },
      });
    } finally {
      setExportingPdf(false);
    }
  }

  if (loading || !data) {
    return <div className="h-96 rounded-3xl bg-white border border-slate-200 animate-pulse" />;
  }

  const publishedExercises = (data.exercises || []).filter(
    (ex) => ex.review_status === 'approved' || ex.review_status === 'published'
  );

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <section className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-slate-900">Trung tâm Giáo viên</h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Quản lý lớp học · Giao nhiệm vụ · Tạo bài tập AI · Nhập hàng loạt · Xuất báo cáo PDF &amp; CSV
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Phân khu giáo viên" className="flex flex-wrap p-1 bg-slate-100 rounded-xl gap-1">
            {[
              { id: 'classes', label: 'Lớp & Năng lực' },
              { id: 'assignments', label: 'Bài tập & Chấm điểm' },
              { id: 'content', label: 'Soạn Bài, AI & Import' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activeTab === t.id}
                onClick={() => setActiveTab(t.id as typeof activeTab)}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap ${
                  activeTab === t.id ? 'bg-white text-sky-800 shadow-xs' : 'text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={exportingPdf}
            onClick={exportReportPdf}
            className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-4 h-4" aria-hidden="true" />
            <span>{exportingPdf ? 'Đang xuất PDF...' : 'Xuất Báo cáo PDF'}</span>
          </button>
          <button
            type="button"
            onClick={exportReportCsv}
            className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>Xuất CSV</span>
          </button>
        </div>
      </section>

      {msg && (
        <div role="status" className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm font-semibold text-emerald-900">
          {msg}
        </div>
      )}
      {errorMsg && (
        <div role="alert" className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-sm font-semibold text-red-700">
          {errorMsg}
        </div>
      )}

      {activeTab === 'classes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-5">
              <h2 className="font-display text-lg font-extrabold text-slate-900 mb-3">Tạo lớp học mới</h2>
              <form onSubmit={handleCreateClass} className="space-y-3">
                <label htmlFor="teacher-class-name" className="sr-only">
                  Tên lớp học
                </label>
                <input
                  id="teacher-class-name"
                  type="text"
                  required
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="Tên lớp (VD: Lớp 4B - Chu Văn An)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
                <label htmlFor="teacher-class-grade" className="sr-only">
                  Khối lớp
                </label>
                <select
                  id="teacher-class-grade"
                  value={classGrade}
                  onChange={(e) => setClassGrade(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  {[1, 2, 3, 4, 5].map((g) => (
                    <option key={g} value={g}>
                      Khối Lớp {g}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>Tạo lớp &amp; Lấy mã tham gia</span>
                </button>
              </form>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-3">
              <h2 className="font-display text-lg font-extrabold text-slate-900">Danh sách lớp của tôi</h2>
              {data.classes.map((c) => (
                <div key={c.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="font-bold text-sm text-slate-900">{c.name}</div>
                  <div className="text-xs text-slate-600 mt-1">
                    {c.grade_name} · Sĩ số: <span className="tabular-nums font-bold">{c.student_count}</span> · Mã lớp:{' '}
                    <strong className="font-mono-nums text-sky-800">{c.join_code}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6">
            {/* Students Competency Table */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6">
              <h2 className="font-display text-lg font-extrabold text-slate-900 flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-sky-600" aria-hidden="true" />
                <span>Theo dõi Năng lực Học sinh</span>
              </h2>
              {data.students.length === 0 ? (
                <p className="text-sm text-slate-600">Chưa có học sinh tham gia lớp. Hãy gửi mã lớp cho các em nhập ở trang chủ.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-600">
                        <th className="py-2.5 pr-4">Học sinh</th>
                        <th className="py-2.5 pr-4">Lớp</th>
                        <th className="py-2.5 pr-4 text-right">Level / XP</th>
                        <th className="py-2.5 pr-4 text-right">Thành thạo TB</th>
                        <th className="py-2.5 pr-4 text-right">Tuần này</th>
                        <th className="py-2.5 text-right">Hoàn thành</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.students.map((s) => (
                        <tr key={s.id}>
                          <td className="py-3 pr-4 font-bold text-slate-900">{s.display_name}</td>
                          <td className="py-3 pr-4 text-slate-600">{s.class_name}</td>
                          <td className="py-3 pr-4 text-right font-mono-nums">
                            Lv.{s.level} · {s.xp} XP
                          </td>
                          <td className="py-3 pr-4 text-right font-mono-nums font-bold text-sky-800">{s.avg_mastery}%</td>
                          <td className="py-3 pr-4 text-right font-mono-nums text-slate-700">{s.weekly_minutes || 0}p</td>
                          <td className="py-3 text-right font-mono-nums">{s.completed_items}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Common Mistakes + AI Insights */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-extrabold text-slate-900">Phân tích Lỗi sai Phổ biến</h2>
                  <p className="text-xs text-slate-600">Tổng hợp từ quá trình học Socratic &amp; làm bài của học sinh</p>
                </div>
                <button
                  type="button"
                  disabled={loadingAi}
                  onClick={handleAiInsights}
                  className="px-4 py-2 rounded-xl bg-violet-700 hover:bg-violet-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  <span>{loadingAi ? 'Đang phân tích...' : 'Gợi ý Sư phạm bằng Gemini AI'}</span>
                </button>
              </div>

              {data.commonMistakes.length === 0 ? (
                <p className="text-sm text-slate-600">Chưa ghi nhận lỗi sai lặp lại nào trong lớp.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.commonMistakes.map((m, i) => (
                    <div key={i} className="p-3.5 rounded-2xl bg-orange-50/70 border border-orange-200">
                      <div className="text-xs font-bold text-orange-950">
                        {m.subject_name} · {m.mistake_type}
                      </div>
                      <div className="text-xs text-slate-700 mt-1">
                        Chủ đề: {m.topic_name} · <strong className="tabular-nums">{m.total_occurrences} lượt gặp lỗi</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {aiInsights && (
                <div className="p-4 rounded-2xl bg-violet-50 border border-violet-200 space-y-2">
                  <div className="text-sm font-extrabold text-violet-950">Đề xuất giảng dạy từ Gemini AI</div>
                  <p className="text-sm text-slate-800 leading-relaxed">{aiInsights.overview}</p>
                  <ul className="list-disc list-inside text-xs text-slate-700 space-y-1">
                    {aiInsights.actionPlan.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'assignments' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6">
            <h2 className="font-display text-lg font-extrabold text-slate-900 mb-4 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-sky-600" aria-hidden="true" />
              <span>Giao nhiệm vụ mới</span>
            </h2>
            <form onSubmit={handleCreateAssignment} className="space-y-3">
              <div>
                <label htmlFor="assign-class" className="block text-xs font-semibold text-slate-700 mb-1">
                  Lớp học
                </label>
                <select
                  id="assign-class"
                  value={assignClassId}
                  onChange={(e) => setAssignClassId(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  {data.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="assign-subject" className="block text-xs font-semibold text-slate-700 mb-1">
                  Môn học
                </label>
                <select
                  id="assign-subject"
                  value={assignSubjectId}
                  onChange={(e) => setAssignSubjectId(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="assign-exercise" className="block text-xs font-semibold text-slate-700 mb-1">
                  Gắn bài tập đã duyệt (tuỳ chọn)
                </label>
                <select
                  id="assign-exercise"
                  value={assignExerciseId}
                  onChange={(e) => setAssignExerciseId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  <option value="">-- Không gắn bài tập cụ thể --</option>
                  {publishedExercises.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      Lớp {ex.grade_level} · {ex.title}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Lưu ý: Bài tập AI hoặc bản nháp cần được duyệt &amp; xuất bản trước mới có thể giao cho học sinh.
                </p>
              </div>
              <input
                type="text"
                required
                aria-label="Tiêu đề nhiệm vụ"
                value={assignTitle}
                onChange={(e) => setAssignTitle(e.target.value)}
                placeholder="Tiêu đề nhiệm vụ"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
              <textarea
                rows={3}
                aria-label="Hướng dẫn cho học sinh"
                value={assignInstructions}
                onChange={(e) => setAssignInstructions(e.target.value)}
                placeholder="Hướng dẫn cho học sinh..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
              <input
                type="date"
                required
                aria-label="Hạn nộp bài"
                value={assignDueDate}
                onChange={(e) => setAssignDueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
              <button type="submit" className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm cursor-pointer">
                Giao nhiệm vụ tới cả lớp
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6">
            <h2 className="font-display text-lg font-extrabold text-slate-900 mb-4">Bài nộp &amp; Nhận xét</h2>
            {data.submissions.length === 0 ? (
              <p className="text-sm text-slate-600">Chưa có bài nộp nào.</p>
            ) : (
              <div className="space-y-3">
                {data.submissions.map((s) => (
                  <div key={s.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-bold text-sm text-slate-900">
                        {s.student_name} · {s.assignment_title}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        Trạng thái: {s.status} {s.score !== null ? `· Điểm: ${s.score}%` : ''}
                      </div>
                      {s.teacher_feedback && <div className="text-xs text-emerald-800 mt-1">Nhận xét: {s.teacher_feedback}</div>}
                    </div>
                    {s.status !== 'graded' && (
                      <button
                        type="button"
                        onClick={() => handleGrade(s.id)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Chấm &amp; Khen</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'content' && (
        <div className="space-y-6">
          {/* AI Exercise Draft Generator */}
          <section className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-violet-600" aria-hidden="true" />
                  <span>Tạo bài tập bằng AI (Luôn lưu ở Bản nháp — Cần giáo viên duyệt)</span>
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  AI gợi ý bộ câu hỏi trắc nghiệm theo chương trình GDPT 2018. Học sinh chỉ thấy bài tập sau khi thầy cô duyệt và xuất bản.
                </p>
              </div>
              {!isOnline && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                  <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Đang ngoại tuyến</span>
                </span>
              )}
            </div>

            <form onSubmit={handleGenerateAiExercise} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div>
                <label htmlFor="ai-ex-grade" className="block text-xs font-semibold text-slate-700 mb-1">
                  Lớp
                </label>
                <select
                  id="ai-ex-grade"
                  value={aiExGrade}
                  onChange={(e) => setAiExGrade(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  {[1, 2, 3, 4, 5].map((g) => (
                    <option key={g} value={g}>
                      Lớp {g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ai-ex-subject" className="block text-xs font-semibold text-slate-700 mb-1">
                  Môn học
                </label>
                <select
                  id="ai-ex-subject"
                  value={aiExSubjectId}
                  onChange={(e) => setAiExSubjectId(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="ai-ex-topic" className="block text-xs font-semibold text-slate-700 mb-1">
                  Chủ đề / Yêu cầu bài tập
                </label>
                <input
                  id="ai-ex-topic"
                  type="text"
                  required
                  value={aiExTopic}
                  onChange={(e) => setAiExTopic(e.target.value)}
                  placeholder="VD: Phép cộng hai phân số khác mẫu số"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="ai-ex-diff" className="block text-xs font-semibold text-slate-700 mb-1">
                    Độ khó
                  </label>
                  <select
                    id="ai-ex-diff"
                    value={aiExDifficulty}
                    onChange={(e) => setAiExDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                    className="w-full px-2.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white font-semibold"
                  >
                    <option value="easy">Dễ</option>
                    <option value="medium">Vừa</option>
                    <option value="hard">Khá</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="ai-ex-count" className="block text-xs font-semibold text-slate-700 mb-1">
                    Số câu
                  </label>
                  <select
                    id="ai-ex-count"
                    value={aiExCount}
                    onChange={(e) => setAiExCount(Number(e.target.value))}
                    className="w-full px-2.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white font-semibold"
                  >
                    {[2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} câu
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={generatingEx}
                className="lg:col-span-5 py-3 px-5 rounded-xl bg-violet-700 hover:bg-violet-800 disabled:opacity-60 text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                <span>{generatingEx ? 'Gemini AI đang soạn bản nháp...' : 'Soạn bản nháp bài tập bằng AI'}</span>
              </button>
            </form>

            {latestAiDraft && (
              <div className="p-5 rounded-2xl bg-violet-50 border border-violet-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="inline-block px-2.5 py-1 rounded-md bg-amber-100 border border-amber-300 text-amber-950 text-xs font-extrabold">
                      Do AI tạo — Cần giáo viên duyệt (Trạng thái: {latestAiDraft.reviewStatus})
                    </span>
                    <h3 className="font-display text-base font-extrabold text-slate-900 mt-1.5">
                      {latestAiDraft.draft.title}
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {latestAiDraft.reviewStatus === 'draft' && (
                      <button
                        type="button"
                        onClick={() => handleReviewAiDraft(latestAiDraft.exerciseId, 'approved')}
                        className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold cursor-pointer"
                      >
                        Duyệt nội dung
                      </button>
                    )}
                    {latestAiDraft.reviewStatus !== 'published' && (
                      <button
                        type="button"
                        onClick={() => handleReviewAiDraft(latestAiDraft.exerciseId, 'published')}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                      >
                        Xuất bản cho học sinh
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {latestAiDraft.draft.questions.map((q, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-white border border-violet-200 text-xs space-y-1">
                      <div className="font-bold text-slate-900">
                        Câu {idx + 1}: {q.prompt}
                      </div>
                      <div className="text-slate-600">Lựa chọn: {q.options.join(' · ')}</div>
                      <div className="text-emerald-800 font-semibold">
                        Đáp án: {q.correctAnswer} — {q.explanation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Manual Lesson + Material Forms */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6">
              <h2 className="font-display text-lg font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                <BookPlus className="w-5 h-5 text-sky-600" aria-hidden="true" />
                <span>Soạn Bài học mới (Lưu Nháp chờ duyệt)</span>
              </h2>
              <form onSubmit={handleCreateLesson} className="space-y-3">
                <select
                  aria-label="Chọn chủ đề bài học"
                  value={lessonUnitId}
                  onChange={(e) => setLessonUnitId(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  {data.units.map((u) => (
                    <option key={u.id} value={u.id}>
                      Lớp {u.grade_level} · {u.subject_name} · {u.title}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  aria-label="Tên bài học"
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  placeholder="Tên bài học"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
                <input
                  type="text"
                  aria-label="Mục tiêu bài học"
                  value={lessonObjectives}
                  onChange={(e) => setLessonObjectives(e.target.value)}
                  placeholder="Mục tiêu bài học"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
                <textarea
                  rows={4}
                  required
                  aria-label="Nội dung kiến thức trọng tâm"
                  value={lessonKnowledge}
                  onChange={(e) => setLessonKnowledge(e.target.value)}
                  placeholder="Nội dung kiến thức trọng tâm..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
                <button type="submit" className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm cursor-pointer">
                  Lưu bài học vào hàng chờ duyệt
                </button>
              </form>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4">
              <h2 className="font-display text-lg font-extrabold text-slate-900">Gửi Học liệu bổ sung (Chờ Admin duyệt)</h2>
              <form onSubmit={handleCreateMaterial} className="space-y-3">
                <select
                  aria-label="Chọn bài học gắn học liệu"
                  value={matLessonId}
                  onChange={(e) => setMatLessonId(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  {data.lessons.map((l) => (
                    <option key={l.id} value={l.id}>
                      Lớp {l.grade_level} · {l.title}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  aria-label="Tiêu đề học liệu"
                  value={matTitle}
                  onChange={(e) => setMatTitle(e.target.value)}
                  placeholder="Tiêu đề phiếu bài tập / hướng dẫn"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
                <textarea
                  rows={3}
                  required
                  aria-label="Nội dung học liệu"
                  value={matContent}
                  onChange={(e) => setMatContent(e.target.value)}
                  placeholder="Nội dung chi tiết học liệu..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
                <button type="submit" className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm cursor-pointer">
                  Gửi học liệu duyệt
                </button>
              </form>

              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="text-xs font-bold text-slate-600">Học liệu đã gửi ({data.materials.length})</div>
                {data.materials.map((m) => (
                  <div key={m.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{m.title}</span>
                    <span className="font-bold text-sky-800">{m.approval_status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bulk Import + Approval Workflow */}
          <BulkImportPanel lessons={data.lessons} exercises={data.exercises || []} onReload={loadAll} />
        </div>
      )}
    </div>
  );
}
