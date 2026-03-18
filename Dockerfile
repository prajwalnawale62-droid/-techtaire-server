FROM node:18-slim

RUN apt-get update && apt-get install -y git python3 make g++ --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV NODE_ENV=production
EXPOSE $PORT
CMD ["node", "index.js"]
