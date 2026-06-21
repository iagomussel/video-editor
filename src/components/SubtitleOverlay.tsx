'use client'

// React
import { useMemo } from 'react'

// Hooks
import { useSubtitles } from '@/context/subtitle'
import { useTranscript } from '@/hooks/transcript'


export function SubtitleOverlay() {
    const { showSubtitles } = useSubtitles();
    const { transcript, currentWordIndex } = useTranscript();

    // Build the subtitle text from current word and upcoming words
    const subtitleText = useMemo(() => {
        if (!transcript.words || transcript.words.length === 0) {
            return '';
        }

        const fullTranscript = transcript.transcription || '';
        if (!fullTranscript) {
            return '';
        }

        // Get current and next few words for smoother display
        const wordsToShow: string[] = [];
        const maxWords = 6;
        const currentIdx = currentWordIndex >= 0 ? currentWordIndex : 0;

        for (let i = 0; i < maxWords && (currentIdx + i) < transcript.words.length; i++) {
            const word = transcript.words[currentIdx + i];
            if (word) {
                // Extract text from the full transcript using character positions
                const wordText = fullTranscript.substring(word.start_char, word.end_char);
                wordsToShow.push(wordText);
            }
        }

        return wordsToShow.join(' ');
    }, [transcript.words, transcript.transcription, currentWordIndex]);

    // Don't render anything if subtitles are disabled or no text
    if (!showSubtitles || !subtitleText) {
        return null;
    }

    return (
        <div className="absolute inset-0 flex items-end justify-center pointer-events-none z-10">
            <div className="w-full bg-gradient-to-t from-black/80 via-black/50 to-transparent pb-4 pt-16">
                <p className="text-center text-white text-lg sm:text-xl font-medium px-4 drop-shadow-lg">
                    {subtitleText}
                </p>
            </div>
        </div>
    );
}
