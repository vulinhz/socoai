import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Sparkles, Upload } from 'lucide-react';
import { apiRequest } from '../lib/api';

export interface ReviewLessonItem {
  id: number;
  title: string;
  unit_title: string;
  grade_level: number;
  subject_name: string;
  review_status?: string;
  is_ai_generated?: number;
}

export interface ReviewExerciseItem {
  id: number;
  title: string;
  game_type: string;
  difficulty: string;
  grade_level: number;
  subject_name: string;
  review_status?: string;
  is_ai_generated?: number;
  question_count?: number;
}

type ImportKind = 'lessons' | 'exercises' | 'questions';

function parseCsvText(csvText: string): Array<Record<string, string>> {
  const clean = csvText.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cell.trim());
      if (row.some((v) => v.length > 0)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  row.push(cell.trim());
  if (row.some((v) => v.length > 0)) rows.push(row);

  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((vals) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (h) obj[h] = vals[idx] ?? '';
    });
    return obj;
  });
}

const SAMPLE_TEMPLATES: Record<ImportKind, { csv: string; filename: string; columns: string }> = {
  lessons: {
    filename: 'mau-import-bai-hoc.csv',
    columns: 'gradeLevel, subjectCode (math/vietnamese/science), semester, unitTitle, title, objectives, coreKnowledge, examples (ngăn cách |), reviewNotes',
    csv: `gradeLevel,subjectCode,semester,unitTitle,title,objectives,coreKnowledge,examples,reviewNotes
4,math,1,Chủ đề bổ sung Lớp 4,Ôn tập tính chất giao hoán phép cộng,Vận dụng đổi chỗ số hạng để tính nhẩm nhanh,Khi đổi chỗ các số hạng trong một tổng thì tổng không thay đổi (a + b = b + a).,250 + 75 = 75 + 250 = 325|199 + 48 + 1 = (199 + 1) + 48 = 248,Ghép cặp các số tròn chục hoặc tròn trăm trước khi cộng.`,
  },
  exercises: {
    filename: 'mau-import-bai-tap.csv',
    columns: 'gradeLevel, subjectCode, title, gameType (quiz/true_false/math_challenge), difficulty (easy/medium/hard), prompt, options (ngăn cách |), correctAnswer, explanation',
    csv: `gradeLevel,subjectCode,title,gameType,difficulty,prompt,options,correctAnswer,explanation
3,math,Luyện tính nhẩm nhân với 10,quiz,easy,Kết quả của phép tính 24 x 10 là bao nhiêu?,240|204|2400|24,240,Khi nhân một số tự nhiên với 10 ta viết thêm một chữ số 0 vào bên phải số đó.`,
  },
  questions: {
    filename: 'mau-import-cau-hoi.csv',
    columns: 'exerciseId, prompt, options (ngăn cách |), correctAnswer, explanation',
    csv: `exerciseId,prompt,options,correctAnswer,explanation
1,Số liền sau của số 99 là số nào?,98|100|101|90,100,Số liền sau của một số thì lớn hơn số đó 1 đơn vị: 99 + 1 = 100.`,
  },
};

function validateClientRow(kind: ImportKind, item: Record<string, unknown>): string | null {
  if (kind === 'lessons') {
    const g = Number(item.gradeLevel ?? item.grade ?? item.lop);
    if (!g || g < 1 || g > 5) return 'Lớp phải từ 1–5';
    if (!String(item.subjectCode ?? item.subject ?? item.monHoc ?? '').trim()) return 'Thiếu mã môn';
    if (!String(item.title ?? item.tenBai ?? '').trim() || !String(item.coreKnowledge ?? item.kienThuc ?? '').trim()) {
      return 'Thiếu tiêu đề/kiến thức';
    }
    return null;
  }
  if (kind === 'exercises') {
    const g = Number(item.gradeLevel ?? item.grade ?? item.lop);
    if (!g || g < 1 || g > 5) return 'Lớp phải từ 1–5';
    if (!String(item.title ?? '').trim() || !String(item.prompt ?? '').trim() || !String(item.correctAnswer ?? '').trim()) {
      return 'Thiếu tiêu đề/câu hỏi/đáp án';
    }
    return null;
  }
  if (!Number(item.exerciseId ?? item.maBaiTap)) return 'Thiếu exerciseId';
  if (!String(item.prompt ?? '').trim() || !String(item.correctAnswer ?? '').trim()) return 'Thiếu câu hỏi/đáp án';
  return null;
}

const STATUS_LABELS: Record<string, { text: string; style: string }> = {
  draft: { text: 'Bản nháp (Chờ duyệt)', style: 'bg-amber-100 text-amber-900 border-amber-300' },
  approved: { text: 'Đã duyệt (Sẵn sàng xuất bản)', style: 'bg-sky-100 text-sky-900 border-sky-300' },
  published: { text: 'Đã xuất bản cho học sinh', style: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  rejected: { text: 'Từ chối', style: 'bg-red-100 text-red-900 border-red-300' },
};

export function BulkImportPanel({
  lessons,
  exercises,
  onReload,
}: {
  lessons: ReviewLessonItem[];
  exercises: ReviewExerciseItem[];
  onReload: () => void;
}) {
  const [kind, setKind] = useState<ImportKind>('lessons');
  const [parsedRows, setParsedRows] = useState<Array<Record<string, unknown>>>([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{
    message: string;
    errors?: Array<{ row: number; message: string }>;
  } | null>(null);

  const [reviewFilter, setReviewFilter] = useState<'draft' | 'approved' | 'all'>('draft');
  const [updatingId, setUpdatingId] = useState<string>('');

  function downloadTemplate() {
    const tpl = SAMPLE_TEMPLATES[kind];
    const blob = new Blob(['\ufeff' + tpl.csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = tpl.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setParseError('');
    setImportFeedback(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      try {
        if (file.name.toLowerCase().endsWith('.json')) {
          const json = JSON.parse(content);
          const arr = Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : null;
          if (!arr) {
            setParseError('Tệp JSON cần là một mảng các đối tượng [{...}] hoặc { "items": [...] }.');
            setParsedRows([]);
            return;
          }
          setParsedRows(arr);
        } else {
          const rows = parseCsvText(content);
          if (rows.length === 0) {
            setParseError('Không đọc được dòng dữ liệu nào từ tệp CSV. Vui lòng kiểm tra dòng tiêu đề cột.');
          }
          setParsedRows(rows);
        }
      } catch {
        setParseError('Không thể phân tích cú pháp tệp. Vui lòng dùng CSV UTF-8 hoặc JSON hợp lệ.');
        setParsedRows([]);
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  async function submitBulkImport() {
    if (parsedRows.length === 0) return;
    setImporting(true);
    setImportFeedback(null);
    try {
      const res = await apiRequest<{
        message: string;
        importedCount: number;
        errors?: Array<{ row: number; message: string }>;
      }>('/api/content/bulk-import', {
        method: 'POST',
        body: JSON.stringify({ kind, items: parsedRows }),
      });
      setImportFeedback({ message: res.message, errors: res.errors });
      if (res.importedCount > 0) {
        setParsedRows([]);
        setFileName('');
        onReload();
      }
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : 'Import dữ liệu không thành công.');
    } finally {
      setImporting(false);
    }
  }

  async function updateReviewStatus(type: 'lessons' | 'exercises', id: number, reviewStatus: 'approved' | 'published' | 'rejected') {
    const key = `${type}-${id}`;
    setUpdatingId(key);
    try {
      await apiRequest(`/api/content/${type}/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ reviewStatus }),
      });
      onReload();
    } finally {
      setUpdatingId('');
    }
  }

  const filteredLessons = lessons.filter((l) =>
    reviewFilter === 'all' ? true : (l.review_status || 'published') === reviewFilter
  );
  const filteredExercises = exercises.filter((ex) =>
    reviewFilter === 'all' ? true : (ex.review_status || 'published') === reviewFilter
  );

  return (
    <div className="space-y-6">
      {/* Bulk CSV / JSON Import Box */}
      <section className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-sky-600" aria-hidden="true" />
              <span>Nhập hàng loạt CSV / JSON (Mặc định lưu ở trạng thái Nháp)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Hỗ trợ nhập Bài học, Bài tập hoặc Câu hỏi bổ sung · Có kiểm tra lỗi từng dòng và xem trước trước khi lưu
            </p>
          </div>
          <button
            type="button"
            onClick={downloadTemplate}
            className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>Tải tệp CSV mẫu</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label htmlFor="bulk-kind" className="block text-xs font-semibold text-slate-700 mb-1">
              Loại dữ liệu cần nhập
            </label>
            <select
              id="bulk-kind"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as ImportKind);
                setParsedRows([]);
                setFileName('');
                setParseError('');
                setImportFeedback(null);
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white font-semibold"
            >
              <option value="lessons">Bài học mới (lessons)</option>
              <option value="exercises">Bài tập &amp; Trò chơi (exercises)</option>
              <option value="questions">Câu hỏi cho bài tập (questions)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Chọn tệp CSV hoặc JSON từ máy tính
            </label>
            <label className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-dashed border-sky-400 bg-sky-50/50 hover:bg-sky-50 cursor-pointer text-sm">
              <span className="font-semibold text-sky-900 truncate">
                {fileName ? `${fileName} (${parsedRows.length} dòng)` : 'Nhấn để chọn tệp .csv hoặc .json...'}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-sky-600 text-white text-xs font-bold shrink-0">
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Chọn tệp</span>
              </span>
              <input type="file" accept=".csv,.json,text/csv,application/json" onChange={handleFileSelected} className="sr-only" />
            </label>
          </div>
        </div>

        <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
          <strong>Các cột hỗ trợ ({kind}):</strong> {SAMPLE_TEMPLATES[kind].columns}
        </div>

        {parseError && (
          <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
            {parseError}
          </div>
        )}

        {importFeedback && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-2">
            <div className="font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
              <span>{importFeedback.message}</span>
            </div>
            {importFeedback.errors && importFeedback.errors.length > 0 && (
              <ul className="list-disc list-inside text-red-700 space-y-0.5">
                {importFeedback.errors.map((err, i) => (
                  <li key={i}>
                    Dòng {err.row}: {err.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {parsedRows.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-700">
                Xem trước dữ liệu ({Math.min(10, parsedRows.length)} / {parsedRows.length} dòng đầu)
              </span>
              <button
                type="button"
                disabled={importing}
                onClick={submitBulkImport}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
              >
                {importing ? 'Đang nhập dữ liệu...' : `Nhập ${parsedRows.length} dòng vào hàng chờ duyệt`}
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2 px-3">Dòng</th>
                    <th className="py-2 px-3">Tiêu đề / Nội dung chính</th>
                    <th className="py-2 px-3">Thông số</th>
                    <th className="py-2 px-3">Kiểm tra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedRows.slice(0, 10).map((row, idx) => {
                    const rowErr = validateClientRow(kind, row);
                    return (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-mono-nums">{idx + 1}</td>
                        <td className="py-2 px-3 font-semibold text-slate-900 max-w-xs truncate">
                          {String(row.title ?? row.prompt ?? row.tenBai ?? '-')}
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {kind === 'questions'
                            ? `Bài tập #${row.exerciseId || '?'}`
                            : `Lớp ${row.gradeLevel ?? row.grade ?? '?'} · ${String(row.subjectCode ?? row.subject ?? '?')}`}
                        </td>
                        <td className="py-2 px-3">
                          {rowErr ? (
                            <span className="inline-flex items-center gap-1 text-red-700 font-semibold">
                              <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>{rowErr}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Hợp lệ</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Content Approval Workflow: draft -> approved -> published */}
      <section className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-extrabold text-slate-900">
              Quy trình Kiểm duyệt Nội dung (Nháp → Đã duyệt → Xuất bản)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Học sinh chỉ thấy bài học và bài tập ở trạng thái Đã xuất bản. Bản nháp AI và dữ liệu mới nhập luôn chờ duyệt trước.
            </p>
          </div>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'draft', label: 'Chờ duyệt (Nháp)' },
              { id: 'approved', label: 'Đã duyệt' },
              { id: 'all', label: 'Tất cả' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setReviewFilter(f.id as typeof reviewFilter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  reviewFilter === f.id ? 'bg-white text-sky-800 shadow-xs' : 'text-slate-600'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
            Bài tập &amp; Đề kiểm tra ({filteredExercises.length})
          </h3>
          {filteredExercises.length === 0 ? (
            <p className="text-xs text-slate-500">Không có bài tập nào trong bộ lọc trạng thái này.</p>
          ) : (
            <div className="space-y-2.5">
              {filteredExercises.slice(0, 15).map((ex) => {
                const st = ex.review_status || 'published';
                const badge = STATUS_LABELS[st] || STATUS_LABELS.draft;
                const busy = updatingId === `exercises-${ex.id}`;
                return (
                  <div
                    key={ex.id}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={`px-2 py-0.5 rounded-md border font-bold ${badge.style}`}>{badge.text}</span>
                        {ex.is_ai_generated === 1 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-100 text-violet-900 border border-violet-300 font-bold">
                            <Sparkles className="w-3 h-3" aria-hidden="true" />
                            <span>Do AI tạo — Cần giáo viên duyệt</span>
                          </span>
                        )}
                        <span className="text-slate-500">
                          Lớp {ex.grade_level} · {ex.subject_name} · {ex.question_count || 0} câu hỏi
                        </span>
                      </div>
                      <div className="font-bold text-sm text-slate-900">{ex.title}</div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {st === 'draft' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => updateReviewStatus('exercises', ex.id, 'approved')}
                          className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold cursor-pointer"
                        >
                          Duyệt nội dung
                        </button>
                      )}
                      {(st === 'draft' || st === 'approved') && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => updateReviewStatus('exercises', ex.id, 'published')}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                        >
                          Xuất bản cho học sinh
                        </button>
                      )}
                      {st !== 'rejected' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => updateReviewStatus('exercises', ex.id, 'rejected')}
                          className="px-3 py-1.5 rounded-xl bg-white border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold cursor-pointer"
                        >
                          Từ chối
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-3 pt-3 border-t border-slate-100">
          <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
            Bài học Kho Tri thức ({filteredLessons.length})
          </h3>
          {filteredLessons.length === 0 ? (
            <p className="text-xs text-slate-500">Không có bài học nào trong bộ lọc trạng thái này.</p>
          ) : (
            <div className="space-y-2.5">
              {filteredLessons.slice(0, 15).map((ls) => {
                const st = ls.review_status || 'published';
                const badge = STATUS_LABELS[st] || STATUS_LABELS.draft;
                const busy = updatingId === `lessons-${ls.id}`;
                return (
                  <div
                    key={ls.id}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={`px-2 py-0.5 rounded-md border font-bold ${badge.style}`}>{badge.text}</span>
                        <span className="text-slate-500">
                          Lớp {ls.grade_level} · {ls.subject_name} · {ls.unit_title}
                        </span>
                      </div>
                      <div className="font-bold text-sm text-slate-900">{ls.title}</div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {st === 'draft' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => updateReviewStatus('lessons', ls.id, 'approved')}
                          className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold cursor-pointer"
                        >
                          Duyệt bài học
                        </button>
                      )}
                      {(st === 'draft' || st === 'approved') && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => updateReviewStatus('lessons', ls.id, 'published')}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                        >
                          Xuất bản cho học sinh
                        </button>
                      )}
                      {st !== 'rejected' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => updateReviewStatus('lessons', ls.id, 'rejected')}
                          className="px-3 py-1.5 rounded-xl bg-white border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold cursor-pointer"
                        >
                          Từ chối
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
