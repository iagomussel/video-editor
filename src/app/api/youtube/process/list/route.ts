import { NextRequest, NextResponse } from 'next/server';
import { callPythonAPI } from '@/lib/python-api';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = searchParams.get('limit') || '50';

        const data = await callPythonAPI(`/jobs?limit=${encodeURIComponent(limit)}`, {
            method: 'GET',
        });

        const jobs = (data?.jobs || []).map((job: any) => {
            const videoPath = job?.video?.path;
            return {
                ...job,
                preview_url: videoPath
                    ? `/api/youtube/process/preview?path=${encodeURIComponent(videoPath)}`
                    : null,
            };
        });

        return NextResponse.json({ jobs });
    } catch (error: any) {
        console.error('Error listing jobs:', error);

        if (error.message && error.message.includes('Python API não está rodando')) {
            return NextResponse.json(
                {
                    error: error.message,
                    suggestion: 'Inicie o servidor Python: cd python-api && source venv/bin/activate && python app.py',
                },
                { status: 503 }
            );
        }

        return NextResponse.json(
            { error: error.message || 'Failed to list jobs' },
            { status: 500 }
        );
    }
}

