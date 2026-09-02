FROM node:24.19.0-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

FROM nginxinc/nginx-unprivileged:1.31.3-alpine@sha256:f972e5322b9797dc2a6b830030094426437b1ae7032e4644496395336ac6fdac

USER root

RUN apk add --no-cache \
    'curl=8.20.0-r0' \
    'libcurl=8.20.0-r0'

ENV PORTFOLIO_API_UPSTREAM=http://portfolio-api:18082
ENV PORTFOLIO_SHOW_CHART_ATTRIBUTION=true
ENV DOLLAR=$

COPY --chown=101:101 docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build --chown=101:101 /app/dist /usr/share/nginx/html

USER 101

EXPOSE 4174

CMD ["nginx", "-g", "daemon off;"]
