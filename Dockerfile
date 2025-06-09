FROM node:18

RUN apt-get update && \
    apt-get install -y python3 python3-pip potrace && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY requirements.txt ./
RUN pip3 install -r requirements.txt

COPY . .

EXPOSE 3000
CMD ["node", "server.js"] 