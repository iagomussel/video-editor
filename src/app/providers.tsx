'use client'

// React
import { ReactNode } from 'react'

// Components
import { ThemeWatcher } from '@/components/Theme'

// Contexts
import { ResizerProvider } from '@/context/resizer'
import { TranscriptProvider } from '@/context/transcript'
import { SubtitleProvider } from '@/context/subtitle'
import { TrimmerProvider } from '@/context/trimmer'
import { VideoProvider } from '@/context/video'

// Third-party Libraries
import { ThemeProvider } from 'next-themes'


export function Providers({ children }: { children: ReactNode }) {
    return (
        <ThemeProvider attribute="class" disableTransitionOnChange>
            <ThemeWatcher />
            <VideoProvider>
                <TranscriptProvider>
                    <SubtitleProvider>
                        <ResizerProvider>
                            <TrimmerProvider>
                                {children}
                            </TrimmerProvider>
                        </ResizerProvider>
                    </SubtitleProvider>
                </TranscriptProvider>
            </VideoProvider>
        </ThemeProvider>
    )
}
