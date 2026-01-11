'use client'

// React
import { useState } from 'react'

// Components
import { Header } from '@/components/Header'
import { ClipEditor } from '@/components/Clips'
import { Transcription } from '@/components/Transcription'
import { DemoLanding } from '@/components/DemoLanding'

// Data
import { intervals } from '@/data/clips'

// Providers
import { Providers } from '@/app/providers'

export default function Demo() {
    const [interval, setInterval] = useState<Interval>(intervals[0]);

    return (
        <div className="w-full">
            <div className="rounded-lg border border-gray-300 dark:border-white/20 bg-white dark:bg-zinc-800 shadow-lg overflow-hidden">
                <Header setInterval={setInterval} />
                <div className="p-4 sm:p-6">
                    <DemoLanding />
                </div>
                <ClipEditor interval={interval} />
                <Transcription />
            </div>
        </div>
    )
}
