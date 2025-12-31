#!/usr/bin/env python3
"""
Script to populate ChromaDB with Variphi company information.
Run this after starting ChromaDB to add company documentation.
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
COLLECTION_NAME = "variphi"

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
    """Add Variphi company information to ChromaDB."""
    
    documents = [
        # Company Overview
        {
            "id": "doc_company_overview",
            "document": "Variphi is an AI company founded in 2024. The company specializes in artificial intelligence solutions and services. Variphi focuses on developing innovative AI technologies and providing AI-powered solutions to businesses.",
            "metadata": {"category": "company", "topic": "overview", "type": "general"}
        },
        {
            "id": "doc_founder",
            "document": "Variphi was founded by Nitish Mishra in 2024. Nitish Mishra is the founder and leader of the company, driving its vision and strategic direction in the AI industry.",
            "metadata": {"category": "company", "topic": "founder", "person": "Nitish Mishra"}
        },
        {
            "id": "doc_founding_year",
            "document": "Variphi was established in the year 2024. As a relatively new company, Variphi is focused on building cutting-edge AI solutions and establishing itself as a leader in the artificial intelligence space.",
            "metadata": {"category": "company", "topic": "history", "year": "2024"}
        },
        
        # Company Mission & Vision
        {
            "id": "doc_mission",
            "document": "Variphi's mission is to leverage artificial intelligence to solve complex business problems and create innovative solutions. The company aims to make AI accessible and practical for businesses of all sizes, helping them transform their operations through intelligent automation and data-driven insights.",
            "metadata": {"category": "company", "topic": "mission", "type": "values"}
        },
        {
            "id": "doc_vision",
            "document": "Variphi envisions a future where AI seamlessly integrates into business operations, enabling smarter decision-making, improved efficiency, and enhanced customer experiences. The company strives to be at the forefront of AI innovation and technology.",
            "metadata": {"category": "company", "topic": "vision", "type": "values"}
        },
        
        # Technology & Solutions
        {
            "id": "doc_ai_technology",
            "document": "Variphi develops and implements advanced AI technologies including machine learning, deep learning, natural language processing, and computer vision. The company builds custom AI solutions tailored to specific business needs, from predictive analytics to intelligent automation systems.",
            "metadata": {"category": "technology", "topic": "ai", "type": "solutions"}
        },
        {
            "id": "doc_services",
            "document": "Variphi offers comprehensive AI services including AI consulting, custom AI development, AI integration services, and AI-powered analytics. The company helps businesses identify AI opportunities, develop AI strategies, and implement AI solutions that drive real business value.",
            "metadata": {"category": "business", "topic": "services", "type": "offerings"}
        },
        
        # Industry Focus
        {
            "id": "doc_industries",
            "document": "Variphi serves various industries including security and surveillance, enterprise software, data analytics, and automation. The company's AI solutions are particularly strong in video analytics, event detection, and intelligent monitoring systems for security applications.",
            "metadata": {"category": "business", "topic": "industries", "type": "markets"}
        },
        {
            "id": "doc_security_solutions",
            "document": "Variphi specializes in AI-powered security and surveillance solutions. The company develops intelligent video analytics systems that can detect events, analyze behavior, and provide real-time alerts. These solutions help organizations enhance their security operations through advanced AI technology.",
            "metadata": {"category": "technology", "topic": "security", "application": "surveillance"}
        },
        
        # Company Culture & Values
        {
            "id": "doc_innovation",
            "document": "Innovation is at the core of Variphi's culture. The company encourages creative thinking, continuous learning, and experimentation with new AI technologies. Variphi believes in pushing the boundaries of what's possible with artificial intelligence.",
            "metadata": {"category": "company", "topic": "culture", "value": "innovation"}
        },
        {
            "id": "doc_quality",
            "document": "Variphi is committed to delivering high-quality AI solutions that meet the highest standards of performance, reliability, and accuracy. The company emphasizes thorough testing, continuous improvement, and customer satisfaction in all its projects.",
            "metadata": {"category": "company", "topic": "culture", "value": "quality"}
        },
        
        # Contact & Communication
        {
            "id": "doc_contact",
            "document": "For inquiries about Variphi's services, partnerships, or general information, you can reach out through the company's official channels. Variphi maintains professional communication standards and is responsive to business inquiries and collaboration opportunities.",
            "metadata": {"category": "company", "topic": "contact", "type": "information"}
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
    print("ChromaDB Variphi Company Information Population Script")
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
    print("Step 2: Adding Variphi company information...")
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
    print("You can now query Variphi information using:")
    print('  curl -X POST http://localhost:5678/webhook/events-query \\')
    print('    -H "Content-Type: application/json" \\')
    print('    -d \'{"message": "Tell me about Variphi company"}\'')

