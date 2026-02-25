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

// Configurações para Hugging Face / Produção
const PORT = process.env.PORT || 7860;
const DOWNLOAD_DIR = process.env.NODE_ENV === 'production' ? '/tmp/downloads' : path.join(__dirname, 'downloads');

if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

app.post('/download', (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).send('URL é obrigatória');
    }

    console.log(`Iniciando download da URL: ${url}`);

    const id = Date.now();
    const filename = `insta_video_${id}.mp4`;
    const filepath = path.join(DOWNLOAD_DIR, filename);

    // Nome do arquivo de cookies exatamente como está na aba 'Files' do seu Space
    const cookieFile = 'www.instagram.com_cookies.txt';

    // Comando yt-dlp atualizado com -4 para forçar IPv4 e evitar erros de hostname
    const command = `yt-dlp -4 --no-check-certificate --cookies "${cookieFile}" --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" -S "ext:mp4:m4a" --merge-output-format mp4 -o "${filepath}" "${url}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            // Se o erro for apenas um aviso (contém WARNING), verificamos se o arquivo foi gerado mesmo assim
            if (stderr.includes('WARNING') && fs.existsSync(filepath)) {
                console.log('Aviso detectado, mas o arquivo foi gerado. Prosseguindo...');
            } else {
                console.error(`Status de erro: ${error}`);
                console.error(`Stderr: ${stderr}`);
                // Retorna o erro real ou a primeira linha para ajudar no debug
                const lines = stderr.split('\n');
                const realError = lines.find(l => l.includes('ERROR:')) || lines[0] || 'Erro desconhecido ao processar vídeo';
                return res.status(500).send(`Erro no download: ${realError}`);
            }
        }

        console.log(`Download concluído: ${filename}`);

        if (fs.existsSync(filepath)) {
            res.download(filepath, filename, (err) => {
                if (err) {
                    console.error('Erro ao enviar o arquivo:', err);
                }
                // Remover o arquivo após o envio
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

    const cookieFile = 'www.instagram.com_cookies.txt';
    const command = `yt-dlp -4 -j --no-check-certificate --cookies "${cookieFile}" --skip-download "${url}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Erro preview: ${stderr}`);
            return res.status(500).send('Erro ao buscar pré-visualização');
        }

        try {
            const metadata = JSON.parse(stdout);
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
    console.log(`Servidor rodando na porta ${PORT}`);
});