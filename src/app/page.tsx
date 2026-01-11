'use client'

import { useState } from 'react';

import { VideoSelector } from '@/components/VideoSelector';
import { SimpleVideoPlayer } from '@/components/SimpleVideoPlayer';
import { SimpleClipList } from '@/components/SimpleClipList';
import { Transcription } from '@/components/Transcription';
import { YouTubeImportPanel } from '@/components/YouTubeImportPanel';
import { UploadPanel } from '@/components/UploadPanel';

export default function Demo() {
    const [showVideoSelector, setShowVideoSelector] = useState(false);

    return (
        <div className="w-full">
            <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-800 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-white/10">
                    <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                            <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                                ClipsAI Demo
                            </h1>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                UI simples para importar vídeos, acompanhar jobs e navegar nos clips.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowVideoSelector(true)}
                            className="px-3 py-2 text-sm rounded-md bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            Vídeos locais
                        </button>
                    </div>
                </div>

                <div className="p-4 sm:p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
                        <aside className="flex flex-col gap-4">
                            <UploadPanel />
                            <YouTubeImportPanel />
                        </aside>

                        <main className="flex flex-col gap-6">
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                <SimpleVideoPlayer />
                                <SimpleClipList />
                            </div>
                            <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900">
                                <Transcription />
                            </div>
                        </main>
                    </div>
                </div>
            </div>

            <VideoSelector
                isOpen={showVideoSelector}
                onClose={() => setShowVideoSelector(false)}
            />
        </div>
    );
}
