

FROM node:18-alpine as build
WORKDIR /app
RUN apk add --no-cache openssh git
COPY package* ./
RUN npm install --omit=dev
COPY dist ./

FROM node:18-alpine
ARG BUILD_VERSION
ARG LOG_LEVEL=info
ARG LOG_LABEL=bull-monitor
ARG PORT=3000
WORKDIR /app
COPY --from=build /app ./
ENV NODE_ENV="production" \
    PORT=$PORT \
    LOG_LEVEL=$LOG_LEVEL \
    LOG_LABEL=$LOG_LABEL \
    VERSION=$BUILD_VERSION
EXPOSE 3000
ENTRYPOINT ["node", "daemon.js"]