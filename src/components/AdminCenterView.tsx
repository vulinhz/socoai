import React, { useEffect, useState } from 'react';
import { Activity, BookCheck, Settings, ShieldAlert, Trash2, Users } from 'lucide-react';
import { apiRequest } from '../lib/api';

interface AdminOverviewData {
  users: Array<{
    id: number;
    username: string;
    email: string | null;
    display_name: string;
    role: string;
    is_verified: number;
    parental_consent_status: string;
    status: string;
  }>;
  classes: Array<{ id: number; name: string; teacher_name: string; grade_name: string; join_code: string; student_count: number }>;
  materials: Array<{ id: number; title: string; lesson_title: string; author_name: string; approval_status: string; content: string }>;
  questions: Array<{ id: number; prompt: string; question_type: string; exercise_title: string; grade_level: number; subject_name: string }>;
  settings: Array<{ key: string; value: string; description: string }>;
  aiLogs: Array<{ id: number; username: string; role: string; endpoint: string; model_name: string; status: string; safety_flagged: number; latency_ms: number; created_at: string }>;
}

export function AdminCenterView() {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'users' | 'materials' | 'questions' | 'ai'>('users');
  const [msg, setMsg] = useState('');

  async function loadAll() {
    setLoading(true);
    try {
      const res = await apiRequest<AdminOverviewData>('/api/admin/overview');
      setData(res);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function toggleUserStatus(userId: number, currentStatus: string) {
    const next = currentStatus === 'active' ? 'suspended' : 'active';
    const res = await apiRequest<{ message: string }>(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: next }),
    });
    setMsg(res.message);
    loadAll();
  }

  async function reviewMaterial(id: number, approvalStatus: 'approved' | 'rejected') {
    const res = await apiRequest<{ message: string }>(`/api/admin/materials/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ approvalStatus }),
    });
    setMsg(res.message);
    loadAll();
  }

  async function deleteQuestion(id: number) {
    const res = await apiRequest<{ message: string }>(`/api/admin/questions/${id}`, { method: 'DELETE' });
    setMsg(res.message);
    loadAll();
  }

  async function saveSetting(key: string, value: string) {
    const res = await apiRequest<{ message: string }>('/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify({ key, value }),
    });
    setMsg(res.message);
    loadAll();
  }

  if (loading || !data) {
    return <div className="h-96 rounded-3xl bg-white border border-slate-200 animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-slate-900">Trung tâm Quản trị Hệ thống</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý người dùng · Lớp học · Duyệt học liệu · Ngân hàng câu hỏi · Cấu hình & An toàn AI
          </p>
        </div>

        <div className="flex flex-wrap p-1 bg-slate-100 rounded-xl gap-1">
          {[
            { id: 'users', label: 'Người dùng & Lớp', icon: <Users className="w-3.5 h-3.5" /> },
            { id: 'materials', label: 'Duyệt Học liệu', icon: <BookCheck className="w-3.5 h-3.5" /> },
            { id: 'questions', label: 'Ngân hàng Câu hỏi', icon: <Settings className="w-3.5 h-3.5" /> },
            { id: 'ai', label: 'Cấu hình AI & Nhật ký', icon: <Activity className="w-3.5 h-3.5" /> },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as typeof tab)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                tab === t.id ? 'bg-white text-sky-800 shadow-xs' : 'text-slate-600'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </section>

      {msg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm font-semibold text-emerald-800">{msg}</div>
      )}

      {tab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 overflow-x-auto">
            <h2 className="font-display text-lg font-extrabold text-slate-900 mb-4">Quản lý Tài khoản ({data.users.length})</h2>
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2 pr-3">Tên hiển thị</th>
                  <th className="py-2 pr-3">Tài khoản</th>
                  <th className="py-2 pr-3">Vai trò</th>
                  <th className="py-2 pr-3">Trạng thái</th>
                  <th className="py-2 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.users.map((u) => (
                  <tr key={u.id}>
                    <td className="py-3 pr-3 font-bold text-slate-900">{u.display_name}</td>
                    <td className="py-3 pr-3 font-mono-nums text-xs text-slate-600">{u.username}</td>
                    <td className="py-3 pr-3 text-xs font-semibold text-sky-800">{u.role}</td>
                    <td className="py-3 pr-3 text-xs font-semibold">
                      {u.status === 'active' ? 'Hoạt động' : 'Tạm khóa'}
                    </td>
                    <td className="py-3 text-right">
                      {u.role !== 'admin' && (
                        <button
                          type="button"
                          onClick={() => toggleUserStatus(u.id, u.status)}
                          className="text-xs font-bold text-sky-700 hover:underline cursor-pointer"
                        >
                          {u.status === 'active' ? 'Tạm khóa' : 'Mở khóa'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-6 space-y-3">
            <h2 className="font-display text-lg font-extrabold text-slate-900">Lớp học toàn hệ thống</h2>
            {data.classes.map((c) => (
              <div key={c.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-sm text-slate-900">{c.name}</div>
                <div className="text-xs text-slate-600 mt-1">
                  GV: {c.teacher_name} · {c.grade_name} · {c.student_count} HS · Mã: <strong className="font-mono-nums">{c.join_code}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'materials' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4">
          <h2 className="font-display text-lg font-extrabold text-slate-900">Kiểm duyệt Học liệu Tiểu học</h2>
          {data.materials.map((m) => (
            <div key={m.id} className="p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div className="max-w-2xl">
                <div className="text-xs font-semibold text-slate-500">
                  Bài: {m.lesson_title} · Tác giả: {m.author_name || 'Giáo viên'} · Trạng thái: <strong>{m.approval_status}</strong>
                </div>
                <div className="font-bold text-sm text-slate-900 mt-1">{m.title}</div>
                <p className="text-xs text-slate-600 mt-1">{m.content}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => reviewMaterial(m.id, 'approved')}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                >
                  Duyệt
                </button>
                <button
                  type="button"
                  onClick={() => reviewMaterial(m.id, 'rejected')}
                  className="px-3.5 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold cursor-pointer"
                >
                  Từ chối
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'questions' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-3">
          <h2 className="font-display text-lg font-extrabold text-slate-900">Ngân hàng Câu hỏi ({data.questions.length})</h2>
          {data.questions.map((q) => (
            <div key={q.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-sky-700">
                  Lớp {q.grade_level} · {q.subject_name} · {q.exercise_title}
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1">{q.prompt}</div>
              </div>
              <button
                type="button"
                onClick={() => deleteQuestion(q.id)}
                className="p-2 rounded-xl hover:bg-red-100 text-red-600 cursor-pointer"
                title="Xóa câu hỏi"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'ai' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 space-y-4">
            <h2 className="font-display text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-sky-600" />
              <span>Cấu hình AI & An toàn Trẻ em</span>
            </h2>
            {data.settings.map((s) => (
              <div key={s.key} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-xs text-slate-900">{s.key}</div>
                <p className="text-xs text-slate-600">{s.description}</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    defaultValue={s.value}
                    onBlur={(e) => {
                      if (e.target.value !== s.value) saveSetting(s.key, e.target.value);
                    }}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono-nums bg-white"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 overflow-x-auto">
            <h2 className="font-display text-lg font-extrabold text-slate-900 mb-4">Nhật ký Hoạt động AI gần nhất</h2>
            {data.aiLogs.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có lượt gọi AI nào được ghi nhận.</p>
            ) : (
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3">Tài khoản</th>
                    <th className="py-2 pr-3">Tác vụ</th>
                    <th className="py-2 pr-3">Trạng thái</th>
                    <th className="py-2 text-right">Độ trễ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.aiLogs.map((l) => (
                    <tr key={l.id}>
                      <td className="py-2.5 pr-3 font-bold text-slate-900">{l.username}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{l.endpoint}</td>
                      <td className="py-2.5 pr-3 font-semibold">{l.safety_flagged ? 'Cảnh báo an toàn' : l.status}</td>
                      <td className="py-2.5 text-right font-mono-nums">{l.latency_ms} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
