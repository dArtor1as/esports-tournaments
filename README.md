# CyberBracket - E-Sports Tournament Management System

Повнофункціональна система управління кіберспортивними турнірами з підтримкою командних та індивідуальних форматів, системою рейтингу на основі Elo та генетичним алгоритмом для симуляції турнірів.

## 📋 Характеристики

- **Управління командами** - створення, запрошення гравців, розпуск команд
- **Система турнірів** - публічні та закриті турніри, різні формати (TEAM/SOLO)
- **Груповий етап та Плей-оф** - автоматична генерація матчів та сіток
- **Система рейтингу** - обчислення Elo з урахуванням турнірного рівня (K-фактор)
- **Консенсус результатів** - звіти про результати, підтвердження, вирішення суперечок
- **Генетичні симуляції** - еволюційний алгоритм для прогнозування результатів турнірів
- **Аналітика** - історія матчів, статистика гравців, рейтинги команд

## 🛠️ Стек технологій

### Backend

- **NestJS** - Framework для REST API
- **Prisma ORM** - Управління базою даних
- **PostgreSQL** - Основна база даних
- **Redis** - Кеш та сесії
- **JWT** - Аутентифікація

### Frontend

- **React 18** - UI бібліотека
- **Vite** - Build tool
- **TanStack Query** - Управління серверним станом
- **React Router** - Навігація
- **Tailwind CSS** - Стилізація

### Infrastructure

- **Docker** - Контейнеризація
- **Docker Compose** - Оркестрація контейнерів
- **Nginx** - Веб-сервер для фронтенду

## 📦 Вимоги

- **Docker** (version 20+)
- **Docker Compose** (version 1.29+)
- Або локально: Node.js 18+, PostgreSQL 14+, Redis 7+

## 🚀 Швидкий старт

### 1. Клонування репозиторію

```bash
git clone https://github.com/dArtor1as/esports-tournaments.git
cd esports-tournaments
```

### 2. Налаштування змінних середовища

#### Backend (.env)

```bash
# Скопіюйте приклад та заповніть
cp backend/.env.example backend/.env
```

Основні змінні для `backend/.env`:

```env
NODE_ENV=development
PORT=3000

# PostgreSQL
POSTGRES_USER=esports_user
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=esports_db
POSTGRES_PORT=5432

# Redis
REDIS_PORT=6379

# JWT
JWT_SECRET=your_jwt_secret_key_min_32_chars

# Mail (опціонально)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your_email@gmail.com
MAIL_PASS=your_app_password

# Frontend URL
FRONTEND_URL=http://localhost:3001
```

#### Frontend (.env)

```bash
# Встановлюється через docker-compose, но можете перевірити
cat frontend/.env 2>/dev/null || echo "VITE_API_URL=http://localhost:3000"
```

### 3. Запуск з Docker Compose

```bash
# Запуск всіх сервісів (PostgreSQL, Redis, Backend, Frontend)
docker-compose up -d

# Перевірка статусу контейнерів
docker-compose ps

# Перегляд логів
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 4. Ініціалізація БД

```bash
# Запуск міграцій Prisma
docker-compose exec backend npx prisma migrate deploy

# Опційно: сидінг (заповнення тестових даних)
docker-compose exec backend npx prisma db seed
```

### 5. Доступ до додатку

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## 📝 Основні команди

### Docker Compose

```bash
# Запуск всіх сервісів
docker-compose up -d

# Перезапуск сервісів
docker-compose restart

# Зупинка всіх сервісів
docker-compose down

# Перебудова образів
docker-compose up -d --build

# Видалення томів (видалить всі дані!)
docker-compose down -v

# Перегляд логів конкретного сервісу
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Backend

```bash
# Запуск локально (без Docker)
cd backend
npm install
npx prisma migrate dev
npm run start:dev

# Запуск тестів
cd backend
npm run test         # Звичайний запуск всіх тестів
npm run test:cov     # Запуск тестів із відображенням звіту про покриття коду (coverage)

# Перевірка форматування
npm run format:check
```

### Frontend

```bash
# Запуск локально (без Docker)
cd frontend
npm install
npm run dev

# Перевірка форматування
npm run format:check

# Продакшн збірка
npm run build
```

## 📁 Структура проекту

```
esports-tournaments/
├── backend/                 # NestJS backend
│   ├── src/
│   │   ├── players/        # Модуль управління гравцями
│   │   ├── teams/          # Модуль управління командами
│   │   ├── tournaments/    # Модуль турнірів
│   │   ├── matches/        # Модуль матчів
│   │   ├── auth/           # Аутентифікація
│   │   └── ...
│   ├── prisma/
│   │   └── schema.prisma   # Схема БД
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                # React frontend
│   ├── src/
│   │   ├── pages/          # Сторінки
│   │   ├── components/     # Компоненти
│   │   ├── hooks/          # Custom hooks
│   │   ├── lib/            # Утилітарні функції
│   │   └── ...
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
│
├── docker-compose.yml       # Конфігурація контейнерів
└── README.md               # Цей файл
```

## 🔐 Безпека

- Пароль хешується bcrypt
- JWT для аутентифікації
- CORS налаштований для фронтенду
- Валідація вхідних даних на бекенді
- Перевірка прав доступу у критичних операціях

## 📄 Ліцензія

MIT

---

**Версія**: 2.0  
**Останнє оновлення**: 2026-08-06
