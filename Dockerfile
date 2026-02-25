# Usa uma imagem oficial do Node.js
FROM node:20

# Instala Python, FFmpeg e ferramentas necessárias
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Instala o yt-dlp
RUN pip3 install --no-cache-dir yt-dlp --break-system-packages

# Define a pasta de trabalho
WORKDIR /app

# Copia os arquivos de configuração primeiro
COPY package*.json ./
RUN npm install --production

# Copia o restante dos arquivos do projeto
COPY . .

# Garante que a pasta de downloads exista e tenha permissões
RUN mkdir -p downloads && chmod 777 downloads

# Configurações de ambiente
ENV NODE_ENV=production
ENV PORT=10000

# Porta padrão do Render (embora ele costume injetar via variável de ambiente)
EXPOSE 10000

# Comando para iniciar
CMD ["node", "server.js"]
