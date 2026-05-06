FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --include=dev

COPY . .

ENV PORT=8787
EXPOSE 8787

CMD ["npm", "run", "start:server"]