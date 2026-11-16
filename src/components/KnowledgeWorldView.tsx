import React, { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, HelpCircle, MessageSquare, Search, Sparkles } from 'lucide-react';
import { apiRequest, UserProfileData } from '../lib/api';

interface LessonItem {
  id: number;
  title: string;
  unit_title: string;
  semester: number;
  grade_level: number;
  grade_name: string;
  subject_id: number;
  subject_name: string;
  objectives: string;
  core_knowledge: string;
  illustration_url: string | null;
  examples: string[];
  interactiveCheck: {
    question?: string;
    options?: string[];
    answer?: string;
    hint?: string;
  };
  review_notes: string;
  progress: { status: string; score: number } | null;
  materials: Array<{ id: number; title: string; material_type: string; content: string }>;
}

interface KnowledgeWorldViewProps {
  user: UserProfileData;
  initialSubjectId?: number;
  onUserUpdated: (user: UserProfileData) => void;
  onAskSoco: (subjectId: number, topic: string) => void;
}

export function KnowledgeWorldView({ user, initialSubjectId, onUserUpdated, onAskSoco }: KnowledgeWorldViewProps) {
  const [grades, setGrades] = useState<Array<{ id: number; level: number; name: string }>>([]);
  const [subjects, setSubjects] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedGrade, setSelectedGrade] = useState<number>(user.profile?.grade_level || 4);
  const [selectedSubject, setSelectedSubject] = useState<number | ''>(initialSubjectId || '');
  const [selectedSemester, setSelectedSemester] = useState<number | ''>('');
  const [search, setSearch] = useState('');

  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [activeLesson, setActiveLesson] = useState<LessonItem | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [checkResult, setCheckResult] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [completing, setCompleting] = useState(false);
  const [completeMsg, setCompleteMsg] = useState('');

  useEffect(() => {
    apiRequest<{ grades: Array<{ id: number; level: number; name: string }>; subjects: Array<{ id: number; name: string }> }>(
      '/api/curriculum/meta'
    ).then((d) => {
      setGrades(d.grades);
      setSubjects(d.subjects);
    });
  }, []);

  async function loadLessons() {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (selectedGrade) qs.set('gradeLevel', String(selectedGrade));
      if (selectedSubject) qs.set('subjectId', String(selectedSubject));
      if (selectedSemester) qs.set('semester', String(selectedSemester));
      if (search.trim()) qs.set('search', search.trim());
      const res = await apiRequest<{ lessons: LessonItem[] }>(`/api/curriculum/lessons?${qs.toString()}`);
      setLessons(res.lessons);
      if (res.lessons.length > 0 && (!activeLesson || !res.lessons.some((l) => l.id === activeLesson.id))) {
        setActiveLesson(res.lessons[0]);
        setSelectedAnswer('');
        setCheckResult('idle');
        setCompleteMsg('');
      } else if (res.lessons.length === 0) {
        setActiveLesson(null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLessons();
  }, [selectedGrade, selectedSubject, selectedSemester]);

  async function handleCompleteLesson(lesson: LessonItem) {
    setCompleting(true);
    setCompleteMsg('');
    try {
      const score = checkResult === 'correct' ? 100 : 85;
      const res = await apiRequest<{ message: string; user: UserProfileData }>(`/api/curriculum/lessons/${lesson.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ score, timeSpentSeconds: 180 }),
      });
      setCompleteMsg(res.message);
      onUserUpdated(res.user);
      loadLessons();
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Filter Header */}
      <section className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-slate-900">Thế giới Kiến thức Lớp 1–5</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Cấu trúc Lớp → Môn học → Học kỳ → Chủ đề → Bài học · Dữ liệu học liệu được giáo viên & nhà trường biên soạn
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') loadLessons();
              }}
              placeholder="Tìm bài học..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setSelectedGrade(0)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                selectedGrade === 0 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Tất cả lớp
            </button>
            {grades.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedGrade(g.level)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap ${
                  selectedGrade === g.level ? 'bg-white text-sky-800 shadow-xs' : 'text-slate-600'
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>

          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value ? Number(e.target.value) : '')}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
          >
            <option value="">Tất cả môn học</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value ? Number(e.target.value) : '')}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
          >
            <option value="">Cả 2 học kỳ</option>
            <option value="1">Học kỳ 1</option>
            <option value="2">Học kỳ 2</option>
          </select>
        </div>
      </section>

      {/* Master-Detail Lesson Explorer */}
      {loading ? (
        <div className="h-96 rounded-3xl bg-white border border-slate-200 animate-pulse" />
      ) : lessons.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-bold text-slate-800">Chưa có bài học phù hợp bộ lọc này</p>
          <p className="text-xs text-slate-500 mt-1">Em hãy thử chọn "Tất cả lớp" hoặc môn học khác nhé.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Lesson List */}
          <div className="lg:col-span-4 space-y-2.5">
            {lessons.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => {
                  setActiveLesson(l);
                  setSelectedAnswer('');
                  setCheckResult('idle');
                  setCompleteMsg('');
                }}
                className={`w-full text-left p-4 rounded-2xl border transition-colors cursor-pointer ${
                  activeLesson?.id === l.id
                    ? 'bg-sky-50 border-sky-500 text-slate-900'
                    : 'bg-white border-slate-200 hover:border-sky-300 text-slate-800'
                }`}
              >
                <div className="text-[11px] font-semibold text-slate-500">
                  {l.grade_name} · {l.subject_name} · Học kỳ {l.semester}
                </div>
                <div className="font-display font-bold text-sm mt-1 flex items-center justify-between gap-2">
                  <span>{l.title}</span>
                  {l.progress?.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                </div>
                <div className="text-xs text-slate-500 mt-1 truncate">{l.unit_title}</div>
              </button>
            ))}
          </div>

          {/* Right Active Lesson Content */}
          {activeLesson && (
            <article className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <div className="text-xs font-semibold text-sky-700">
                    {activeLesson.grade_name} · {activeLesson.subject_name} · {activeLesson.unit_title}
                  </div>
                  <h2 className="font-display text-2xl font-extrabold text-slate-900 mt-1">{activeLesson.title}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => onAskSoco(activeLesson.subject_id, activeLesson.title)}
                  className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-2 shrink-0 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Hỏi SOCO về bài này</span>
                </button>
              </div>

              {activeLesson.illustration_url && (
                <div className="rounded-2xl overflow-hidden border border-slate-200 max-h-72 bg-slate-50">
                  <img
                    src={activeLesson.illustration_url}
                    alt={activeLesson.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover max-h-72"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200">
                  <h3 className="font-display text-sm font-extrabold text-sky-950">Mục tiêu bài học</h3>
                  <p className="mt-1.5 text-sm text-slate-700 leading-relaxed">{activeLesson.objectives}</p>
                </div>
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
                  <h3 className="font-display text-sm font-extrabold text-amber-950">Ghi nhớ ôn tập</h3>
                  <p className="mt-1.5 text-sm text-slate-700 leading-relaxed">{activeLesson.review_notes}</p>
                </div>
              </div>

              <div>
                <h3 className="font-display text-lg font-extrabold text-slate-900">Kiến thức trọng tâm</h3>
                <p className="mt-2 text-[15px] text-slate-800 leading-relaxed">{activeLesson.core_knowledge}</p>
              </div>

              {activeLesson.examples.length > 0 && (
                <div>
                  <h3 className="font-display text-lg font-extrabold text-slate-900 mb-2">Ví dụ minh họa</h3>
                  <ul className="space-y-2">
                    {activeLesson.examples.map((ex, i) => (
                      <li key={i} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-800">
                        {ex}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {activeLesson.materials.length > 0 && (
                <div>
                  <h3 className="font-display text-base font-extrabold text-slate-900 mb-2">Học liệu bổ sung đã duyệt</h3>
                  <div className="space-y-2">
                    {activeLesson.materials.map((m) => (
                      <div key={m.id} className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200">
                        <div className="text-sm font-bold text-emerald-950">{m.title}</div>
                        <p className="text-xs text-slate-700 mt-1">{m.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Interactive Check Question */}
              {activeLesson.interactiveCheck?.question && (
                <div className="p-5 rounded-2xl bg-[#F7FBFF] border border-sky-200 space-y-3">
                  <div className="flex items-center gap-2 font-display text-base font-extrabold text-slate-900">
                    <HelpCircle className="w-5 h-5 text-sky-600" />
                    <span>Câu hỏi tương tác nhanh</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">{activeLesson.interactiveCheck.question}</p>
                  <div className="grid grid-cols-1 gap-2">
                    {(activeLesson.interactiveCheck.options || []).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          setSelectedAnswer(opt);
                          setCheckResult(opt === activeLesson.interactiveCheck.answer ? 'correct' : 'wrong');
                        }}
                        className={`text-left px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${
                          selectedAnswer === opt
                            ? opt === activeLesson.interactiveCheck.answer
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold'
                              : 'bg-red-50 border-red-400 text-red-900'
                            : 'bg-white border-slate-200 hover:border-sky-400'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  {checkResult === 'correct' && (
                    <p className="text-xs font-bold text-emerald-700">Chính xác! Em đã nắm vững ý chính của bài học rồi.</p>
                  )}
                  {checkResult === 'wrong' && (
                    <p className="text-xs font-semibold text-orange-700">
                      Gợi ý cho em: {activeLesson.interactiveCheck.hint || 'Hãy đọc lại phần Kiến thức trọng tâm ở trên nhé!'}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100">
                {completeMsg ? (
                  <div className="text-sm font-bold text-emerald-700 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>{completeMsg}</span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-500">Hoàn thành bài học để lưu tiến độ và nhận +30 XP</span>
                )}
                <button
                  type="button"
                  disabled={completing}
                  onClick={() => handleCompleteLesson(activeLesson)}
                  className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{completing ? 'Đang lưu...' : 'Đánh dấu hoàn thành bài học'}</span>
                </button>
              </div>
            </article>
          )}
        </div>
      )}
    </div>
  );
}
