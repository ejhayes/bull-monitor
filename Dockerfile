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
ENV PORT="3000" \
    VERSION=$BUILD_VERSION
EXPOSE 3000
ENTRYPOINT ["node", "main.js"]