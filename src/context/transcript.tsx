// React
import { ReactNode, createContext, useState, useEffect } from 'react'

// Data
import { transcript as transcript_data } from '@/data/transcript'

// Hooks
import { useVideoContext } from '@/hooks/video'

// Utils
import { getWordIndexByChar } from '@/utils/transcript'

// Third-party Libraries
import { useImmer, Updater } from 'use-immer'


type TranscriptContextType = {
    transcript: Transcript,
    setTranscript: Updater<Transcript>,
    currentWordIndex: number,
    setCurrentWordIndex: SetState<number>,
    startTranscript: ClipTranscript,
    setStartTranscript: Updater<ClipTranscript>,
    midTranscript: ClipTranscript,
    setMidTranscript: Updater<ClipTranscript>,
    endTranscript: ClipTranscript,
    setEndTranscript: Updater<ClipTranscript>,
}

export const TranscriptContext = createContext<TranscriptContextType>({
    transcript: transcript_data,
    setTranscript: async () => undefined,
    currentWordIndex: 0,
    setCurrentWordIndex: () => { },
    startTranscript: { startChar: 0, endChar: 0, text: "" },
    setStartTranscript: () => { },
    midTranscript: { startChar: 0, endChar: 0, text: "" },
    setMidTranscript: () => { },
    endTranscript: { startChar: 0, endChar: 0, text: "" },
    setEndTranscript: () => { },
});

export function TranscriptProvider({ children }: { children: ReactNode }) {
    const { clip } = useVideoContext();

    const [transcript, setTranscript] = useImmer<Transcript>(transcript_data);
    const [currentWordIndex, setCurrentWordIndex] = useState<number>(
        transcript.words && transcript.words.length > 0
            ? getWordIndexByChar(clip.start_char, transcript.words)
            : 0
    );
    const [startTranscript, setStartTranscript] = useImmer<ClipTranscript>({
        startChar: clip.start_char,
        endChar: clip.start_char,
        text: transcript_data.transcription.substring(clip.start_char, clip.start_char)
    });
    const [midTranscript, setMidTranscript] = useImmer<ClipTranscript>({
        startChar: clip.start_char,
        endChar: clip.end_char,
        text: transcript_data.transcription.substring(clip.start_char, clip.end_char)
    });
    const [endTranscript, setEndTranscript] = useImmer<ClipTranscript>({
        startChar: clip.end_char,
        endChar: clip.end_char,
        text: transcript_data.transcription.substring(clip.end_char, clip.end_char)
    });

    // Update transcript-related state when clip changes
    useEffect(() => {
        if (!transcript.words || transcript.words.length === 0) {
            setCurrentWordIndex(0);
            return;
        }
        
        const newCurrentWordIndex = getWordIndexByChar(clip.start_char, transcript.words);
        // Ensure index is valid
        if (newCurrentWordIndex >= 0 && newCurrentWordIndex < transcript.words.length) {
            setCurrentWordIndex(newCurrentWordIndex);
        } else {
            setCurrentWordIndex(0);
        }
        
        const transcription = transcript.transcription || '';
        
        setStartTranscript((draft: ClipTranscript) => {
            draft.startChar = clip.start_char;
            draft.endChar = clip.start_char;
            draft.text = transcription.substring(draft.startChar, draft.endChar);
        });
        
        setMidTranscript((draft: ClipTranscript) => {
            draft.startChar = clip.start_char;
            draft.endChar = clip.end_char;
            draft.text = transcription.substring(draft.startChar, draft.endChar);
        });
        
        setEndTranscript((draft: ClipTranscript) => {
            draft.startChar = clip.end_char;
            draft.endChar = clip.end_char;
            draft.text = transcription.substring(draft.startChar, draft.endChar);
        });
    }, [clip.id, clip.start_char, clip.end_char, transcript.transcription, transcript.words]);

    const transcriptContext = {
        transcript, setTranscript,
        currentWordIndex, setCurrentWordIndex,
        startTranscript, setStartTranscript,
        midTranscript, setMidTranscript,
        endTranscript, setEndTranscript,
    };

    return (
        <TranscriptContext.Provider value={transcriptContext}>
            {children}
        </TranscriptContext.Provider>
    )
}
