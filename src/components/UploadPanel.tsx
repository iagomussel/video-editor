'use client'

import { useRef, useState } from 'react';

import { useVideo } from '@/hooks/video';

export function UploadPanel() {
    const { setVideo } = useVideo();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);

    const onPick = () => fileInputRef.current?.click();

    const onChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('video/')) {
            alert('Selecione um arquivo de vídeo.');
            return;
        }

        setBusy(true);
        try {
            const videoUrl = URL.createObjectURL(file);

            const videoElement = document.createElement('video');
            videoElement.preload = 'metadata';
            videoElement.src = videoUrl;

            await new Promise<void>((resolve, reject) => {
                videoElement.onloadedmetadata = () => resolve();
                videoElement.onerror = () => reject(new Error('Falha ao ler metadados do vídeo.'));
            });

            const newVideo: Video = {
                id: `uploaded-${Date.now()}`,
                object: 'video',
                clips: [],
                created: Math.floor(Date.now() / 1000),
                metadata: {
                    duration: videoElement.duration,
                    file_size: file.size,
                    mime_type: file.type,
                },
                source: videoUrl,
                status: 'complete',
                title: file.name.replace(/\.[^/.]+$/, ''),
            };

            setVideo(newVideo);
        } catch (e: any) {
            alert(`Erro: ${e.message || 'Falha ao carregar vídeo'}`);
        } finally {
            setBusy(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Upload</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Carregue um vídeo local no navegador (sem gerar clips automaticamente).
            </p>

            <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={onChange}
                className="hidden"
            />

            <button
                type="button"
                onClick={onPick}
                disabled={busy}
                className="mt-3 w-full px-3 py-2 text-sm rounded-md bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white"
            >
                {busy ? 'Carregando…' : 'Selecionar arquivo'}
            </button>
        </div>
    );
}

