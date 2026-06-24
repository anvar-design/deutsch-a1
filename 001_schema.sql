-- DeutschA1 Platform — PostgreSQL Schema
-- Run: psql -d deutsch_a1 -f schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── USERS ───────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       VARCHAR(255) UNIQUE NOT NULL,
  name        VARCHAR(100) NOT NULL,
  password    VARCHAR(255) NOT NULL,  -- bcrypt hashed
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── LESSONS ─────────────────────────────────────────────────────────────────
CREATE TABLE lessons (
  id         SMALLINT PRIMARY KEY,          -- 1–24
  title_de   VARCHAR(100) NOT NULL,
  title_uz   VARCHAR(100) NOT NULL,
  module     SMALLINT NOT NULL CHECK (module BETWEEN 1 AND 6),
  order_num  SMALLINT NOT NULL
);

-- ─── WORDS ───────────────────────────────────────────────────────────────────
CREATE TABLE words (
  id          SERIAL PRIMARY KEY,
  lesson_id   SMALLINT NOT NULL REFERENCES lessons(id),
  de          VARCHAR(200) NOT NULL,
  uz          VARCHAR(200) NOT NULL,
  type        VARCHAR(20) CHECK (type IN ('noun','verb','adjective','adverb','phrase','other')),
  article     VARCHAR(3)  CHECK (article IN ('der','die','das') OR article IS NULL),
  example_de  TEXT,
  example_uz  TEXT
);

CREATE INDEX idx_words_lesson ON words(lesson_id);

-- ─── USER PROGRESS (per lesson) ──────────────────────────────────────────────
CREATE TABLE user_progress (
  id           SERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id    SMALLINT NOT NULL REFERENCES lessons(id),
  completed    BOOLEAN DEFAULT FALSE,
  score        SMALLINT DEFAULT 0,       -- last quiz score (0–100)
  studied_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

CREATE INDEX idx_progress_user ON user_progress(user_id);

-- ─── WORD REVIEWS (spaced repetition) ───────────────────────────────────────
CREATE TABLE word_reviews (
  id           SERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_id      INTEGER NOT NULL REFERENCES words(id),
  known        BOOLEAN DEFAULT FALSE,
  ease_factor  DECIMAL(3,2) DEFAULT 2.50,  -- SM-2 algorithm
  interval     INTEGER DEFAULT 1,           -- days until next review
  due_date     DATE DEFAULT CURRENT_DATE,
  reviewed_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, word_id)
);

CREATE INDEX idx_reviews_user_due ON word_reviews(user_id, due_date);

-- ─── QUIZ RESULTS ────────────────────────────────────────────────────────────
CREATE TABLE quiz_results (
  id          SERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id   SMALLINT REFERENCES lessons(id),
  score       SMALLINT NOT NULL,      -- correct answers
  total       SMALLINT NOT NULL,      -- total questions
  duration_s  SMALLINT,               -- seconds taken
  quiz_type   VARCHAR(20) DEFAULT 'multiple_choice',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quiz_user ON quiz_results(user_id, created_at);

-- ─── SESSIONS (JWT refresh tokens) ───────────────────────────────────────────
CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SEED: Lessons ───────────────────────────────────────────────────────────
INSERT INTO lessons (id, title_de, title_uz, module, order_num) VALUES
(1,  'Wie heißt du?',   'Isming nima?',        1, 1),
(2,  'Jahre alt',        'Yosh',                1, 2),
(3,  'Die Familie',      'Oila',                1, 3),
(4,  'Zu Hause',         'Uyda',                1, 4),
(5,  'Das Ding',         'Narsalar',            2, 5),
(6,  'Oh Gott!',         'Kundalik hayot',      2, 6),
(7,  'Hobbys',           'Qiziqishlar',         2, 7),
(8,  'Wann?',            'Qachon?',             2, 8),
(9,  'Essen & Trinken',  'Ovqat va ichimlik',   3, 9),
(10, 'Der Flughafen',    'Aeroport',            3, 10),
(11, 'Gestern',          'Kecha',               3, 11),
(12, 'Der Marathon',     'Marafon',             3, 12),
(13, 'Die Mauer',        'Devor',               4, 13),
(14, 'Der Weg',          'Yo''l',               4, 14),
(15, 'Die Wohnung',      'Uy-joy',              4, 15),
(16, 'Der Aufzug',       'Lift',                4, 16),
(17, 'Träume',           'Orzular',             5, 17),
(18, 'Gesundheit',       'Salomatlik',          5, 18),
(19, 'Haushalt',         'Uy ishlari',          5, 19),
(20, 'Das Team',         'Jamoa',               5, 20),
(21, 'Verboten!',        'Taqiq',               6, 21),
(22, 'Kleidung',         'Kiyim',               6, 22),
(23, 'Gefühle',          'His-tuyg''ular',      6, 23),
(24, 'Feiertage',        'Bayramlar',           6, 24);

-- ─── USEFUL VIEWS ────────────────────────────────────────────────────────────
CREATE VIEW user_stats AS
SELECT
  u.id,
  u.name,
  COUNT(DISTINCT up.lesson_id) FILTER (WHERE up.completed) AS lessons_done,
  COUNT(DISTINCT wr.word_id)   FILTER (WHERE wr.known)     AS words_known,
  COALESCE(AVG(qr.score::float / NULLIF(qr.total,0) * 100), 0)::INT AS avg_score
FROM users u
LEFT JOIN user_progress up ON up.user_id = u.id
LEFT JOIN word_reviews  wr ON wr.user_id = u.id
LEFT JOIN quiz_results  qr ON qr.user_id = u.id
GROUP BY u.id, u.name;

-- Trigger: auto update updated_at on users
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
