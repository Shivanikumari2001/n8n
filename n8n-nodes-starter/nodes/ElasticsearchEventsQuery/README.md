# Elasticsearch Events Query Node

A custom n8n node for querying Elasticsearch events index with advanced filtering options.

## Features

- Query Elasticsearch events index
- Multiple filter options:
  - Status filter
  - Resolution status filter
  - Admin client ID filter
  - Camera detail ID filter
  - Date range filters (today, yesterday, last 7 days, custom)
- Pagination support (size, from)
- Custom sorting
- Full custom query support (Elasticsearch DSL)

## Installation

1. Copy this folder to your n8n custom nodes directory
2. Restart n8n
3. The node will appear in the node palette

## Configuration

### Required Parameters
- **Host**: Elasticsearch host (default: localhost)
- **Port**: Elasticsearch port (default: 9200)
- **Index**: Index name (default: events)

### Optional Parameters
- **Username/Password**: Elasticsearch authentication
- **Status**: Filter by status (e.g., COMPLETED)
- **Resolution Status**: Filter by resolution_status
- **Admin Client ID**: Filter by admin_client_id
- **Camera Detail ID**: Filter by camera_detail_id
- **Date Range Type**: None, Today, Yesterday, Last 7 Days, Custom
- **Size**: Number of results (default: 10)
- **From**: Pagination offset (default: 0)
- **Sort Field**: Field to sort by (default: created_at)
- **Sort Order**: asc or desc (default: desc)
- **Custom Query**: Full Elasticsearch query DSL (overrides all filters)

## Usage Examples

### Basic Query (All Events)
Simply configure the host, port, and index. Leave filters empty.

### Filter by Status
Set **Status** to "COMPLETED"

### Date Range Query
1. Set **Date Range Type** to "Today", "Yesterday", or "Last 7 Days"
2. Or set to "Custom" and provide **From Date** and **To Date**

### Custom Query
Provide a JSON Elasticsearch query in the **Custom Query** field:
```json
{
  "bool": {
    "filter": [
      {
        "term": {
          "status.keyword": "COMPLETED"
        }
      },
      {
        "range": {
          "capture_time": {
            "gte": "2025-01-01T00:00:00Z",
            "lte": "2025-01-31T23:59:59Z"
          }
        }
      }
    ]
  }
}
```

## Output

The node returns:
- `hits`: Array of matching documents
- `total`: Total number of matches
- `query`: The executed query
- `took`: Query execution time (ms)
- `aggregations`: Aggregation results (if any)

## Based On

Query structure matches the Python `events.py` implementation:
- Uses `bool` query with `filter` array
- Supports `capture_time` and `created_at` date fields
- Matches the exact query format used in production

