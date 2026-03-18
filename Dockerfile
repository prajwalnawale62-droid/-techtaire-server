FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV NODE_ENV=production
EXPOSE $PORT
CMD ["node", "index.js"]
