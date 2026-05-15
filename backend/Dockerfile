FROM node:22-alpine

WORKDIR /app

# Встановлюємо curl для healthcheck
RUN apk add --no-cache curl

# Копіюємо конфіги та Прізму
COPY package*.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma/

# Встановлюємо ВСІ залежності (щоб працював ts-node для seed.ts)
RUN npm install

# Копіюємо весь вихідний код
COPY . .

# Генеруємо Prisma Client та компілюємо NestJS
RUN npx prisma generate
RUN npm run build

# Налаштовуємо права доступу для безпеки (не працюємо під root)
RUN chown -R node:node /app
USER node

EXPOSE 3000

# Запускаємо міграції, сідінг (якщо треба) і сам сервер
CMD ["npm", "run", "start:prod"]