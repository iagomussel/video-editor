'use client'

// React
import { ReactNode, createContext, useContext, useState } from 'react'


type SubtitleContextType = {
    showSubtitles: boolean;
    setShowSubtitles: (show: boolean) => void;
    toggleSubtitles: () => void;
}


export const SubtitleContext = createContext<SubtitleContextType>({
    showSubtitles: false,
    setShowSubtitles: () => { },
    toggleSubtitles: () => { },
});


export function SubtitleProvider({ children }: { children: ReactNode }) {
    const [showSubtitles, setShowSubtitles] = useState<boolean>(false);

    const toggleSubtitles = () => {
        setShowSubtitles((prev) => !prev);
    };

    return (
        <SubtitleContext.Provider value={{ showSubtitles, setShowSubtitles, toggleSubtitles }}>
            {children}
        </SubtitleContext.Provider>
    );
}


export function useSubtitles() {
    return useContext(SubtitleContext);
}
