const urlInput = document.getElementById('videoUrl');
const previewContainer = document.getElementById('previewContainer');
const previewImage = document.getElementById('previewImage');
const previewTitle = document.getElementById('previewTitle');
const previewDuration = document.getElementById('previewDuration');
const platformRadios = document.getElementsByName('platform');

let debounceTimer;
let lastThumbUrl = '';

// Função para detectar plataforma baseada na URL
function detectPlatform(url) {
    if (url.includes('instagram.com/')) return 'instagram';
    if (url.includes('tiktok.com/')) return 'tiktok';
    if (url.includes('youtube.com/') || url.includes('youtu.be/')) return 'youtube';
    return null;
}

urlInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const url = urlInput.value.trim();
    const detected = detectPlatform(url);

    if (detected) {
        // Seleciona o rádio correspondente automaticamente
        for (const radio of platformRadios) {
            if (radio.value === detected) radio.checked = true;
        }

        debounceTimer = setTimeout(async () => {
            try {
                const response = await fetch('/preview', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                });

                if (response.ok) {
                    const data = await response.json();

                    if (data.thumbnail && data.thumbnail !== lastThumbUrl) {
                        lastThumbUrl = data.thumbnail;
                        // Usamos o proxy do servidor para carregar a imagem com segurança (evita CORS)
                        previewImage.src = `/proxy-thumb?url=${encodeURIComponent(data.thumbnail)}`;

                        previewImage.onerror = () => {
                            if (previewImage.src.includes('proxy-thumb')) {
                                previewImage.src = 'https://via.placeholder.com/600x338/1e293b/ffffff?text=Previs%C3%A3o+Indispon%C3%ADvel';
                            }
                        };
                    }

                    previewTitle.textContent = data.title;
                    previewDuration.textContent = data.duration ? `Duração: ${data.duration}` : '';
                    previewContainer.style.display = 'block';
                } else {
                    previewContainer.style.display = 'none';
                }
            } catch (error) {
                console.error('Preview error:', error);
                previewContainer.style.display = 'none';
            }
        }, 800);
    } else {
        previewContainer.style.display = 'none';
        lastThumbUrl = '';
    }
});

document.getElementById('downloadForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const downloadBtn = document.getElementById('downloadBtn');
    const statusMessage = document.getElementById('statusMessage');
    const btnText = downloadBtn.querySelector('.btn-text');
    const btnLoader = downloadBtn.querySelector('.btn-loader');

    const url = urlInput.value.trim();
    if (!url) return;

    // Reset UI
    statusMessage.textContent = '';
    statusMessage.className = 'status-message';
    downloadBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'flex';
    btnLoader.style.justifyContent = 'center';
    btnLoader.style.alignItems = 'center';
    btnLoader.style.gap = '10px';

    try {
        const response = await fetch('/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Erro ao processar o vídeo');
        }

        // Handle file download
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = downloadUrl;

        // Extract filename from header or use default
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'video_download.mp4';

        const detected = detectPlatform(url) || 'video';
        filename = `${detected}_video_${Date.now()}.mp4`;

        if (contentDisposition && contentDisposition.includes('filename=')) {
            const match = contentDisposition.match(/filename="?([^"]+)"?/);
            if (match) filename = match[1];
        }

        a.download = filename;
        document.body.appendChild(a);
        a.click();

        window.URL.revokeObjectURL(downloadUrl);
        statusMessage.textContent = 'Download concluído com sucesso!';
        statusMessage.classList.add('success');
        urlInput.value = '';
        previewContainer.style.display = 'none';
    } catch (error) {
        console.error('Download error:', error);
        statusMessage.textContent = error.message;
        statusMessage.classList.add('error');
    } finally {
        downloadBtn.disabled = false;
        btnText.style.display = 'block';
        btnLoader.style.display = 'none';
    }
});
