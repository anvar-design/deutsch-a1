// backend/src/server.ts
// DeutschA1 Platform — Node.js + Express backend

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = process.env.PORT || 4000;

// ─── DATABASE ─────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
const auth = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET!);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ─── AUTH ROUTES ─────────────────────────────────────────────────────────────

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const { email, name, password } = req.body;
  if (!email || !name || !password)
    return res.status(400).json({ error: "Barcha maydonlarni to'ldiring" });
  try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      'INSERT INTO users (email, name, password) VALUES ($1,$2,$3) RETURNING id, email, name',
      [email.toLowerCase(), name, hash]
    );
    const token = jwt.sign({ id: rows[0].id, email }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    res.status(201).json({ user: rows[0], token });
  } catch (e: any) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email allaqachon ro\'yxatda' });
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email.toLowerCase()]);
    if (!rows.length) return res.status(401).json({ error: "Email yoki parol noto'g'ri" });
    const ok = await bcrypt.compare(password, rows[0].password);
    if (!ok) return res.status(401).json({ error: "Email yoki parol noto'g'ri" });
    const { password: _, ...user } = rows[0];
    const token = jwt.sign({ id: user.id, email }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    res.json({ user, token });
  } catch {
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// ─── LESSONS ─────────────────────────────────────────────────────────────────

// GET /api/lessons — barcha darslar
app.get('/api/lessons', auth, async (req: any, res) => {
  try {
    const { rows: lessons } = await pool.query(
      'SELECT * FROM lessons ORDER BY order_num'
    );
    const { rows: progress } = await pool.query(
      'SELECT lesson_id, completed, score FROM user_progress WHERE user_id=$1',
      [req.user.id]
    );
    const progressMap = Object.fromEntries(progress.map((p: any) => [p.lesson_id, p]));
    const result = lessons.map((l: any) => ({
      ...l,
      progress: progressMap[l.id] || { completed: false, score: 0 },
    }));
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// GET /api/lessons/:id/words — dars so'zlari
app.get('/api/lessons/:id/words', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM words WHERE lesson_id=$1 ORDER BY id',
      [req.params.id]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// ─── FLASHCARDS / WORD REVIEW ─────────────────────────────────────────────────

// GET /api/flashcards?lesson=N — flashcard so'zlari (review bilan)
app.get('/api/flashcards', auth, async (req: any, res) => {
  const lessonId = req.query.lesson;
  try {
    const query = lessonId
      ? 'SELECT w.*, wr.known, wr.ease_factor FROM words w LEFT JOIN word_reviews wr ON wr.word_id=w.id AND wr.user_id=$1 WHERE w.lesson_id=$2 ORDER BY RANDOM()'
      : 'SELECT w.*, wr.known, wr.ease_factor FROM words w LEFT JOIN word_reviews wr ON wr.word_id=w.id AND wr.user_id=$1 ORDER BY RANDOM()';
    const params = lessonId ? [req.user.id, lessonId] : [req.user.id];
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// POST /api/flashcards/review — bitta so'z baholash (spaced repetition)
app.post('/api/flashcards/review', auth, async (req: any, res) => {
  const { wordId, known } = req.body;
  try {
    // SM-2 simplified: interval *= ease_factor if known, reset if not
    const { rows } = await pool.query(
      'SELECT * FROM word_reviews WHERE user_id=$1 AND word_id=$2',
      [req.user.id, wordId]
    );
    let ef = rows[0]?.ease_factor || 2.5;
    let interval = rows[0]?.interval || 1;
    if (known) {
      interval = Math.round(interval * ef);
      ef = Math.min(ef + 0.1, 3.0);
    } else {
      interval = 1;
      ef = Math.max(ef - 0.2, 1.3);
    }
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + interval);

    await pool.query(
      `INSERT INTO word_reviews (user_id, word_id, known, ease_factor, interval, due_date, reviewed_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT (user_id, word_id) DO UPDATE
       SET known=$3, ease_factor=$4, interval=$5, due_date=$6, reviewed_at=NOW()`,
      [req.user.id, wordId, known, ef.toFixed(2), interval, dueDate.toISOString().split('T')[0]]
    );
    res.json({ ok: true, nextReview: dueDate });
  } catch {
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// ─── QUIZ ─────────────────────────────────────────────────────────────────────

// GET /api/quiz/:lessonId — test savollar (10 ta)
app.get('/api/quiz/:lessonId', auth, async (req, res) => {
  try {
    const { rows: correct } = await pool.query(
      'SELECT * FROM words WHERE lesson_id=$1 ORDER BY RANDOM() LIMIT 10',
      [req.params.lessonId]
    );
    // Har bir savol uchun 3 ta noto'g'ri variant
    const questions = await Promise.all(correct.map(async (word: any) => {
      const { rows: wrong } = await pool.query(
        'SELECT uz FROM words WHERE lesson_id=$1 AND id!=$2 ORDER BY RANDOM() LIMIT 3',
        [req.params.lessonId, word.id]
      );
      // Agar yetarli so'z yo'q bo'lsa, boshqa darslardan olish
      if (wrong.length < 3) {
        const { rows: extra } = await pool.query(
          'SELECT uz FROM words WHERE id!=$1 ORDER BY RANDOM() LIMIT $2',
          [word.id, 3 - wrong.length]
        );
        wrong.push(...extra);
      }
      const options = [word.uz, ...wrong.map((w: any) => w.uz)]
        .sort(() => Math.random() - 0.5);
      return {
        wordId: word.id,
        de: word.de,
        article: word.article,
        correct: word.uz,
        options,
      };
    }));
    res.json(questions);
  } catch {
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// POST /api/quiz/result — natija saqlash
app.post('/api/quiz/result', auth, async (req: any, res) => {
  const { lessonId, score, total, durationS } = req.body;
  try {
    await pool.query(
      'INSERT INTO quiz_results (user_id, lesson_id, score, total, duration_s) VALUES ($1,$2,$3,$4,$5)',
      [req.user.id, lessonId, score, total, durationS]
    );
    // Progress yangilash
    const pct = Math.round((score / total) * 100);
    const completed = pct >= 70;
    await pool.query(
      `INSERT INTO user_progress (user_id, lesson_id, completed, score)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, lesson_id) DO UPDATE
       SET score=GREATEST(user_progress.score,$4), completed=(user_progress.completed OR $3), studied_at=NOW()`,
      [req.user.id, lessonId, completed, pct]
    );
    res.json({ ok: true, completed, percentage: pct });
  } catch {
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// ─── USER STATS ───────────────────────────────────────────────────────────────

// GET /api/user/stats — foydalanuvchi statistikasi
app.get('/api/user/stats', auth, async (req: any, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM user_stats WHERE id=$1', [req.user.id]);
    const { rows: recent } = await pool.query(
      'SELECT qr.*, l.title_uz FROM quiz_results qr JOIN lessons l ON l.id=qr.lesson_id WHERE qr.user_id=$1 ORDER BY qr.created_at DESC LIMIT 5',
      [req.user.id]
    );
    const { rows: due } = await pool.query(
      'SELECT COUNT(*) FROM word_reviews WHERE user_id=$1 AND due_date <= CURRENT_DATE',
      [req.user.id]
    );
    res.json({
      stats: rows[0] || { lessons_done: 0, words_known: 0, avg_score: 0 },
      recentQuizzes: recent,
      wordsForReview: parseInt(due[0].count),
    });
  } catch {
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// GET /api/user/due-words — bugungi review so'zlari
app.get('/api/user/due-words', auth, async (req: any, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT w.*, wr.known, wr.ease_factor FROM word_reviews wr
       JOIN words w ON w.id=wr.word_id
       WHERE wr.user_id=$1 AND wr.due_date <= CURRENT_DATE
       ORDER BY wr.due_date LIMIT 50`,
      [req.user.id]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// GET /api/user/progress — progress yangilash
app.post('/api/user/progress', auth, async (req: any, res) => {
  const { lessonId, completed } = req.body;
  try {
    await pool.query(
      `INSERT INTO user_progress (user_id, lesson_id, completed)
       VALUES ($1,$2,$3)
       ON CONFLICT (user_id, lesson_id) DO UPDATE SET completed=$3, studied_at=NOW()`,
      [req.user.id, lessonId, completed]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// ─── HEALTH ───────────────────────────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() });
  } catch {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

app.listen(PORT, () => console.log(`DeutschA1 API: http://localhost:${PORT}`));

export default app;
