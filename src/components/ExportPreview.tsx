'use client'

// React
import {
    Fragment,
    ReactNode,
    MutableRefObject,
    useState,
    useRef,
    useEffect,
    useCallback,
    ChangeEvent,
} from 'react'

// Utils
import { classNames } from '@/utils/styling'

// Icons
import { Visibility as PreviewIcon } from "@mui/icons-material"
import {
    XMarkIcon as CloseIcon,
    PlayIcon as PlayMiniIcon,
    PauseIcon as PauseMiniIcon,
} from "@heroicons/react/24/solid"
import { ToolTipButton } from '@/components/ToolTip'

// Third-party Libraries
import { Dialog, Transition } from '@headlessui/react'


// ─── Preview Settings ────────────────────────────────────────────────────────

const PREVIEW_RESOLUTION = {
    width: 480,
    height: 270,
};

const PREVIEW_FPS = 30;


// ─── Export Preview Modal ────────────────────────────────────────────────────

export function ExportPreviewModal({
    open,
    setOpen,
}: {
    open: boolean,
    setOpen: SetState<boolean>,
}) {
    const cancelButtonRef = useRef<null>(null);

    return (
        <Transition.Root show={open} as={Fragment}>
            <Dialog
                as="div"
                className="relative z-50"
                initialFocus={cancelButtonRef}
                onClose={setOpen}
            >
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/80 transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 z-10 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel
                                className="relative w-full max-w-2xl transform
                                overflow-hidden rounded-2xl bg-zinc-900 shadow-2xl
                                transition-all ring-1 ring-white/10"
                            >
                                <ModalHeader
                                    setOpen={setOpen}
                                    cancelButtonRef={cancelButtonRef}
                                />
                                <ExportPreview />
                                <ModalFooter setOpen={setOpen} />
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition.Root>
    )
}


function ModalHeader({
    setOpen,
    cancelButtonRef,
}: {
    setOpen: SetState<boolean>,
    cancelButtonRef: MutableRefObject<null>,
}) {
    return (
        <div className="flex items-center justify-between px-5 pt-4 pb-3
            border-b border-white/10"
        >
            <div>
                <Dialog.Title
                    as="h3"
                    className="text-lg font-semibold leading-6 text-white"
                >
                    Export Preview
                </Dialog.Title>
                <p className="mt-0.5 text-sm text-white/50">
                    Simulates final output — runs client-side, no server needed
                </p>
            </div>
            <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-white/60 hover:text-white
                    hover:bg-white/10 transition-colors"
            >
                <CloseIcon className="h-5 w-5" />
            </button>
        </div>
    )
}


function ModalFooter({ setOpen }: { setOpen: SetState<boolean> }) {
    return (
        <div className="flex items-center justify-end px-5 py-3
            border-t border-white/10 bg-black/20"
        >
            <button
                onClick={() => setOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium
                    text-white bg-blue-600 hover:bg-blue-500 transition-colors"
            >
                Close Preview
            </button>
        </div>
    )
}


// ─── Preview Canvas Engine ───────────────────────────────────────────────────

function ExportPreview() {
    // Hidden source video element (full quality, no display)
    const sourceVideoRef = useRef<HTMLVideoElement>(null);

    // Offscreen canvas where we composite the preview
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Overlay canvas for subtitle text
    const overlayRef = useRef<HTMLCanvasElement>(null);

    // State
    const [previewReady, setPreviewReady] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [currentPreviewTime, setCurrentPreviewTime] = useState(0);
    const [previewDuration, setPreviewDuration] = useState(0);
    const [renderError, setRenderError] = useState<string | null>(null);

    // Load from global video player
    useEffect(() => {
        const videoEl = document.querySelector('video') as HTMLVideoElement | null;
        if (!videoEl || !videoEl.src) {
            setRenderError('No video loaded. Please upload a video first.');
            return;
        }

        setRenderError(null);
        setPreviewReady(false);

        // Clone source into hidden preview video
        if (sourceVideoRef.current) {
            sourceVideoRef.current.src = videoEl.src;
        }
    }, []);

    // Initialise preview canvas dimensions
    useEffect(() => {
        if (!overlayRef.current) return;
        overlayRef.current.width = PREVIEW_RESOLUTION.width;
        overlayRef.current.height = PREVIEW_RESOLUTION.height;
    }, []);

    // Draw a single frame onto canvas + overlay
    const drawFrame = useCallback(() => {
        const video = sourceVideoRef.current;
        const canvas = canvasRef.current;
        const overlay = overlayRef.current;
        if (!video || !canvas || !overlay) return;

        const ctx = canvas.getContext('2d');
        const overlayCtx = overlay.getContext('2d');
        if (!ctx || !overlayCtx) return;

        // Match canvas resolution to the preview output
        canvas.width = PREVIEW_RESOLUTION.width;
        canvas.height = PREVIEW_RESOLUTION.height;
        overlay.width = PREVIEW_RESOLUTION.width;
        overlay.height = PREVIEW_RESOLUTION.height;

        // Draw video frame — letterboxed to target resolution
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const vw = video.videoWidth || 1;
        const vh = video.videoHeight || 1;
        const targetW = PREVIEW_RESOLUTION.width;
        const targetH = PREVIEW_RESOLUTION.height;

        // Compute "contain" scaling (like CSS object-fit: contain)
        const srcAspect = vw / vh;
        const dstAspect = targetW / targetH;
        let drawW: number, drawH: number, drawX: number, drawY: number;

        if (srcAspect > dstAspect) {
            // Video is wider — fit to width, pillarbox
            drawW = targetW;
            drawH = Math.round(targetW / srcAspect);
            drawX = 0;
            drawY = Math.round((targetH - drawH) / 2);
        } else {
            // Video is taller — fit to height, letterbox
            drawH = targetH;
            drawW = Math.round(targetH * srcAspect);
            drawX = Math.round((targetW - drawW) / 2);
            drawY = 0;
        }

        ctx.drawImage(video, drawX, drawY, drawW, drawH);

        // ── Subtitle overlay (preview only) ────────────────────────────────
        overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

        // Pull active subtitle from transcript panel (if any)
        const transcriptEl = document.querySelector('[data-transcript-text]');
        if (transcriptEl) {
            const text = transcriptEl.textContent?.trim() || '';
            if (text) {
                overlayCtx.save();
                overlayCtx.fillStyle = 'rgba(0,0,0,0.7)';
                overlayCtx.roundRect(
                    10,
                    PREVIEW_RESOLUTION.height - 50,
                    PREVIEW_RESOLUTION.width - 20,
                    42,
                    6
                );
                overlayCtx.fill();

                overlayCtx.font = 'bold 16px sans-serif';
                overlayCtx.fillStyle = '#fff';
                overlayCtx.textAlign = 'center';
                overlayCtx.textBaseline = 'middle';
                overlayCtx.fillText(
                    text.substring(0, 80),
                    PREVIEW_RESOLUTION.width / 2,
                    PREVIEW_RESOLUTION.height - 28
                );
                overlayCtx.restore();
            }
        }

        // Composite overlay onto main canvas
        ctx.drawImage(overlay, 0, 0);

        setCurrentPreviewTime(video.currentTime);
    }, []);

    // Sync video events → canvas redraws
    useEffect(() => {
        const video = sourceVideoRef.current;
        if (!video) return;

        const onLoadedMetadata = () => {
            setPreviewDuration(video.duration);
            setPreviewReady(true);
        };

        const onSeeked = () => {
            drawFrame();
        };

        const onTimeUpdate = () => {
            drawFrame();
            setCurrentPreviewTime(video.currentTime);
        };

        const onPlay = () => setPlaying(true);
        const onPause = () => setPlaying(false);
        const onEnded = () => setPlaying(false);

        video.addEventListener('loadedmetadata', onLoadedMetadata);
        video.addEventListener('seeked', onSeeked);
        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('ended', onEnded);

        return () => {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('seeked', onSeeked);
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('ended', onEnded);
        };
    }, [drawFrame]);

    // Play / pause the preview video
    const togglePlay = () => {
        const video = sourceVideoRef.current;
        if (!video) return;
        if (video.paused) {
            video.play().catch(() => { });
        } else {
            video.pause();
        }
    };

    // Seek preview to a given ratio (0–1)
    const seekTo = (ratio: number) => {
        const video = sourceVideoRef.current;
        if (!video || !previewDuration) return;
        video.currentTime = ratio * previewDuration;
    };

    const elapsed = formatTime(currentPreviewTime);
    const total = formatTime(previewDuration);
    const progress = previewDuration > 0 ? (currentPreviewTime / previewDuration) * 100 : 0;

    return (
        <div className="px-5 py-4 space-y-4">
            {/* Hidden source */}
            <video
                ref={sourceVideoRef}
                className="hidden"
                crossOrigin="anonymous"
                muted
                playsInline
            />

            {/* Canvas preview */}
            <div
                className="relative mx-auto rounded-xl overflow-hidden
                    bg-black shadow-2xl"
                style={{
                    width: PREVIEW_RESOLUTION.width,
                    height: PREVIEW_RESOLUTION.height,
                }}
            >
                {renderError ? (
                    <div className="flex items-center justify-center w-full h-full
                        text-white/60 text-sm text-center p-4"
                    >
                        {renderError}
                    </div>
                ) : (
                    <>
                        <canvas
                            ref={canvasRef}
                            className="block"
                            style={{
                                width: PREVIEW_RESOLUTION.width,
                                height: PREVIEW_RESOLUTION.height,
                            }}
                        />
                        <canvas
                            ref={overlayRef}
                            className="absolute inset-0 pointer-events-none"
                        />
                        {!previewReady && (
                            <div className="absolute inset-0 flex items-center
                                justify-center bg-black/60 text-white/60 text-sm"
                            >
                                Loading preview…
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Playback controls */}
            <div className="flex items-center gap-3">
                <button
                    onClick={togglePlay}
                    disabled={!previewReady}
                    className={classNames(
                        "flex items-center justify-center w-9 h-9 rounded-full",
                        "transition-colors",
                        previewReady
                            ? "bg-blue-600 hover:bg-blue-500 text-white"
                            : "bg-white/10 text-white/30 cursor-not-allowed"
                    )}
                >
                    {playing ? (
                        <PauseMiniIcon className="h-4 w-4" />
                    ) : (
                        <PlayMiniIcon className="h-4 w-4 ml-0.5" />
                    )}
                </button>

                {/* Progress bar */}
                <div className="flex-1 relative h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                        className="absolute inset-y-0 left-0 bg-blue-500 rounded-full
                            transition-all"
                        style={{ width: `${progress}%` }}
                    />
                    <input
                        type="range"
                        min={0}
                        max={100}
                        step={0.5}
                        value={progress}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            seekTo(e.currentTarget.valueAsNumber / 100)
                        }
                        className="absolute inset-0 w-full opacity-0 cursor-pointer"
                    />
                </div>

                <span className="text-xs text-white/60 tabular-nums min-w-[3.5rem] text-right">
                    {elapsed} / {total}
                </span>
            </div>

            {/* Quality / performance notice */}
            <div className="flex items-start gap-2.5 rounded-xl bg-blue-900/30
                border border-blue-500/30 px-4 py-3"
            >
                <InfoIcon className="flex-shrink-0 mt-0.5 text-blue-400" />
                <div className="text-xs text-blue-200/80 leading-relaxed">
                    <span className="font-semibold text-blue-300">Performance Preview — </span>
                    This canvas renders at{' '}
                    <span className="font-semibold">{PREVIEW_RESOLUTION.width}×{PREVIEW_RESOLUTION.height}</span>{' '}
                    ({PREVIEW_FPS} fps max) to keep playback smooth in the browser.{' '}
                    <span className="text-blue-300">
                        The final FFmpeg export will render at full resolution
                        with higher quality settings.
                    </span>
                </div>
            </div>
        </div>
    );
}


// ─── Preview Button (integrates into VideoControls) ─────────────────────────

export function PreviewExportButton({
    onClick,
}: {
    onClick: () => void,
}) {
    return (
        <ToolTipButton
            tooltipText="Preview Export"
            buttonClass="rounded hover:bg-gray-200"
            tooltipClass="w-24 bottom-9 bg-blue-600"
            OnClick={onClick}
        >
            <PreviewIcon
                sx={{ fontSize: 24 }}
                className="text-blue-600 hover:text-blue-700
                    dark:text-white/90 dark:hover:text-white/80"
            />
        </ToolTipButton>
    )
}


// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
    if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function InfoIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            width="16"
            height="16"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
        </svg>
    );
}
