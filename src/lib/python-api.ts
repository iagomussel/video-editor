/**
 * Python API Client
 * Handles communication with the separate Python API server
 */

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:5000';

export async function callPythonAPI(endpoint: string, options: RequestInit = {}) {
    const url = `${PYTHON_API_URL}${endpoint}`;
    
    try {
        // Build headers - don't set Content-Type for FormData (browser will set it with boundary)
        const headers: Record<string, string> = { ...options.headers as Record<string, string> };
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        
        const response = await fetch(url, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            // Don't treat API errors as "server not running" - these are processing errors
            throw new Error(error.error || `API request failed: ${response.statusText}`);
        }

        return await response.json();
    } catch (error: any) {
        // Only treat actual connection errors as "server not running"
        // Check for network-level errors, not API errors
        if (
            error.message && (
                error.message.includes('fetch failed') || 
                error.message.includes('ECONNREFUSED') ||
                error.message.includes('NetworkError') ||
                error.message.includes('Failed to fetch') ||
                (error.name === 'TypeError' && error.message.includes('fetch'))
            )
        ) {
            throw new Error(
                'Python API não está rodando. ' +
                'Por favor, inicie o servidor Python: cd python-api && source venv/bin/activate && python app.py'
            );
        }
        // Re-throw other errors (processing errors, API errors, etc.)
        throw error;
    }
}

export async function checkPythonAPIHealth() {
    try {
        const response = await fetch(`${PYTHON_API_URL}/health`);
        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch {
        return null;
    }
}

export async function downloadYouTubeVideo(url: string) {
    return callPythonAPI('/youtube/download', {
        method: 'POST',
        body: JSON.stringify({ url }),
    });
}

export async function generateClipsFromVideo(videoFile: File, videoId: string, title: string) {
    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('videoId', videoId);
    formData.append('title', title);

    const url = `${PYTHON_API_URL}/clips/generate`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: formData,
            // Don't set Content-Type header, let browser set it with boundary
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `API request failed: ${response.statusText}`);
        }

        return await response.json();
    } catch (error: any) {
        // Only treat actual connection errors as "server not running"
        if (
            error.message && (
                error.message.includes('fetch failed') || 
                error.message.includes('ECONNREFUSED') ||
                error.message.includes('NetworkError') ||
                error.message.includes('Failed to fetch') ||
                (error.name === 'TypeError' && error.message.includes('fetch'))
            )
        ) {
            throw new Error(
                'Python API não está rodando. ' +
                'Por favor, inicie o servidor Python: cd python-api && source venv/bin/activate && python app.py'
            );
        }
        // Re-throw other errors (processing errors, API errors, etc.)
        throw error;
    }
}

export async function processYouTubeVideo(url: string) {
    return callPythonAPI('/youtube/process', {
        method: 'POST',
        body: JSON.stringify({ url }),
    });
}
