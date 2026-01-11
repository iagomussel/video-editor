import { NextRequest, NextResponse } from 'next/server';
import { generateClipsFromVideo } from '@/lib/python-api';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const videoFile = formData.get('video') as File;
        const videoData = formData.get('videoData') as string; // Base64 encoded video
        const videoId = formData.get('videoId') as string || `video-${Date.now()}`;
        const videoTitle = formData.get('title') as string || 'Uploaded Video';

        if (!videoFile && !videoData) {
            return NextResponse.json(
                { error: 'Video file or video data is required' },
                { status: 400 }
            );
        }

        let fileToProcess: File;

        if (videoFile) {
            // Use the uploaded file directly
            fileToProcess = videoFile;
        } else if (videoData) {
            // Convert base64 to File
            const base64Data = videoData.includes(',') 
                ? videoData.split(',')[1] 
                : videoData;
            const buffer = Buffer.from(base64Data, 'base64');
            const blob = new Blob([buffer]);
            fileToProcess = new File([blob], `video-${Date.now()}.mp4`, { type: 'video/mp4' });
        } else {
            return NextResponse.json(
                { error: 'No video data provided' },
                { status: 400 }
            );
        }

        // Call Python API to generate clips
        console.log('Calling Python API to generate clips...');
        const result = await generateClipsFromVideo(fileToProcess, videoId, videoTitle);

        if (result.error) {
            return NextResponse.json(
                { 
                    error: result.error,
                    isInstallationError: result.error.includes('ClipsAI not installed') || result.error.includes('clipsai'),
                    suggestion: result.suggestion || 'Make sure ClipsAI is installed: pip install clipsai'
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            clips: result.clips,
            transcript: result.transcript,
            metadata: result.metadata,
        });
    } catch (error: any) {
        console.error('Error generating clips:', error);
        
        // Check if it's a Python API connection error
        if (error.message && error.message.includes('Python API não está rodando')) {
            return NextResponse.json(
                { 
                    error: error.message,
                    isInstallationError: false,
                    suggestion: 'Inicie o servidor Python: cd python-api && source venv/bin/activate && python app.py'
                },
                { status: 503 }
            );
        }
        
        return NextResponse.json(
            { error: error.message || 'Failed to generate clips' },
            { status: 500 }
        );
    }
}
