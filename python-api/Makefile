.PHONY: setup start install clean

setup:
	@echo "Setting up Python API..."
	python3 -m venv venv
	. venv/bin/activate && pip install --upgrade pip
	. venv/bin/activate && pip install -r requirements.txt
	@echo "Setup complete! Run 'make start' to start the server."

install:
	. venv/bin/activate && pip install -r requirements.txt

start:
	@if [ ! -d "venv" ]; then \
		echo "Virtual environment not found. Running setup..."; \
		make setup; \
	fi
	. venv/bin/activate && python app.py

clean:
	rm -rf venv
	rm -rf __pycache__
	find . -type d -name __pycache__ -exec rm -r {} +
	find . -type f -name "*.pyc" -delete
