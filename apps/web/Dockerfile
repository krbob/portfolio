FROM node:24.18.1-alpine@sha256:f70403e87646dc51b45295f4b8b70cdad0b63d2297c4c9899119b03f7af7a6b3 AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

FROM nginxinc/nginx-unprivileged:1.31.2-alpine@sha256:6320020c7da8714feab524e02c08c5a1958675c4e68700e93a2fd8970b065786

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
