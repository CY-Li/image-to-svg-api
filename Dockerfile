FROM node:18

# 安裝系統依賴
RUN apt-get update && \
    apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-full \
    potrace \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    pkg-config \
    libagg-dev \
    libreoffice \
    poppler-utils \
    enscript \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 安裝 Node.js 依賴
COPY package*.json ./
RUN npm install

# 設置 Python 虛擬環境
RUN python3 -m venv /app/venv
ENV PATH="/app/venv/bin:$PATH"

# 安裝 Python 依賴
COPY requirements.txt ./
RUN pip install --no-cache-dir numpy && \
    pip install --no-cache-dir opencv-python && \
    pip install --no-cache-dir pypotrace

# 複製應用程式代碼
COPY . .

# 創建臨時目錄
RUN mkdir -p /tmp/uploads && chmod 777 /tmp/uploads

# 設置環境變數
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["node", "server.js"] 