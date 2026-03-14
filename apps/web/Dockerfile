FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

EXPOSE 4174

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "4174"]
