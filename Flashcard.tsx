// frontend/src/components/flashcard/Flashcard.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import { WORDS, type Word } from '@/data/words';
import { apiPost } from '@/hooks/useLearnStore';

interface FlashcardProps {
  lessonId?: number;      // null = all lessons
  token?: string | null;
}

export function Flashcard({ lessonId, token }: FlashcardProps) {
  const [words, setWords] = useState<Word[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<number>>(new Set());
  const [unknown, setUnknown] = useState<Set<number>>(new Set());

  useEffect(() => {
    const filtered = lessonId
      ? WORDS.filter((w) => w.lesson === lessonId)
      : [...WORDS];
    setWords(filtered.sort(() => Math.random() - 0.5));
    setIdx(0);
    setFlipped(false);
  }, [lessonId]);

  const current = words[idx];
  const progress = words.length > 0 ? Math.round((idx / words.length) * 100) : 0;

  const flip = () => setFlipped((f) => !f);

  const rate = useCallback(
    async (isKnown: boolean) => {
      if (!current) return;
      if (isKnown) setKnown((s) => new Set(s).add(current.id));
      else setUnknown((s) => new Set(s).add(current.id));

      // Serverga yuborish (auth bo'lsa)
      if (token) {
        try {
          await apiPost('/api/flashcards/review', { wordId: current.id, known: isKnown }, token);
        } catch {
          // offline mode — local only
        }
      }
      setFlipped(false);
      setIdx((i) => (i + 1) % words.length);
    },
    [current, token, words.length]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); flip(); }
      if (e.key === 'ArrowRight') rate(true);
      if (e.key === 'ArrowLeft') rate(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [rate]);

  if (!current) return <p>So'zlar yuklanmoqda...</p>;

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      {/* Progress */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: 'var(--color-text-secondary)' }}>
        <span>{idx + 1} / {words.length}</span>
        <span style={{ color: '#0F6E56' }}>{known.size} bilaman</span>
      </div>
      <div style={{ background: 'var(--color-background-secondary)', borderRadius: 99, height: 6, marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: '#534AB7', borderRadius: 99, transition: 'width 0.3s' }} />
      </div>

      {/* Article badge */}
      {current.article && (
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <span style={{
            fontSize: 12, fontWeight: 500, padding: '2px 10px', borderRadius: 99,
            background: current.article === 'der' ? '#E6F1FB' : current.article === 'die' ? '#FBEAF0' : '#E1F5EE',
            color: current.article === 'der' ? '#185FA5' : current.article === 'die' ? '#993556' : '#0F6E56',
          }}>
            {current.article}
          </span>
        </div>
      )}

      {/* Card */}
      <div
        onClick={flip}
        style={{
          background: 'var(--color-background-primary)',
          border: '0.5px solid var(--color-border-tertiary)',
          borderRadius: 16,
          padding: '2.5rem 2rem',
          textAlign: 'center',
          cursor: 'pointer',
          minHeight: 180,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
          transition: 'border-color 0.15s',
        }}
      >
        <p style={{ fontSize: 32, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: flipped ? 16 : 0 }}>
          {current.de}
        </p>
        {flipped && (
          <>
            <div style={{ width: 40, height: 1, background: 'var(--color-border-tertiary)', margin: '12px 0' }} />
            <p style={{ fontSize: 22, color: 'var(--color-text-secondary)' }}>{current.uz}</p>
          </>
        )}
        {!flipped && (
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 16 }}>
            bosing yoki <kbd style={{ fontSize: 11, padding: '1px 5px', border: '0.5px solid var(--color-border-secondary)', borderRadius: 4 }}>Space</kbd>
          </p>
        )}
      </div>

      {/* Buttons */}
      {flipped && (
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => rate(false)}
            style={{
              flex: 1, padding: '12px', border: '0.5px solid #F0997B', borderRadius: 12,
              background: '#FAECE7', color: '#712B13', cursor: 'pointer', fontSize: 14, fontWeight: 500,
            }}
          >
            ✗ Bilmadim
          </button>
          <button
            onClick={() => rate(true)}
            style={{
              flex: 1, padding: '12px', border: '0.5px solid #5DCAA5', borderRadius: 12,
              background: '#E1F5EE', color: '#085041', cursor: 'pointer', fontSize: 14, fontWeight: 500,
            }}
          >
            ✓ Bildim
          </button>
        </div>
      )}

      <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 16 }}>
        ← Bilmadim &nbsp;·&nbsp; Space = aylantir &nbsp;·&nbsp; → Bildim
      </p>
    </div>
  );
}
