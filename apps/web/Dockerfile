FROM node:24.21.0-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN corepack enable npm \
    && npm --version \
    && npm ci

COPY . .

RUN npm run build

FROM nginxinc/nginx-unprivileged:1.31.7-alpine@sha256:b5047b9b76845eac124358373c6852377c52e4b05834a47647e955dd91cb8f1e

ENV PORTFOLIO_API_UPSTREAM=http://portfolio-api:18082
ENV PORTFOLIO_SHOW_CHART_ATTRIBUTION=true
ENV DOLLAR=$

COPY --chown=101:101 docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build --chown=101:101 /app/dist /usr/share/nginx/html

USER 101

EXPOSE 4174

CMD ["nginx", "-g", "daemon off;"]
