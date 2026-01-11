import * as fs from 'fs';
import * as path from 'path';

// Store video paths in memory (in production, use a database or cache)
const videoCache = new Map<string, string>();

// Directory to store processed videos
const VIDEOS_DIR = path.join(process.cwd(), '.next', 'videos');

// Cleanup old videos on startup (older than 24 hours)
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
    videoCache.delete(id);
}

export function getVideosDir(): string {
    return VIDEOS_DIR;
}
