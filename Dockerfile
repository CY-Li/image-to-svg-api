FROM node:18

RUN apt-get update && \
    apt-get install -y python3 python3-pip potrace build-essential libgl1 libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY requirements.txt ./
RUN pip3 install --upgrade pip
RUN pip3 install --break-system-packages -r requirements.txt

COPY . .

EXPOSE 3000
CMD ["node", "server.js"] 