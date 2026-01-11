# ClipsAI Python API

API Python separada para processamento de vídeos usando ClipsAI e yt-dlp.

## Setup

### 1. Criar ambiente virtual (venv)

```bash
cd python-api
python3 -m venv venv
```

### 2. Ativar ambiente virtual

**Linux/macOS:**
```bash
source venv/bin/activate
```

**Windows:**
```bash
venv\Scripts\activate
```

### 3. Instalar dependências

```bash
pip install -r requirements.txt
```

### 4. Instalar dependências do sistema

**Linux (Ubuntu/Debian):**
```bash
sudo apt install ffmpeg libmagic1
```

**macOS:**
```bash
brew install ffmpeg libmagic
```

**Windows:**
- Baixe ffmpeg de https://ffmpeg.org/download.html
- libmagic geralmente vem com Python

### 5. Executar servidor

```bash
python app.py
```

O servidor estará disponível em `http://localhost:5000`

## Endpoints

### GET `/health`
Verifica se o servidor está rodando e se as dependências estão instaladas.

### POST `/youtube/download`
Baixa vídeo do YouTube.

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=..."
}
```

**Response:**
```json
{
  "success": true,
  "video_path": "/tmp/...",
  "filename": "video.mp4",
  "title": "Video Title",
  "duration": 123.45,
  "file_size": 1234567
}
```

### POST `/clips/generate`
Gera clips de um vídeo usando ClipsAI.

**Request:** FormData
- `video`: arquivo de vídeo
- `videoId`: ID do vídeo (opcional)
- `title`: título do vídeo (opcional)

**Response:**
```json
{
  "clips": [...],
  "transcript": {...},
  "metadata": {...}
}
```

### POST `/youtube/process`
Baixa vídeo do YouTube e gera clips em uma única chamada.

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=..."
}
```

**Response:**
```json
{
  "video": {...},
  "transcript": {...},
  "temp_video_path": "/tmp/...",
  "temp_dir": "/tmp/..."
}
```

## Variáveis de Ambiente

- `PORT`: Porta do servidor (padrão: 5000)

## Notas

- Os arquivos temporários são criados em `/tmp` e devem ser limpos pelo cliente
- Para produção, considere usar um sistema de filas (Redis, RabbitMQ) para processamento assíncrono
- Para vídeos grandes, considere usar armazenamento persistente (S3, etc.)

## Warnings Conhecidos

### Warning do PyTorch sobre pynvml

Ao iniciar o servidor, você pode ver um warning:
```
FutureWarning: The pynvml package is deprecated. Please install nvidia-ml-py instead.
```

**Isso é normal e pode ser ignorado.** O `pynvml` é uma dependência do `clipsai` e ainda é necessário. O `nvidia-ml-py` já está instalado como dependência. Este warning não afeta a funcionalidade da aplicação e será resolvido quando o `clipsai` atualizar suas dependências.
