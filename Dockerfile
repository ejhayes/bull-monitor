FROM node:14-alpine as build
WORKDIR /app
RUN apk add --no-cache openssh git
COPY package* .
RUN npm install --production
COPY dist .

FROM node:14-alpine
WORKDIR /app
COPY --from=build /app .
ARG BUILD_VERSION
ARG LOG_LEVEL=info
ARG LOG_LABEL=bull-monitor
ARG PORT=3000
ENV NODE_ENV="production" \
    PORT=$PORT \
    LOG_LEVEL=$LOG_LEVEL \
    LOG_LABEL=$LOG_LABEL \
    VERSION=$BUILD_VERSION
EXPOSE 3000
ENTRYPOINT ["node", "main.js"]