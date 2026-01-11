import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { registerVideo } from '@/app/api/video/[id]/route';
import { processYouTubeVideo } from '@/lib/python-api';

// Directory to store processed videos (persist across requests)
const VIDEOS_DIR = path.join(process.cwd(), '.next', 'videos');

// Ensure videos directory exists
if (!fs.existsSync(VIDEOS_DIR)) {
    fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

export async function POST(request: NextRequest) {
    let tempVideoPath: string | null = null;
    let tempDir: string | null = null;
    
    try {
        const { url } = await request.json();

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

        // Call Python API to process YouTube video
        console.log('Calling Python API to process YouTube video...');
        const pythonResult = await processYouTubeVideo(url);

        if (pythonResult.error) {
            return NextResponse.json(
                { error: pythonResult.error },
                { status: 500 }
            );
        }

        // Copy video from Python API temp location to persistent storage
        tempVideoPath = pythonResult.temp_video_path;
        tempDir = pythonResult.temp_dir;
        
        if (!tempVideoPath) {
            return NextResponse.json(
                { error: 'Video file path not returned from Python API' },
                { status: 500 }
            );
        }

        // Check if file exists (may be on different filesystem in some setups)
        if (!fs.existsSync(tempVideoPath)) {
            console.warn(`Video file not found at ${tempVideoPath}, attempting to read from Python API...`);
            // If file doesn't exist locally, we might need to fetch it from Python API
            // For now, return an error with helpful message
            return NextResponse.json(
                { 
                    error: 'Video file not accessible. Make sure Python API and Next.js are running on the same machine.',
                    temp_path: tempVideoPath
                },
                { status: 500 }
            );
        }

        const videoId = pythonResult.video.id;
        const videoTitle = pythonResult.video.title || 'Downloaded Video';
        const videoExt = path.extname(tempVideoPath);
        
        // Sanitize video title for filename (normalize and remove invalid characters)
        const sanitizedTitle = videoTitle
            .normalize('NFD') // Normalize to decomposed form (é -> e + ´)
            .replace(/[\u0300-\u036f]/g, '') // Remove diacritics (accents)
            .replace(/[^a-zA-Z0-9\s\-_]/g, '') // Remove special characters except spaces, hyphens, underscores
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
            .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
            .substring(0, 80) // Limit length (leave room for videoId)
            .trim();
        
        // Use format: {title}-{videoId}.ext to ensure videoId is always in filename
        // This allows the file to be found after server restarts
        const filename = sanitizedTitle 
            ? `${sanitizedTitle}-${videoId}`
            : videoId;
        const finalPath = path.join(VIDEOS_DIR, `${filename}${videoExt}`);
        
        // Copy video to persistent location
        fs.copyFileSync(tempVideoPath, finalPath);
        
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
        console.error('Error processing YouTube video:', error);
        
        // Clean up on error
        if (tempDir && fs.existsSync(tempDir)) {
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
            } catch (cleanupError) {
                console.error('Error cleaning up temp directory:', cleanupError);
            }
        }
        
        // Check if it's a Python API connection error
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
            { error: error.message || 'Failed to process video' },
            { status: 500 }
        );
    }
}
