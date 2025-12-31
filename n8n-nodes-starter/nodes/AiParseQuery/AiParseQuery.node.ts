import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import axios from 'axios';

export class AiParseQuery implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AI - Parse Query to ES Params',
		name: 'aiParseQuery',
		icon: 'file:ai.svg',
		group: ['transform'],
		version: 1,
		description: 'Uses OpenRouter to convert natural language to Elasticsearch query parameters',
		defaults: {
			name: 'AI - Parse Query',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'OpenRouter API Key',
				name: 'apiKey',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				required: false,
				description: 'Your OpenRouter API key (optional if OPENROUTER_API_KEY env var is set)',
			},
			{
				displayName: 'Message Field',
				name: 'messageField',
				type: 'string',
				default: 'body.message',
				required: true,
				description: 'Path to the natural language query in input data (e.g., body.message)',
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'string',
				default: 'openai/gpt-4o-mini',
				required: true,
				description: 'OpenRouter model to use (e.g., openai/gpt-4o-mini)',
			},
			{
				displayName: 'Default Host',
				name: 'defaultHost',
				type: 'string',
				default: '34.173.116.41',
				description: 'Default Elasticsearch host',
			},
			{
				displayName: 'Default Port',
				name: 'defaultPort',
				type: 'string',
				default: '9200',
				description: 'Default Elasticsearch port',
			},
			{
				displayName: 'Default Index',
				name: 'defaultIndex',
				type: 'string',
				default: 'events',
				description: 'Default Elasticsearch index',
			},
			{
				displayName: 'Default Username',
				name: 'defaultUsername',
				type: 'string',
				default: 'elastic',
				description: 'Default Elasticsearch username',
			},
			{
				displayName: 'Default Password',
				name: 'defaultPassword',
				type: 'string',
				typeOptions: { password: true },
				default: 'variphi@2024',
				description: 'Default Elasticsearch password',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const returnData: INodeExecutionData[] = [];
		const items = this.getInputData();

		for (let i = 0; i < items.length; i++) {
			// Get parameters
			const apiKeyParam = this.getNodeParameter('apiKey', i) as string;
			const apiKey = apiKeyParam || process.env.OPENROUTER_API_KEY || '';
			const messageField = this.getNodeParameter('messageField', i) as string;
			const model = this.getNodeParameter('model', i) as string;
			const defaultHost = this.getNodeParameter('defaultHost', i) as string;
			const defaultPort = this.getNodeParameter('defaultPort', i) as string;
			const defaultIndex = this.getNodeParameter('defaultIndex', i) as string;
			const defaultUsername = this.getNodeParameter('defaultUsername', i) as string;
			const defaultPassword = this.getNodeParameter('defaultPassword', i) as string;

			const inputData: any = items[i].json;

			// Extract message from input using field path
			const fieldParts = messageField.split('.');
			let message: any = inputData;
			for (const part of fieldParts) {
				if (message && typeof message === 'object') {
					message = message[part];
				} else {
					message = undefined;
					break;
				}
			}

			// Check if we have a natural language message
			if (!message || typeof message !== 'string') {
				// No message - use structured parameters
				const body = inputData.body || inputData;
				const params = {
					queryType: 'events',
					host: body.host || defaultHost,
					port: body.port || defaultPort,
					index: body.index || defaultIndex,
					username: body.username || defaultUsername,
					password: body.password || defaultPassword,
					status: body.status || '',
					resolutionStatus: body.resolution_status || '',
					adminClientId: body.admin_client_id || '',
					cameraDetailId: body.camera_detail_id || '',
					size: body.size || 50,
					from: body.from || 0,
					sortField: body.sortField || 'capture_time',
					sortOrder: body.sortOrder || 'desc',
					customQuery: body.query ? JSON.stringify(body.query) : '',
					dateRangeType: 'none',
					dateField: 'capture_time',
					fromDate: '',
					toDate: '',
					originalMessage: '',
				};

				// Handle date range
				if (body.dateRange) {
					const { today, yesterday, last7days, gte, lte, field } = body.dateRange;
					if (today) params.dateRangeType = 'today';
					else if (yesterday) params.dateRangeType = 'yesterday';
					else if (last7days) params.dateRangeType = 'last7days';
					else if (gte || lte) {
						params.dateRangeType = 'custom';
						params.fromDate = gte || '';
						params.toDate = lte || '';
					}
					params.dateField = field || 'capture_time';
				}

				returnData.push({ json: params });
				continue;
			}

			// Quick keyword-based check for general/greeting queries
			const generalKeywords = [
				'hi', 'hello', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening',
				'thank you', 'thanks', 'thank', 'bye', 'goodbye', 'see you',
				'what is your name', 'your name', 'who are you', 'what are you',
				'how are you', 'whats up', 'what\'s up', 'help', 'can you help'
			];
			
			// Quick keyword-based check for NVR queries (before LLM call for reliability)
			const nvrKeywords = [
				'nvr', 'streaming', 'recording', 'video recording', 'live stream',
				'stream setup', 'recording settings', 'stream configuration',
				'video storage', 'playback', 'stream quality', 'bitrate', 'resolution',
				'codec', 'rtsp', 'rtmp', 'hls', 'recording schedule', 'storage management',
				'stream protocol', 'video codec', 'stream bitrate', 'set up', 'setup'
			];
			
			// Quick keyword-based check for Variphi/company queries
			const variphiKeywords = [
				'variphi', 'company', 'about variphi', 'tell me about variphi', 'tell me about the company',
				'who is variphi', 'what is variphi', 'what does variphi do',
				'variphi company', 'variphi founded', 'variphi founder', 'nitish mishra',
				'variphi mission', 'variphi vision', 'variphi services', 'variphi technology',
				'variphi ai', 'variphi solutions', 'variphi team', 'variphi history',
				'about the company', 'about your company', 'who founded variphi', 'when was variphi founded'
			];
			
			const messageLower = message.toLowerCase().trim();
			
			// Check if it's a general greeting or simple question
			const isGeneralQuery = generalKeywords.some(keyword => {
				const keywordLower = keyword.toLowerCase();
				// For short queries, require exact match or word boundary
				if (messageLower.length < 15) {
					return messageLower === keywordLower || 
					       messageLower.startsWith(keywordLower + ' ') ||
					       messageLower.startsWith(keywordLower + '?') ||
					       messageLower.startsWith(keywordLower + '!') ||
					       messageLower.endsWith(' ' + keywordLower) ||
					       messageLower === keywordLower + '?' ||
					       messageLower === keywordLower + '!';
				}
				return messageLower.includes(keywordLower);
			});
			
			const isNvrQuery = nvrKeywords.some(keyword => {
				const keywordLower = keyword.toLowerCase();
				return messageLower.includes(keywordLower);
			});
			
			const isVariphiQuery = variphiKeywords.some(keyword => {
				const keywordLower = keyword.toLowerCase();
				return messageLower.includes(keywordLower);
			});

			// Check Variphi queries FIRST (most specific)
			if (isVariphiQuery) {
				const params: any = {
					queryType: 'variphi',
					variphiQuery: message,
					originalMessage: message,
				};
				returnData.push({ json: params });
				continue;
			}

			// Check NVR queries (specific technical queries)
			if (isNvrQuery) {
				const params: any = {
					queryType: 'nvr',
					nvrQuery: message,
					originalMessage: message,
				};
				returnData.push({ json: params });
				continue;
			}

			// Check general queries LAST (least specific)
			if (isGeneralQuery) {
				const params: any = {
					queryType: 'general',
					generalQuery: message,
					originalMessage: message,
				};
				returnData.push({ json: params });
				continue;
			}

			// Use OpenRouter to parse natural language query
			if (!apiKey) {
				throw new Error('OpenRouter API key is required. Set it in node parameters or OPENROUTER_API_KEY environment variable.');
			}

			const systemPrompt = `You are a query router for a security camera events system. You need to determine if the query is about:
1. Variphi company information (HIGHEST PRIORITY - check first) - use ChromaDB
2. General conversation (greetings, thank you, asking about the assistant) - handle directly
3. NVR (Network Video Recorder) streaming/recording - use ChromaDB
4. Camera events/data - use Elasticsearch

Analyze the user question and return ONLY valid JSON with these fields:
{
  "queryType": "general" | "nvr" | "variphi" | "events",
  "dateRangeType": "none" | "today" | "yesterday" | "last7days" | "custom",
  "dateField": "capture_time" | "created_at",
  "fromDate": "ISO date string or empty",
  "toDate": "ISO date string or empty",
  "status": "LABELLED" | "UNLABELLED" | "",
  "resolutionStatus": "Unresolved" | "Resolved" | "",
  "cameraDetailId": "UUID or empty",
  "size": number (default 50, use 1000 for count/total queries to ensure accurate count, use 1 for "latest" queries, use 50-100 for general queries),
  "sortField": "capture_time" | "created_at",
  "sortOrder": "desc" | "asc"
}

Query type detection:
- "general" for: greetings (hi, hello, hey), thank you, asking about the assistant's name or capabilities, help requests, goodbye, how are you
- "variphi" if question mentions: Variphi, company, about Variphi, tell me about Variphi, tell me about the company, who is Variphi, what is Variphi, what does Variphi do, Variphi founder, Nitish Mishra, Variphi mission, Variphi vision, Variphi services, Variphi technology, Variphi AI, Variphi solutions, Variphi team, Variphi history, who founded Variphi, when was Variphi founded
- "nvr" if question mentions: NVR, streaming, recording, video recording, live stream, stream setup, recording settings, stream configuration, video storage, playback, stream quality, bitrate, resolution, codec, RTSP, RTMP, HLS, recording schedule, storage management
- "events" for: events, incidents, camera events, detections, alerts, labelled/unlabelled events, resolved/unresolved events, event history

Examples:
- "show me events from today" → {"dateRangeType": "today", "dateField": "capture_time", "size": 50, "status": "", "resolutionStatus": "", "sortField": "capture_time", "sortOrder": "desc"}
- "get unresolved labelled events from yesterday" → {"dateRangeType": "yesterday", "status": "LABELLED", "resolutionStatus": "Unresolved", "size": 50, "sortField": "capture_time", "sortOrder": "desc"}
- "list 20 events from last 7 days" → {"dateRangeType": "last7days", "size": 20, "status": "", "resolutionStatus": "", "sortField": "capture_time", "sortOrder": "desc"}
- "show all events from today" → {"dateRangeType": "today", "size": 100, "sortField": "capture_time", "sortOrder": "desc"}
- "get all events" → {"dateRangeType": "none", "size": 100, "sortField": "capture_time", "sortOrder": "desc"}
- "total number of events for today" → {"dateRangeType": "today", "size": 1000, "sortField": "capture_time", "sortOrder": "desc"}
- "how many events today" → {"dateRangeType": "today", "size": 1000, "sortField": "capture_time", "sortOrder": "desc"}
- "count events from today" → {"dateRangeType": "today", "size": 1000, "sortField": "capture_time", "sortOrder": "desc"}
- "give me latest event" → {"dateRangeType": "none", "dateField": "capture_time", "size": 1, "status": "", "resolutionStatus": "", "sortField": "capture_time", "sortOrder": "desc"}
- "show me the most recent event" → {"dateRangeType": "none", "dateField": "capture_time", "size": 1, "status": "", "resolutionStatus": "", "sortField": "capture_time", "sortOrder": "desc"}
- "latest event from today" → {"dateRangeType": "today", "dateField": "capture_time", "size": 1, "status": "", "resolutionStatus": "", "sortField": "capture_time", "sortOrder": "desc"}

Latest/Most Recent detection:
- "latest", "most recent", "newest", "last" (singular) → size: 1, sortField: "capture_time", sortOrder: "desc"
- Always sort by "capture_time" descending for latest queries
- If no date specified, use dateRangeType: "none" to get the absolute latest

Date detection:
- "today", "this day" → dateRangeType: "today"
- "yesterday" → dateRangeType: "yesterday"
- "last 7 days", "past week" → dateRangeType: "last7days"

Status detection:
- "labelled", "tagged", "annotated" → status: "LABELLED"
- "unlabelled", "untagged" → status: "UNLABELLED"

Resolution:
- "unresolved", "pending", "open" → resolutionStatus: "Unresolved"
- "resolved", "closed", "fixed" → resolutionStatus: "Resolved"

Size/Limit detection:
- "total", "count", "how many", "number of" (for counting queries) → size: 1000 (use large size to ensure accurate total count is returned)
- "all events", "show all", "get all", "all of them" → size: 100 (use larger size for "all" requests)
- "more events", "show more", "get more" → size: 50-100
- "20 events", "show 20", "list 20" → size: 20 (use the number specified)
- "latest", "most recent", "newest", "last" (singular) → size: 1
- Default: 50 (use 50 for general queries without specific count, 100 for "all" requests, 1 for "latest" queries, 1000 for count queries)

Sorting:
- Default sortField: "capture_time" (most relevant for events)
- Default sortOrder: "desc" (newest first)
- For "latest" queries, always use sortField: "capture_time", sortOrder: "desc", size: 1

Return ONLY the JSON object, no markdown, no explanation.`;

			try {
				const response = await axios.post(
					'https://openrouter.ai/api/v1/chat/completions',
					{
						model,
						messages: [
							{ role: 'system', content: systemPrompt },
							{ role: 'user', content: message },
						],
						temperature: 0.1,
						max_tokens: 500,
					},
					{
						headers: {
							'Authorization': `Bearer ${apiKey}`,
							'Content-Type': 'application/json',
							'HTTP-Referer': 'https://n8n.io',
						},
					}
				);

				const rawResponse = response.data.choices[0].message.content.trim();
				
				// Parse LLM JSON response
				let parsedQuery: any;
				try {
					// Extract JSON from response (handle markdown code blocks)
					const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
					if (jsonMatch) {
						parsedQuery = JSON.parse(jsonMatch[0]);
					} else {
						parsedQuery = JSON.parse(rawResponse);
					}
				} catch (parseError) {
					// Fallback to default query (events type)
					parsedQuery = {
						queryType: 'events',
						dateRangeType: 'none',
						dateField: 'capture_time',
						status: '',
						resolutionStatus: '',
						size: 50,
						sortField: 'capture_time',
						sortOrder: 'desc',
					};
				}

				// Build final parameters
				const body = inputData.body || inputData;
				let queryType = parsedQuery.queryType || 'events';
				
				// Fallback: Double-check with keyword matching in priority order
				// Variphi first (most specific)
				if (queryType !== 'variphi' && isVariphiQuery) {
					queryType = 'variphi';
				}
				// NVR second
				if (queryType !== 'nvr' && isNvrQuery) {
					queryType = 'nvr';
				}
				// General last (least specific)
				if (queryType !== 'general' && isGeneralQuery) {
					queryType = 'general';
				}
				
				const params: any = {
					queryType,
					originalMessage: message,
				};

				if (queryType === 'general') {
					// For general queries, pass the message for direct handling
					params.generalQuery = message;
				} else if (queryType === 'nvr') {
					// For NVR queries, pass the message to ChromaDB
					params.nvrQuery = message;
				} else if (queryType === 'variphi') {
					// For Variphi queries, pass the message to ChromaDB
					params.variphiQuery = message;
				} else {
					// For events queries, build Elasticsearch parameters
					params.host = body.host || defaultHost;
					params.port = body.port || defaultPort;
					params.index = body.index || defaultIndex;
					params.username = body.username || defaultUsername;
					params.password = body.password || defaultPassword;
					params.status = parsedQuery.status || '';
					params.resolutionStatus = parsedQuery.resolutionStatus || '';
					params.adminClientId = parsedQuery.adminClientId || body.admin_client_id || '';
					params.viewerClientId = parsedQuery.viewerClientId || body.viewer_client_id || '';
					params.cameraDetailId = parsedQuery.cameraDetailId || body.camera_detail_id || '';
					params.dateRangeType = parsedQuery.dateRangeType || 'none';
					params.dateField = parsedQuery.dateField || 'capture_time';
					params.fromDate = parsedQuery.fromDate || '';
					params.toDate = parsedQuery.toDate || '';
					params.size = parsedQuery.size || body.size || 50;
					params.from = body.from || 0;
					params.sortField = parsedQuery.sortField || 'capture_time';
					params.sortOrder = parsedQuery.sortOrder || 'desc';
					params.customQuery = body.query ? JSON.stringify(body.query) : '';
				}

				returnData.push({ json: params });
			} catch (error: any) {
				throw new Error(
					`OpenRouter Error: ${error.response?.data?.error?.message || error.message}`
				);
			}
		}

		return [returnData];
	}
}

