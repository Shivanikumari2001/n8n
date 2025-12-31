import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import axios from 'axios';

export class ElasticsearchEventsQuery implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Elasticsearch Events Query',
		name: 'elasticsearchEventsQuery',
		icon: 'file:elasticsearch.svg',
		group: ['transform'],
		version: 1,
		description: 'Query Elasticsearch events index with advanced filtering',
		defaults: {
			name: 'Elasticsearch Events Query',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'elasticsearchApi',
				required: false,
			},
		],
		properties: [
			{
				displayName: 'Host',
				name: 'host',
				type: 'string',
				default: 'localhost',
				required: true,
				description: 'Elasticsearch host',
			},
			{
				displayName: 'Port',
				name: 'port',
				type: 'string',
				default: '9200',
				required: true,
				description: 'Elasticsearch port',
			},
			{
				displayName: 'Index',
				name: 'index',
				type: 'string',
				default: 'events',
				required: true,
				description: 'Elasticsearch index name',
			},
			{
				displayName: 'Username',
				name: 'username',
				type: 'string',
				default: '',
				description: 'Elasticsearch username (optional)',
			},
			{
				displayName: 'Password',
				name: 'password',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				description: 'Elasticsearch password (optional)',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'string',
				default: '',
				description: 'Filter by status (e.g., COMPLETED)',
			},
			{
				displayName: 'Resolution Status',
				name: 'resolutionStatus',
				type: 'string',
				default: '',
				description: 'Filter by resolution_status',
			},
			{
				displayName: 'Admin Client ID',
				name: 'adminClientId',
				type: 'string',
				default: '',
				description: 'Filter by admin_client_id (for ADMIN role)',
			},
			{
				displayName: 'Viewer Client ID',
				name: 'viewerClientId',
				type: 'string',
				default: '',
				description: 'Filter by viewer_client_id (for VIEWER role)',
			},
			{
				displayName: 'Camera Detail ID',
				name: 'cameraDetailId',
				type: 'string',
				default: '',
				description: 'Filter by camera_detail_id',
			},
			{
				displayName: 'Date Range Type',
				name: 'dateRangeType',
				type: 'options',
				options: [
					{ name: 'None', value: 'none' },
					{ name: 'Today', value: 'today' },
					{ name: 'Yesterday', value: 'yesterday' },
					{ name: 'Last 7 Days', value: 'last7days' },
					{ name: 'Custom', value: 'custom' },
				],
				default: 'none',
				description: 'Type of date range filter',
			},
			{
				displayName: 'Date Field',
				name: 'dateField',
				type: 'string',
				default: 'capture_time',
				displayOptions: {
					show: {
						dateRangeType: ['today', 'yesterday', 'last7days', 'custom'],
					},
				},
				description: 'Field to use for date filtering (capture_time, created_at, etc.)',
			},
			{
				displayName: 'From Date',
				name: 'fromDate',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						dateRangeType: ['custom'],
					},
				},
				description: 'Start date (ISO format: 2025-01-01T00:00:00Z)',
			},
			{
				displayName: 'To Date',
				name: 'toDate',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						dateRangeType: ['custom'],
					},
				},
				description: 'End date (ISO format: 2025-01-31T23:59:59Z)',
			},
			{
				displayName: 'Size',
				name: 'size',
				type: 'number',
				default: 50,
				description: 'Number of results to return (default: 50, use 100 for "all" requests)',
			},
			{
				displayName: 'From',
				name: 'from',
				type: 'number',
				default: 0,
				description: 'Offset for pagination',
			},
			{
				displayName: 'Sort Field',
				name: 'sortField',
				type: 'string',
				default: 'created_at',
				description: 'Field to sort by',
			},
			{
				displayName: 'Sort Order',
				name: 'sortOrder',
				type: 'options',
				options: [
					{ name: 'Ascending', value: 'asc' },
					{ name: 'Descending', value: 'desc' },
				],
				default: 'desc',
				description: 'Sort order',
			},
			{
				displayName: 'Custom Query',
				name: 'customQuery',
				type: 'json',
				default: '',
				description: 'Custom Elasticsearch query DSL (overrides all other filters)',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const output: INodeExecutionData[] = [];
		const items = this.getInputData();

		for (let i = 0; i < items.length; i++) {
			// Check if this is an NVR query - if so, just pass through without querying Elasticsearch
			const inputData: any = items[i].json;
			if (inputData.queryType === 'nvr') {
				// For NVR queries, just pass through the data without querying Elasticsearch
				output.push({
					json: {
						...inputData,
						hits: { hits: [], total: { value: 0 } },
						queryType: 'nvr',
					},
				});
				continue;
			}

			// Get parameters
			const host = this.getNodeParameter('host', i) as string;
			const port = this.getNodeParameter('port', i) as string;
			const index = this.getNodeParameter('index', i) as string;
			const username = this.getNodeParameter('username', i) as string;
			const password = this.getNodeParameter('password', i) as string;
			
			const status = this.getNodeParameter('status', i) as string;
			const resolutionStatus = this.getNodeParameter('resolutionStatus', i) as string;
			const adminClientId = this.getNodeParameter('adminClientId', i) as string;
			const viewerClientId = this.getNodeParameter('viewerClientId', i) as string;
			const cameraDetailId = this.getNodeParameter('cameraDetailId', i) as string;
			
			const dateRangeType = this.getNodeParameter('dateRangeType', i) as string;
			const dateField = this.getNodeParameter('dateField', i) as string;
			const fromDate = this.getNodeParameter('fromDate', i) as string;
			const toDate = this.getNodeParameter('toDate', i) as string;
			
			const size = this.getNodeParameter('size', i) as number;
			const from = this.getNodeParameter('from', i) as number;
			const sortField = this.getNodeParameter('sortField', i) as string;
			const sortOrder = this.getNodeParameter('sortOrder', i) as string;
			const customQuery = this.getNodeParameter('customQuery', i) as string;

			// Build query (matching Python events.py structure)
			let query: any;
			
			if (customQuery) {
				// Use custom query if provided
				try {
					query = JSON.parse(customQuery);
				} catch (error) {
					throw new Error(`Invalid custom query JSON: ${error.message}`);
				}
			} else {
				// Build query with filter array (matching Python events.py)
				const filters: any[] = [];
				
				// Date range filter
				if (dateRangeType !== 'none') {
					// Get timezone from environment variable (default to IST)
					const timezone = process.env.TIMEZONE || 'Asia/Kolkata';
					
					const dateRange: any = {};
					
					if (dateRangeType === 'today') {
						dateRange.gte = 'now/d';
						dateRange.lt = 'now/d+1d';  // Use 'lt' (less than) to exclude tomorrow
					} else if (dateRangeType === 'yesterday') {
						dateRange.gte = 'now-1d/d';
						dateRange.lt = 'now/d';  // Use 'lt' (less than) to exclude today's midnight events
					} else if (dateRangeType === 'last7days') {
						dateRange.gte = 'now-7d/d';
						dateRange.lt = 'now/d+1d';  // Use 'lt' (less than) to exclude tomorrow
					} else if (dateRangeType === 'custom') {
						if (fromDate) dateRange.gte = fromDate;
						if (toDate) dateRange.lte = toDate;
					}
					
					// Add timezone to date range for IST-based queries
					if (Object.keys(dateRange).length > 0) {
						dateRange.time_zone = timezone;
						filters.push({
							range: {
								[dateField]: dateRange,
							},
						});
					}
				}
				
				// Status filter - default to COMPLETED if not specified (matching backend behavior)
				const statusFilter = status || 'COMPLETED';
				filters.push({
					term: {
						'status.keyword': statusFilter,
					},
				});
				
				// Resolution status filter
				if (resolutionStatus) {
					filters.push({
						term: {
							'resolution_status.keyword': resolutionStatus,
						},
					});
				}
				
				// Client ID filter with OR conditions (matching backend controller logic)
				if (adminClientId || viewerClientId) {
					const clientIdShouldClauses: any[] = [];
					
					// For ADMIN: filter by admin_client_id OR image.dataset.client_id
					if (adminClientId) {
						clientIdShouldClauses.push({
							term: {
								'pre_event_capture.camera_detail.admin_client_id.keyword': adminClientId,
							},
						});
						clientIdShouldClauses.push({
							term: {
								'image.dataset.client_id.keyword': adminClientId,
							},
						});
					}
					
					// For VIEWER: filter by viewer_client_id OR image.dataset.client_id
					if (viewerClientId) {
						clientIdShouldClauses.push({
							term: {
								'pre_event_capture.camera_detail.viewer_client_id.keyword': viewerClientId,
							},
						});
						clientIdShouldClauses.push({
							term: {
								'image.dataset.client_id.keyword': viewerClientId,
							},
						});
					}
					
					// Add OR condition for clientId filtering
					if (clientIdShouldClauses.length > 0) {
						filters.push({
							bool: {
								should: clientIdShouldClauses,
								minimum_should_match: 1,
							},
						});
					}
				}
				
				// Camera detail ID filter
				if (cameraDetailId) {
					filters.push({
						term: {
							'pre_event_capture.camera_detail.id.keyword': cameraDetailId,
						},
					});
				}
				
				// Build final query
				if (filters.length > 0) {
					query = {
						bool: {
							filter: filters,
						},
					};
				} else {
					// No filters - match all
					query = { match_all: {} };
				}
			}

			// Build Elasticsearch request body
			const esBody: any = {
				query,
				size,
				from,
				sort: [
					{ [sortField]: { order: sortOrder } },
				],
			};

			// Make request to Elasticsearch
			const url = `http://${host}:${port}/${index}/_search`;
			
			try {
				const requestConfig: any = {
					headers: {
						'Content-Type': 'application/json',
					},
				};
				
				// Add authentication if provided
				if (username && password) {
					requestConfig.auth = {
						username,
						password,
					};
				}
				
				const response = await axios.post(url, esBody, requestConfig);
				
				const data = response.data;
				const hits = data.hits.hits || [];
				const total = data.hits.total?.value || data.hits.total || 0;
				
				output.push({
					json: {
						hits: hits,
						total: total,
						query: esBody,
						took: data.took,
						aggregations: data.aggregations,
					},
				});
			} catch (error: any) {
				const errorMessage = error.response?.data?.error?.reason || error.message;
				throw new Error(`Elasticsearch Error: ${errorMessage}`);
			}
		}

		return [output];
	}
}

