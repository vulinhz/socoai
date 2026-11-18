import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type Grade12Override = 'auto' | 'on' | 'off';
export type SpeechRateOption = 0.75 | 0.9 | 1.1;

interface GradeModeContextValue {
  studentGrade: number | null;
  grade12Override: Grade12Override;
  setGrade12Override: (next: Grade12Override) => void;
  toggleGrade12Mode: () => void;
  isGrade12Mode: boolean;
  autoReadEnabled: boolean;
  setAutoReadEnabled: (enabled: boolean) => void;
  speechRate: SpeechRateOption;
  setSpeechRate: (rate: SpeechRateOption) => void;
  speechSupported: boolean;
  isSpeaking: boolean;
  speakVietnamese: (text: string) => void;
  stopSpeaking: () => void;
}

const OVERRIDE_KEY = 'socrates_grade12_override';
const AUTOREAD_KEY = 'socrates_autoread_enabled';
const RATE_KEY = 'socrates_speech_rate';

function safeGetStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage limits
  }
}

const GradeModeContext = createContext<GradeModeContextValue | null>(null);

export function GradeModeProvider({
  studentGrade,
  children,
}: {
  studentGrade?: number | null;
  children: React.ReactNode;
}) {
  const [grade12Override, setOverrideState] = useState<Grade12Override>(() => {
    const saved = safeGetStorage(OVERRIDE_KEY);
    return saved === 'on' || saved === 'off' ? saved : 'auto';
  });

  const [autoReadOverride, setAutoReadOverride] = useState<boolean | null>(() => {
    const saved = safeGetStorage(AUTOREAD_KEY);
    if (saved === '1') return true;
    if (saved === '0') return false;
    return null;
  });

  const [speechRate, setRateState] = useState<SpeechRateOption>(() => {
    const saved = Number(safeGetStorage(RATE_KEY));
    if (saved === 0.75 || saved === 0.9 || saved === 1.1) return saved;
    return 0.9;
  });

  const [isSpeaking, setIsSpeaking] = useState(false);

  const normalizedGrade = typeof studentGrade === 'number' && studentGrade >= 1 && studentGrade <= 5 ? studentGrade : null;
  const isGrade12Mode =
    grade12Override === 'on' ? true : grade12Override === 'off' ? false : Boolean(normalizedGrade && normalizedGrade <= 2);

  const autoReadEnabled = autoReadOverride !== null ? autoReadOverride : isGrade12Mode;
  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

  const setGrade12Override = useCallback((next: Grade12Override) => {
    setOverrideState(next);
    safeSetStorage(OVERRIDE_KEY, next);
  }, []);

  const toggleGrade12Mode = useCallback(() => {
    setOverrideState((prev) => {
      const currentActive =
        prev === 'on' ? true : prev === 'off' ? false : Boolean(normalizedGrade && normalizedGrade <= 2);
      const next: Grade12Override = currentActive ? 'off' : 'on';
      safeSetStorage(OVERRIDE_KEY, next);
      return next;
    });
  }, [normalizedGrade]);

  const setAutoReadEnabled = useCallback((enabled: boolean) => {
    setAutoReadOverride(enabled);
    safeSetStorage(AUTOREAD_KEY, enabled ? '1' : '0');
    if (!enabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  const setSpeechRate = useCallback((rate: SpeechRateOption) => {
    setRateState(rate);
    safeSetStorage(RATE_KEY, String(rate));
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const speakVietnamese = useCallback(
    (text: string) => {
      if (!speechSupported || !text.trim()) return;
      const synth = window.speechSynthesis;
      synth.cancel();

      const utter = new SpeechSynthesisUtterance(text.trim());
      utter.lang = 'vi-VN';
      utter.rate = speechRate;
      utter.pitch = isGrade12Mode ? 1.05 : 1.0;

      const voices = synth.getVoices();
      const viVoice =
        voices.find((v) => v.lang.toLowerCase() === 'vi-vn') ||
        voices.find((v) => v.lang.toLowerCase().startsWith('vi'));
      if (viVoice) {
        utter.voice = viVoice;
      }

      utter.onstart = () => setIsSpeaking(true);
      utter.onend = () => setIsSpeaking(false);
      utter.onerror = () => setIsSpeaking(false);
      synth.speak(utter);
    },
    [speechSupported, speechRate, isGrade12Mode]
  );

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return (
    <GradeModeContext.Provider
      value={{
        studentGrade: normalizedGrade,
        grade12Override,
        setGrade12Override,
        toggleGrade12Mode,
        isGrade12Mode,
        autoReadEnabled,
        setAutoReadEnabled,
        speechRate,
        setSpeechRate,
        speechSupported,
        isSpeaking,
        speakVietnamese,
        stopSpeaking,
      }}
    >
      {children}
    </GradeModeContext.Provider>
  );
}

export function useGradeMode(): GradeModeContextValue {
  const ctx = useContext(GradeModeContext);
  if (!ctx) {
    throw new Error('useGradeMode must be used inside GradeModeProvider');
  }
  return ctx;
}
