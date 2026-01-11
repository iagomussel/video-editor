import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

const VIDEOS_DIR = path.join(process.cwd(), '.next', 'videos');

export async function GET(request: NextRequest) {
    try {
        const videos: Array<{
            id: string;
            filename: string;
            path: string;
            size: number;
            created: number;
            mimeType: string;
        }> = [];

        if (!fs.existsSync(VIDEOS_DIR)) {
            return NextResponse.json({ videos: [] });
        }

        const files = fs.readdirSync(VIDEOS_DIR);
        
        for (const file of files) {
            const filePath = path.join(VIDEOS_DIR, file);
            try {
                const stats = fs.statSync(filePath);
                
                // Only include video files
                const ext = path.extname(file).toLowerCase();
                const videoExtensions = ['.mp4', '.webm', '.mkv', '.mov', '.avi'];
                
                if (videoExtensions.includes(ext)) {
                    // Extract video ID from filename (format: videoId.ext)
                    const videoId = path.basename(file, ext);
                    
                    const mimeTypes: Record<string, string> = {
                        '.mp4': 'video/mp4',
                        '.webm': 'video/webm',
                        '.mkv': 'video/x-matroska',
                        '.mov': 'video/quicktime',
                        '.avi': 'video/x-msvideo',
                    };

                    videos.push({
                        id: videoId,
                        filename: file,
                        path: `/api/video/${videoId}`,
                        size: stats.size,
                        created: stats.birthtime.getTime(),
                        mimeType: mimeTypes[ext] || 'video/mp4',
                    });
                }
            } catch (error) {
                // Skip files that can't be read
                console.warn(`Skipping file ${file}:`, error);
            }
        }

        // Sort by creation date (newest first)
        videos.sort((a, b) => b.created - a.created);

        return NextResponse.json({ videos });
    } catch (error: any) {
        console.error('Error listing videos:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to list videos' },
            { status: 500 }
        );
    }
}
