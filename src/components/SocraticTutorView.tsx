import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle,
  Compass,
  HelpCircle,
  Lightbulb,
  Mic,
  MicOff,
  Plus,
  Send,
  Sparkles,
  Volume2,
  Zap,
} from 'lucide-react';
import { apiRequest, UserProfileData } from '../lib/api';
import { SocoEmotion, SocoMascot } from './SocoMascot';
import { ProblemScannerModal, ScannedProblemPayload } from './ProblemScannerModal';

type TutorMode = 'socratic' | 'hint' | 'concept' | 'challenge';

interface MessageItem {
  id: number;
  sender: 'student' | 'soco';
  content: string;
  hint_level?: number;
  pedagogicalMeta?: {
    questionGoal?: string;
    testedSkill?: string;
    understandingLevel?: number;
    detectedMistake?: string;
    nextStepHint?: string;
    socoEmotion?: SocoEmotion;
    similarChallengeProblem?: string;
    isSolvedByStudent?: boolean;
    prerequisites?: string[];
  } | null;
}

interface SessionSummary {
  id: number;
  topic: string;
  mode: TutorMode;
  subject_id: number;
  subject_name: string;
  grade_level: number;
  learning_objective?: string;
  prerequisite_skills?: string;
  extracted_problem_text?: string;
  status: string;
}

interface SocraticTutorViewProps {
  user: UserProfileData;
  onUserUpdated: (user: UserProfileData) => void;
  initialSubjectId?: number;
  initialSessionId?: number;
  initialTopic?: string;
  autoOpenScanner?: boolean;
}

export function SocraticTutorView({
  user,
  onUserUpdated,
  initialSubjectId,
  initialSessionId,
  initialTopic,
  autoOpenScanner = false,
}: SocraticTutorViewProps) {
  const [subjects, setSubjects] = useState<Array<{ id: number; name: string }>>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(initialSessionId || null);
  const [messages, setMessages] = useState<MessageItem[]>([]);

  const [gradeLevel, setGradeLevel] = useState<number>(user.profile?.grade_level || 4);
  const [subjectId, setSubjectId] = useState<number>(initialSubjectId || 1);
  const [mode, setMode] = useState<TutorMode>('socratic');
  const [hintLevel, setHintLevel] = useState<number>(1);
  const [topic, setTopic] = useState<string>(initialTopic || 'Khám phá kiến thức');
  const [problemText, setProblemText] = useState<string>('');

  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [socoEmotion, setSocoEmotion] = useState<SocoEmotion>('happy');
  const [scannerOpen, setScannerOpen] = useState(autoOpenScanner);

  // Latest pedagogical state
  const [latestObjective, setLatestObjective] = useState('Hiểu bản chất bài toán và tự tìm hướng giải');
  const [latestPrereqs, setLatestPrereqs] = useState<string[]>([]);
  const [understandingScore, setUnderstandingScore] = useState<number>(3);
  const [similarProblem, setSimilarProblem] = useState<string>('');

  // Voice recognition & speech synthesis
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<unknown>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    apiRequest<{ subjects: Array<{ id: number; name: string }> }>('/api/curriculum/meta').then((d) => {
      setSubjects(d.subjects);
    });
    loadSessions();
  }, []);

  useEffect(() => {
    if (initialSessionId) {
      openExistingSession(initialSessionId);
    }
  }, [initialSessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  async function loadSessions() {
    try {
      const data = await apiRequest<{ sessions: SessionSummary[] }>('/api/ai/sessions');
      setSessions(data.sessions);
    } catch {
      // ignore
    }
  }

  async function openExistingSession(id: number) {
    setError('');
    try {
      const data = await apiRequest<{ session: SessionSummary; messages: MessageItem[] }>(`/api/ai/sessions/${id}`);
      setActiveSessionId(data.session.id);
      setGradeLevel(data.session.grade_level);
      setSubjectId(data.session.subject_id);
      setMode(data.session.mode);
      setTopic(data.session.topic);
      setProblemText(data.session.extracted_problem_text || '');
      if (data.session.learning_objective) setLatestObjective(data.session.learning_objective);
      if (data.session.prerequisite_skills) {
        setLatestPrereqs(data.session.prerequisite_skills.split('·').map((s) => s.trim()).filter(Boolean));
      }
      setMessages(data.messages);
      const lastSoco = [...data.messages].reverse().find((m) => m.sender === 'soco');
      if (lastSoco?.pedagogicalMeta) {
        setSocoEmotion(lastSoco.pedagogicalMeta.socoEmotion || 'explaining');
        if (lastSoco.pedagogicalMeta.understandingLevel) {
          setUnderstandingScore(lastSoco.pedagogicalMeta.understandingLevel);
        }
        if (lastSoco.pedagogicalMeta.similarChallengeProblem) {
          setSimilarProblem(lastSoco.pedagogicalMeta.similarChallengeProblem);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không tải được phiên học.');
    }
  }

  function startFreshSession() {
    setActiveSessionId(null);
    setMessages([]);
    setProblemText('');
    setTopic('Khám phá kiến thức mới');
    setSimilarProblem('');
    setHintLevel(1);
    setSocoEmotion('happy');
    setError('');
  }

  async function sendTurn(customText?: string, overrideMode?: TutorMode, overrideHintLevel?: number, revealSolution = false) {
    const textToSend = (customText ?? inputText).trim();
    if (!textToSend || sending) return;

    const activeMode = overrideMode || mode;
    const activeHint = overrideHintLevel ?? hintLevel;

    setError('');
    if (!customText) setInputText('');

    const optimisticMsg: MessageItem = {
      id: Date.now(),
      sender: 'student',
      content: textToSend,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setSending(true);
    setSocoEmotion('thinking');

    try {
      const res = await apiRequest<{
        sessionId: number;
        messageId: number;
        aiResponse: {
          reply: string;
          socoEmotion: SocoEmotion;
          pedagogicalAnalysis: {
            questionGoal: string;
            testedSkill: string;
            understandingLevel: number;
            detectedMistake: string;
            nextStepHint: string;
          };
          topic: string;
          learningObjective: string;
          prerequisites: string[];
          isSolvedByStudent: boolean;
          similarChallengeProblem: string;
        };
        user: UserProfileData;
      }>('/api/ai/tutor', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: activeSessionId,
          message: textToSend,
          mode: activeMode,
          hintLevel: activeHint,
          revealSolutionRequested: revealSolution,
          gradeLevel,
          subjectId,
          topic,
          problemText: problemText || textToSend,
        }),
      });

      setActiveSessionId(res.sessionId);
      setTopic(res.aiResponse.topic);
      setLatestObjective(res.aiResponse.learningObjective);
      setLatestPrereqs(res.aiResponse.prerequisites || []);
      setUnderstandingScore(res.aiResponse.pedagogicalAnalysis.understandingLevel || 3);
      setSocoEmotion(res.aiResponse.socoEmotion);
      if (res.aiResponse.similarChallengeProblem) {
        setSimilarProblem(res.aiResponse.similarChallengeProblem);
      }

      const socoReply: MessageItem = {
        id: res.messageId,
        sender: 'soco',
        content: res.aiResponse.reply,
        pedagogicalMeta: {
          ...res.aiResponse.pedagogicalAnalysis,
          socoEmotion: res.aiResponse.socoEmotion,
          similarChallengeProblem: res.aiResponse.similarChallengeProblem,
          isSolvedByStudent: res.aiResponse.isSolvedByStudent,
        },
      };
      setMessages((prev) => [...prev, socoReply]);
      onUserUpdated(res.user);
      loadSessions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'SOCO đang bận một chút, em thử gửi lại nhé!');
      setSocoEmotion('happy');
    } finally {
      setSending(false);
    }
  }

  function handleScannedProblem(payload: ScannedProblemPayload) {
    const matchedSub = subjects.find((s) =>
      payload.detectedSubject.toLowerCase().includes(s.name.toLowerCase().split(' ')[0])
    );
    if (matchedSub) setSubjectId(matchedSub.id);
    setGradeLevel(payload.detectedGrade);
    setTopic(payload.topic);
    setProblemText(payload.extractedText);
    setActiveSessionId(null);
    setMessages([]);
    sendTurn(`Em vừa quét được đề bài này từ ảnh: "${payload.extractedText}". SOCO hướng dẫn em bắt đầu suy nghĩ nhé!`);
  }

  function toggleVoiceInput() {
    const SpeechRec = (window as unknown as { webkitSpeechRecognition?: new () => unknown; SpeechRecognition?: new () => unknown })
      .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;

    if (!SpeechRec) {
      setError('Trình duyệt hiện tại chưa hỗ trợ nhập giọng nói. Em hãy gõ hoặc chụp ảnh bài tập nhé!');
      return;
    }

    if (listening && recognitionRef.current) {
      (recognitionRef.current as { stop: () => void }).stop();
      setListening(false);
      return;
    }

    const rec = new SpeechRec() as {
      lang: string;
      interimResults: boolean;
      onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
      onerror: () => void;
      onend: () => void;
      start: () => void;
    };
    rec.lang = 'vi-VN';
    rec.interimResults = false;
    rec.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript || '';
      setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }

  function speakText(text: string) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'vi-VN';
    utter.rate = gradeLevel <= 2 ? 0.9 : 1.0;
    window.speechSynthesis.speak(utter);
  }

  const modeTabs: Array<{ id: TutorMode; label: string; desc: string; icon: React.ReactNode }> = [
    { id: 'socratic', label: 'Socratic', desc: 'Đặt câu hỏi gợi mở', icon: <Compass className="w-4 h-4" /> },
    { id: 'hint', label: 'Gợi ý 3 cấp', desc: 'Nhắc kiến thức & phương pháp', icon: <Lightbulb className="w-4 h-4" /> },
    { id: 'concept', label: 'Giải thích', desc: 'Hiểu bản chất & ví dụ', icon: <HelpCircle className="w-4 h-4" /> },
    { id: 'challenge', label: 'Thử thách', desc: 'Tạo bài tương tự', icon: <Zap className="w-4 h-4" /> },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Sidebar: Sessions & Context */}
      <aside className="lg:col-span-3 space-y-4">
        <div className="bg-white border border-slate-200 rounded-3xl p-4 space-y-3">
          <button
            type="button"
            onClick={startFreshSession}
            className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Bài hỏi mới</span>
          </button>

          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="w-full py-2.5 px-4 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-900 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <Camera className="w-4 h-4 text-orange-600" />
            <span>Chụp / Tải ảnh đề bài</span>
          </button>

          <div className="pt-2 border-t border-slate-100 space-y-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Lớp học (Phân hóa AI)</label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold bg-white"
              >
                {[1, 2, 3, 4, 5].map((g) => (
                  <option key={g} value={g}>
                    Lớp {g} {g <= 2 ? '(Câu ngắn, đồ vật)' : g === 3 ? '(Thực hành)' : '(Phân tích nhiều bước)'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Môn học</label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold bg-white"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* History */}
        <div className="bg-white border border-slate-200 rounded-3xl p-4">
          <h3 className="font-display text-sm font-extrabold text-slate-900 mb-2.5">Lịch sử hội thoại</h3>
          {sessions.length === 0 ? (
            <p className="text-xs text-slate-500">Chưa có phiên trò chuyện nào được lưu.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => openExistingSession(s.id)}
                  className={`w-full text-left p-2.5 rounded-xl border text-xs transition-colors cursor-pointer ${
                    activeSessionId === s.id
                      ? 'bg-sky-50 border-sky-400 text-sky-950'
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="font-bold truncate">{s.topic}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {s.subject_name} · Lớp {s.grade_level}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main Conversation Stage */}
      <section className="lg:col-span-6 bg-white border border-slate-200 rounded-3xl flex flex-col min-h-[620px] max-h-[760px]">
        {/* Mode Bar */}
        <div className="p-4 border-b border-slate-100">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-100 p-1 rounded-2xl">
            {modeTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setMode(t.id)}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                  mode === t.id ? 'bg-white text-sky-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {mode === 'hint' && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-amber-900">Mức gợi ý:</span>
                {[1, 2, 3].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => {
                      setHintLevel(lvl);
                      sendTurn(`SOCO ơi, cho em xin gợi ý cấp độ ${lvl} cho bài này nhé!`, 'hint', lvl, false);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                      hintLevel === lvl ? 'bg-amber-600 text-white' : 'bg-white text-amber-900 border border-amber-300'
                    }`}
                  >
                    Cấp {lvl}
                  </button>
                ))}
              </div>
              {hintLevel >= 3 && (
                <button
                  type="button"
                  onClick={() =>
                    sendTurn('Em đã thử 3 gợi ý rồi, SOCO hướng dẫn từng bước cách giải mẫu để em đối chiếu nhé!', 'hint', 3, true)
                  }
                  className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-bold cursor-pointer"
                >
                  Xem cách giải mẫu
                </button>
              )}
            </div>
          )}
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {messages.length === 0 ? (
            <div className="py-6 space-y-5">
              <SocoMascot
                emotion="happy"
                size="lg"
                speech={`Chào ${user.display_name}! Em đang ở chế độ ${modeTabs.find((m) => m.id === mode)?.label} dành cho Lớp ${gradeLevel}. Hãy gửi bài tập, chụp ảnh hoặc hỏi bất kỳ điều gì em đang thắc mắc nhé!`}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  'Làm sao cộng hai phân số khác mẫu 1/2 + 1/3 ạ?',
                  'Vì sao cây xanh cần ánh sáng mặt trời để sống?',
                  'Giúp em đặt một câu có biện pháp nhân hóa về cơn mưa.',
                  'Tính chu vi hình chữ nhật dài 9cm, rộng 5cm thế nào?',
                ].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => sendTurn(sample)}
                    className="text-left p-3 rounded-2xl border border-slate-200 hover:border-sky-400 hover:bg-sky-50/50 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.sender === 'student' ? 'justify-end' : 'justify-start'}`}>
                {m.sender === 'student' ? (
                  <div className="max-w-[82%] bg-sky-600 text-white rounded-2xl rounded-br-sm px-4 py-3 text-sm leading-relaxed">
                    {m.content}
                  </div>
                ) : (
                  <div className="max-w-[90%] space-y-2">
                    <div className="bg-[#F7FBFF] border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3.5 text-sm md:text-[15px] leading-relaxed text-slate-800">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-extrabold text-sky-700">SOCO Gia sư Socratic</span>
                        <button
                          type="button"
                          onClick={() => speakText(m.content)}
                          className="text-xs font-semibold text-slate-500 hover:text-sky-700 flex items-center gap-1 cursor-pointer"
                          title="Đọc to câu này"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Nghe đọc</span>
                        </button>
                      </div>
                      <p className="whitespace-pre-line">{m.content}</p>
                      {m.pedagogicalMeta?.isSolvedByStudent && (
                        <div className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                          <CheckCircle className="w-4 h-4" />
                          <span>Tuyệt vời! Em đã tự giải được bước này!</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

          {sending && (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-violet-50 border border-violet-200 text-xs font-semibold text-violet-900">
              <Sparkles className="w-4 h-4 text-violet-600" />
              <span>SOCO đang phân tích cách nghĩ của em để đặt câu hỏi gợi mở phù hợp...</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">{error}</div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input Box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendTurn();
          }}
          className="p-4 border-t border-slate-200 bg-slate-50/70 rounded-b-3xl"
        >
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={toggleVoiceInput}
              className={`p-3 rounded-xl border transition-colors shrink-0 cursor-pointer ${
                listening
                  ? 'bg-red-50 border-red-400 text-red-700'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
              title="Nói bằng giọng nói"
            >
              {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <textarea
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendTurn();
                }
              }}
              placeholder="Nhập câu hỏi hoặc câu trả lời của em (Enter để gửi)..."
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-500"
            />

            <button
              type="submit"
              disabled={sending || !inputText.trim()}
              className="px-4 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-sm flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Gửi</span>
            </button>
          </div>
        </form>
      </section>

      {/* Right Column: Mascot State & Pedagogical Insight */}
      <aside className="lg:col-span-3 space-y-4">
        <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
          <SocoMascot emotion={socoEmotion} size="md" />

          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div>
              <div className="text-[11px] font-semibold text-slate-500">Chủ đề đang khám phá</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">{topic}</div>
            </div>

            <div>
              <div className="text-[11px] font-semibold text-slate-500">Mục tiêu học tập</div>
              <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">{latestObjective}</p>
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-1">
                <span>Mức độ nắm bắt</span>
                <span className="tabular-nums font-bold text-sky-700">{understandingScore}/5</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${(understandingScore / 5) * 100}%` }}
                />
              </div>
            </div>

            {latestPrereqs.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold text-slate-500 mb-1">Kiến thức nền liên quan</div>
                <ul className="space-y-1 text-xs text-slate-700 list-disc list-inside">
                  {latestPrereqs.map((p, idx) => (
                    <li key={idx}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {similarProblem && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 space-y-3">
            <div className="text-xs font-extrabold text-emerald-900 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-emerald-600" />
              <span>Bài tập tương tự rèn luyện</span>
            </div>
            <p className="text-xs text-emerald-950 leading-relaxed">{similarProblem}</p>
            <button
              type="button"
              onClick={() => {
                setMode('challenge');
                sendTurn(`Em muốn thử giải bài tập tương tự này: ${similarProblem}`, 'challenge', 1, false);
              }}
              className="w-full py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer"
            >
              Thử giải bài này cùng SOCO
            </button>
          </div>
        )}
      </aside>

      <ProblemScannerModal
        isOpen={scannerOpen}
        defaultGrade={gradeLevel}
        onClose={() => setScannerOpen(false)}
        onConfirmProblem={handleScannedProblem}
      />
    </div>
  );
}
