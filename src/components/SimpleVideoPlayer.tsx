'use client'

import { useVideo } from '@/hooks/video';

export function SimpleVideoPlayer() {
    const {
        video,
        videoPlayer,
        handlePlay,
        handlePause,
        handleOnTimeUpdate,
    } = useVideo();

    const isEmpty = !video?.source || video.source === '' || video.id === 'empty-video';

    if (isEmpty) {
        return (
            <div className="flex items-center justify-center h-[360px] rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-zinc-900">
                <div className="text-center px-6">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Nenhum vídeo carregado
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Faça upload, selecione um vídeo local ou importe do YouTube.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-black overflow-hidden">
            <video
                ref={videoPlayer}
                src={video.source}
                controls
                playsInline
                preload="metadata"
                onPlay={handlePlay}
                onPause={handlePause}
                onTimeUpdate={handleOnTimeUpdate}
                className="w-full h-[360px] object-contain bg-black"
            />
        </div>
    );
}

