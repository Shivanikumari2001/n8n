#!/usr/bin/env python3
"""
Script to populate ChromaDB with NVR streaming and recording information.
Run this after starting ChromaDB to add documentation.
"""

import sys
import os

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("⚠️  python-dotenv not installed. .env file will not be loaded automatically.")
    print("   Install it with: pip install python-dotenv")
    print("   Or set OPENROUTER_API_KEY environment variable manually.")
except Exception as e:
    print(f"⚠️  Warning: Could not load .env file: {e}")
    print("   Make sure .env file exists in the current directory.")

try:
    import chromadb
    from chromadb.config import Settings
    from chromadb.utils import embedding_functions
except ImportError:
    print("❌ ChromaDB Python client not installed!")
    print("   Install it with: pip install chromadb")
    sys.exit(1)

# ChromaDB configuration
CHROMADB_HOST = "localhost"
CHROMADB_PORT = 8000
COLLECTION_NAME = "nvr_streaming_recording"

def create_openrouter_embedding_function(api_key: str):
    """Create a custom embedding function that uses OpenRouter API."""
    try:
        from openai import OpenAI
        import numpy as np
    except ImportError as e:
        if 'openai' in str(e):
            print("❌ openai package is required. Install it with: pip install openai")
        else:
            print("❌ numpy package is required. Install it with: pip install numpy")
        raise
    
    class OpenRouterEmbeddingFunction:
        def __init__(self, api_key: str):
            self.client = OpenAI(
                api_key=api_key,
                base_url="https://openrouter.ai/api/v1"
            )
            # OpenRouter uses OpenAI-compatible model names for embeddings
            self.model = "text-embedding-3-small"
        
        def name(self):
            """Return the name of the embedding function."""
            return "openrouter"
        
        def __call__(self, input):
            """Generate embeddings using OpenRouter API.
            
            Args:
                input: Can be a single string or a list of strings
            """
            try:
                # Handle both single string and list of strings
                if isinstance(input, str):
                    input_list = [input]
                else:
                    input_list = input
                
                response = self.client.embeddings.create(
                    model=self.model,
                    input=input_list
                )
                # Return as numpy arrays (ChromaDB expects this)
                return [np.array(item.embedding, dtype=np.float32) for item in response.data]
            except Exception as e:
                print(f"❌ Error generating embeddings via OpenRouter: {e}")
                raise
        
        def embed_query(self, input):
            """Generate embedding for query string(s).
            
            Args:
                input: Query string(s) to embed (can be str or list of str)
            
            Returns:
                List of numpy arrays (embedding vectors)
            """
            # Handle input - convert to list if single string
            if isinstance(input, str):
                query_texts = [input]
            elif isinstance(input, list):
                query_texts = input
            else:
                query_texts = [str(input)]
            
            # Generate embeddings for all query strings
            try:
                response = self.client.embeddings.create(
                    model=self.model,
                    input=query_texts  # Can be list of strings
                )
                # Return as numpy arrays (ChromaDB expects this)
                return [np.array(item.embedding, dtype=np.float32) for item in response.data]
            except Exception as e:
                print(f"❌ Error generating query embedding via OpenRouter: {e}")
                raise
    
    return OpenRouterEmbeddingFunction(api_key)

def get_chromadb_client():
    """Get ChromaDB HTTP client."""
    try:
        client = chromadb.HttpClient(
            host=CHROMADB_HOST,
            port=CHROMADB_PORT,
            settings=Settings(
                allow_reset=False,
                anonymized_telemetry=False,
            ),
        )
        client.heartbeat()
        print("✅ ChromaDB is running and accessible")
        return client
    except Exception as e:
        print(f"❌ Cannot connect to ChromaDB: {e}")
        print("   Start it with: docker-compose up -d chromadb")
        print("   Or: docker run -d -p 8000:8000 chromadb/chroma:latest")
        return None

def create_or_get_collection(client):
    """Create the collection with OpenRouter embedding function."""
    # Get OpenRouter API key from environment
    openrouter_api_key = os.environ.get('OPENROUTER_API_KEY')
    if not openrouter_api_key:
        print("❌ OPENROUTER_API_KEY environment variable is required")
        return None

    # Create OpenAI embedding function configured for OpenRouter
    # OpenRouter uses OpenAI-compatible API, so we can use OpenAIEmbeddingFunction
    # but we need to set the base URL to OpenRouter's endpoint
    try:
        # Check if OpenAIEmbeddingFunction supports base_url parameter
        # If not, we'll need to create a custom embedding function
        try:
            # Try with openai_api_base parameter (if supported)
            openai_ef = embedding_functions.OpenAIEmbeddingFunction(
                api_key=openrouter_api_key,
                model_name="text-embedding-3-small",
                openai_api_base="https://openrouter.ai/api/v1"
            )
            print(f"✅ OpenRouter embedding function created (model: text-embedding-3-small via OpenRouter)")
        except TypeError:
            # If openai_api_base is not supported, create custom embedding function
            print("⚠️  OpenAIEmbeddingFunction doesn't support base_url, creating custom OpenRouter embedding function...")
            openai_ef = create_openrouter_embedding_function(openrouter_api_key)
            print(f"✅ Custom OpenRouter embedding function created (model: text-embedding-3-small)")
    except Exception as e:
        print(f"❌ Failed to create OpenRouter embedding function: {e}")
        return None
    
    # Check if collection already exists and handle it
    try:
        existing_collection = client.get_collection(name=COLLECTION_NAME)
        count = existing_collection.count()
        print(f"⚠️  Collection '{COLLECTION_NAME}' already exists with {count} documents")
        print(f"⚠️  Deleting and recreating to ensure proper embedding function configuration...")

        # Delete existing collection
        client.delete_collection(name=COLLECTION_NAME)
        print(f"   ✅ Deleted existing collection")

    except Exception:
        print(f"   Collection '{COLLECTION_NAME}' not found, will create new one")

    # Create collection with embedding function
    try:
        print(f"Creating collection '{COLLECTION_NAME}' with OpenRouter embedding function...")
        collection = client.create_collection(
            name=COLLECTION_NAME,
            embedding_function=openai_ef,
            metadata={"hnsw:space": "cosine"}  # Cosine similarity for better semantic search
        )
        print(f"✅ Created collection '{COLLECTION_NAME}' with OpenRouter embedding function")
        print(f"   Embedding Function: OpenRouter (text-embedding-3-small)")
        print(f"   Distance Metric: Cosine Similarity")
        return collection
    except Exception as create_error:
        print(f"❌ Failed to create collection: {create_error}")
        return None

def add_documents(collection):
    """Add NVR documentation to ChromaDB."""
    
    documents = [
        # Streaming Protocols
        {
            "id": "doc_rtsp",
            "document": "RTSP (Real-Time Streaming Protocol) is supported for live video streaming. To configure RTSP streaming, go to NVR settings > Streaming > RTSP. Enable RTSP server and set the port (default: 554). RTSP URL format: rtsp://nvr-ip:port/stream-path",
            "metadata": {"category": "streaming", "topic": "protocols", "protocol": "RTSP"}
        },
        {
            "id": "doc_rtmp",
            "document": "RTMP streaming is available for external streaming services like YouTube Live, Twitch, or Facebook Live. Configure RTMP in NVR settings > Streaming > RTMP. Enter the RTMP server URL and stream key provided by your streaming platform.",
            "metadata": {"category": "streaming", "topic": "protocols", "protocol": "RTMP"}
        },
        {
            "id": "doc_hls",
            "document": "HLS (HTTP Live Streaming) protocol is supported for web-based playback. To set up HLS streaming, enable it in NVR settings > Streaming > HLS. HLS creates adaptive bitrate streams that work well in web browsers. The HLS stream URL format: http://nvr-ip:port/hls/stream.m3u8",
            "metadata": {"category": "streaming", "topic": "protocols", "protocol": "HLS"}
        },
        
        # Recording Configuration
        {
            "id": "doc_bitrates",
            "document": "Recording bitrates can be configured in NVR settings > Recording > Bitrate. Available options: 1 Mbps (low quality, saves storage), 2 Mbps (medium quality, balanced), 4 Mbps (high quality, uses more storage). Higher bitrates provide better video quality but consume more storage space.",
            "metadata": {"category": "recording", "topic": "bitrate", "settings": "recording"}
        },
        {
            "id": "doc_codecs",
            "document": "NVR supports H.264 and H.265 codecs for video recording. H.264 is widely compatible and uses more storage. H.265 (HEVC) provides better compression, reducing storage by up to 50% while maintaining quality. Configure codec in NVR settings > Recording > Codec. H.265 is recommended for newer systems.",
            "metadata": {"category": "recording", "topic": "codec", "settings": "recording"}
        },
        {
            "id": "doc_resolution",
            "document": "Video resolution options: 720p (1280x720), 1080p (1920x1080), and 4K (3840x2160). Configure resolution in NVR settings > Video > Resolution. Higher resolutions provide clearer images but require more storage and bandwidth. 1080p is recommended for most use cases.",
            "metadata": {"category": "streaming", "topic": "quality", "settings": "video"}
        },
        
        # Recording Schedules
        {
            "id": "doc_schedule_continuous",
            "document": "Continuous recording mode records video 24/7 without interruption. This mode uses the most storage but ensures no events are missed. Configure in NVR settings > Recording > Schedule > Continuous.",
            "metadata": {"category": "recording", "topic": "schedule", "mode": "continuous"}
        },
        {
            "id": "doc_schedule_motion",
            "document": "Motion-triggered recording only records when motion is detected, saving significant storage space. Configure motion detection zones and sensitivity in NVR settings > Recording > Schedule > Motion Triggered. Adjust sensitivity to avoid false alarms.",
            "metadata": {"category": "recording", "topic": "schedule", "mode": "motion"}
        },
        {
            "id": "doc_schedule_custom",
            "document": "Custom recording schedule allows you to set specific times for recording. For example, record only during business hours (9 AM - 5 PM) or during specific days. Configure in NVR settings > Recording > Schedule > Custom. Set start time, end time, and days of week.",
            "metadata": {"category": "recording", "topic": "schedule", "mode": "custom"}
        },
        
        # Storage Management
        {
            "id": "doc_storage_format",
            "document": "Recordings are stored in H.264 or H.265 format depending on codec settings. Files are typically saved as MP4 or proprietary NVR format. Storage location can be configured in NVR settings > Storage > Path. Ensure sufficient disk space is available.",
            "metadata": {"category": "recording", "topic": "storage", "format": "video"}
        },
        {
            "id": "doc_storage_retention",
            "document": "Recording retention period determines how long videos are kept before automatic deletion. Configure in NVR settings > Storage > Retention. Options: 7 days, 30 days, 90 days, or custom. When storage is full, oldest recordings are deleted first (FIFO - First In First Out).",
            "metadata": {"category": "recording", "topic": "storage", "retention": "management"}
        },
        {
            "id": "doc_storage_management",
            "document": "Storage management includes monitoring disk usage, setting up automatic cleanup, and configuring storage paths. Access in NVR settings > Storage > Management. View current usage, set alerts when storage is low (e.g., 80% full), and configure backup locations.",
            "metadata": {"category": "recording", "topic": "storage", "management": "settings"}
        },
        
        # Playback Features
        {
            "id": "doc_playback_time",
            "document": "Time-based playback allows you to search and play recordings by date and time. Use the calendar and time picker in the playback interface. Navigate to specific dates and times to review recorded footage. Supports fast forward, rewind, and frame-by-frame playback.",
            "metadata": {"category": "recording", "topic": "playback", "feature": "time-based"}
        },
        {
            "id": "doc_playback_event",
            "document": "Event-based navigation lets you jump between motion events or alarm triggers. In playback mode, click 'Events' to see a timeline of all detected events. Click any event marker to jump directly to that moment in the recording.",
            "metadata": {"category": "recording", "topic": "playback", "feature": "event-based"}
        },
        
        # Stream Configuration
        {
            "id": "doc_stream_quality",
            "document": "Stream quality settings affect both live viewing and recording. Configure in NVR settings > Streaming > Quality. Options: Low (reduces bandwidth), Medium (balanced), High (best quality). Stream quality is separate from recording quality - you can have high-quality recording with lower stream quality to save bandwidth.",
            "metadata": {"category": "streaming", "topic": "configuration", "setting": "quality"}
        },
        {
            "id": "doc_stream_bitrate",
            "document": "Stream bitrate configuration affects bandwidth usage and video quality. Higher bitrates provide better quality but require more bandwidth. Configure in NVR settings > Streaming > Bitrate. Recommended: 2-4 Mbps for 1080p streams. Adjust based on your network capacity and number of simultaneous viewers.",
            "metadata": {"category": "streaming", "topic": "configuration", "setting": "bitrate"}
        },
    ]
    
    # Prepare data for ChromaDB
    ids = [doc["id"] for doc in documents]
    texts = [doc["document"] for doc in documents]
    metadatas = [doc["metadata"] for doc in documents]
    
    # Add documents to ChromaDB
    try:
        print(f"Adding {len(documents)} documents to ChromaDB...")
        collection.add(
            ids=ids,
            documents=texts,
            metadatas=metadatas
        )
        print(f"✅ Successfully added {len(documents)} documents to ChromaDB")
        return True
    except Exception as e:
        print(f"❌ Error adding documents: {type(e).__name__}: {e}")
        return False

def verify_collection(collection):
    """Verify the collection has documents and embedding function."""
    try:
        count = collection.count()
        print(f"✅ Collection '{COLLECTION_NAME}' now contains {count} documents")
        
        # Try to verify embedding function is working
        print(f"\n🔍 Verifying embedding function...")
        print(f"   Collection object: {collection}")
        
        # Check if we can get the collection metadata
        metadata = collection.metadata
        if metadata:
            print(f"   Collection metadata: {metadata}")
        
        # Try a simple query to verify embeddings work
        if count > 0:
            try:
                test_results = collection.query(
                    query_texts=["test"],
                    n_results=1,
                )
                print(f"   ✅ Embedding function is working! Test query succeeded.")
                print(f"   Returned {len(test_results['ids'][0])} results")
            except Exception as query_error:
                print(f"   ❌ Warning: Test query failed: {query_error}")
                print(f"   This means the collection may not have embedding function properly configured")
        
        return True
    except Exception as e:
        print(f"❌ Error verifying collection: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("ChromaDB NVR Documentation Population Script")
    print("=" * 60)
    print()
    
    # Step 0: Get ChromaDB client
    print("Step 0: Connecting to ChromaDB...")
    client = get_chromadb_client()
    if not client:
        print("\n❌ Please start ChromaDB first:")
        print("   docker-compose up -d chromadb")
        print("   OR")
        print("   docker run -d -p 8000:8000 chromadb/chroma:latest")
        sys.exit(1)
    print()
    
    # Step 1: Create or get collection
    print("Step 1: Creating/getting collection...")
    collection = create_or_get_collection(client)
    if not collection:
        print("\n❌ Failed to create collection. Exiting.")
        sys.exit(1)
    print()
    
    # Step 2: Add documents
    print("Step 2: Adding NVR documentation...")
    if not add_documents(collection):
        print("\n❌ Failed to add documents. Exiting.")
        sys.exit(1)
    print()
    
    # Step 3: Verify
    print("Step 3: Verifying collection...")
    verify_collection(collection)
    print()
    
    print("=" * 60)
    print("✅ ChromaDB population complete!")
    print("=" * 60)
    print()
    print("You can now query NVR information using:")
    print('  curl -X POST http://localhost:5678/webhook/events-query \\')
    print('    -H "Content-Type: application/json" \\')
    print('    -d \'{"message": "How to set up HLS streaming?"}\'')

