import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { callPythonAPI } from '@/lib/python-api';
import { registerVideo, getVideosDir } from '@/lib/video-storage';

// Get videos directory
const VIDEOS_DIR = getVideosDir();

// Ensure videos directory exists
if (!fs.existsSync(VIDEOS_DIR)) {
    fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

export const maxDuration = 300; // 5 minutes

export async function GET(
    request: NextRequest,
    { params }: { params: { jobId: string } }
) {
    let tempDir: string | null = null;
    
    try {
        const jobId = params.jobId;

        if (!jobId) {
            return NextResponse.json(
                { error: 'Job ID is required' },
                { status: 400 }
            );
        }

        // Get job result from Python API
        const pythonResult = await callPythonAPI(`/jobs/${jobId}/result`, {
            method: 'GET',
        });

        // Get video file from Python API
        const tempVideoPath = pythonResult.temp_video_path;
        tempDir = pythonResult.temp_dir;
        
        if (!tempVideoPath) {
            return NextResponse.json(
                { error: 'Video file path not returned from Python API' },
                { status: 500 }
            );
        }

        const videoId = pythonResult.video.id;
        const videoTitle = pythonResult.video.title || 'Downloaded Video';
        const videoExt = path.extname(tempVideoPath) || '.mp4';
        
        // Sanitize video title for filename
        const sanitizedTitle = videoTitle
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9\s\-_]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 80)
            .trim();
        
        const filename = sanitizedTitle 
            ? `${sanitizedTitle}-${videoId}`
            : videoId;
        const finalPath = path.join(VIDEOS_DIR, `${filename}${videoExt}`);
        
        // Download video from Python API via HTTP
        // This works even if Python API is in a separate process/container
        const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:5000';
        const pythonVideoUrl = `${PYTHON_API_URL}/video/${encodeURIComponent(tempVideoPath)}`;
        
        console.log(`Downloading video from Python API: ${pythonVideoUrl}`);
        
        const videoResponse = await fetch(pythonVideoUrl);
        if (!videoResponse.ok) {
            // Fallback: try direct file access (if on same filesystem)
            if (fs.existsSync(tempVideoPath)) {
                console.log('Falling back to direct file copy');
                fs.copyFileSync(tempVideoPath, finalPath);
            } else {
                return NextResponse.json(
                    { 
                        error: 'Failed to download video from Python API',
                        details: `HTTP ${videoResponse.status}: ${videoResponse.statusText}`
                    },
                    { status: 500 }
                );
            }
        } else {
            // Download and save video file
            const videoBuffer = await videoResponse.arrayBuffer();
            fs.writeFileSync(finalPath, Buffer.from(videoBuffer));
            console.log(`Video saved to: ${finalPath}`);
        }
        
        // Register video for serving
        registerVideo(videoId, finalPath);
        
        // Create URL to serve the video
        const videoUrl = `/api/video/${videoId}`;

        // Clean up Python API temp directory
        if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }

        // Update video source to use the URL instead of temp path
        const video = {
            ...pythonResult.video,
            source: videoUrl,
        };

        return NextResponse.json({
            video,
            transcript: pythonResult.transcript,
        });
    } catch (error: any) {
        console.error('Error getting job result:', error);
        
        // Clean up on error
        if (tempDir && fs.existsSync(tempDir)) {
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
            } catch (cleanupError) {
                console.error('Error cleaning up temp directory:', cleanupError);
            }
        }
        
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
            { error: error.message || 'Failed to get job result' },
            { status: 500 }
        );
    }
}
