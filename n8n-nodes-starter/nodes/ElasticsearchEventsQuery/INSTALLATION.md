# Installation Guide: Elasticsearch Events Query Node

## Step 1: Build the Node

Navigate to the n8n-nodes-starter directory and build:

```bash
cd /Users/deepakarvd/Documents/code/n8n/n8n-nodes-starter
npm run build
```

This will compile the TypeScript files and create the distribution files in the `dist/` directory.

## Step 2: Link to n8n (Development)

If you're running n8n locally for development:

```bash
# Link the package
npm link

# In your n8n directory, link to this package
cd /path/to/n8n
npm link n8n-nodes-<...>
```

## Step 3: Restart n8n

Restart your n8n instance:

```bash
n8n start
```

Or if running via Docker:

```bash
docker restart n8n
```

## Step 4: Verify Installation

1. Open n8n in your browser
2. Create a new workflow
3. Click the "+" button to add a node
4. Search for "Elasticsearch Events Query"
5. The node should appear in the list

## Configuration Examples

### Example 1: Query All Events (No Filters)

**Node Configuration:**
- Host: `34.173.116.41`
- Port: `9200`
- Index: `events`
- Username: `elastic`
- Password: `variphi@2024`
- Size: `10`
- Sort Field: `created_at`
- Sort Order: `desc`

**Generated Query:**
```json
{
  "query": { "match_all": {} },
  "size": 10,
  "from": 0,
  "sort": [{ "created_at": { "order": "desc" } }]
}
```

### Example 2: Query Today's Completed Events

**Node Configuration:**
- Host: `34.173.116.41`
- Port: `9200`
- Index: `events`
- Username: `elastic`
- Password: `variphi@2024`
- Status: `COMPLETED`
- Date Range Type: `Today`
- Date Field: `capture_time`
- Size: `100`

**Generated Query:**
```json
{
  "query": {
    "bool": {
      "filter": [
        {
          "range": {
            "capture_time": {
              "gte": "now/d",
              "lte": "now/d+1d"
            }
          }
        },
        {
          "term": {
            "status.keyword": "COMPLETED"
          }
        }
      ]
    }
  },
  "size": 100,
  "from": 0,
  "sort": [{ "created_at": { "order": "desc" } }]
}
```

### Example 3: Custom Date Range with Client Filter

**Node Configuration:**
- Host: `34.173.116.41`
- Port: `9200`
- Index: `events`
- Username: `elastic`
- Password: `variphi@2024`
- Status: `COMPLETED`
- Admin Client ID: `your-client-id`
- Date Range Type: `Custom`
- Date Field: `capture_time`
- From Date: `2025-01-01T00:00:00Z`
- To Date: `2025-01-31T23:59:59Z`
- Size: `1000`

**Generated Query:**
```json
{
  "query": {
    "bool": {
      "filter": [
        {
          "range": {
            "capture_time": {
              "gte": "2025-01-01T00:00:00Z",
              "lte": "2025-01-31T23:59:59Z"
            }
          }
        },
        {
          "term": {
            "status.keyword": "COMPLETED"
          }
        },
        {
          "term": {
            "pre_event_capture.camera_detail.admin_client_id.keyword": "your-client-id"
          }
        }
      ]
    }
  },
  "size": 1000,
  "from": 0,
  "sort": [{ "created_at": { "order": "desc" } }]
}
```

### Example 4: Custom Query (Full Control)

**Node Configuration:**
- Host: `34.173.116.41`
- Port: `9200`
- Index: `events`
- Username: `elastic`
- Password: `variphi@2024`
- Custom Query:
```json
{
  "bool": {
    "filter": [
      {
        "range": {
          "capture_time": {
            "gte": "2025-01-01T00:00:00Z",
            "lte": "2025-01-31T23:59:59Z"
          }
        }
      },
      {
        "term": {
          "status.keyword": "COMPLETED"
        }
      }
    ]
  }
}
```
- Size: `10000`

## Troubleshooting

### Node Not Appearing

1. Check that the build was successful:
   ```bash
   ls dist/nodes/ElasticsearchEventsQuery/
   ```
   You should see: `ElasticsearchEventsQuery.node.js`

2. Verify package.json includes the node:
   ```json
   "nodes": [
     "dist/nodes/ElasticsearchEventsQuery/ElasticsearchEventsQuery.node.js"
   ]
   ```

3. Clear n8n cache and restart:
   ```bash
   rm -rf ~/.n8n/cache
   n8n start
   ```

### Connection Errors

1. Verify Elasticsearch is accessible:
   ```bash
   curl -u elastic:variphi@2024 http://34.173.116.41:9200/_cat/health
   ```

2. Check the index exists:
   ```bash
   curl -u elastic:variphi@2024 http://34.173.116.41:9200/events/_count
   ```

### Empty Results

1. Check if data exists with a simple query:
   ```bash
   curl -u elastic:variphi@2024 -X GET "http://34.173.116.41:9200/events/_search" \
     -H 'Content-Type: application/json' \
     -d '{"query": {"match_all": {}}, "size": 1}'
   ```

2. Try removing all filters and using only match_all

3. Check the date range - ensure dates are in UTC format

## Output Structure

The node returns a JSON object with:

```json
{
  "hits": [
    {
      "_index": "events",
      "_id": "...",
      "_source": {
        // Event data
      }
    }
  ],
  "total": 123,
  "query": {
    // The executed query
  },
  "took": 45,
  "aggregations": {
    // Aggregation results (if any)
  }
}
```

Access results in subsequent nodes using expressions:
- `{{ $json.hits }}` - Array of results
- `{{ $json.total }}` - Total count
- `{{ $json.hits[0]._source }}` - First result's data

