FROM node:18-alpine as build
WORKDIR /app
RUN apk add --no-cache openssh git
COPY package* ./
RUN npm install --omit=dev
COPY dist ./

FROM golang:latest as go
RUN go install -v github.com/bitly/oauth2_proxy@latest

FROM node:18-alpine
# https://stackoverflow.com/questions/66963068/docker-alpine-executable-binary-not-found-even-if-in-path
RUN apk add --no-cache libc6-compat
ARG BUILD_VERSION
ARG LOG_LEVEL=info
ARG LOG_LABEL=bull-monitor
ARG PORT=3000
WORKDIR /app
COPY --from=go /go/bin/oauth2_proxy ./
COPY --from=build /app ./
COPY docker-entrypoint.sh .
COPY oauth2_proxy.cfg .
ENV NODE_ENV="production" \
    PORT=$PORT \
    LOG_LEVEL=$LOG_LEVEL \
    LOG_LABEL=$LOG_LABEL \
    VERSION=$BUILD_VERSION
EXPOSE 3000
ENTRYPOINT ["sh", "docker-entrypoint.sh"]