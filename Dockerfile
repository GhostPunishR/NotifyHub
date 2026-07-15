FROM node:22-alpine AS build
WORKDIR /app

COPY package.json ./
COPY apps/bot/package.json apps/bot/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/i18n/package.json packages/i18n/package.json
COPY packages/logger/package.json packages/logger/package.json
COPY packages/discord-ui/package.json packages/discord-ui/package.json
COPY modules/twitch/package.json modules/twitch/package.json
COPY modules/kick/package.json modules/kick/package.json
COPY modules/youtube/package.json modules/youtube/package.json
COPY modules/tiktok/package.json modules/tiktok/package.json
COPY modules/x/package.json modules/x/package.json
COPY modules/bluesky/package.json modules/bluesky/package.json
RUN npm install

COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S notifyhub && adduser -S notifyhub -G notifyhub
COPY --from=build --chown=notifyhub:notifyhub /app /app

USER notifyhub
EXPOSE 3000
CMD ["npm", "start"]
