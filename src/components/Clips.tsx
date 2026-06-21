// Components
import { Search } from '@/components/Search'
import { VideoPlayer } from '@/components/Video'
import { OptionsMenu, Option } from '@/components/Options'
import { RenameModal, DeleteModal } from '@/components/Modal'
import { ResizeToggle } from '@/components/Resize'
import { RefinePanel } from '@/components/Refine'

// Hooks
import { useVideo } from '@/hooks/video'
import { useResizer } from '@/hooks/resizer'
import { useTrimmer } from '@/hooks/trimmer'
import { useTranscript } from '@/hooks/transcript'

// Icons
import { Stars as StarIcon, Delete, EditNote } from '@mui/icons-material'
import { EllipsisVerticalIcon } from '@heroicons/react/24/solid'

// React
import { useState } from 'react'

// Utils
import { filterClips } from '@/utils/clips'
import { convertToDuration, convertToTime } from '@/utils/time'
import { classNames } from '@/utils/styling'


export function ClipEditor({ interval }: { interval: Interval }) {
    const [query, setQuery] = useState("");

    return (
        <div className="flex flex-col w-full justify-between p-4 sm:p-6">
            <div className="flex w-full mb-4 space-x-4">
                <Search setQuery={setQuery} placeholder="Search using keywords" />
                <ResizeToggle />
                <RefinePanel />
            </div>
            <div className="grid gap-x-6 grid-cols-3">
                <Clips query={query} interval={interval} />
                <div className="col-span-2">
                    <VideoPlayer />
                </div>
            </div>
        </div>
    )
}


function Clips({ query, interval }: { query: string, interval: Interval }) {
    const { clip, clips } = useVideo();
    const { transcript } = useTranscript();

    const filteredClips = filterClips(clips, interval, transcript, query);

    return (
        <div className="flex flex-col">
            <div
                className="basis-0 grow border border-gray-300 dark:border-white/20
                rounded-xl overflow-scroll scrollbar-hide"
            >
                <ul className="w-full p-4 mx-auto space-y-3">
                    {filteredClips.map((filteredClip) => (
                        <ClipCard
                            key={filteredClip.id}
                            clip={filteredClip}
                            selected={clip && clip.id === filteredClip.id}
                        />
                    ))}
                </ul>
            </div>
        </div>
    );
}


function ClipCard({ clip, selected }: { clip: Clip, selected: boolean }) {
    const { setFrame } = useResizer();
    const { resetTrim } = useTrimmer();
    const { updateCurrentWord, setTranscriptState } = useTranscript();
    const { videoPlayer, play, setClip, setClips, setCurrentTime } = useVideo();

    const [openRenameModal, setOpenRenameModal] = useState(false);
    const [openDeleteModal, setOpenDeleteModal] = useState(false);

    async function handlePlay() {
        if (!videoPlayer.current || !clip.id) {
            return;
        }

        const { start_time, end_time, start_char, end_char } = clip;

        setClip(clip);
        setFrame(start_time);
        setCurrentTime(start_time);
        resetTrim(start_time, end_time);
        updateCurrentWord(start_time);
        setTranscriptState(start_char, start_char, end_char, end_char);

        await play();
    }

    const handleRename = (newTitle: string) => {
        setClip((draftClip: Clip) => {
            draftClip.title = newTitle;
        });
        setClips((draftClips: Clip[]) => {
            const index = draftClips.findIndex((draft: Clip) => draft.id === clip.id);
            draftClips[index].title = newTitle;
        });
        setOpenRenameModal(false);
    }

    const handleDelete = () => {
        setClips((draftClips: Clip[]) => {
            const index = draftClips.findIndex((draft: Clip) => draft.id === clip.id);
            draftClips[index].deleted = true;
        });
        setOpenDeleteModal(false);
    }

    return (
        <div
            id="clip-card"
            key={clip.id}
            onClick={handlePlay}
            className={classNames(
                selected 
                    ? "bg-blue-600 text-white"
                    : "bg-blue-50/50 dark:bg-zinc-800",
                "flex justify-between items-center space-x-2.5 p-3 cursor-pointer",
                "border rounded-xl shadow-sm hover:border-1.5 hover:border-blue-600",
                "dark:border-white/20"
            )}
        >
            <ClipInfo clip={clip} selected={selected} />
            <OptionsButton
                clip={clip}
                selected={selected}
                setOpenRenameModal={setOpenRenameModal}
                setOpenDeleteModal={setOpenDeleteModal}
            />
            <RenameModal
                open={openRenameModal}
                setOpen={setOpenRenameModal}
                prevName={clip.title}
                rename={handleRename}
            />
            <DeleteModal
                open={openDeleteModal}
                setOpen={setOpenDeleteModal}
                title={clip.title}
                deleteClip={handleDelete}
            />
        </div>
    )
}


function ClipInfo({ clip, selected }: { clip: Clip; selected: boolean }) {
    const startTime = convertToTime(clip.start_time);
    const endTime = convertToTime(clip.end_time);
    const duration = convertToDuration(Math.round(clip.end_time - clip.start_time))

    // Calculate refined info
    const hasRefinement = clip.refined || clip.removed_silences?.length || clip.removed_filler_count;
    const refinedDuration = clip.total_removed_seconds 
        ? convertToDuration(Math.round((clip.end_time - clip.start_time + clip.total_removed_seconds)))
        : null;

    return (
        <div
            className="flex-1 flex-col justify-between
            min-w-0 text-[0.825rem]/[1.15rem]"
        >
            <div className="flex flex-row items-center space-x-1">
                {clip.favorited && (
                    <StarIcon
                        sx={{ fontSize: 15 }}
                        className={classNames(
                            "mb-1",
                            selected ? "text-white" : "text-blue-600"
                        )}
                    />
                )}
                <p className={classNames(
                    "truncate font-bold mb-1",
                    selected 
                        ? 'text-white'
                        : 'text-gray-900 dark:text-white/90'
                )}>
                    {clip.title}
                </p>
                {hasRefinement && (
                    <span className={classNames(
                        "inline-flex items-center px-1.5 py-0.5 rounded text-[0.65rem] font-medium",
                        selected 
                            ? 'bg-blue-700 text-white' 
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                    )}>
                        Refined
                    </span>
                )}
            </div>
            <span className={classNames(
                "inline",
                selected 
                ? 'text-sky-100' 
                : 'text-gray-900 dark:text-sky-100'
            )}>
                <span>{duration}</span>
                {" "}<span aria-hidden="true">|</span>{" "}
                <span>{`${startTime} - ${endTime}`}</span>
                {hasRefinement && (
                    <>
                        {" "}<span aria-hidden="true">|</span>{" "}
                        <span className="text-green-600 dark:text-green-400" title="Time saved by removing silences/fillers">
                            -{clip.total_removed_seconds?.toFixed(1) || '?'}s
                        </span>
                    </>
                )}
            </span>
        </div>
    );
}


function OptionsButton({
    clip,
    selected,
    setOpenRenameModal,
    setOpenDeleteModal
}: {
    clip: Clip,
    selected: boolean,
    setOpenRenameModal: SetState<boolean>,
    setOpenDeleteModal: SetState<boolean>,
}) {
    const { setClips } = useVideo();
    const { transcript } = useTranscript();

    const handleRefineClip = async (event: any) => {
        event.stopPropagation();
        
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
                    clips: [clip],
                    words,
                    remove_silences: true,
                    remove_fillers: true,
                    silence_threshold: 0.3,
                }),
            })
            
            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to refine clip')
            }
            
            const result = await response.json()
            
            if (result.refined_clips?.length > 0) {
                const refinedClip = result.refined_clips[0]
                setClips((draftClips: Clip[]) => {
                    const index = draftClips.findIndex((draft: Clip) => draft.id === clip.id)
                    if (index !== -1) {
                        draftClips[index] = {
                            ...draftClips[index],
                            start_time: refinedClip.start_time,
                            end_time: refinedClip.end_time,
                            refined: true,
                            removed_silences: refinedClip.removed_silences,
                            removed_filler_count: refinedClip.removed_filler_count,
                            total_removed_seconds: refinedClip.total_removed_seconds,
                        }
                    }
                })
            }
        } catch (error: any) {
            console.error('Error refining clip:', error)
            alert(`Error refining clip: ${error.message}`)
        }
    }

    const handleResetClip = (event: any) => {
        event.stopPropagation();
        setClips((draftClips: Clip[]) => {
            const index = draftClips.findIndex((draft: Clip) => draft.id === clip.id)
            if (index !== -1 && draftClips[index].original_start_time !== undefined) {
                draftClips[index].start_time = draftClips[index].original_start_time!
                draftClips[index].end_time = draftClips[index].original_end_time!
                draftClips[index].refined = false
                delete draftClips[index].removed_silences
                delete draftClips[index].removed_filler_count
                delete draftClips[index].total_removed_seconds
            }
        })
    }

    const options: Option[] = [
        {
            id: 1,
            name: clip.favorited ? "Unfavorite" : "Favorite",
            icon: <StarIcon fontSize="small" className="mt-0.5 mr-2 text-blue-600" />,
            handleClick: (event: any) => {
                event.stopPropagation();
                setClips((draftClips: Clip[]) => {
                    const index = draftClips.findIndex((draft: Clip) =>
                        draft.id === clip.id
                    );
                    draftClips[index].favorited = !draftClips[index].favorited;
                });
            }
        },
        {
            id: 2,
            name: clip.refined ? "Reset Refinement" : "Remove Silences & Fillers",
            icon: (
                <svg className="mr-2 text-blue-600" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M19 6a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V6z" />
                </svg>
            ),
            handleClick: clip.refined ? handleResetClip : handleRefineClip,
        },
        {
            id: 3,
            name: "Rename",
            icon: <EditNote className="mr-2 text-blue-600" />,
            handleClick: (event: any) => {
                event.stopPropagation();
                setOpenRenameModal(true);
            }
        },
        {
            id: 4,
            name: "Delete",
            icon: <Delete fontSize="small" className="mt-0.5 mr-2 text-blue-600" />,
            handleClick: (event: any) => {
                event.stopPropagation();
                setOpenDeleteModal(true);
            }
        },
    ]

    return (
        <OptionsMenu
            options={options}
            buttonIcon={
                <div
                    className={classNames(
                        selected
                            ? "hover:bg-blue-700"
                            : "hover:bg-blue-100 dark:hover:bg-white/10",
                            "p-0.5 rounded-full focus:outline-none"
                    )}
                >
                    <EllipsisVerticalIcon
                        aria-hidden="true"
                        className={classNames(
                            selected 
                            ? "text-white" 
                            : "text-gray-900 dark:text-white/90", 
                            "h-5 w-5"
                        )}
                    />
                </div>
            }
        />
    )
}
