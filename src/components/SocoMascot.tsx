import React, { useEffect, useState } from 'react';
import { Bot, Sparkles, Brain, Heart, Lightbulb } from 'lucide-react';
import { socoMascotImg } from '../lib/assets';

export type SocoEmotion = 'happy' | 'thinking' | 'cheering' | 'explaining';

interface SocoMascotProps {
  emotion?: SocoEmotion;
  size?: 'sm' | 'md' | 'lg';
  speech?: string;
  className?: string;
}

const EMOTION_META: Record<SocoEmotion, { label: string; ring: string; bg: string; icon: React.ReactNode }> = {
  happy: {
    label: 'Vui vẻ đồng hành',
    ring: 'ring-sky-300',
    bg: 'bg-sky-50 text-sky-900',
    icon: <Heart className="w-3.5 h-3.5 text-orange-600" aria-hidden="true" />,
  },
  thinking: {
    label: 'Đang suy nghĩ gợi ý',
    ring: 'ring-violet-300',
    bg: 'bg-violet-50 text-violet-900',
    icon: <Brain className="w-3.5 h-3.5 text-violet-700" aria-hidden="true" />,
  },
  cheering: {
    label: 'Cổ vũ tiến bộ',
    ring: 'ring-amber-300',
    bg: 'bg-amber-50 text-amber-900',
    icon: <Sparkles className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />,
  },
  explaining: {
    label: 'Đang giải thích',
    ring: 'ring-emerald-300',
    bg: 'bg-emerald-50 text-emerald-900',
    icon: <Lightbulb className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />,
  },
};

export function SocoMascot({ emotion = 'happy', size = 'md', speech, className = '' }: SocoMascotProps) {
  const [imgError, setImgError] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const meta = EMOTION_META[emotion] || EMOTION_META.happy;

  const sizeClass =
    size === 'sm' ? 'w-12 h-12' : size === 'lg' ? 'w-24 h-24 md:w-28 md:h-28' : 'w-16 h-16';

  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <div className="relative shrink-0">
        <div
          className={`${sizeClass} rounded-2xl overflow-hidden bg-white border border-slate-200 ring-4 ${meta.ring} shadow-sm flex items-center justify-center ${
            reducedMotion ? '' : 'transition-transform duration-200'
          }`}
        >
          {!imgError ? (
            <img
              src={socoMascotImg}
              alt="Mascot SOCO — bạn đồng hành học tập AI Socratic"
              decoding="async"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-sky-100 via-white to-amber-100 flex items-center justify-center">
              <Bot className="w-8 h-8 text-sky-700" aria-hidden="true" />
            </div>
          )}
        </div>
        <div
          className={`mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${meta.bg} whitespace-nowrap`}
        >
          {meta.icon}
          <span>{meta.label}</span>
        </div>
      </div>

      {speech && (
        <div className="relative bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm md:text-[15px] leading-relaxed text-slate-800 shadow-xs max-w-xl">
          {speech}
        </div>
      )}
    </div>
  );
}
