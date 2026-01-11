import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');

    if (!filePath) {
        return NextResponse.json(
            { error: 'path is required' },
            { status: 400 }
        );
    }

    const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:5000';
    const pythonUrl = `${PYTHON_API_URL}/video/${encodeURIComponent(filePath)}`;

    const headers: HeadersInit = {};
    const range = request.headers.get('range');
    if (range) headers['range'] = range;

    const upstream = await fetch(pythonUrl, { headers });

    // Pass through key headers for video playback/seek
    const outHeaders = new Headers();
    const passthrough = [
        'content-type',
        'content-length',
        'accept-ranges',
        'content-range',
        'last-modified',
    ];
    for (const h of passthrough) {
        const v = upstream.headers.get(h);
        if (v) outHeaders.set(h, v);
    }
    outHeaders.set('cache-control', 'no-store');

    return new Response(upstream.body, {
        status: upstream.status,
        headers: outHeaders,
    });
}

