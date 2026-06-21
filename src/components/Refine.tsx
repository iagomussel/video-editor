'use client'

import { useState } from 'react'
import { classNames } from '@/utils/styling'
import { useVideo } from '@/hooks/video'
import { useTranscript } from '@/hooks/transcript'
import { Slider, Switch, CircularProgress } from '@mui/material'

interface RefinePanelProps {
    onRefineComplete?: (refinedClips: any[]) => void
}

export function RefinePanel({ onRefineComplete }: RefinePanelProps) {
    const { clips, setClips } = useVideo()
    const { transcript } = useTranscript()
    
    const [removeSilences, setRemoveSilences] = useState(true)
    const [removeFillers, setRemoveFillers] = useState(true)
    const [silenceThreshold, setSilenceThreshold] = useState(0.3)
    const [isRefining, setIsRefining] = useState(false)
    const [showPanel, setShowPanel] = useState(false)
    const [stats, setStats] = useState<{
        silencesRemoved: number
        fillersRemoved: number
        originalDuration: number
        refinedDuration: number
    } | null>(null)

    const handleRefine = async () => {
        if (clips.length === 0) return
        
        setIsRefining(true)
        setStats(null)
        
        try {
            // Prepare words from transcript
            const words = transcript.words?.map(w => ({
                start_time: w.start_time,
                end_time: w.end_time,
                text: transcript.transcription?.substring(w.start_char, w.end_char) || ''
            })) || []
            
            const response = await fetch('/api/clips/refine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clips: clips.filter(c => !c.deleted),
                    words,
                    remove_silences: removeSilences,
                    remove_fillers: removeFillers,
                    silence_threshold: silenceThreshold,
                }),
            })
            
            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to refine clips')
            }
            
            const result = await response.json()
            
            // Update stats for display
            setStats({
                silencesRemoved: result.stats?.silences_removed || 0,
                fillersRemoved: result.stats?.fillers_removed || 0,
                originalDuration: result.original_duration || 0,
                refinedDuration: result.refined_duration || 0,
            })
            
            // Update clips with refined versions
            setClips((draftClips: Clip[]) => {
                result.refined_clips.forEach((refinedClip: any) => {
                    const index = draftClips.findIndex((c: Clip) => c.id === refinedClip.id)
                    if (index !== -1) {
                        // Preserve clip properties but update timing
                        draftClips[index] = {
                            ...draftClips[index],
                            start_time: refinedClip.start_time,
                            end_time: refinedClip.end_time,
                            // Store refinement metadata
                            refined: true,
                            removed_silences: refinedClip.removed_silences,
                            removed_filler_count: refinedClip.removed_filler_count,
                            total_removed_seconds: refinedClip.total_removed_seconds,
                        }
                    }
                })
            })
            
            // Notify parent component
            if (onRefineComplete) {
                onRefineComplete(result.refined_clips)
            }
        } catch (error: any) {
            console.error('Error refining clips:', error)
            alert(`Error refining clips: ${error.message}`)
        } finally {
            setIsRefining(false)
        }
    }

    const resetRefinement = () => {
        setClips((draftClips: Clip[]) => {
            draftClips.forEach((clip: any) => {
                // Reset to original timings if they were refined
                if (clip.refined && clip.original_start_time !== undefined) {
                    clip.start_time = clip.original_start_time
                    clip.end_time = clip.original_end_time
                    clip.refined = false
                    delete clip.removed_silences
                    delete clip.removed_filler_count
                    delete clip.total_removed_seconds
                }
            })
        })
        setStats(null)
    }

    if (!showPanel) {
        return (
            <button
                onClick={() => setShowPanel(true)}
                className={classNames(
                    "flex items-center gap-2 px-3 py-2 rounded-lg",
                    "bg-blue-600 text-white hover:bg-blue-700",
                    "text-sm font-medium transition-colors"
                )}
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M19 6a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V6z" />
                </svg>
                Refine Clips
            </button>
        )
    }

    return (
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-lg p-4 mb-4 border border-gray-200 dark:border-white/20">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Refine Clips
                </h3>
                <button
                    onClick={() => setShowPanel(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            
            <div className="space-y-4">
                {/* Remove Silences Toggle */}
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Remove Silences
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Automatically cut out pauses and gaps
                        </p>
                    </div>
                    <Switch
                        checked={removeSilences}
                        onChange={(e) => setRemoveSilences(e.target.checked)}
                        color="primary"
                        size="small"
                    />
                </div>
                
                {/* Silence Threshold Slider */}
                {removeSilences && (
                    <div className="pl-4 border-l-2 border-blue-200 dark:border-blue-800">
                        <label className="text-xs text-gray-600 dark:text-gray-400">
                            Silence threshold: {silenceThreshold.toFixed(1)}s
                        </label>
                        <Slider
                            value={silenceThreshold}
                            onChange={(_, value) => setSilenceThreshold(value as number)}
                            min={0.1}
                            max={1.0}
                            step={0.1}
                            marks={[
                                { value: 0.1, label: '0.1s' },
                                { value: 0.5, label: '0.5s' },
                                { value: 1.0, label: '1.0s' },
                            ]}
                            size="small"
                            className="mt-1"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Gaps longer than this will be removed
                        </p>
                    </div>
                )}
                
                {/* Remove Fillers Toggle */}
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Remove Filler Words
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Remove "uh", "um", "like", etc.
                        </p>
                    </div>
                    <Switch
                        checked={removeFillers}
                        onChange={(e) => setRemoveFillers(e.target.checked)}
                        color="primary"
                        size="small"
                    />
                </div>
                
                {/* Filler Words Reference */}
                {removeFillers && (
                    <div className="pl-4 border-l-2 border-blue-200 dark:border-blue-800">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Detects: uh, um, uhm, ah, er, eh, like, you know, i mean
                        </p>
                    </div>
                )}
                
                {/* Stats Display */}
                {stats && (
                    <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
                            Refinement Results
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                                <span className="text-gray-600 dark:text-gray-400">Silences removed:</span>
                                <span className="ml-2 font-medium text-blue-700 dark:text-blue-300">
                                    {stats.silencesRemoved}
                                </span>
                            </div>
                            <div>
                                <span className="text-gray-600 dark:text-gray-400">Fillers removed:</span>
                                <span className="ml-2 font-medium text-blue-700 dark:text-blue-300">
                                    {stats.fillersRemoved}
                                </span>
                            </div>
                            <div>
                                <span className="text-gray-600 dark:text-gray-400">Original duration:</span>
                                <span className="ml-2 font-medium text-blue-700 dark:text-blue-300">
                                    {stats.originalDuration.toFixed(1)}s
                                </span>
                            </div>
                            <div>
                                <span className="text-gray-600 dark:text-gray-400">Refined duration:</span>
                                <span className="ml-2 font-medium text-blue-700 dark:text-blue-300">
                                    {stats.refinedDuration.toFixed(1)}s
                                </span>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Action Buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={handleRefine}
                        disabled={isRefining || clips.length === 0}
                        className={classNames(
                            "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg",
                            "text-sm font-medium transition-colors",
                            isRefining || clips.length === 0
                                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                : "bg-blue-600 text-white hover:bg-blue-700"
                        )}
                    >
                        {isRefining ? (
                            <>
                                <CircularProgress size={16} color="inherit" />
                                Refining...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                        d="M5 13l4 4L19 7" />
                                </svg>
                                Apply Refinement
                            </>
                        )}
                    </button>
                    
                    {stats && (
                        <button
                            onClick={resetRefinement}
                            className={classNames(
                                "px-4 py-2 rounded-lg text-sm font-medium",
                                "bg-gray-200 text-gray-700 hover:bg-gray-300",
                                "dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                            )}
                        >
                            Reset
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
