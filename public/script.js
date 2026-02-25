const urlInput = document.getElementById('videoUrl');
const previewContainer = document.getElementById('previewContainer');
const previewImage = document.getElementById('previewImage');
const previewTitle = document.getElementById('previewTitle');
const previewDuration = document.getElementById('previewDuration');

let debounceTimer;

let lastThumbUrl = '';

urlInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const url = urlInput.value.trim();

    if (url.includes('instagram.com/')) {
        debounceTimer = setTimeout(async () => {
            try {
                const response = await fetch('/preview', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                });

                if (response.ok) {
                    const data = await response.json();

                    // Só atualiza se for uma imagem diferente para evitar "piscar" a tela
                    if (data.thumbnail && data.thumbnail !== lastThumbUrl) {
                        lastThumbUrl = data.thumbnail;
                        // Usamos o proxy do servidor para carregar a imagem com segurança
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
                    // If response is not ok, hide the preview container
                    previewContainer.style.display = 'none';
                }
            } catch (error) {
                console.error('Preview error:', error);
                // Hide preview container on error
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

    // const urlInput = document.getElementById('videoUrl'); // Moved to global scope
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

        // Extract filename if possible or use default
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'video_instagram.mp4';
        if (contentDisposition && contentDisposition.includes('filename=')) {
            filename = contentDisposition.split('filename=')[1].replace(/"/g, '');
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
