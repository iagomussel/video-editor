'use client'

// Data
import { intervals } from '@/data/clips'
import { video as video_data } from '@/data/video'
import { transcript } from '@/data/transcript'

// React
import { ReactNode, createContext, useState, useRef, MutableRefObject, useEffect } from 'react'

// Utils
import { filterClips } from '@/utils/clips'

// Third-party Libraries
import { useImmer, Updater } from 'use-immer'
import { init } from 'next/dist/compiled/webpack/webpack'


type VideoContextType = {
    videoPlayer: MutableRefObject<HTMLVideoElement | null>,
    clip: Clip,
    setClip: Updater<Clip>,
    clips: Clip[],
    setClips: Updater<Clip[]>,
    video: Video,
    setVideo: Updater<Video>,
    muted: boolean,
    setMuted: SetState<boolean>,
    paused: boolean,
    setPaused: SetState<boolean>,
    currentTime: number,
    setTime: SetState<number>,
}

// Default empty clip for context default value
const defaultContextClip: Clip = {
    id: "default-clip",
    object: "clip",
    created: Math.floor(Date.now() / 1000),
    start_time: 0,
    end_time: 0,
    start_char: 0,
    end_char: 0,
    video_id: video_data.id,
    favorited: false,
    deleted: false,
    scores: {
        embedding_norm: 0
    },
    title: video_data.title,
};

export const VideoContext = createContext<VideoContextType>({
    videoPlayer: { current: null },
    clip: defaultContextClip,
    setClip: async () => undefined,
    clips: [],
    setClips: async () => undefined,
    video: video_data,
    setVideo: async () => undefined,
    muted: false,
    setMuted: () => { },
    paused: true,
    setPaused: () => { },
    currentTime: 0,
    setTime: () => { },
});

export function VideoProvider({ children }: { children: ReactNode }) {
    const videoPlayer = useRef<HTMLVideoElement | null>(null);

    // Create default empty clip if no clips available
    const defaultClip: Clip = {
        id: "default-clip",
        object: "clip",
        created: Math.floor(Date.now() / 1000),
        start_time: 0,
        end_time: 0,
        start_char: 0,
        end_char: 0,
        video_id: video_data.id,
        favorited: false,
        deleted: false,
        scores: {
            embedding_norm: 0
        },
        title: video_data.title,
    };

    const initClip = video_data.clips.length > 0 
        ? (filterClips(video_data.clips, intervals[0], transcript)[0] || video_data.clips[0])
        : defaultClip;

    const [clip, setClip] = useImmer<Clip>(initClip);
    const [video, setVideo] = useImmer<Video>(video_data);
    const [clips, setClips] = useImmer<Clip[]>(video_data.clips);

    const [muted, setMuted] = useState<boolean>(false);
    const [paused, setPaused] = useState<boolean>(true);
    const [currentTime, setTime] = useState<number>(initClip?.start_time || 0);

    // Update clips when video changes
    useEffect(() => {
        if (video.clips.length === 0) {
            setClips([]);
            // Create a default clip that spans the entire video
            const defaultClip: Clip = {
                id: `default-${video.id}`,
                object: "clip",
                created: Math.floor(Date.now() / 1000),
                start_time: 0,
                end_time: video.metadata.duration,
                start_char: 0,
                end_char: 0,
                video_id: video.id,
                favorited: false,
                deleted: false,
                scores: {
                    embedding_norm: 0
                },
                title: video.title,
            };
            setClip(defaultClip);
            setTime(0);
        } else {
            setClips(video.clips);
            const filtered = filterClips(video.clips, intervals[0], transcript);
            if (filtered.length > 0) {
                setClip(filtered[0]);
                setTime(filtered[0].start_time);
            } else if (video.clips.length > 0) {
                setClip(video.clips[0]);
                setTime(video.clips[0].start_time);
            }
        }
    }, [video]);

    useEffect(() => {
        if (videoPlayer.current) {
            videoPlayer.current.currentTime = currentTime;
        }
    }, []);

    const clipInfo = {
        videoPlayer,
        clip, setClip,
        clips, setClips,
        video, setVideo,
        muted, setMuted,
        paused, setPaused,
        currentTime, setTime,
    };

    return (
        <VideoContext.Provider value={clipInfo}>
            {children}
        </VideoContext.Provider>
    )
}