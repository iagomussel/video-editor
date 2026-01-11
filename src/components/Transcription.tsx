// Hooks
import { useTranscript } from '@/hooks/transcript'


export function Transcription() {
    const {
        transcript,
        startTranscript,
        midTranscript,
        endTranscript,
        currentWordIndex
    } = useTranscript();

    // Safety checks: ensure words array exists and index is valid
    const hasWords = transcript.words && transcript.words.length > 0;
    const validIndex = hasWords && currentWordIndex >= 0 && currentWordIndex < transcript.words.length;
    const currentWord = validIndex ? transcript.words[currentWordIndex] : null;

    // Default values if no word is available
    let currentWordStartChar = midTranscript.startChar;
    let currentWordEndChar = midTranscript.endChar;

    if (currentWord) {
        currentWordStartChar = currentWord.start_char;
        if (midTranscript.startChar > currentWordStartChar) {
            currentWordStartChar = midTranscript.startChar;
        }

        currentWordEndChar = currentWord.end_char;
        if (currentWordEndChar > midTranscript.endChar) {
            currentWordEndChar = midTranscript.endChar;
        }
    }

    const transcription = transcript.transcription || '';
    
    const preHighlighted = transcription.substring(
        midTranscript.startChar,
        currentWordStartChar
    );
    const highlightedWord = transcription.substring(
        currentWordStartChar,
        currentWordEndChar
    );
    const postHighlighted = transcription.substring(
        currentWordEndChar,
        midTranscript.endChar
    );


    // Show message if no transcription is available
    if (!transcription || transcription.trim() === '') {
        return (
            <div className="p-4 sm:py-3 sm:px-6">
                <div className="flex flex-col">
                    <h1 className="text-xl font-bold mr-1">
                        Transcription
                    </h1>
                    <p className="pt-2 text-gray-500 dark:text-gray-400 italic">
                        Nenhuma transcrição disponível. Processe o vídeo com ClipsAI para gerar a transcrição.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:py-3 sm:px-6">
            <div className="flex flex-col">
                <h1 className="text-xl font-bold mr-1">
                    Transcription
                </h1>
                <p className="pt-2">
                    <span className="font-light text-gray-400 dark:text-gray-300">
                        {startTranscript.text}
                    </span>
                    <span className="font-medium">
                        {preHighlighted}
                    </span>
                    {highlightedWord && (
                        <span className="font-medium bg-blue-300 dark:bg-blue-600">
                            {highlightedWord}
                        </span>
                    )}
                    <span className="font-medium">
                        {postHighlighted}
                    </span>
                    <span className="font-light text-gray-400 dark:text-gray-300">
                        {endTranscript.text}
                    </span>
                </p>
            </div>
        </div>
    );
}
