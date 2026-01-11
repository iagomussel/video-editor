import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// Store video paths in memory (in production, use a database or cache)
const videoCache = new Map<string, string>();

// Cleanup old videos on startup (older than 24 hours)
const VIDEOS_DIR = path.join(process.cwd(), '.next', 'videos');
if (fs.existsSync(VIDEOS_DIR)) {
    try {
        const files = fs.readdirSync(VIDEOS_DIR);
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        files.forEach(file => {
            const filePath = path.join(VIDEOS_DIR, file);
            try {
                const stats = fs.statSync(filePath);
                if (now - stats.mtime.getTime() > maxAge) {
                    fs.unlinkSync(filePath);
                    console.log(`Cleaned up old video: ${file}`);
                }
            } catch (error) {
                // Ignore errors for individual files
            }
        });
    } catch (error) {
        // Ignore cleanup errors
    }
}

export function registerVideo(id: string, filePath: string) {
    videoCache.set(id, filePath);
}

export function getVideoPath(id: string): string | null {
    // Check cache first
    if (videoCache.has(id)) {
        return videoCache.get(id)!;
    }
    
    // If not in cache, check filesystem (handles server restarts)
    if (fs.existsSync(VIDEOS_DIR)) {
        try {
            const files = fs.readdirSync(VIDEOS_DIR);
            // Try to find file that starts with id (old format) or ends with -id.ext (new format with title)
            const videoFile = files.find(file => {
                const ext = path.extname(file);
                const basename = path.basename(file, ext);
                // Match files that start with id (old format) or end with -id (new format: title-id.ext)
                return file.startsWith(id) || basename.endsWith(`-${id}`) || basename === id;
            });
            if (videoFile) {
                const filePath = path.join(VIDEOS_DIR, videoFile);
                // Re-register in cache
                videoCache.set(id, filePath);
                return filePath;
            }
        } catch (error) {
            // Ignore filesystem errors
        }
    }
    
    return null;
}

export function unregisterVideo(id: string) {
    const filePath = videoCache.get(id);
    if (filePath) {
        videoCache.delete(id);
        // Optionally delete the file
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (error) {
            console.error('Error deleting video file:', error);
        }
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const videoId = params.id;
        const videoPath = getVideoPath(videoId);

        if (!videoPath || !fs.existsSync(videoPath)) {
            return NextResponse.json(
                { error: 'Video not found' },
                { status: 404 }
            );
        }

        const stats = fs.statSync(videoPath);
        const fileSize = stats.size;
        const range = request.headers.get('range');
        
        // Determine MIME type from file extension
        const ext = path.extname(videoPath).toLowerCase();
        const mimeTypes: Record<string, string> = {
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.mkv': 'video/x-matroska',
            '.mov': 'video/quicktime',
            '.avi': 'video/x-msvideo',
        };
        const contentType = mimeTypes[ext] || 'video/mp4';

        if (range) {
            // Handle range requests for video streaming
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(videoPath, { start, end });
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize.toString(),
                'Content-Type': contentType,
            };

            return new NextResponse(file as any, {
                status: 206,
                headers: head,
            });
        } else {
            // Return full file
            const file = fs.createReadStream(videoPath);
            const head = {
                'Content-Length': fileSize.toString(),
                'Content-Type': contentType,
            };

            return new NextResponse(file as any, {
                status: 200,
                headers: head,
            });
        }
    } catch (error: any) {
        console.error('Error serving video:', error);
        return NextResponse.json(
            { error: 'Failed to serve video' },
            { status: 500 }
        );
    }
}
