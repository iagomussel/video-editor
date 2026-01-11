#!/bin/bash
# Start script for Python API

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "Virtual environment not found. Running setup..."
    ./setup.sh
fi

# Activate virtual environment
source venv/bin/activate

# Check if dependencies are installed
if ! python -c "import flask" 2>/dev/null; then
    echo "Dependencies not installed. Installing..."
    pip install -r requirements.txt
fi

# Start the server
echo "Starting Python API server on http://localhost:5000"
echo "Press Ctrl+C to stop"
python app.py
