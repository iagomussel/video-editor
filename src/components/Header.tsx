// Components
import { IntervalDropdown } from '@/components/Dropdown'

// Hooks
import { useVideo } from '@/hooks/video'
import { useTranscript } from '@/hooks/transcript'

// Next
import Link from 'next/link'

// Icons
import { GitHub, Upload, YouTube, Close, VideoLibrary } from "@mui/icons-material"

// Components
import { VideoSelector } from '@/components/VideoSelector'

// React
import { useRef, useState } from 'react'


export function Header({ setInterval }: { setInterval: SetState<Interval> }) {
    const { clip, video, setVideo, setClips } = useVideo();
    const { setTranscript } = useTranscript();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [showYoutubeInput, setShowYoutubeInput] = useState(false);
    const [showVideoSelector, setShowVideoSelector] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStatus, setProcessingStatus] = useState('');
    const [processingPreviewUrl, setProcessingPreviewUrl] = useState<string | null>(null);
    const [jobs, setJobs] = useState<any[]>([]);
    const [jobsError, setJobsError] = useState<string | null>(null);

    const formatEta = (seconds: any) => {
        if (typeof seconds !== 'number' || !isFinite(seconds) || seconds <= 0) return '';
        const s = Math.round(seconds);
        const m = Math.floor(s / 60);
        const r = s % 60;
        return `${m}:${String(r).padStart(2, '0')}`;
    };

    const loadJobs = async () => {
        try {
            setJobsError(null);
            const res = await fetch('/api/youtube/process/list?limit=20', { method: 'GET' });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to list jobs');
            }
            const data = await res.json();
            setJobs(Array.isArray(data.jobs) ? data.jobs : []);
        } catch (e: any) {
            setJobsError(e.message || 'Failed to list jobs');
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Check if it's a video file
        if (!file.type.startsWith('video/')) {
            alert('Please select a video file');
            return;
        }

        // Create a blob URL for the video
        const videoUrl = URL.createObjectURL(file);

        // Get video metadata
        const videoElement = document.createElement('video');
        videoElement.preload = 'metadata';
        videoElement.src = videoUrl;

        videoElement.onloadedmetadata = () => {
            const duration = videoElement.duration;
            
            // Create a new video object
            const newVideo: Video = {
                id: `uploaded-${Date.now()}`,
                object: "video",
                clips: [],
                created: Math.floor(Date.now() / 1000),
                metadata: {
                    duration: duration,
                    file_size: file.size,
                    mime_type: file.type,
                },
                source: videoUrl,
                status: "complete",
                title: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
            };

            setVideo(newVideo);
        };

        videoElement.onerror = () => {
            alert('Error loading video file');
            URL.revokeObjectURL(videoUrl);
        };

        // Reset the input so the same file can be selected again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleYoutubeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!youtubeUrl.trim()) return;

        setIsProcessing(true);
        setProcessingStatus('Iniciando processamento...');
        setProcessingPreviewUrl(null);

        try {
            // Step 1: Start async processing (clips will be filtered to < 30 seconds)
            const startResponse = await fetch('/api/youtube/process/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    url: youtubeUrl,
                    max_duration: 30.0  // Filter clips to be less than 30 seconds
                }),
            });

            if (!startResponse.ok) {
                const error = await startResponse.json();
                throw new Error(error.error || 'Failed to start processing');
            }

            const { job_id } = await startResponse.json();
            await loadJobs();
            
            // Step 2: Poll for status
            const pollStatus = async (): Promise<void> => {
                const maxAttempts = 600; // 10 minutes max (1 second intervals)
                let attempts = 0;
                
                const poll = async (): Promise<void> => {
                    if (attempts >= maxAttempts) {
                        throw new Error('Processamento demorou muito tempo. Tente novamente.');
                    }
                    
                    attempts++;
                    
                    try {
                        const statusResponse = await fetch(`/api/youtube/process/status/${job_id}`);
                        
                        if (!statusResponse.ok) {
                            throw new Error('Failed to get job status');
                        }
                        
                        const status = await statusResponse.json();
                        
                        // Update status message
                        if (status.message) {
                            const eta = formatEta(status.eta_seconds);
                            setProcessingStatus(`${status.message} (${status.progress}%)${eta ? ` • ETA ${eta}` : ''}`);
                        }
                        if (status.preview_url) {
                            setProcessingPreviewUrl(status.preview_url);
                        }
                        
                        if (status.status === 'completed') {
                            // Step 3: Get result
                            setProcessingStatus('Finalizando...');
                            const resultResponse = await fetch(`/api/youtube/process/result/${job_id}`);
                            
                            if (!resultResponse.ok) {
                                throw new Error('Failed to get job result');
                            }
                            
                            const data = await resultResponse.json();

                            // Update video
                            setVideo(data.video);
                            
                            // Update clips
                            if (data.video.clips && data.video.clips.length > 0) {
                                setClips(data.video.clips);
                            }

                            // Update transcript
                            if (data.transcript) {
                                setTranscript(data.transcript);
                            }

                            setProcessingStatus('Complete!');
                            setShowYoutubeInput(false);
                            setYoutubeUrl('');
                            await loadJobs();
                            
                            // Clear status after a moment
                            setTimeout(() => {
                                setProcessingStatus('');
                                setIsProcessing(false);
                                setProcessingPreviewUrl(null);
                            }, 2000);
                        } else if (status.status === 'failed') {
                            throw new Error(status.error || status.message || 'Processing failed');
                        } else {
                            // Continue polling
                            setTimeout(poll, 1000); // Poll every 1 second
                        }
                    } catch (error: any) {
                        if (error.message && !error.message.includes('Failed to get')) {
                            throw error;
                        }
                        // Retry on network errors
                        setTimeout(poll, 2000);
                    }
                };
                
                await poll();
            };
            
            await pollStatus();
        } catch (error: any) {
            console.error('Error processing YouTube video:', error);
            const errorMessage = error.message || 'Failed to process YouTube video';
            
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
            setProcessingStatus('');
            setIsProcessing(false);
            setProcessingPreviewUrl(null);
        }
    };

    const handleYoutubeClick = () => {
        const next = !showYoutubeInput;
        setShowYoutubeInput(next);
        if (next) {
            void loadJobs();
        } else {
            setYoutubeUrl('');
            setProcessingPreviewUrl(null);
        }
    };

    const handleLocalVideoClick = () => {
        setShowVideoSelector(true);
    };

    return (
        <div 
            className="p-4 sm:py-3 sm:px-6 border-b
            border-gray-300 dark:border-white/20"
        >
            <span className="flex flex-row justify-between items-center">
                <div className='w-36'>
                    <IntervalDropdown setInterval={setInterval} />
                </div>
                <div className="flex w-full justify-center items-center mx-4">
                    <h1 className="text-2xl font-bold text-center">
                        {clip.title}
                    </h1>
                </div>
                <div className="relative flex justify-center items-center space-x-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="video/*"
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                    <VideoSelector 
                        isOpen={showVideoSelector} 
                        onClose={() => setShowVideoSelector(false)} 
                    />
                    {showYoutubeInput && (
                        <form 
                            onSubmit={handleYoutubeSubmit}
                            className="absolute right-0 top-full mt-2 p-4 bg-white dark:bg-zinc-800 
                            border border-gray-300 dark:border-white/20 rounded-lg shadow-lg z-50
                            flex flex-col space-y-2 min-w-[300px]"
                        >
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-medium text-gray-900 dark:text-white">
                                    YouTube URL
                                </label>
                                <button
                                    type="button"
                                    onClick={handleYoutubeClick}
                                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
                                >
                                    <Close fontSize="small" />
                                </button>
                            </div>
                            <input
                                type="url"
                                value={youtubeUrl}
                                onChange={(e) => setYoutubeUrl(e.target.value)}
                                placeholder="https://www.youtube.com/watch?v=..."
                                disabled={isProcessing}
                                className="px-3 py-2 border border-gray-300 dark:border-white/20 
                                rounded-md text-sm bg-white dark:bg-zinc-900 text-gray-900 
                                dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            />
                            {processingStatus && (
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                    {processingStatus}
                                </p>
                            )}
                            {processingPreviewUrl && (
                                <div className="border border-gray-200 dark:border-white/10 rounded-md overflow-hidden">
                                    <video
                                        src={processingPreviewUrl}
                                        controls
                                        muted
                                        playsInline
                                        className="w-full max-h-40 bg-black"
                                    />
                                </div>
                            )}
                            <button
                                type="submit"
                                disabled={isProcessing || !youtubeUrl.trim()}
                                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 
                                disabled:cursor-not-allowed px-4 py-2 rounded text-white text-sm
                                font-medium flex items-center justify-center"
                            >
                                {isProcessing ? 'Processing...' : 'Process Video'}
                            </button>

                            <div className="pt-2 border-t border-gray-200 dark:border-white/10">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-medium text-gray-700 dark:text-gray-200">Jobs</p>
                                    <button
                                        type="button"
                                        onClick={() => void loadJobs()}
                                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                        Atualizar
                                    </button>
                                </div>
                                {jobsError && (
                                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                        {jobsError}
                                    </p>
                                )}
                                <div className="max-h-64 overflow-auto mt-2 space-y-2">
                                    {jobs.length === 0 && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            Nenhum job ainda.
                                        </p>
                                    )}
                                    {jobs.map((j) => (
                                        <div
                                            key={j.job_id}
                                            className="p-2 rounded border border-gray-200 dark:border-white/10"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                                                        {j?.video?.title || j?.url || j.job_id}
                                                    </p>
                                                    <p className="text-[11px] text-gray-600 dark:text-gray-300">
                                                        {j.status} • {j.progress}%{j.eta_seconds ? ` • ETA ${formatEta(j.eta_seconds)}` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            {j.preview_url && (
                                                <div className="mt-2 border border-gray-200 dark:border-white/10 rounded overflow-hidden">
                                                    <video
                                                        src={j.preview_url}
                                                        controls
                                                        muted
                                                        playsInline
                                                        className="w-full max-h-32 bg-black"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </form>
                    )}
                    <button
                        onClick={handleLocalVideoClick}
                        disabled={isProcessing}
                        className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 w-auto h-auto flex
                        items-center justify-center px-4 py-2 border border-transparent
                        text-base font-medium rounded text-white md:py-1 md:text-sm
                        md:px-3"
                        title="Vídeos Locais"
                    >
                        <VideoLibrary className="mr-2" />
                        <span className="hidden sm:inline">Locais</span>
                    </button>
                    <button
                        onClick={handleYoutubeClick}
                        disabled={isProcessing}
                        className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 w-auto h-auto flex
                        items-center justify-center px-4 py-2 border border-transparent
                        text-base font-medium rounded text-white md:py-1 md:text-sm
                        md:px-3"
                        title="Import from YouTube"
                    >
                        <YouTube className="mr-2" />
                        <span className="hidden sm:inline">YouTube</span>
                    </button>
                    <button
                        onClick={handleUploadClick}
                        disabled={isProcessing}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 w-auto h-auto flex
                        items-center justify-center px-4 py-2 border border-transparent
                        text-base font-medium rounded text-white md:py-1 md:text-sm
                        md:px-3"
                        title="Upload video"
                    >
                        <Upload className="mr-2" />
                        <span className="hidden sm:inline">Upload</span>
                    </button>
                    <Link 
                        href="https://github.com/ClipsAI/editor"
                        target="_blank"
                        className="bg-blue-600 hover:bg-blue-700 w-auto h-auto flex
                        items-center justify-center px-8 py-2 border border-transparent
                        text-base font-medium rounded text-white md:py-1 md:text-lg
                        md:px-2"
                    >
                        <GitHub />
                    </Link>
                </div>
            </span>
        </div>
    )
}