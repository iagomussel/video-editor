'use client'

// React
import { useState } from 'react'

// Icons
import { PlayArrow, Upload, YouTube, AutoAwesome } from '@mui/icons-material'

// Hooks
import { useVideo } from '@/hooks/video'

export function DemoLanding() {
    const { video } = useVideo();
    const [showInstructions, setShowInstructions] = useState(false);

    // Show landing page only if no video is loaded (empty/default state)
    // This provides a welcome screen similar to clipsai.com
    const isEmptyVideo = !video.source || video.source === "" || video.id === "empty-video";

    if (!isEmptyVideo) {
        return null; // Hide landing when user has uploaded/imported their own video
    }

    return (
        <div className="w-full min-h-[400px] flex flex-col items-center justify-center p-8 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-zinc-900 dark:to-zinc-800 rounded-lg border border-gray-200 dark:border-white/10">
            <div className="max-w-2xl w-full text-center space-y-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-center space-x-2">
                        <AutoAwesome className="text-4xl text-blue-600 dark:text-blue-400" />
                        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                            ClipsAI Video Editor
                        </h1>
                    </div>
                    <p className="text-lg text-gray-600 dark:text-gray-300">
                        Automatically convert longform videos into clips using AI-powered transcription and intelligent segmentation
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                    <div className="bg-white dark:bg-zinc-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-white/10">
                        <YouTube className="text-3xl text-red-600 mb-3" />
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                            Import from YouTube
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Paste a YouTube URL to automatically download, transcribe, and generate clips
                        </p>
                    </div>

                    <div className="bg-white dark:bg-zinc-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-white/10">
                        <Upload className="text-3xl text-green-600 mb-3" />
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                            Upload Video
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Upload your own video files to create and edit clips with AI assistance
                        </p>
                    </div>

                    <div className="bg-white dark:bg-zinc-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-white/10">
                        <PlayArrow className="text-3xl text-blue-600 mb-3" />
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                            Try Demo
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Explore the demo video below to see how ClipsAI automatically segments content
                        </p>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-white/10">
                    <button
                        onClick={() => setShowInstructions(!showInstructions)}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                        {showInstructions ? 'Hide' : 'Show'} Quick Start Guide
                    </button>

                    {showInstructions && (
                        <div className="mt-4 text-left bg-white dark:bg-zinc-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-white/10">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                                Quick Start Guide
                            </h3>
                            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                <li>Click the <strong className="text-gray-900 dark:text-white">YouTube</strong> button to import a video from YouTube, or <strong className="text-gray-900 dark:text-white">Upload</strong> a local video file</li>
                                <li>Wait for the video to be processed - ClipsAI will automatically transcribe and generate clips</li>
                                <li>Browse the generated clips in the left sidebar and click any clip to play it</li>
                                <li>Use the search bar to find clips by keywords</li>
                                <li>Adjust the trim handles to fine-tune clip boundaries</li>
                                <li>Switch between 16:9 and 9:16 aspect ratios using the resize toggle</li>
                            </ol>
                            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                                <p className="text-xs text-blue-800 dark:text-blue-300">
                                    <strong>Note:</strong> For YouTube imports, ensure <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">yt-dlp</code> and <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">clipsai</code> are installed on your server. See README for setup instructions.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
