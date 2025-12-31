# ChromaDB NVR Query Node

This node queries ChromaDB for NVR (Network Video Recorder) streaming and recording information using semantic search.

## Features

- Semantic search for NVR-related documentation
- Supports metadata filtering
- Configurable number of results
- Automatic collection creation if it doesn't exist

## Setup

### 1. Install ChromaDB

You can run ChromaDB using Docker:

```bash
docker run -d \
  -p 8000:8000 \
  -v chroma_data:/chroma/chroma \
  chromadb/chroma:latest
```

Or install it locally:
```bash
pip install chromadb
chroma run --path ./chroma_data --port 8000
```

### 2. Populate ChromaDB with NVR Information

You need to add NVR streaming and recording documentation to ChromaDB. Here's a Python script example:

```python
from chromadb import Client, Settings

client = Client(Settings(
    chroma_db_impl="duckdb+parquet",
    persist_directory="./chroma_data"
))

collection = client.create_collection(
    name="nvr_streaming_recording",
    metadata={"hnsw:space": "cosine"}
)

# Add documents about NVR streaming and recording
documents = [
    "NVR supports RTSP streaming protocol for live video feeds",
    "Recording can be configured with different bitrates: 1Mbps, 2Mbps, 4Mbps",
    "Storage management: Recordings are stored in H.264 format with configurable retention periods",
    "Stream quality settings: 720p, 1080p, and 4K resolutions are supported",
    "RTMP streaming is available for external streaming services",
    "HLS streaming protocol is supported for web-based playback",
    "Recording schedule can be set to continuous, motion-triggered, or scheduled",
    "Codec options: H.264, H.265 for efficient storage",
    "Stream bitrate configuration affects both quality and bandwidth usage",
    "Playback supports time-based search and event-based navigation"
]

ids = [f"doc_{i}" for i in range(len(documents))]
metadatas = [
    {"category": "streaming", "topic": "protocols"},
    {"category": "recording", "topic": "bitrate"},
    {"category": "recording", "topic": "storage"},
    {"category": "streaming", "topic": "quality"},
    {"category": "streaming", "topic": "protocols"},
    {"category": "streaming", "topic": "protocols"},
    {"category": "recording", "topic": "schedule"},
    {"category": "recording", "topic": "codec"},
    {"category": "streaming", "topic": "configuration"},
    {"category": "recording", "topic": "playback"}
]

collection.add(
    documents=documents,
    ids=ids,
    metadatas=metadatas
)
```

## Usage

The node will automatically:
1. Connect to ChromaDB at the specified host and port
2. Query the collection using semantic search
3. Return the most relevant documents based on the query text

## Example Queries

- "How do I configure RTSP streaming?"
- "What recording bitrates are available?"
- "How to set up HLS streaming?"
- "What codecs are supported for recording?"
- "How to configure recording schedules?"

## Parameters

- **ChromaDB Host**: Server hostname (default: localhost)
- **ChromaDB Port**: Server port (default: 8000)
- **Collection Name**: Name of the ChromaDB collection (default: nvr_streaming_recording)
- **Query Text**: Natural language query about NVR
- **Number of Results**: How many documents to retrieve (default: 5)
- **Where Filter**: Optional JSON metadata filter



