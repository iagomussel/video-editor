'use client'

import { useEffect, useRef, useState } from 'react';

import { useVideo } from '@/hooks/video';
import { useTranscript } from '@/hooks/transcript';

type Job = {
    job_id: string;
    status: string;
    progress: number;
    message?: string;
    error?: string;
    eta_seconds?: number | null;
    preview_url?: string | null;
    video?: {
        title?: string;
        duration?: number;
        thumbnail?: string;
        path?: string | null;
    };
};

function formatEta(seconds: any) {
    if (typeof seconds !== 'number' || !isFinite(seconds) || seconds <= 0) return '';
    const s = Math.round(seconds);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
}

export function YouTubeImportPanel() {
    const { setVideo, setClips } = useVideo();
    const { setTranscript } = useTranscript();

    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [busy, setBusy] = useState(false);
    const [statusText, setStatusText] = useState<string>('');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [jobsError, setJobsError] = useState<string | null>(null);

    const activeJobIdRef = useRef<string | null>(null);
    const pollTimerRef = useRef<number | null>(null);

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

    useEffect(() => {
        void loadJobs();
        return () => {
            if (pollTimerRef.current !== null) {
                window.clearTimeout(pollTimerRef.current);
                pollTimerRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const startProcessing = async () => {
        if (!youtubeUrl.trim()) return;

        setBusy(true);
        setStatusText('Iniciando…');
        setPreviewUrl(null);

        try {
            const startResponse = await fetch('/api/youtube/process/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: youtubeUrl, max_duration: 30.0 }),
            });
            if (!startResponse.ok) {
                const err = await startResponse.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to start processing');
            }
            const { job_id } = await startResponse.json();
            activeJobIdRef.current = job_id;
            await loadJobs();

            const poll = async () => {
                const jobId = activeJobIdRef.current;
                if (!jobId) return;

                try {
                    const statusResponse = await fetch(`/api/youtube/process/status/${jobId}`);
                    if (!statusResponse.ok) {
                        throw new Error('Failed to get job status');
                    }
                    const status = await statusResponse.json();

                    const eta = formatEta(status.eta_seconds);
                    setStatusText(`${status.message || status.status} (${status.progress || 0}%)${eta ? ` • ETA ${eta}` : ''}`);

                    if (status.preview_url) setPreviewUrl(status.preview_url);
                    await loadJobs();

                    if (status.status === 'completed') {
                        setStatusText('Finalizando…');
                        const resultResponse = await fetch(`/api/youtube/process/result/${jobId}`);
                        if (!resultResponse.ok) {
                            throw new Error('Failed to get job result');
                        }
                        const data = await resultResponse.json();
                        setVideo(data.video);
                        setClips(data.video?.clips || []);
                        if (data.transcript) setTranscript(data.transcript);

                        setStatusText('Concluído!');
                        setBusy(false);
                        activeJobIdRef.current = null;
                        setYoutubeUrl('');
                        setTimeout(() => setStatusText(''), 1500);
                        return;
                    }

                    if (status.status === 'failed') {
                        throw new Error(status.error || status.message || 'Processing failed');
                    }

                    pollTimerRef.current = window.setTimeout(poll, 1500);
                } catch (e: any) {
                    setBusy(false);
                    activeJobIdRef.current = null;
                    setStatusText('');
                    throw e;
                }
            };

            await poll();
        } catch (e: any) {
            setBusy(false);
            setStatusText('');
            alert(`Erro: ${e.message || 'Falha ao processar YouTube'}`);
        }
    };

    return (
        <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-4">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">YouTube</h2>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Cole um link e processe com ClipsAI.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => void loadJobs()}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                    Atualizar jobs
                </button>
            </div>

            <div className="mt-3 flex gap-2">
                <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=…"
                    disabled={busy}
                    className="flex-1 px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white"
                />
                <button
                    type="button"
                    onClick={() => void startProcessing()}
                    disabled={busy || !youtubeUrl.trim()}
                    className="px-3 py-2 text-sm rounded-md bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white"
                >
                    {busy ? 'Processando…' : 'Processar'}
                </button>
            </div>

            {statusText && (
                <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">{statusText}</p>
            )}

            {previewUrl && (
                <div className="mt-3 rounded-md overflow-hidden border border-gray-200 dark:border-white/10">
                    <video src={previewUrl} controls muted playsInline className="w-full max-h-40 bg-black" />
                </div>
            )}

            <div className="mt-4">
                <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-200">Jobs recentes</p>
                    {jobsError && (
                        <p className="text-xs text-red-600 dark:text-red-400">{jobsError}</p>
                    )}
                </div>
                <div className="mt-2 max-h-64 overflow-auto space-y-2">
                    {jobs.length === 0 ? (
                        <p className="text-xs text-gray-600 dark:text-gray-400">Nenhum job ainda.</p>
                    ) : (
                        jobs.map((j) => (
                            <div key={j.job_id} className="rounded-md border border-gray-200 dark:border-white/10 p-2">
                                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                                    {j?.video?.title || j.job_id}
                                </p>
                                <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">
                                    {j.status} • {j.progress}%{j.eta_seconds ? ` • ETA ${formatEta(j.eta_seconds)}` : ''}
                                </p>
                                {j.preview_url && (
                                    <div className="mt-2 rounded overflow-hidden border border-gray-200 dark:border-white/10">
                                        <video src={j.preview_url} controls muted playsInline className="w-full max-h-28 bg-black" />
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

