FROM node:24-slim

WORKDIR /app

COPY package*.json ./
COPY scripts ./scripts

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3001

ENV PORT=3001

CMD ["node", "dist/index.js"]
