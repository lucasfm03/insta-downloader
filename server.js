const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servindo arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Rota de proxy para as thumbnails do Instagram
app.get('/proxy-thumb', (req, res) => {
    const imageUrl = req.query.url;
    if (!imageUrl) return res.status(400).send('URL da imagem é obrigatória');

    https.get(imageUrl, (proxyRes) => {
        if (proxyRes.statusCode !== 200) {
            return res.status(proxyRes.statusCode).send('Erro ao buscar imagem');
        }
        res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'image/jpeg');
        proxyRes.pipe(res);
    }).on('error', (err) => {
        console.error('Erro no proxy de imagem:', err);
        res.status(500).send('Erro no servidor');
    });
});

const PORT = 3000;
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');

if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR);
}

// A rota '/' agora servirá automaticamente o index.html da pasta public via express.static

app.post('/download', (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).send('URL é obrigatória');
    }

    console.log(`Iniciando download da URL: ${url}`);

    const id = Date.now();
    const filename = `insta_video_${id}.mp4`;
    const filepath = path.join(DOWNLOAD_DIR, filename);

    // Usando yt-dlp para baixar o vídeo
    const command = `yt-dlp -f mp4 -o "${filepath}" "${url}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Status de erro: ${error}`);
            console.error(`Stderr: ${stderr}`);
            return res.status(500).send('Erro ao baixar vídeo. Verifique o link e tente novamente.');
        }

        console.log(`Download concluído: ${filename}`);

        // Verificando se o arquivo existe antes de enviar
        if (fs.existsSync(filepath)) {
            res.download(filepath, filename, (err) => {
                if (err) {
                    console.error('Erro ao enviar o arquivo:', err);
                }
                // Remover o arquivo após o envio para não ocupar espaço
                fs.unlink(filepath, (unlinkErr) => {
                    if (unlinkErr) console.error('Erro ao deletar arquivo temporário:', unlinkErr);
                });
            });
        } else {
            res.status(500).send('Arquivo não encontrado após o download.');
        }
    });
});

app.post('/preview', (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).send('URL é obrigatória');

    // yt-dlp -j --skip-download pre-visualiza os metadados
    const command = `yt-dlp -j --skip-download "${url}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            return res.status(500).send('Erro ao buscar pré-visualização');
        }

        try {
            const metadata = JSON.parse(stdout);

            // Tenta pegar a melhor thumbnail disponível
            let thumb = metadata.thumbnail;
            if (!thumb && metadata.thumbnails && metadata.thumbnails.length > 0) {
                thumb = metadata.thumbnails[metadata.thumbnails.length - 1].url;
            }

            res.json({
                thumbnail: thumb,
                title: metadata.title || 'Vídeo do Instagram',
                duration: metadata.duration_string
            });
        } catch (e) {
            console.error('Erro ao processar metadados:', e);
            res.status(500).send('Erro ao processar metadados');
        }
    });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
