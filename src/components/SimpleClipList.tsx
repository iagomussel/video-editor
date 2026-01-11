'use client'

import { useMemo, useState } from 'react';

import { useVideo } from '@/hooks/video';
import { useTrimmer } from '@/hooks/trimmer';
import { useTranscript } from '@/hooks/transcript';
import { useResizer } from '@/hooks/resizer';

import { convertToDuration, convertToTime } from '@/utils/time';

function classNames(...classes: Array<string | false | undefined | null>) {
    return classes.filter(Boolean).join(' ');
}

export function SimpleClipList() {
    const { clip, clips, setClip, setCurrentTime, play } = useVideo();
    const { resetTrim } = useTrimmer();
    const { updateCurrentWord, setTranscriptState } = useTranscript();
    const { setFrame } = useResizer();

    const [query, setQuery] = useState('');

    const visibleClips = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return clips.filter((c) => !c.deleted);
        return clips.filter((c) => !c.deleted && (c.title || '').toLowerCase().includes(q));
    }, [clips, query]);

    const onSelect = async (c: Clip) => {
        setClip(c);
        setFrame(c.start_time);
        setCurrentTime(c.start_time);
        resetTrim(c.start_time, c.end_time);
        updateCurrentWord(c.start_time);
        setTranscriptState(c.start_char, c.start_char, c.end_char, c.end_char);
        await play();
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Clips</h2>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                        {visibleClips.length} itens
                    </p>
                </div>
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por título…"
                    className="w-56 max-w-[50%] px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white"
                />
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
                <ul className="max-h-[360px] overflow-auto divide-y divide-gray-200 dark:divide-white/10 bg-white dark:bg-zinc-900">
                    {visibleClips.length === 0 ? (
                        <li className="p-4 text-sm text-gray-600 dark:text-gray-400">
                            Nenhum clip encontrado.
                        </li>
                    ) : (
                        visibleClips.map((c) => {
                            const selected = c.id === clip?.id;
                            const duration = convertToDuration(Math.round(c.end_time - c.start_time));
                            const range = `${convertToTime(c.start_time)} - ${convertToTime(c.end_time)}`;

                            return (
                                <li key={c.id}>
                                    <button
                                        type="button"
                                        onClick={() => void onSelect(c)}
                                        className={classNames(
                                            'w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-white/5',
                                            selected && 'bg-blue-50 dark:bg-blue-900/20'
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                    {c.title || 'Sem título'}
                                                </p>
                                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                                    {duration} • {range}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            );
                        })
                    )}
                </ul>
            </div>
        </div>
    );
}

