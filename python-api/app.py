#!/usr/bin/env python3
"""
ClipsAI API Server
Handles YouTube downloads and clip generation using ClipsAI
"""

# Import sys first (needed for stderr in PyTorch config)
import sys

# IMPORTANT: Configure PyTorch serialization BEFORE any other imports
# This must be done before importing ClipsAI/WhisperX which use torch.load internally
# PyTorch 2.6+ changed default weights_only=True, which blocks various types
try:
    import torch
    import typing
    import collections
    
    # Check if we're on PyTorch 2.6+ (has add_safe_globals)
    if hasattr(torch.serialization, 'add_safe_globals'):
        safe_globals = []
        
        # Add common typing types (needed by Pyannote/Lightning models)
        safe_globals.extend([
            typing.Any,
            typing.Union,
            typing.Optional,
            typing.Dict,
            typing.List,
            typing.Tuple,
            typing.Callable,
            typing.Type,
            typing.Generic,
        ])
        
        # Add basic Python types (often needed by models)
        safe_globals.extend([
            dict,
            list,
            tuple,
            int,
            float,
            str,
            bool,
            bytes,
            bytearray,
            collections.defaultdict,
            collections.OrderedDict,
        ])
        
        # Add omegaconf types (needed by WhisperX/ClipsAI/Pyannote models)
        try:
            from omegaconf import ListConfig, DictConfig, OmegaConf
            from omegaconf.base import ContainerMetadata, Metadata
            from omegaconf.nodes import AnyNode
            safe_globals.extend([
                ListConfig,
                DictConfig,
                OmegaConf,
                ContainerMetadata,
                Metadata,
                AnyNode,
            ])
        except ImportError:
            # Try with available types
            try:
                from omegaconf import ListConfig, DictConfig, OmegaConf
                from omegaconf.base import ContainerMetadata
                safe_globals.extend([ListConfig, DictConfig, OmegaConf, ContainerMetadata])
            except ImportError:
                # Try with just ListConfig if others not available
                try:
                    from omegaconf import ListConfig
                    safe_globals.append(ListConfig)
                except ImportError:
                    pass
        
        # Add all safe globals at once
        if safe_globals:
            torch.serialization.add_safe_globals(safe_globals)
            globals_list = [g.__name__ if hasattr(g, '__name__') else str(g) for g in safe_globals[:10]]
            print(f"Configured torch.serialization to allow {len(safe_globals)} types (including: {', '.join(globals_list)}...)", file=sys.stderr)
        
        # Monkey patch torch.load to use weights_only=False for trusted models
        # This is safe for HuggingFace/Pyannote models which are from trusted sources
        # Some libraries (like Lightning Fabric) call torch.load with weights_only=True explicitly,
        # so we need to override it
        original_load = torch.load
        def patched_load(*args, **kwargs):
            # Force weights_only=False for trusted model loading
            # Models from HuggingFace/Pyannote are trusted sources
            kwargs['weights_only'] = False
            return original_load(*args, **kwargs)
        torch.load = patched_load
        print("Patched torch.load to use weights_only=False (safe for trusted HuggingFace/Pyannote models)", file=sys.stderr)
except ImportError:
    # PyTorch not available, will fail later when ClipsAI tries to use it
    pass

# Now import other modules
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import json
import tempfile
import shutil
import threading
import uuid
import time
from pathlib import Path
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Enable CORS for Next.js frontend

# In-memory job storage (in production, use Redis or database)
jobs = {}
jobs_lock = threading.Lock()

# Import ClipsAI after ensuring it's available
try:
    from clipsai import ClipFinder, Transcriber
    CLIPSAI_AVAILABLE = True
except ImportError:
    CLIPSAI_AVAILABLE = False
    print("Warning: ClipsAI not installed. Install with: pip install clipsai", file=sys.stderr)

try:
    import yt_dlp
    YT_DLP_AVAILABLE = True
except ImportError:
    YT_DLP_AVAILABLE = False
    print("Warning: yt-dlp not installed. Install with: pip install yt-dlp", file=sys.stderr)


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'clipsai_available': CLIPSAI_AVAILABLE,
        'yt_dlp_available': YT_DLP_AVAILABLE
    })


@app.route('/jobs/<job_id>/status', methods=['GET'])
def get_job_status(job_id):
    """Get status of a processing job"""
    with jobs_lock:
        job = jobs.get(job_id)
        if not job:
            return jsonify({'error': 'Job not found'}), 404
        
        return jsonify({
            'job_id': job_id,
            'status': job['status'],
            'progress': job.get('progress', 0),
            'message': job.get('message', ''),
            'error': job.get('error'),
            'created_at': job.get('created_at'),
            'updated_at': job.get('updated_at'),
        })


@app.route('/jobs/<job_id>/result', methods=['GET'])
def get_job_result(job_id):
    """Get result of a completed job"""
    with jobs_lock:
        job = jobs.get(job_id)
        if not job:
            return jsonify({'error': 'Job not found'}), 404
        
        if job['status'] != 'completed':
            return jsonify({
                'error': 'Job not completed',
                'status': job['status']
            }), 400
        
        return jsonify(job.get('result', {}))


def update_job_status(job_id, status, progress=0, message='', error=None):
    """Update job status"""
    with jobs_lock:
        if job_id in jobs:
            jobs[job_id]['status'] = status
            jobs[job_id]['progress'] = progress
            jobs[job_id]['message'] = message
            jobs[job_id]['updated_at'] = datetime.now().isoformat()
            if error:
                jobs[job_id]['error'] = error


def process_youtube_async(job_id, url, max_duration=30.0):
    """Process YouTube video asynchronously"""
    download_temp_dir = tempfile.mkdtemp(prefix='yt-process-')
    
    try:
        update_job_status(job_id, 'processing', 10, 'Downloading video from YouTube...')
        
        # Step 1: Download video
        ydl_opts_info = {
            'quiet': True,
            'no_warnings': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts_info) as ydl:
            info = ydl.extract_info(url, download=False)
            video_title = info.get('title', 'Downloaded Video')
            duration = info.get('duration', 0)
        
        safe_title = "".join(c for c in video_title if c.isalnum() or c in (' ', '-', '_')).rstrip()
        safe_title = safe_title[:100]
        
        ydl_opts = {
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'outtmpl': os.path.join(download_temp_dir, f'{safe_title}.%(ext)s'),
            'quiet': False,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        
        # Find downloaded file
        files = os.listdir(download_temp_dir)
        video_file = None
        for f in files:
            if f.endswith(('.mp4', '.webm', '.mkv')):
                video_file = os.path.join(download_temp_dir, f)
                break
        
        if not video_file:
            update_job_status(job_id, 'failed', 0, 'Failed to download video file', 'Video file not found')
            return
        
        file_size = os.path.getsize(video_file)
        video_id = f'youtube-{os.urandom(8).hex()}'
        
        # Step 2: Generate clips
        update_job_status(job_id, 'processing', 40, 'Transcribing video with ClipsAI...')
        transcriber = Transcriber()
        transcription = transcriber.transcribe(audio_file_path=video_file)
        
        update_job_status(job_id, 'processing', 70, 'Finding clips with ClipsAI...')
        clipfinder = ClipFinder()
        clips = clipfinder.find_clips(transcription=transcription)
        
        # Convert clips to JSON format and filter by duration
        clips_data = []
        transcription_text = getattr(transcription, 'transcription', '')
        # Get max_duration from job settings (default 30 seconds)
        with jobs_lock:
            max_clip_duration = jobs.get(job_id, {}).get('max_duration', max_duration)
        
        clip_index = 0
        for clip in clips:
            clip_duration = float(clip.end_time) - float(clip.start_time)
            
            # Only include clips that are less than 30 seconds
            if clip_duration <= max_clip_duration:
                start_char = getattr(clip, 'start_char', 0)
                end_char = getattr(clip, 'end_char', len(transcription_text))
                
                clip_text = transcription_text[start_char:end_char] if transcription_text else f"Clip {clip_index + 1}"
                clip_title = clip_text.strip()[:100] if clip_text.strip() else f"Clip {clip_index + 1}"
                
                clips_data.append({
                    'id': f'{video_id}-clip-{clip_index}',
                    'object': 'clip',
                    'created': int(os.path.getmtime(video_file)),
                    'start_time': float(clip.start_time),
                    'end_time': float(clip.end_time),
                    'start_char': int(start_char),
                    'end_char': int(end_char),
                    'video_id': video_id,
                    'favorited': False,
                    'deleted': False,
                    'scores': {'embedding_norm': 0},
                    'title': clip_title,
                })
                clip_index += 1
        
        # Get transcription data
        words_data = []
        if hasattr(transcription, 'words'):
            for word in transcription.words:
                words_data.append({
                    'start_char': int(getattr(word, 'start_char', 0)),
                    'end_char': int(getattr(word, 'end_char', 0)),
                    'start_time': float(getattr(word, 'start_time', 0)),
                    'end_time': float(getattr(word, 'end_time', 0)),
                })
        
        update_job_status(job_id, 'processing', 95, 'Finalizing...')
        
        result = {
            'video': {
                'id': video_id,
                'object': 'video',
                'clips': clips_data,
                'created': int(os.path.getmtime(video_file)),
                'metadata': {
                    'duration': duration or 0,
                    'file_size': file_size,
                    'mime_type': f'video/{os.path.splitext(video_file)[1][1:]}',
                },
                'source': video_file,
                'status': 'complete',
                'title': video_title,
            },
            'transcript': {
                'id': f'{video_id}-transcript',
                'object': 'transcript',
                'created': int(os.path.getmtime(video_file)),
                'words': words_data,
                'transcription': transcription_text
            },
            'temp_video_path': video_file,
            'temp_dir': download_temp_dir,
        }
        
        with jobs_lock:
            jobs[job_id]['result'] = result
        update_job_status(job_id, 'completed', 100, 'Processing complete!')
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error processing YouTube video: {error_trace}", file=sys.stderr)
        
        # Cleanup on error
        if os.path.exists(download_temp_dir):
            shutil.rmtree(download_temp_dir, ignore_errors=True)
        
        update_job_status(job_id, 'failed', 0, f'Error: {str(e)}', str(e))


@app.route('/video/<path:filepath>', methods=['GET'])
def serve_video(filepath):
    """Serve video file (for temporary files)"""
    # Decode URL-encoded path
    from urllib.parse import unquote
    filepath = unquote(filepath)
    
    # Security: only serve files from temp directories
    # Allow /tmp/ paths and paths containing 'tmp' (for tempfile.mkdtemp paths)
    if not (filepath.startswith('/tmp/') or 'tmp' in filepath or filepath.startswith('/var/tmp/')):
        return jsonify({'error': 'Invalid file path - only temp files allowed'}), 403
    
    if not os.path.exists(filepath):
        return jsonify({'error': f'File not found: {filepath}'}), 404
    
    # Determine MIME type
    ext = os.path.splitext(filepath)[1].lower()
    mime_types = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mkv': 'video/x-matroska',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
    }
    content_type = mime_types.get(ext, 'video/mp4')
    
    return send_file(filepath, mimetype=content_type)


@app.route('/youtube/download', methods=['POST'])
def download_youtube():
    """Download video from YouTube URL"""
    if not YT_DLP_AVAILABLE:
        return jsonify({'error': 'yt-dlp not installed'}), 500
    
    data = request.get_json()
    url = data.get('url')
    
    if not url:
        return jsonify({'error': 'YouTube URL is required'}), 400
    
    # Validate YouTube URL
    if 'youtube.com' not in url and 'youtu.be' not in url:
        return jsonify({'error': 'Invalid YouTube URL'}), 400
    
    temp_dir = tempfile.mkdtemp(prefix='yt-download-')
    
    try:
        # Get video info first
        ydl_opts_info = {
            'quiet': True,
            'no_warnings': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts_info) as ydl:
            info = ydl.extract_info(url, download=False)
            video_title = info.get('title', 'Downloaded Video')
            duration = info.get('duration', 0)
        
        # Download video
        safe_title = "".join(c for c in video_title if c.isalnum() or c in (' ', '-', '_')).rstrip()
        safe_title = safe_title[:100]  # Limit length
        
        ydl_opts = {
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'outtmpl': os.path.join(temp_dir, f'{safe_title}.%(ext)s'),
            'quiet': False,
            'no_warnings': False,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        
        # Find downloaded file
        files = os.listdir(temp_dir)
        video_file = None
        for f in files:
            if f.endswith(('.mp4', '.webm', '.mkv')):
                video_file = os.path.join(temp_dir, f)
                break
        
        if not video_file:
            return jsonify({'error': 'Failed to download video file'}), 500
        
        file_size = os.path.getsize(video_file)
        
        return jsonify({
            'success': True,
            'video_path': video_file,
            'temp_dir': temp_dir,
            'filename': os.path.basename(video_file),
            'title': video_title,
            'duration': duration,
            'file_size': file_size,
            'mime_type': f'video/{os.path.splitext(video_file)[1][1:]}'
        })
    
    except Exception as e:
        # Cleanup on error
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)
        return jsonify({'error': str(e)}), 500


@app.route('/clips/generate', methods=['POST'])
def generate_clips():
    """Generate clips from video file using ClipsAI"""
    if not CLIPSAI_AVAILABLE:
        return jsonify({
            'error': 'ClipsAI not installed',
            'suggestion': 'Install with: pip install clipsai'
        }), 500
    
    if 'video' not in request.files:
        return jsonify({'error': 'Video file is required'}), 400
    
    video_file = request.files['video']
    video_id = request.form.get('videoId', f'video-{os.urandom(8).hex()}')
    video_title = request.form.get('title', 'Uploaded Video')
    
    temp_dir = tempfile.mkdtemp(prefix='clips-generate-')
    video_path = os.path.join(temp_dir, video_file.filename or 'video.mp4')
    
    try:
        # Save uploaded video
        video_file.save(video_path)
        
        # Transcribe the video
        print(f"Starting transcription for {video_path}...", file=sys.stderr)
        transcriber = Transcriber()
        transcription = transcriber.transcribe(audio_file_path=video_path)
        print("Transcription complete", file=sys.stderr)
        
        # Find clips
        print("Finding clips...", file=sys.stderr)
        clipfinder = ClipFinder()
        clips = clipfinder.find_clips(transcription=transcription)
        print(f"Found {len(clips)} clips", file=sys.stderr)
        
        # Convert clips to JSON format
        clips_data = []
        transcription_text = getattr(transcription, 'transcription', '')
        
        for i, clip in enumerate(clips):
            start_char = getattr(clip, 'start_char', 0)
            end_char = getattr(clip, 'end_char', len(transcription_text))
            
            # Generate title from transcription snippet
            clip_text = transcription_text[start_char:end_char] if transcription_text else f"Clip {i + 1}"
            clip_title = clip_text.strip()[:100] if clip_text.strip() else f"Clip {i + 1}"
            
            clips_data.append({
                'id': f'{video_id}-clip-{i}',
                'object': 'clip',
                'created': int(os.path.getmtime(video_path)),
                'start_time': float(clip.start_time),
                'end_time': float(clip.end_time),
                'start_char': int(start_char),
                'end_char': int(end_char),
                'video_id': video_id,
                'favorited': False,
                'deleted': False,
                'scores': {'embedding_norm': 0},
                'title': clip_title,
            })
        
        # Get transcription data
        words_data = []
        if hasattr(transcription, 'words'):
            for word in transcription.words:
                words_data.append({
                    'start_char': int(getattr(word, 'start_char', 0)),
                    'end_char': int(getattr(word, 'end_char', 0)),
                    'start_time': float(getattr(word, 'start_time', 0)),
                    'end_time': float(getattr(word, 'end_time', 0)),
                })
        
        # Get video duration
        try:
            import subprocess
            result = subprocess.run(
                ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', video_path],
                capture_output=True,
                text=True
            )
            if result.returncode == 0:
                probe_data = json.loads(result.stdout)
                duration = float(probe_data.get('format', {}).get('duration', 0))
            else:
                duration = 0
        except:
            duration = 0
        
        return jsonify({
            'clips': clips_data,
            'transcript': {
                'id': f'{video_id}-transcript',
                'object': 'transcript',
                'created': int(os.path.getmtime(video_path)),
                'words': words_data,
                'transcription': transcription_text
            },
            'metadata': {
                'duration': duration,
                'file_size': os.path.getsize(video_path),
                'clips_count': len(clips_data),
            }
        })
    
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error generating clips: {error_trace}", file=sys.stderr)
        return jsonify({
            'error': str(e),
            'traceback': error_trace
        }), 500
    
    finally:
        # Cleanup temp directory
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)


@app.route('/youtube/process', methods=['POST'])
def process_youtube():
    """Start async YouTube video processing - returns job_id immediately"""
    if not YT_DLP_AVAILABLE:
        return jsonify({'error': 'yt-dlp not installed'}), 500
    
    if not CLIPSAI_AVAILABLE:
        return jsonify({
            'error': 'ClipsAI not installed',
            'suggestion': 'Install with: pip install clipsai'
        }), 500
    
    data = request.get_json()
    url = data.get('url')
    max_duration = data.get('max_duration', 30.0)  # Default 30 seconds
    
    if not url:
        return jsonify({'error': 'YouTube URL is required'}), 400
    
    # Validate YouTube URL
    if 'youtube.com' not in url and 'youtu.be' not in url:
        return jsonify({'error': 'Invalid YouTube URL'}), 400
    
    # Create job
    job_id = str(uuid.uuid4())
    with jobs_lock:
        jobs[job_id] = {
            'status': 'queued',
            'progress': 0,
            'message': 'Job queued, starting processing...',
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat(),
            'max_duration': max_duration,  # Store max_duration for this job
        }
    
    # Start processing in background thread
    thread = threading.Thread(target=process_youtube_async, args=(job_id, url, max_duration))
    thread.daemon = True
    thread.start()
    
    return jsonify({
        'job_id': job_id,
        'status': 'queued',
        'message': 'Processing started. Use /jobs/{job_id}/status to check progress.'
    })


def process_youtube_sync():
    """Old synchronous version - kept for backward compatibility if needed"""
    if not YT_DLP_AVAILABLE:
        return jsonify({'error': 'yt-dlp not installed'}), 500
    
    if not CLIPSAI_AVAILABLE:
        return jsonify({
            'error': 'ClipsAI not installed',
            'suggestion': 'Install with: pip install clipsai'
        }), 500
    
    data = request.get_json()
    url = data.get('url')
    
    if not url:
        return jsonify({'error': 'YouTube URL is required'}), 400
    
    # Validate YouTube URL
    if 'youtube.com' not in url and 'youtu.be' not in url:
        return jsonify({'error': 'Invalid YouTube URL'}), 400
    
    download_temp_dir = tempfile.mkdtemp(prefix='yt-process-')
    
    try:
        # Step 1: Download video
        print("Downloading video from YouTube...", file=sys.stderr)
        ydl_opts_info = {
            'quiet': True,
            'no_warnings': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts_info) as ydl:
            info = ydl.extract_info(url, download=False)
            video_title = info.get('title', 'Downloaded Video')
            duration = info.get('duration', 0)
        
        safe_title = "".join(c for c in video_title if c.isalnum() or c in (' ', '-', '_')).rstrip()
        safe_title = safe_title[:100]
        
        ydl_opts = {
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'outtmpl': os.path.join(download_temp_dir, f'{safe_title}.%(ext)s'),
            'quiet': False,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        
        # Find downloaded file
        files = os.listdir(download_temp_dir)
        video_file = None
        for f in files:
            if f.endswith(('.mp4', '.webm', '.mkv')):
                video_file = os.path.join(download_temp_dir, f)
                break
        
        if not video_file:
            return jsonify({'error': 'Failed to download video file'}), 500
        
        file_size = os.path.getsize(video_file)
        video_id = f'youtube-{os.urandom(8).hex()}'
        
        # Step 2: Generate clips
        print("Generating clips with ClipsAI...", file=sys.stderr)
        transcriber = Transcriber()
        transcription = transcriber.transcribe(audio_file_path=video_file)
        
        clipfinder = ClipFinder()
        clips = clipfinder.find_clips(transcription=transcription)
        
        # Convert clips to JSON format
        clips_data = []
        transcription_text = getattr(transcription, 'transcription', '')
        
        for i, clip in enumerate(clips):
            start_char = getattr(clip, 'start_char', 0)
            end_char = getattr(clip, 'end_char', len(transcription_text))
            
            clip_text = transcription_text[start_char:end_char] if transcription_text else f"Clip {i + 1}"
            clip_title = clip_text.strip()[:100] if clip_text.strip() else f"Clip {i + 1}"
            
            clips_data.append({
                'id': f'{video_id}-clip-{i}',
                'object': 'clip',
                'created': int(os.path.getmtime(video_file)),
                'start_time': float(clip.start_time),
                'end_time': float(clip.end_time),
                'start_char': int(start_char),
                'end_char': int(end_char),
                'video_id': video_id,
                'favorited': False,
                'deleted': False,
                'scores': {'embedding_norm': 0},
                'title': clip_title,
            })
        
        # Get transcription data
        words_data = []
        if hasattr(transcription, 'words'):
            for word in transcription.words:
                words_data.append({
                    'start_char': int(getattr(word, 'start_char', 0)),
                    'end_char': int(getattr(word, 'end_char', 0)),
                    'start_time': float(getattr(word, 'start_time', 0)),
                    'end_time': float(getattr(word, 'end_time', 0)),
                })
        
        # Read video file and return as base64 (for small files) or save to persistent storage
        # For now, we'll return the path and let Next.js handle storage
        # In production, you'd want to save to a persistent location
        
        return jsonify({
            'video': {
                'id': video_id,
                'object': 'video',
                'clips': clips_data,
                'created': int(os.path.getmtime(video_file)),
                'metadata': {
                    'duration': duration or 0,
                    'file_size': file_size,
                    'mime_type': f'video/{os.path.splitext(video_file)[1][1:]}',
                },
                'source': video_file,  # Temporary path - Next.js should copy this
                'status': 'complete',
                'title': video_title,
            },
            'transcript': {
                'id': f'{video_id}-transcript',
                'object': 'transcript',
                'created': int(os.path.getmtime(video_file)),
                'words': words_data,
                'transcription': transcription_text
            },
            'temp_video_path': video_file,  # For Next.js to copy
            'temp_dir': download_temp_dir,  # For cleanup
        })
    
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error processing YouTube video: {error_trace}", file=sys.stderr)
        
        # Cleanup on error
        if os.path.exists(download_temp_dir):
            shutil.rmtree(download_temp_dir, ignore_errors=True)
        
        return jsonify({
            'error': str(e),
            'traceback': error_trace
        }), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
