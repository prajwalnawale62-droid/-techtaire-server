FROM node:18-slim

RUN apt-get update && apt-get install -y \
chromium \
libglib2.0-0 \
libnss3 \
libatk1.0-0 \
libatk-bridge2.0-0 \
libcups2 \
libdrm2 \
libxkbcommon0 \
libxcomposite1 \
libxdamage1 \
libxrandr2 \
libgbm1 \
libasound2 \
libx11-6 \
libx11-xcb1 \
libxcb1 \
libxext6 \
libxfixes3 \
libxi6 \
libxrender1 \
libxss1 \
libxtst6 \
ca-certificates \
fonts-liberation \
wget \
--no-install-recommends \
&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

ENV CHROME_BIN=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node","index.js"]
