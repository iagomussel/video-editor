'use client'

// React
import { useState, useEffect } from 'react'

// Icons
import { VideoLibrary, Close, Refresh, PlayArrow } from '@mui/icons-material'

// Hooks
import { useVideo } from '@/hooks/video'
import { useTranscript } from '@/hooks/transcript'

type LocalVideo = {
    id: string;
    filename: string;
    path: string;
    size: number;
    created: number;
    mimeType: string;
}

export function VideoSelector({ 
    isOpen, 
    onClose 
}: { 
    isOpen: boolean; 
    onClose: () => void;
}) {
    const { setVideo, setClips } = useVideo();
    const { setTranscript } = useTranscript();
    const [localVideos, setLocalVideos] = useState<LocalVideo[]>([]);
    const [loading, setLoading] = useState(false);
    const [processingVideo, setProcessingVideo] = useState<string | null>(null);

    const fetchLocalVideos = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/videos/list');
            if (response.ok) {
                const data = await response.json();
                setLocalVideos(data.videos || []);
            }
        } catch (error) {
            console.error('Error fetching local videos:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchLocalVideos();
        }
    }, [isOpen]);

    const handleSelectVideo = async (video: LocalVideo) => {
        setProcessingVideo(video.id);
        
        try {
            // First, load the video without clips
            const tempVideo: Video = {
                id: video.id,
                object: "video",
                clips: [],
                created: Math.floor(video.created / 1000),
                metadata: {
                    duration: 0, // Will be updated after processing
                    file_size: video.size,
                    mime_type: video.mimeType,
                },
                source: video.path,
                status: "processing",
                title: video.filename.replace(/\.[^/.]+$/, ""),
            };

            setVideo(tempVideo);

            // Generate clips using ClipsAI
            // Fetch the video file and send it to the API
            const videoResponse = await fetch(video.path);
            if (!videoResponse.ok) {
                throw new Error('Failed to fetch video file');
            }

            const videoBlob = await videoResponse.blob();
            const formData = new FormData();
            formData.append('video', videoBlob, video.filename);
            formData.append('videoId', video.id);
            formData.append('title', tempVideo.title);

            const clipsResponse = await fetch('/api/clips/generate', {
                method: 'POST',
                body: formData,
            });

            if (!clipsResponse.ok) {
                const error = await clipsResponse.json();
                const errorMessage = error.error || 'Failed to generate clips';
                
                // Check if it's an installation error
                if (error.isInstallationError || errorMessage.includes('clipsai') || errorMessage.includes('No module named')) {
                    throw new Error('ClipsAI não está instalado. Por favor, instale com: pip install clipsai');
                }
                
                throw new Error(errorMessage);
            }

            const clipsData = await clipsResponse.json();

            // Update video with clips and metadata
            const updatedVideo: Video = {
                ...tempVideo,
                clips: clipsData.clips || [],
                status: "complete",
                metadata: {
                    ...tempVideo.metadata,
                    duration: clipsData.metadata?.duration || 0,
                    clips_count: clipsData.metadata?.clips_count,
                },
            };

            setVideo(updatedVideo);
            setClips(clipsData.clips || []);
            
            if (clipsData.transcript) {
                setTranscript(clipsData.transcript);
            }

            onClose();
        } catch (error: any) {
            console.error('Error processing local video:', error);
            const errorMessage = error.message || 'Falha ao processar vídeo local';
            
            // Show more helpful message for ClipsAI installation errors
            if (errorMessage.includes('ClipsAI não está instalado') || errorMessage.includes('clipsai')) {
                alert(
                    `Erro: ClipsAI não está instalado.\n\n` +
                    `Para instalar, execute no terminal:\n` +
                    `pip install clipsai\n` +
                    `pip install whisperx@git+https://github.com/m-bain/whisperx.git\n\n` +
                    `Certifique-se também de ter instalado:\n` +
                    `- ffmpeg\n` +
                    `- libmagic`
                );
            } else {
                alert(`Erro: ${errorMessage}`);
            }
        } finally {
            setProcessingVideo(null);
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const formatDate = (timestamp: number): string => {
        const date = new Date(timestamp);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-white/10">
                    <div className="flex items-center space-x-3">
                        <VideoLibrary className="text-blue-600 dark:text-blue-400" />
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            Vídeos Locais
                        </h2>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={fetchLocalVideos}
                            disabled={loading}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded"
                            title="Atualizar lista"
                        >
                            <Refresh className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded"
                        >
                            <Close />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {loading && localVideos.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                            <p className="mt-4 text-gray-600 dark:text-gray-400">Carregando vídeos...</p>
                        </div>
                    ) : localVideos.length === 0 ? (
                        <div className="text-center py-12">
                            <VideoLibrary className="text-6xl text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-600 dark:text-gray-400">
                                Nenhum vídeo local encontrado
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                                Faça upload de um vídeo ou importe do YouTube para começar
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {localVideos.map((video) => (
                                <div
                                    key={video.id}
                                    className={`border rounded-lg p-4 hover:shadow-md transition-shadow
                                        ${processingVideo === video.id 
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                                            : 'border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-zinc-900'
                                        }`}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                                                {video.filename}
                                            </h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                {formatDate(video.created)}
                                            </p>
                                        </div>
                                        {processingVideo === video.id && (
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 ml-2"></div>
                                        )}
                                    </div>
                                    
                                    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-3">
                                        <span>{formatFileSize(video.size)}</span>
                                        <span className="text-xs">{video.mimeType}</span>
                                    </div>

                                    <button
                                        onClick={() => handleSelectVideo(video)}
                                        disabled={processingVideo !== null}
                                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 
                                        disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm
                                        font-medium flex items-center justify-center space-x-2"
                                    >
                                        <PlayArrow fontSize="small" />
                                        <span>
                                            {processingVideo === video.id 
                                                ? 'Processando...' 
                                                : 'Gerar Cortes com ClipsAI'
                                            }
                                        </span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
