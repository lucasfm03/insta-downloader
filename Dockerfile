# Usa uma imagem mais completa para evitar erros de biblioteca
FROM node:20

# Instala Python, FFmpeg e ferramentas necessárias
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Instala o yt-dlp de forma oficial via pip
RUN pip3 install --no-cache-dir yt-dlp --break-system-packages

# Define a pasta de trabalho
WORKDIR /app

# Garante que as permissões estejam corretas para o usuário do Hugging Face (ID 1000)
RUN chown -R 1000:1000 /app
USER 1000

# Copia os arquivos de configuração primeiro (para agilizar o build)
COPY --chown=1000 package*.json ./
RUN npm install --production

# Copia o restante dos arquivos do projeto
COPY --chown=1000 . .

# Configurações de ambiente
ENV NODE_ENV=production
ENV PORT=7860

# Porta obrigatória do Hugging Face
EXPOSE 7860

# Comando para iniciar
CMD ["node", "server.js"]
