import { NextRequest, NextResponse } from 'next/server';
import { callPythonAPI } from '@/lib/python-api';

export const maxDuration = 60; // 1 minute for starting job

export async function POST(request: NextRequest) {
    try {
        const { url, max_duration } = await request.json();

        if (!url || typeof url !== 'string') {
            return NextResponse.json(
                { error: 'YouTube URL is required' },
                { status: 400 }
            );
        }

        // Validate YouTube URL
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
        if (!youtubeRegex.test(url)) {
            return NextResponse.json(
                { error: 'Invalid YouTube URL' },
                { status: 400 }
            );
        }

        // Start async processing with max_duration (default 30 seconds)
        const result = await callPythonAPI('/youtube/process', {
            method: 'POST',
            body: JSON.stringify({ 
                url,
                max_duration: max_duration || 30.0
            }),
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error starting YouTube processing:', error);
        
        if (error.message && error.message.includes('Python API não está rodando')) {
            return NextResponse.json(
                { 
                    error: error.message,
                    suggestion: 'Inicie o servidor Python: cd python-api && source venv/bin/activate && python app.py'
                },
                { status: 503 }
            );
        }
        
        return NextResponse.json(
            { error: error.message || 'Failed to start processing' },
            { status: 500 }
        );
    }
}
