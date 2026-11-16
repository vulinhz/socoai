import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Gamepad2, RefreshCw, Sparkles, XCircle } from 'lucide-react';
import { apiRequest, UserProfileData } from '../lib/api';

type GameType =
  | 'quiz'
  | 'matching'
  | 'drag_drop'
  | 'fill_blank'
  | 'word_puzzle'
  | 'math_challenge'
  | 'picture_recognition'
  | 'memory'
  | 'true_false'
  | 'interactive_story';

interface GameQuestion {
  id: number;
  question_type: string;
  prompt: string;
  options: unknown;
  correct_answer: string;
  explanation: string;
}

interface GameExercise {
  id: number;
  title: string;
  game_type: GameType;
  difficulty: string;
  xp_reward: number;
  grade_level: number;
  grade_name: string;
  subject_name: string;
  questions: GameQuestion[];
}

const GAME_TYPE_LABELS: Record<GameType, string> = {
  quiz: 'Trắc nghiệm',
  matching: 'Nối cặp',
  drag_drop: 'Kéo thả sắp xếp',
  fill_blank: 'Điền chỗ trống',
  word_puzzle: 'Ghép chữ',
  math_challenge: 'Thử thách Toán',
  picture_recognition: 'Nhận diện ảnh',
  memory: 'Trí nhớ lật thẻ',
  true_false: 'Đúng hay Sai',
  interactive_story: 'Truyện tương tác',
};

interface PlayLearnViewProps {
  user: UserProfileData;
  initialSubjectId?: number;
  onUserUpdated: (user: UserProfileData) => void;
}

export function PlayLearnView({ user, initialSubjectId, onUserUpdated }: PlayLearnViewProps) {
  const [games, setGames] = useState<GameExercise[]>([]);
  const [filterType, setFilterType] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [activeGame, setActiveGame] = useState<GameExercise | null>(null);

  // Active gameplay states
  const [qIndex, setQIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongTopics, setWrongTopics] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [finishedScore, setFinishedScore] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());

  // Specific mechanics states
  const [textInput, setTextInput] = useState('');
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Record<string, string>>({});
  const [dragOrder, setDragOrder] = useState<string[]>([]);
  const [wordLetters, setWordLetters] = useState<string[]>([]);
  const [pickedLetters, setPickedLetters] = useState<number[]>([]);
  const [memoryCards, setMemoryCards] = useState<Array<{ uid: string; pairId: string; text: string; matched: boolean }>>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);

  useEffect(() => {
    loadGames();
  }, [filterType, initialSubjectId]);

  async function loadGames() {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filterType) qs.set('gameType', filterType);
      if (initialSubjectId) qs.set('subjectId', String(initialSubjectId));
      const res = await apiRequest<{ games: GameExercise[] }>(`/api/games?${qs.toString()}`);
      setGames(res.games);
    } finally {
      setLoading(false);
    }
  }

  function startGame(g: GameExercise) {
    setActiveGame(g);
    setQIndex(0);
    setCorrectCount(0);
    setWrongTopics([]);
    setFeedback(null);
    setFinishedScore(null);
    setStartTime(Date.now());
    initQuestionState(g.questions[0], g.game_type);
  }

  function initQuestionState(q: GameQuestion | undefined, gType: GameType) {
    if (!q) return;
    setFeedback(null);
    setTextInput('');
    setSelectedLeft(null);
    setMatchedPairs({});
    setPickedLetters([]);

    if (gType === 'drag_drop' && Array.isArray(q.options)) {
      setDragOrder([...(q.options as string[])]);
    }
    if (gType === 'word_puzzle' && Array.isArray(q.options)) {
      setWordLetters([...(q.options as string[])]);
    }
    if (gType === 'memory' && Array.isArray(q.options)) {
      const pairs = q.options as Array<{ id: string; a: string; b: string }>;
      const deck: Array<{ uid: string; pairId: string; text: string; matched: boolean }> = [];
      pairs.forEach((p) => {
        deck.push({ uid: `${p.id}-a`, pairId: p.id, text: p.a, matched: false });
        deck.push({ uid: `${p.id}-b`, pairId: p.id, text: p.b, matched: false });
      });
      deck.sort(() => Math.random() - 0.5);
      setMemoryCards(deck);
      setFlippedIndices([]);
    }
  }

  async function finishGame(finalCorrect: number, totalQ: number, finalWrong: string[]) {
    if (!activeGame) return;
    const score = Math.round((finalCorrect / Math.max(1, totalQ)) * 100);
    const timeSpentSeconds = Math.max(10, Math.round((Date.now() - startTime) / 1000));
    setFinishedScore(score);
    try {
      const res = await apiRequest<{ user: UserProfileData }>(`/api/games/${activeGame.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ score, timeSpentSeconds, wrongTopics: finalWrong }),
      });
      onUserUpdated(res.user);
    } catch {
      // ignore
    }
  }

  function recordOutcome(isCorrect: boolean, explanation: string, promptText: string) {
    if (!activeGame) return;
    const nextCorrect = isCorrect ? correctCount + 1 : correctCount;
    const nextWrong = isCorrect ? wrongTopics : [...wrongTopics, promptText];
    setCorrectCount(nextCorrect);
    setWrongTopics(nextWrong);
    setFeedback({
      ok: isCorrect,
      text: isCorrect ? `Chính xác! ${explanation}` : `Chưa đúng rồi, thử xem nhé: ${explanation}`,
    });
  }

  function nextStep() {
    if (!activeGame) return;
    if (qIndex + 1 >= activeGame.questions.length) {
      finishGame(correctCount, activeGame.questions.length, wrongTopics);
    } else {
      const nextIdx = qIndex + 1;
      setQIndex(nextIdx);
      initQuestionState(activeGame.questions[nextIdx], activeGame.game_type);
    }
  }

  // Memory card flip handler
  function handleFlipMemory(idx: number) {
    if (flippedIndices.length >= 2 || memoryCards[idx].matched || flippedIndices.includes(idx)) return;
    const next = [...flippedIndices, idx];
    setFlippedIndices(next);
    if (next.length === 2) {
      const [i1, i2] = next;
      const c1 = memoryCards[i1];
      const c2 = memoryCards[i2];
      if (c1.pairId === c2.pairId) {
        const updated = memoryCards.map((c, idxCard) =>
          idxCard === i1 || idxCard === i2 ? { ...c, matched: true } : c
        );
        setMemoryCards(updated);
        setFlippedIndices([]);
        if (updated.every((c) => c.matched) && activeGame) {
          recordOutcome(true, activeGame.questions[qIndex].explanation, activeGame.questions[qIndex].prompt);
        }
      } else {
        setTimeout(() => setFlippedIndices([]), 700);
      }
    }
  }

  if (activeGame) {
    const q = activeGame.questions[qIndex];
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <button
            type="button"
            onClick={() => setActiveGame(null)}
            className="text-sm font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại danh sách</span>
          </button>
          <div className="text-xs font-bold text-sky-700 tabular-nums">
            {GAME_TYPE_LABELS[activeGame.game_type]} · Câu {Math.min(qIndex + 1, activeGame.questions.length)}/{activeGame.questions.length}
          </div>
        </div>

        {finishedScore !== null ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 mx-auto flex items-center justify-center">
              <Sparkles className="w-8 h-8" />
            </div>
            <h2 className="font-display text-2xl font-extrabold text-slate-900">
              Hoàn thành trò chơi: {activeGame.title}
            </h2>
            <p className="text-base text-slate-700 tabular-nums">
              Kết quả của em: <strong className="text-sky-700">{finishedScore}%</strong> ({correctCount}/{activeGame.questions.length} lượt đúng)
            </p>
            <p className="text-xs text-slate-500">Điểm kinh nghiệm (XP) và hồ sơ năng lực đã được lưu vào hệ thống.</p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => startGame(activeGame)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 font-bold text-sm flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Chơi lại</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveGame(null)}
                className="px-5 py-2.5 rounded-xl bg-sky-600 text-white font-bold text-sm cursor-pointer"
              >
                Chọn trò chơi khác
              </button>
            </div>
          </div>
        ) : q ? (
          <div className="space-y-5">
            <h2 className="font-display text-xl font-extrabold text-slate-900">{activeGame.title}</h2>
            <p className="text-base font-semibold text-slate-800 leading-relaxed">{q.prompt}</p>

            {/* 1. Quiz / True-False / Fill Blank with options */}
            {(activeGame.game_type === 'quiz' ||
              activeGame.game_type === 'true_false' ||
              activeGame.game_type === 'fill_blank') &&
              Array.isArray(q.options) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(q.options as string[]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      disabled={Boolean(feedback)}
                      onClick={() => recordOutcome(opt === q.correct_answer, q.explanation, q.prompt)}
                      className="p-4 rounded-2xl border border-slate-200 hover:border-sky-500 hover:bg-sky-50 text-left font-bold text-sm text-slate-900 transition-colors cursor-pointer disabled:opacity-75"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

            {/* 2. Math Challenge (direct numeric/text answer) */}
            {activeGame.game_type === 'math_challenge' && (
              <div className="flex gap-3">
                <input
                  type="text"
                  value={textInput}
                  disabled={Boolean(feedback)}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Nhập đáp số của em..."
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-300 text-base font-mono-nums font-bold"
                />
                <button
                  type="button"
                  disabled={Boolean(feedback) || !textInput.trim()}
                  onClick={() => recordOutcome(textInput.trim() === q.correct_answer.trim(), q.explanation, q.prompt)}
                  className="px-6 py-3 rounded-xl bg-sky-600 text-white font-bold text-sm cursor-pointer disabled:opacity-50"
                >
                  Kiểm tra
                </button>
              </div>
            )}

            {/* 3. Matching */}
            {activeGame.game_type === 'matching' && Array.isArray(q.options) && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-500">Cột A (Chọn một ô)</div>
                    {(q.options as Array<{ left: string; right: string }>).map((pair) => (
                      <button
                        key={pair.left}
                        type="button"
                        onClick={() => setSelectedLeft(pair.left)}
                        className={`w-full p-3 rounded-xl border text-sm font-bold cursor-pointer ${
                          selectedLeft === pair.left
                            ? 'bg-sky-100 border-sky-500'
                            : matchedPairs[pair.left]
                            ? 'bg-emerald-50 border-emerald-400'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        {pair.left} {matchedPairs[pair.left] ? `→ ${matchedPairs[pair.left]}` : ''}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-500">Cột B (Ghép cặp)</div>
                    {(q.options as Array<{ left: string; right: string }>).map((pair) => (
                      <button
                        key={pair.right}
                        type="button"
                        onClick={() => {
                          if (!selectedLeft) return;
                          setMatchedPairs((prev) => ({ ...prev, [selectedLeft]: pair.right }));
                          setSelectedLeft(null);
                        }}
                        className="w-full p-3 rounded-xl border border-slate-200 hover:border-sky-400 bg-slate-50 text-sm font-bold cursor-pointer"
                      >
                        {pair.right}
                      </button>
                    ))}
                  </div>
                </div>
                {!feedback && (
                  <button
                    type="button"
                    onClick={() => {
                      const expected = JSON.parse(q.correct_answer) as Record<string, string>;
                      const allMatch = Object.keys(expected).every((k) => matchedPairs[k] === expected[k]);
                      recordOutcome(allMatch, q.explanation, q.prompt);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-sky-600 text-white font-bold text-sm cursor-pointer"
                  >
                    Kiểm tra các cặp đã nối
                  </button>
                )}
              </div>
            )}

            {/* 4. Drag & Drop Ordering */}
            {activeGame.game_type === 'drag_drop' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">Nhấn mũi tên Lên / Xuống để sắp xếp đúng thứ tự:</p>
                {dragOrder.map((item, idx) => (
                  <div key={item} className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-sm font-bold text-slate-800">
                      {idx + 1}. {item}
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        disabled={idx === 0 || Boolean(feedback)}
                        onClick={() => {
                          const copy = [...dragOrder];
                          [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
                          setDragOrder(copy);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-xs font-bold disabled:opacity-40 cursor-pointer"
                      >
                        Lên
                      </button>
                      <button
                        type="button"
                        disabled={idx === dragOrder.length - 1 || Boolean(feedback)}
                        onClick={() => {
                          const copy = [...dragOrder];
                          [copy[idx + 1], copy[idx]] = [copy[idx], copy[idx + 1]];
                          setDragOrder(copy);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-xs font-bold disabled:opacity-40 cursor-pointer"
                      >
                        Xuống
                      </button>
                    </div>
                  </div>
                ))}
                {!feedback && (
                  <button
                    type="button"
                    onClick={() => {
                      const expected = JSON.parse(q.correct_answer) as string[];
                      const ok = expected.every((v, i) => dragOrder[i] === v);
                      recordOutcome(ok, q.explanation, q.prompt);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-sky-600 text-white font-bold text-sm cursor-pointer"
                  >
                    Kiểm tra thứ tự
                  </button>
                )}
              </div>
            )}

            {/* 5. Word Puzzle */}
            {activeGame.game_type === 'word_puzzle' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 min-h-[56px] flex flex-wrap gap-2 items-center">
                  {pickedLetters.length === 0 ? (
                    <span className="text-xs text-slate-500">Nhấn các chữ cái bên dưới để ghép từ...</span>
                  ) : (
                    pickedLetters.map((idx, pos) => (
                      <button
                        key={`${idx}-${pos}`}
                        type="button"
                        onClick={() => setPickedLetters((prev) => prev.filter((_, p) => p !== pos))}
                        className="w-10 h-10 rounded-xl bg-white border border-sky-400 font-display font-extrabold text-sky-900 cursor-pointer"
                      >
                        {wordLetters[idx]}
                      </button>
                    ))
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {wordLetters.map((ch, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={pickedLetters.includes(idx) || Boolean(feedback)}
                      onClick={() => setPickedLetters((prev) => [...prev, idx])}
                      className="w-11 h-11 rounded-xl bg-white border border-slate-300 hover:border-sky-500 font-display font-extrabold text-slate-900 disabled:opacity-30 cursor-pointer"
                    >
                      {ch}
                    </button>
                  ))}
                </div>
                {!feedback && (
                  <button
                    type="button"
                    onClick={() => {
                      const built = pickedLetters.map((i) => wordLetters[i]).join('');
                      recordOutcome(built.toUpperCase() === q.correct_answer.toUpperCase(), q.explanation, q.prompt);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-sky-600 text-white font-bold text-sm cursor-pointer"
                  >
                    Kiểm tra từ vừa ghép
                  </button>
                )}
              </div>
            )}

            {/* 6. Picture Recognition */}
            {activeGame.game_type === 'picture_recognition' && typeof q.options === 'object' && q.options !== null && (
              <div className="space-y-4">
                <img
                  src={(q.options as { imageUrl: string }).imageUrl}
                  alt="Hình minh họa câu hỏi"
                  referrerPolicy="no-referrer"
                  className="w-full max-h-64 object-cover rounded-2xl border border-slate-200"
                />
                <div className="space-y-2">
                  {((q.options as { choices: string[] }).choices || []).map((c) => (
                    <button
                      key={c}
                      type="button"
                      disabled={Boolean(feedback)}
                      onClick={() => recordOutcome(c === q.correct_answer, q.explanation, q.prompt)}
                      className="w-full p-3.5 rounded-2xl border border-slate-200 hover:border-sky-500 text-left font-bold text-sm cursor-pointer"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 7. Memory Game */}
            {activeGame.game_type === 'memory' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {memoryCards.map((card, idx) => {
                  const revealed = card.matched || flippedIndices.includes(idx);
                  return (
                    <button
                      key={card.uid}
                      type="button"
                      onClick={() => handleFlipMemory(idx)}
                      className={`h-24 rounded-2xl border p-2 text-xs font-extrabold transition-colors cursor-pointer ${
                        card.matched
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                          : revealed
                          ? 'bg-sky-50 border-sky-500 text-sky-950'
                          : 'bg-slate-800 border-slate-900 text-white hover:bg-slate-700'
                      }`}
                    >
                      {revealed ? card.text : 'Lật thẻ ?'}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 8. Interactive Story */}
            {activeGame.game_type === 'interactive_story' && Array.isArray(q.options) && (
              <div className="space-y-2.5">
                {(q.options as Array<{ text: string; isBest: boolean; feedback: string }>).map((branch) => (
                  <button
                    key={branch.text}
                    type="button"
                    disabled={Boolean(feedback)}
                    onClick={() => recordOutcome(branch.isBest, branch.feedback, q.prompt)}
                    className="w-full p-4 rounded-2xl border border-slate-200 hover:border-sky-500 hover:bg-sky-50 text-left text-sm font-semibold text-slate-800 cursor-pointer"
                  >
                    {branch.text}
                  </button>
                ))}
              </div>
            )}

            {feedback && (
              <div
                className={`p-4 rounded-2xl border flex items-start justify-between gap-4 ${
                  feedback.ok ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-amber-50 border-amber-300 text-amber-950'
                }`}
              >
                <div className="flex items-start gap-2.5 text-sm">
                  {feedback.ok ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                  )}
                  <span>{feedback.text}</span>
                </div>
                <button
                  type="button"
                  onClick={nextStep}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold shrink-0 cursor-pointer"
                >
                  {qIndex + 1 >= activeGame.questions.length ? 'Xem kết quả' : 'Câu tiếp theo →'}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-slate-900">Play & Learn — Vừa chơi vừa học</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              10 dạng trò chơi tư duy tương tác phù hợp Lớp {user.profile?.grade_level || 4} · Tự động chấm điểm & tích lũy XP
            </p>
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
          >
            <option value="">Tất cả 10 thể loại trò chơi</option>
            {Object.entries(GAME_TYPE_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-3xl bg-white border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {games.map((g) => (
            <div key={g.id} className="bg-white border border-slate-200 rounded-3xl p-5 flex flex-col justify-between">
              <div>
                <div className="text-xs font-semibold text-sky-700">
                  {GAME_TYPE_LABELS[g.game_type]} · {g.subject_name} · {g.grade_name}
                </div>
                <h3 className="font-display text-lg font-extrabold text-slate-900 mt-1.5">{g.title}</h3>
                <p className="text-xs text-slate-500 mt-2 tabular-nums">
                  {g.questions.length} thử thách · Thưởng tối đa +{g.xp_reward} XP
                </p>
              </div>
              <button
                type="button"
                onClick={() => startGame(g)}
                className="mt-5 w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Gamepad2 className="w-4 h-4" />
                <span>Chơi ngay</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
