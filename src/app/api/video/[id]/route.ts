import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { getVideoPath } from '@/lib/video-storage';

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
