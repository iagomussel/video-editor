// React
import { ReactNode, createContext, useState, useRef, MutableRefObject } from 'react'

// Data
import { crops as crops_data } from '@/data/crops'

// Hooks
import { useVideoContext } from '@/hooks/video'

// Utils
import { getSegmentIndex } from '@/utils/crops'

// Third-party Libraries
import { useImmer, Updater } from 'use-immer'


type ResizerContextType = {
    crops: Crops,
    setCrops: Updater<Crops>,
    resizeLeft: number,
    setResizeLeft: SetState<number>,
    resizeMode: ResizeMode,
    setResizeMode: SetState<ResizeMode>,
    segments: Segment[],
    setSegments: Updater<Segment[]>,
    currentSegment: MutableRefObject<Segment>,
}

const defaultSegment: Segment = {
    speakers: [],
    start_time: 0,
    end_time: 0,
    x: 0,
    y: 0,
};

export const ResizerContext = createContext<ResizerContextType>({
    crops: crops_data,
    setCrops: async () => undefined,
    resizeLeft: 0,
    setResizeLeft: () => { },
    resizeMode: "9:16",
    setResizeMode: () => { },
    segments: [],
    setSegments: () => { },
    currentSegment: { 
        current: crops_data.segments.length > 0 ? crops_data.segments[0] : defaultSegment 
    },
});

export function ResizerProvider({ children }: { children: ReactNode }) {
    const { clip } = useVideoContext();

    // Default segment if no segments available
    const defaultSegment: Segment = {
        speakers: [],
        start_time: 0,
        end_time: 0,
        x: 0,
        y: 0,
    };

    const i = crops_data.segments.length > 0 
        ? getSegmentIndex(clip.start_time, crops_data.segments)
        : -1;
    
    const currentSegment = useRef<Segment>(
        i >= 0 && i < crops_data.segments.length 
            ? crops_data.segments[i] 
            : defaultSegment
    );

    const [crops, setCrops] = useImmer<Crops>(crops_data);
    const [segments, setSegments] = useImmer<Segment[]>(crops_data.segments);

    const [resizeLeft, setResizeLeft] = useState<number>(
        crops_data.segments.length > 0 && i >= 0
            ? (crops_data.segments[i].x / crops_data.original_width) * 100
            : 0
    );
    const [resizeMode, setResizeMode] = useState<ResizeMode>("9:16");
    
    const resizeContext = {
        crops, setCrops,
        resizeMode, setResizeMode,
        resizeLeft, setResizeLeft,
        currentSegment, segments, setSegments,
    };

    return (
        <ResizerContext.Provider value={resizeContext}>
            {children}
        </ResizerContext.Provider>
    )
}
