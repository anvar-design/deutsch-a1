// frontend/src/components/quiz/Quiz.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { WORDS } from '@/data/words';
import { apiPost } from '@/hooks/useLearnStore';

interface Question {
  wordId: number;
  de: string;
  article?: string | null;
  correct: string;
  options: string[];
}

interface QuizProps {
  lessonId: number;
  onComplete?: (score: number, total: number) => void;
  token?: string | null;
}

type Status = 'idle' | 'playing' | 'answered' | 'done';

function buildQuestions(lessonId: number): Question[] {
  const pool = WORDS.filter((w) => w.lesson === lessonId);
  const all = WORDS;
  return pool
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(10, pool.length))
    .map((word) => {
      const distractors = all
        .filter((w) => w.uz !== word.uz)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map((w) => w.uz);
      const options = [word.uz, ...distractors].sort(() => Math.random() - 0.5);
      return { wordId: word.id, de: word.de, article: word.article, correct: word.uz, options };
    });
}

export function Quiz({ lessonId, onComplete, token }: QuizProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<Status>('idle');
  const [startTime, setStartTime] = useState<number>(0);

  const start = useCallback(() => {
    setQuestions(buildQuestions(lessonId));
    setIdx(0);
    setScore(0);
    setSelected(null);
    setStatus('playing');
    setStartTime(Date.now());
  }, [lessonId]);

  useEffect(() => { start(); }, [start]);

  const q = questions[idx];
  const total = questions.length;
  const progress = total > 0 ? Math.round(((idx) / total) * 100) : 0;

  const answer = useCallback(
    (opt: string) => {
      if (status !== 'playing') return;
      setSelected(opt);
      const correct = opt === q.correct;
      if (correct) setScore((s) => s + 1);
      setStatus('answered');
      setTimeout(() => {
        if (idx + 1 >= total) {
          setStatus('done');
        } else {
          setIdx((i) => i + 1);
          setSelected(null);
          setStatus('playing');
        }
      }, 1100);
    },
    [status, q, idx, total]
  );

  useEffect(() => {
    if (status === 'done') {
      const duration = Math.round((Date.now() - startTime) / 1000);
      if (token) {
        apiPost('/api/quiz/result', { lessonId, score, total, durationS: duration }, token).catch(() => {});
      }
      onComplete?.(score, total);
    }
  }, [status]);

  const pct = total > 0 ? Math.round((score / total) * 100) : 0;

  if (status === 'done') {
    return (
      <div style={{ textAlign: 'center', padding: '2rem 0' }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>
          {pct >= 90 ? '🏆' : pct >= 70 ? '✅' : '📚'}
        </div>
        <p style={{ fontSize: 36, fontWeight: 500, color: 'var(--color-text-primary)' }}>{score}/{total}</p>
        <p style={{ fontSize: 16, color: pct >= 70 ? '#0F6E56' : '#993C1D', margin: '8px 0 24px' }}>
          {pct >= 90 ? 'Mukammal! Zo\'r natija!' : pct >= 70 ? 'Yaxshi! Dars bajarildi.' : 'Yana mashq qiling!'}
        </p>
        <div style={{
          background: 'var(--color-background-secondary)',
          borderRadius: 12, padding: '1rem 1.5rem',
          display: 'inline-block', marginBottom: 24,
        }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            To'g'ri: {score} &nbsp;·&nbsp; Noto'g'ri: {total - score} &nbsp;·&nbsp; {pct}%
          </p>
        </div>
        <br />
        <button
          onClick={start}
          style={{
            padding: '10px 28px', border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 10, background: 'transparent', cursor: 'pointer', fontSize: 14,
            color: 'var(--color-text-primary)',
          }}
        >
          Qayta boshlash
        </button>
      </div>
    );
  }

  if (!q) return null;

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: 'var(--color-text-secondary)' }}>
        <span>Savol {idx + 1} / {total}</span>
        <span style={{ color: '#534AB7' }}>{score} to'g'ri</span>
      </div>
      <div style={{ background: 'var(--color-background-secondary)', borderRadius: 99, height: 6, marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: '#534AB7', borderRadius: 99, transition: 'width 0.3s' }} />
      </div>

      {/* Question */}
      <div style={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 16, padding: '1.5rem 1.25rem',
        textAlign: 'center', marginBottom: 24,
      }}>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
          Nemischa so'zni tarjima qiling:
        </p>
        {q.article && (
          <span style={{
            fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99,
            background: q.article === 'der' ? '#E6F1FB' : q.article === 'die' ? '#FBEAF0' : '#E1F5EE',
            color: q.article === 'der' ? '#185FA5' : q.article === 'die' ? '#993556' : '#0F6E56',
            marginBottom: 6, display: 'inline-block',
          }}>
            {q.article}
          </span>
        )}
        <p style={{ fontSize: 28, fontWeight: 500, color: 'var(--color-text-primary)', marginTop: 4 }}>{q.de}</p>
      </div>

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {q.options.map((opt) => {
          const isSelected = selected === opt;
          const isCorrect = opt === q.correct;
          let bg = 'var(--color-background-primary)';
          let border = 'var(--color-border-tertiary)';
          let color = 'var(--color-text-primary)';
          if (status === 'answered') {
            if (isCorrect) { bg = '#E1F5EE'; border = '#0F6E56'; color = '#085041'; }
            else if (isSelected) { bg = '#FCEBEB'; border = '#A32D2D'; color = '#791F1F'; }
          }
          return (
            <button
              key={opt}
              onClick={() => answer(opt)}
              style={{
                padding: '12px 16px', border: `0.5px solid ${border}`, borderRadius: 12,
                background: bg, color, cursor: status === 'playing' ? 'pointer' : 'default',
                fontSize: 14, textAlign: 'left', transition: 'all 0.15s', fontWeight: isCorrect && status === 'answered' ? 500 : 400,
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
