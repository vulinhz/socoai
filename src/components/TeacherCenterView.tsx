import React, { useEffect, useState } from 'react';
import { BookPlus, CheckCircle2, ClipboardList, Download, Plus, Sparkles, Users } from 'lucide-react';
import { apiRequest } from '../lib/api';

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
  }>;
  assignments: Array<{ id: number; title: string; class_name: string; subject_name: string; due_date: string }>;
  submissions: Array<{ id: number; student_name: string; assignment_title: string; status: string; score: number | null; teacher_feedback: string | null }>;
  commonMistakes: Array<{ mistake_type: string; topic_name: string; subject_name: string; total_occurrences: number }>;
  lessons: Array<{ id: number; title: string; status: string; unit_title: string; grade_level: number; subject_name: string }>;
  materials: Array<{ id: number; title: string; lesson_title: string; approval_status: string; material_type: string }>;
  units: Array<{ id: number; title: string; grade_level: number; subject_name: string }>;
}

export function TeacherCenterView() {
  const [data, setData] = useState<TeacherOverviewData | null>(null);
  const [subjects, setSubjects] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'classes' | 'assignments' | 'content'>('classes');
  const [msg, setMsg] = useState('');

  // Create class form
  const [className, setClassName] = useState('');
  const [classGrade, setClassGrade] = useState(4);

  // Create assignment form
  const [assignClassId, setAssignClassId] = useState<number>(0);
  const [assignSubjectId, setAssignSubjectId] = useState<number>(1);
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

  // AI Class Insights
  const [aiInsights, setAiInsights] = useState<{ overview: string; actionPlan: string[] } | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

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
    const res = await apiRequest<{ message: string }>('/api/teacher/classes', {
      method: 'POST',
      body: JSON.stringify({ name: className, gradeLevel: classGrade }),
    });
    setMsg(res.message);
    setClassName('');
    loadAll();
  }

  async function handleCreateAssignment(e: React.FormEvent) {
    e.preventDefault();
    const res = await apiRequest<{ message: string }>('/api/teacher/assignments', {
      method: 'POST',
      body: JSON.stringify({
        classId: assignClassId,
        subjectId: assignSubjectId,
        title: assignTitle,
        instructions: assignInstructions,
        dueDate: assignDueDate,
      }),
    });
    setMsg(res.message);
    setAssignTitle('');
    setAssignInstructions('');
    loadAll();
  }

  async function handleCreateLesson(e: React.FormEvent) {
    e.preventDefault();
    const res = await apiRequest<{ message: string }>('/api/teacher/lessons', {
      method: 'POST',
      body: JSON.stringify({
        unitId: lessonUnitId,
        title: lessonTitle,
        objectives: lessonObjectives,
        coreKnowledge: lessonKnowledge,
      }),
    });
    setMsg(res.message);
    setLessonTitle('');
    setLessonObjectives('');
    setLessonKnowledge('');
    loadAll();
  }

  async function handleCreateMaterial(e: React.FormEvent) {
    e.preventDefault();
    const res = await apiRequest<{ message: string }>('/api/teacher/materials', {
      method: 'POST',
      body: JSON.stringify({ lessonId: matLessonId, title: matTitle, materialType: 'worksheet', content: matContent }),
    });
    setMsg(res.message);
    setMatTitle('');
    setMatContent('');
    loadAll();
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
    setLoadingAi(true);
    try {
      const cls = data.classes[0];
      const avg = data.students.length
        ? Math.round(data.students.reduce((a, s) => a + (s.avg_mastery || 0), 0) / data.students.length)
        : 75;
      const mistakesStr = data.commonMistakes.map((m) => `${m.subject_name} - ${m.mistake_type} (${m.total_occurrences} lượt)`).join('; ');
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
    } finally {
      setLoadingAi(false);
    }
  }

  function exportReportCsv() {
    if (!data) return;
    const rows = [
      ['Học sinh', 'Lớp', 'Level', 'XP', 'Độ thành thạo TB (%)', 'Bài hoàn thành'],
      ...data.students.map((s) => [s.display_name, s.class_name, String(s.level), String(s.xp), String(s.avg_mastery), String(s.completed_items)]),
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

  if (loading || !data) {
    return <div className="h-96 rounded-3xl bg-white border border-slate-200 animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <section className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-slate-900">Trung tâm Giáo viên</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý lớp học · Giao nhiệm vụ · Chấm bài · Biên soạn học liệu · Phân tích lỗi sai bằng AI
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
            {[
              { id: 'classes', label: 'Lớp & Năng lực' },
              { id: 'assignments', label: 'Bài tập & Chấm điểm' },
              { id: 'content', label: 'Soạn Bài & Học liệu' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as typeof activeTab)}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap ${
                  activeTab === t.id ? 'bg-white text-sky-800 shadow-xs' : 'text-slate-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={exportReportCsv}
            className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Xuất CSV</span>
          </button>
        </div>
      </section>

      {msg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm font-semibold text-emerald-800">{msg}</div>
      )}

      {activeTab === 'classes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-5">
              <h2 className="font-display text-lg font-extrabold text-slate-900 mb-3">Tạo lớp học mới</h2>
              <form onSubmit={handleCreateClass} className="space-y-3">
                <input
                  type="text"
                  required
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="Tên lớp (VD: Lớp 4B - Chu Văn An)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
                <select
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
                  <Plus className="w-4 h-4" />
                  <span>Tạo lớp & Lấy mã tham gia</span>
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
                    <strong className="font-mono-nums text-sky-700">{c.join_code}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6">
            {/* Students Competency Table */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6">
              <h2 className="font-display text-lg font-extrabold text-slate-900 flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-sky-600" />
                <span>Theo dõi Năng lực Học sinh</span>
              </h2>
              {data.students.length === 0 ? (
                <p className="text-sm text-slate-500">Chưa có học sinh tham gia lớp. Hãy gửi mã lớp cho các em nhập ở trang chủ.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-500">
                        <th className="py-2.5 pr-4">Học sinh</th>
                        <th className="py-2.5 pr-4">Lớp</th>
                        <th className="py-2.5 pr-4 text-right">Level / XP</th>
                        <th className="py-2.5 pr-4 text-right">Thành thạo TB</th>
                        <th className="py-2.5 text-right">Đã hoàn thành</th>
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
                          <td className="py-3 pr-4 text-right font-mono-nums font-bold text-sky-700">{s.avg_mastery}%</td>
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
                  <p className="text-xs text-slate-500">Tổng hợp từ quá trình học Socratic & làm bài của học sinh</p>
                </div>
                <button
                  type="button"
                  disabled={loadingAi}
                  onClick={handleAiInsights}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{loadingAi ? 'Đang phân tích...' : 'Gợi ý Sư phạm bằng Gemini AI'}</span>
                </button>
              </div>

              {data.commonMistakes.length === 0 ? (
                <p className="text-sm text-slate-500">Chưa ghi nhận lỗi sai lặp lại nào trong lớp.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.commonMistakes.map((m, i) => (
                    <div key={i} className="p-3.5 rounded-2xl bg-orange-50/70 border border-orange-200">
                      <div className="text-xs font-bold text-orange-900">
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
              <ClipboardList className="w-5 h-5 text-sky-600" />
              <span>Giao nhiệm vụ mới</span>
            </h2>
            <form onSubmit={handleCreateAssignment} className="space-y-3">
              <select
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
              <select
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
              <input
                type="text"
                required
                value={assignTitle}
                onChange={(e) => setAssignTitle(e.target.value)}
                placeholder="Tiêu đề nhiệm vụ"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
              <textarea
                rows={3}
                value={assignInstructions}
                onChange={(e) => setAssignInstructions(e.target.value)}
                placeholder="Hướng dẫn cho học sinh..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
              <input
                type="date"
                required
                value={assignDueDate}
                onChange={(e) => setAssignDueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
              <button type="submit" className="w-full py-3 rounded-xl bg-sky-600 text-white font-bold text-sm cursor-pointer">
                Giao nhiệm vụ tới cả lớp
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6">
            <h2 className="font-display text-lg font-extrabold text-slate-900 mb-4">Bài nộp & Nhận xét</h2>
            {data.submissions.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có bài nộp nào.</p>
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
                      {s.teacher_feedback && <div className="text-xs text-emerald-700 mt-1">Nhận xét: {s.teacher_feedback}</div>}
                    </div>
                    {s.status !== 'graded' && (
                      <button
                        type="button"
                        onClick={() => handleGrade(s.id)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Chấm & Khen</span>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6">
            <h2 className="font-display text-lg font-extrabold text-slate-900 mb-4 flex items-center gap-2">
              <BookPlus className="w-5 h-5 text-sky-600" />
              <span>Thêm Bài học mới vào Kho Tri thức</span>
            </h2>
            <form onSubmit={handleCreateLesson} className="space-y-3">
              <select
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
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
                placeholder="Tên bài học"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
              <input
                type="text"
                value={lessonObjectives}
                onChange={(e) => setLessonObjectives(e.target.value)}
                placeholder="Mục tiêu bài học"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
              <textarea
                rows={4}
                required
                value={lessonKnowledge}
                onChange={(e) => setLessonKnowledge(e.target.value)}
                placeholder="Nội dung kiến thức trọng tâm..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
              <button type="submit" className="w-full py-3 rounded-xl bg-sky-600 text-white font-bold text-sm cursor-pointer">
                Xuất bản bài học
              </button>
            </form>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4">
            <h2 className="font-display text-lg font-extrabold text-slate-900">Gửi Học liệu bổ sung (Chờ Admin duyệt)</h2>
            <form onSubmit={handleCreateMaterial} className="space-y-3">
              <select
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
                value={matTitle}
                onChange={(e) => setMatTitle(e.target.value)}
                placeholder="Tiêu đề phiếu bài tập / hướng dẫn"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
              <textarea
                rows={3}
                required
                value={matContent}
                onChange={(e) => setMatContent(e.target.value)}
                placeholder="Nội dung chi tiết học liệu..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
              <button type="submit" className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm cursor-pointer">
                Gửi học liệu duyệt
              </button>
            </form>

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="text-xs font-bold text-slate-500">Học liệu đã gửi ({data.materials.length})</div>
              {data.materials.map((m) => (
                <div key={m.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">{m.title}</span>
                  <span className="font-bold text-sky-700">{m.approval_status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
