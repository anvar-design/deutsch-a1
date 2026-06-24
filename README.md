# DeutschA1 O'quv Platformasi

Momente A1 darsligi asosida qurilgan to'liq nemis tili o'rganish platformasi.  
**24 dars · 326+ so'z · Flashcard · Test · Progress tracking**

---

## 📁 Loyiha tuzilmasi

```
deutsch-a1-platform/
├── frontend/                    # Next.js 14 (React)
│   └── src/
│       ├── components/
│       │   ├── flashcard/       # Flashcard.tsx — lug'at kartalari
│       │   ├── quiz/            # Quiz.tsx — testlar
│       │   ├── lessons/         # Darslar ro'yxati
│       │   └── ui/              # Umumiy UI komponentlar
│       ├── hooks/
│       │   └── useLearnStore.ts # Zustand state management
│       └── data/
│           └── words.ts         # 326+ so'z ma'lumotlar bazasi
├── backend/                     # Node.js + Express + TypeScript
│   └── src/
│       └── server.ts            # Asosiy API server
├── database/
│   └── migrations/
│       └── 001_schema.sql       # PostgreSQL schema + seed
├── docker-compose.yml           # To'liq docker tizimi
└── README.md
```

---

## 🚀 Mahalliy ishga tushirish (Local dev)

### 1. Muhit o'zgaruvchilarini sozlash

```bash
cp .env.example .env
```

`.env` faylini to'ldiring:
```env
DB_PASSWORD=kuchli_parol_123
REDIS_PASSWORD=redis_parol_456
JWT_SECRET=juda_uzun_va_xavfsiz_sir_kalit
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:4000
```

### 2. Docker bilan ishga tushirish (tavsiya etiladi)

```bash
docker compose up -d
```

Bu quyidagilarni avtomatik ishga tushiradi:
- PostgreSQL ma'lumotlar bazasi (port 5432)
- Redis kesh serveri (port 6379)
- Backend API (port 4000)
- Frontend (port 3000)
- Nginx reverse proxy (port 80/443)

### 3. Ma'lumotlar bazasini tekshirish

```bash
docker compose exec db psql -U deutsch_user -d deutsch_a1
# SQL konsolda:
\dt          # jadvallarni ko'rish
SELECT COUNT(*) FROM words;   # so'zlar soni
```

### 4. Faqat backend (Docker'siz)

```bash
cd backend
npm install
npm run dev        # nodemon bilan
```

### 5. Faqat frontend (Docker'siz)

```bash
cd frontend
npm install
npm run dev        # localhost:3000
```

---

## 🌐 Deploy (Production)

### Variant A: Vercel + Railway (eng oson)

```bash
# Frontend → Vercel
cd frontend
npx vercel --prod

# Backend → Railway
# railway.app saytida yangi loyiha oching
# GitHub repo ulang, backend/ papkasini tanlang
# Environment variables qo'shing
```

### Variant B: VPS (Ubuntu 22.04)

```bash
# 1. Server tayyorlash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 nginx certbot

# 2. Repo klonlash
git clone https://github.com/sizning_repo/deutsch-a1.git
cd deutsch-a1

# 3. .env to'ldirish
cp .env.example .env
nano .env

# 4. SSL sertifikat (Let's Encrypt)
sudo certbot certonly --standalone -d sizning-domen.uz

# 5. Nginx konfiguratsiya nusxalash
sudo cp nginx/nginx.conf /etc/nginx/sites-available/deutsch-a1
sudo ln -s /etc/nginx/sites-available/deutsch-a1 /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 6. Docker ishga tushirish
docker compose -f docker-compose.yml up -d --build

# 7. Log tekshirish
docker compose logs -f backend
```

### Variant C: Supabase + Vercel (bepul tier)

```bash
# 1. supabase.com → yangi loyiha
# 2. SQL editor → 001_schema.sql ni joylashtiring
# 3. Project settings → API → connection string olish
# 4. .env ga DATABASE_URL ni qo'shing
# 5. Vercel'ga deploy:
cd frontend && npx vercel --prod
cd backend  && npx vercel --prod   # Vercel serverless functions
```

---

## 📡 API endpointlar

| Method | URL | Tavsif |
|--------|-----|--------|
| POST | `/api/auth/register` | Ro'yxatdan o'tish |
| POST | `/api/auth/login` | Kirish |
| GET | `/api/lessons` | Barcha darslar + progress |
| GET | `/api/lessons/:id/words` | Dars so'zlari |
| GET | `/api/flashcards?lesson=N` | Flashcard so'zlari |
| POST | `/api/flashcards/review` | So'z baholash (SM-2) |
| GET | `/api/quiz/:lessonId` | Test savollar |
| POST | `/api/quiz/result` | Test natijasini saqlash |
| GET | `/api/user/stats` | Foydalanuvchi statistikasi |
| GET | `/api/user/due-words` | Bugungi review so'zlari |
| GET | `/api/health` | Server holati |

---

## 🔧 Texnik tafsilotlar

### Frontend stack
- **Next.js 14** (App Router, TypeScript)
- **Zustand** — global state (progress localStorage'da saqlanadi)
- **TanStack Query** — server data fetching va kesh
- **Tailwind CSS** — stillar

### Backend stack
- **Node.js + Express + TypeScript**
- **PostgreSQL** — asosiy ma'lumotlar bazasi
- **Redis** — sessiya kesh
- **JWT** — autentifikatsiya (7 kun)
- **bcrypt** — parol shifrlash

### Spaced Repetition (SM-2)
So'zlarni yodlash uchun ilmiy asosda ishlovchi algoritm:
- Bilingan so'z → keyingi ko'rsatish muddati uzayadi (× ease_factor)
- Bilinmagan so'z → 1 kundan qayta boshlanadi
- Ease factor: 1.3 – 3.0 oralig'ida avtomatik sozlanadi

### Ma'lumotlar bazasi sxemasi

```
users          — foydalanuvchilar
lessons        — 24 ta dars meta-ma'lumot
words          — 326+ so'z (de, uz, article, type)
user_progress  — har bir foydalanuvchi dars progressi
word_reviews   — so'z ko'rib chiqish tarixi (SM-2)
quiz_results   — test natijalari
sessions       — JWT refresh tokenlar
```

---

## 🔑 Xavfsizlik

- Barcha `/api/` marshrut (auth va health'dan tashqari) JWT talab qiladi
- Parollar bcrypt (salt rounds: 12) bilan shifrlanadi
- Rate limiting: 100 so'rov / 15 daqiqa / IP
- CORS faqat ruxsat etilgan frontend URLga
- Helmet.js HTTP xavfsizlik sarlavhalari

---

## 📊 Kengaytirish imkoniyatlari

- [ ] Audio talaffuz (TTS API yoki oldindan yozilgan)
- [ ] O'zbek → Nemis yozish mashqi
- [ ] Leaderboard (reyting jadvali)
- [ ] AI suhbat (Anthropic Claude API)
- [ ] Mobile app (React Native)
- [ ] Ko'p til (Rus, Ingliz)
