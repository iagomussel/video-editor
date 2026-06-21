import { NextRequest, NextResponse } from 'next/server';
import { refineClips } from '@/lib/python-api';

// Increase timeout for clip processing
export const maxDuration = 120; // 2 minutes

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { clips, words, remove_silences, remove_fillers, silence_threshold } = body;

        if (!clips || !Array.isArray(clips)) {
            return NextResponse.json(
                { error: 'Clips array is required' },
                { status: 400 }
            );
        }

        console.log('Calling Python API to refine clips...', {
            clips_count: clips.length,
            words_count: words?.length || 0,
            remove_silences,
            remove_fillers,
            silence_threshold
        });

        // Call Python API to refine clips
        const result = await refineClips(clips, words, {
            remove_silences: remove_silences ?? true,
            remove_fillers: remove_fillers ?? true,
            silence_threshold: silence_threshold ?? 0.3,
        });

        if (result.error) {
            return NextResponse.json(
                { error: result.error },
                { status: 500 }
            );
        }

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error refining clips:', error);
        
        // Check if it's a Python API connection error
        if (error.message && error.message.includes('Python API não está rodando')) {
            return NextResponse.json(
                { 
                    error: error.message,
                    suggestion: 'Start the Python server: cd python-api && source venv/bin/activate && python app.py'
                },
                { status: 503 }
            );
        }
        
        return NextResponse.json(
            { error: error.message || 'Failed to refine clips' },
            { status: 500 }
        );
    }
}
