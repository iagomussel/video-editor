// Context
import { TranscriptContext } from '@/context/transcript'

// React
import { useContext } from 'react'

// Utils
import { getWordIndexByTime } from '@/utils/transcript'


export function useTranscript() {
    const {
        transcript, setTranscript,
        currentWordIndex, setCurrentWordIndex,
        startTranscript, setStartTranscript,
        midTranscript, setMidTranscript,
        endTranscript, setEndTranscript
    } = useContext(TranscriptContext);

    const updateTranscript = (
        startTime: number,
        endTime: number,
        trimStartTime: number,
        trimEndTime: number
    ) => {
        if (!transcript.words || transcript.words.length === 0) return;

        let index = getWordIndexByTime(startTime, transcript.words);
        if (index < 0 || index >= transcript.words.length) index = 0;
        const startWord = transcript.words[index];

        index = getWordIndexByTime(endTime, transcript.words);
        if (index < 0 || index >= transcript.words.length) index = transcript.words.length - 1;
        const endWord = transcript.words[index];

        index = getWordIndexByTime(trimStartTime, transcript.words);
        if (index < 0 || index >= transcript.words.length) index = 0;
        const midStartWord = transcript.words[index];

        index = getWordIndexByTime(trimEndTime, transcript.words);
        if (index < 0 || index >= transcript.words.length) index = transcript.words.length - 1;
        const midEndWord = transcript.words[index];

        setTranscriptState(
            startWord.start_char,
            midStartWord.start_char,
            midEndWord.end_char,
            endWord.end_char
        );
    }

    const setTranscriptState = (
        start: number,
        midStart: number,
        midEnd: number,
        end: number
    ) => {
        const transcription = transcript.transcription;
        setStartTranscript((draft: ClipTranscript) => {
            draft.startChar = start;
            draft.endChar = midStart;
            draft.text = transcription.substring(draft.startChar, draft.endChar);
        });
        setMidTranscript((draft: ClipTranscript) => {
            draft.startChar = midStart;
            draft.endChar = midEnd;
            draft.text = transcription.substring(draft.startChar, draft.endChar);
        });
        setEndTranscript((draft: ClipTranscript) => {
            draft.startChar = midEnd;
            draft.endChar = end;
            draft.text = transcription.substring(draft.startChar, draft.endChar);
        });
    }

    const updateCurrentWord = (currentTime: number) => {
        if (!transcript.words || transcript.words.length === 0) {
            return;
        }
        
        const wordIndex = getWordIndexByTime(
            currentTime,
            transcript.words
        );
        
        // Ensure index is valid
        if (wordIndex >= 0 && wordIndex < transcript.words.length) {
            setCurrentWordIndex(wordIndex);
        }
    }

    return {
        transcript, setTranscript,
        currentWordIndex, setCurrentWordIndex,
        startTranscript, setStartTranscript,
        midTranscript, setMidTranscript,
        endTranscript, setEndTranscript,
        updateTranscript,
        setTranscriptState,
        updateCurrentWord
    }
}
