# ============================================
# Events Query with Conversation History
# ============================================
# Note: clientId or admin_client_id is required for conversation storage
# Use the workflow: n8n-events-query-with-history.json
# Supports both "clientId" and "admin_client_id" field names

curl -X POST http://localhost:5678/webhook/events-query \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "client-123",
    "message": "give me latest event"
  }'

# Alternative: using admin_client_id
curl -X POST http://localhost:5678/webhook/events-query \
  -H "Content-Type: application/json" \
  -d '{
    "admin_client_id": "9534ea08-5107-4475-b935-5d0f5a8bd498",
    "message": "give me the camername of the latest event"
  }'



# Latest event from today
curl -X POST http://localhost:5678/webhook/events-query \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "client-123",
    "message": "show me the most recent event from today"
  }'


curl -X POST http://localhost:5678/webhook/events-query \
  -H "Content-Type: application/json" \
  -d '{"clientId": "client-123", "message": "show me events from today"}'

# Yesterday's unresolved events
curl -X POST http://localhost:5678/webhook/events-query \
  -H "Content-Type: application/json" \
  -d '{"clientId": "client-123", "message": "get unresolved labelled events from yesterday"}'

# Last week with limit
curl -X POST http://localhost:5678/webhook/events-query \
  -H "Content-Type: application/json" \
  -d '{"clientId": "client-123", "message": "list 20 events from last 7 days"}'


curl -X POST http://localhost:5678/webhook/events-query \
     -H "Content-Type: application/json" \
     -d '{"clientId": "client-123", "message": "give me the name of camera of the latest event"}'

# ============================================
# NVR Streaming and Recording Queries (ChromaDB)
# ============================================
# These queries are automatically routed to ChromaDB for semantic search

# RTSP streaming configuration
curl -X POST http://localhost:5678/webhook/events-query \
  -H "Content-Type: application/json" \
  -d '{"clientId": "client-123", "message": "How do I configure RTSP streaming?"}'

# Recording bitrates
curl -X POST http://localhost:5678/webhook/events-query \
  -H "Content-Type: application/json" \
  -d '{"clientId": "client-123", "message": "What recording bitrates are available?"}'

# HLS streaming setup
curl -X POST http://localhost:5678/webhook/events-query \
  -H "Content-Type: application/json" \
  -d '{"clientId": "client-123", "message": "How to set up HLS streaming?"}'

# Recording codecs
curl -X POST http://localhost:5678/webhook/events-query \
  -H "Content-Type: application/json" \
  -d '{"clientId": "client-123", "message": "What codecs are supported for recording?"}'

# Stream quality settings
curl -X POST http://localhost:5678/webhook/events-query \
  -H "Content-Type: application/json" \
  -d '{"clientId": "client-123", "message": "What video resolutions are supported?"}'

# Recording schedules
curl -X POST http://localhost:5678/webhook/events-query \
  -H "Content-Type: application/json" \
  -d '{"clientId": "client-123", "message": "How do I configure recording schedules?"}'

# Storage management
curl -X POST http://localhost:5678/webhook/events-query \
  -H "Content-Type: application/json" \
  -d '{"clientId": "client-123", "message": "How is video storage managed?"}'

# General NVR streaming info
curl -X POST http://localhost:5678/webhook/events-query \
  -H "Content-Type: application/json" \
  -d '{"clientId": "client-123", "message": "Tell me about NVR streaming capabilities"}'

# ============================================
# Conversation History Retrieval
# ============================================
# Use the workflow: n8n-get-conversation-history.json
# Supports both "clientId" and "admin_client_id" field names

# Get full conversation history for a client using clientId
curl -X GET "http://localhost:5678/webhook/conversation-history?clientId=client-123"

# Using admin_client_id as query parameter
curl -X GET "http://localhost:5678/webhook/conversation-history?clientId=9534ea08-5107-4475-b935-5d0f5a8bd498"

# Alternative: POST with clientId in body
curl -X GET http://localhost:5678/webhook/conversation-history \
  -H "Content-Type: application/json" \
  -d '{"clientId": "client-123"}'

# See curls-nvr.md for more NVR examples and ChromaDB API commands