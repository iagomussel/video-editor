import { NextRequest, NextResponse } from 'next/server';
import { callPythonAPI } from '@/lib/python-api';

export async function GET(
    request: NextRequest,
    { params }: { params: { jobId: string } }
) {
    try {
        const jobId = params.jobId;

        if (!jobId) {
            return NextResponse.json(
                { error: 'Job ID is required' },
                { status: 400 }
            );
        }

        // Get job status from Python API
        const status = await callPythonAPI(`/jobs/${jobId}/status`, {
            method: 'GET',
        });

        // If Python already downloaded a video file, expose a same-origin preview URL
        const videoPath = status?.video?.path;
        const enriched = {
            ...status,
            preview_url: videoPath
                ? `/api/youtube/process/preview?path=${encodeURIComponent(videoPath)}`
                : null,
        };

        return NextResponse.json(enriched);
    } catch (error: any) {
        console.error('Error getting job status:', error);
        
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
            { error: error.message || 'Failed to get job status' },
            { status: 500 }
        );
    }
}
