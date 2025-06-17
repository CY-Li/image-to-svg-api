FROM node:18

# 安裝系統依賴與建立 Python 虛擬環境
RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-venv potrace pkg-config libagg-dev && \
    python3 -m venv /app/venv

# 啟用 venv，安裝 Python 套件
ENV PATH="/app/venv/bin:$PATH"
RUN pip install --upgrade pip && pip install opencv-python numpy

# 建立 uploads 目錄
RUN mkdir -p /tmp/uploads && chmod 777 /tmp/uploads

# 設置工作目錄
WORKDIR /app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝 Node.js 依賴
RUN npm install

# 複製 requirements.txt
COPY requirements.txt ./

# 安裝 Python 依賴
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir numpy && \
    pip install --no-cache-dir opencv-python && \
    pip install --no-cache-dir Cython && \
    pip install --no-cache-dir pypotrace==0.3.0

# 複製應用程序文件
COPY . .

# 設置環境變數
ENV NODE_ENV=production
ENV PORT=3000

# 暴露端口
EXPOSE 3000

# 啟動應用
CMD ["node", "server.js"] 