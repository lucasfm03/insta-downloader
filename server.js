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

// Rota de proxy para as thumbnails
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

// Configurações para produção
const PORT = process.env.PORT || 10000;
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
const IG_COOKIE_FILE = 'www.instagram.com_cookies.txt';

// Se existir uma variável de ambiente com os cookies do IG, cria o arquivo
if (process.env.IG_COOKIES) {
    console.log('Criando arquivo de cookies do Instagram...');
    fs.writeFileSync(path.join(__dirname, IG_COOKIE_FILE), process.env.IG_COOKIES);
}

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
    let platform = 'video';
    if (url.includes('instagram.com')) platform = 'insta';
    else if (url.includes('tiktok.com')) platform = 'tiktok';
    else if (url.includes('youtube.com') || url.includes('youtu.be')) platform = 'youtube';

    const filename = `${platform}_video_${id}.mp4`;
    const filepath = path.join(DOWNLOAD_DIR, filename);

    let extraArgs = '-4 --no-check-certificate --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"';

    // Cookies específicos por plataforma se necessário
    if (url.includes('instagram.com') && fs.existsSync(path.join(__dirname, IG_COOKIE_FILE))) {
        extraArgs += ` --cookies "${IG_COOKIE_FILE}"`;
    }

    // Parâmetros específicos para TikTok
    let formatArg = '-S "ext:mp4:m4a" --merge-output-format mp4';
    if (url.includes('tiktok.com')) {
        // O TikTok exige Referer para liberar a extração de dados
        extraArgs += ' --referer "https://www.tiktok.com/"';
        formatArg = '-f "bestvideo+bestaudio/best" --merge-output-format mp4';
    }

    const command = `yt-dlp ${extraArgs} ${formatArg} -o "${filepath}" "${url}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            if (stderr.includes('WARNING') && fs.existsSync(filepath)) {
                console.log('Aviso detectado, mas o arquivo foi gerado. Prosseguindo...');
            } else {
                console.error(`Status de erro: ${error}`);
                console.error(`Stderr: ${stderr}`);

                let realError = 'Erro desconhecido ao processar vídeo';
                if (stderr.includes('rate-limit reached') || stderr.includes('login required')) {
                    realError = 'Acesso bloqueado ou login necessário para esta plataforma.';
                } else {
                    const lines = stderr.split('\n');
                    realError = lines.find(l => l.includes('ERROR:')) || lines[0] || realError;
                }

                return res.status(500).send(`Erro no download: ${realError}`);
            }
        }

        console.log(`Download concluído: ${filename}`);

        if (fs.existsSync(filepath)) {
            res.download(filepath, filename, (err) => {
                if (err) {
                    console.error('Erro ao enviar o arquivo:', err);
                }
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

    let extraArgs = '-4 --no-check-certificate';
    if (url.includes('instagram.com') && fs.existsSync(path.join(__dirname, IG_COOKIE_FILE))) {
        extraArgs += ` --cookies "${IG_COOKIE_FILE}"`;
    }

    const command = `yt-dlp ${extraArgs} -j --skip-download "${url}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Erro preview: ${stderr}`);
            return res.status(500).send('Erro ao buscar pré-visualização');
        }

        try {
            const metadata = JSON.parse(stdout);
            let thumb = metadata.thumbnail;
            if (!thumb && metadata.thumbnails && metadata.thumbnails.length > 0) {
                // Pega a última thumb (geralmente maior qualidade)
                thumb = metadata.thumbnails[metadata.thumbnails.length - 1].url;
            }

            res.json({
                thumbnail: thumb,
                title: metadata.title || 'Vídeo',
                duration: metadata.duration_string || (metadata.duration ? `${Math.floor(metadata.duration / 60)}:${(metadata.duration % 60).toString().padStart(2, '0')}` : '')
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
