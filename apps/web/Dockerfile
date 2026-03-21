FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

FROM nginx:1.29-alpine

ENV PORTFOLIO_API_UPSTREAM=http://portfolio-api:18082
ENV DOLLAR=$

COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 4174

CMD ["nginx", "-g", "daemon off;"]
