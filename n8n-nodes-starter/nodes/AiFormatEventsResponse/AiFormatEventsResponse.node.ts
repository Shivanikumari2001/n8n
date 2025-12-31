import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import axios from 'axios';

/**
 * Convert UTC timestamp to specified timezone
 * @param utcTimestamp - UTC timestamp string (ISO format)
 * @param timezone - IANA timezone identifier (e.g., 'Asia/Kolkata' for IST)
 * @returns Formatted date string in the specified timezone
 */
function convertToTimezone(utcTimestamp: string, timezone: string): string {
	if (!utcTimestamp) return utcTimestamp;
	
	try {
		const date = new Date(utcTimestamp);
		if (isNaN(date.getTime())) {
			// Invalid date, return original
			return utcTimestamp;
		}
		
		// Format date in the specified timezone
		const formatter = new Intl.DateTimeFormat('en-US', {
			timeZone: timezone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: true,
			timeZoneName: 'short',
		});
		
		return formatter.format(date);
	} catch (error) {
		// If timezone conversion fails, return original timestamp
		return utcTimestamp;
	}
}

export class AiFormatEventsResponse implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AI - Format Events Response',
		name: 'aiFormatEventsResponse',
		icon: 'file:format.svg',
		group: ['transform'],
		version: 1,
		description: 'Uses OpenRouter to convert Elasticsearch events results into natural language responses',
		defaults: {
			name: 'AI - Format Events Response',
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
				displayName: 'Model',
				name: 'model',
				type: 'string',
				default: 'openai/gpt-4o-mini',
				required: true,
				description: 'OpenRouter model to use (e.g., openai/gpt-4o-mini)',
			},
			{
				displayName: 'Original Message Field',
				name: 'originalMessageField',
				type: 'string',
				default: 'originalMessage',
				description: 'Field containing the original user question (from AI Parse Query node)',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const output: INodeExecutionData[] = [];
		const items = this.getInputData();

		for (let i = 0; i < items.length; i++) {
			// Get API key from parameter or fallback to environment variable
			const apiKeyParam = this.getNodeParameter('apiKey', i) as string;
			const apiKey = apiKeyParam || process.env.OPENROUTER_API_KEY || '';
			if (!apiKey) {
				throw new Error('OpenRouter API key is required. Set it in node parameters or OPENROUTER_API_KEY environment variable.');
			}
			const model = this.getNodeParameter('model', i) as string;
			const originalMessageField = this.getNodeParameter('originalMessageField', i) as string;

			const inputData: any = items[i].json;

			// Get timezone from environment variable (default to IST)
			const timezone = process.env.TIMEZONE || 'Asia/Kolkata';
			const timezoneDisplay = timezone === 'Asia/Kolkata' ? 'IST' : timezone;

			// Get original question if available
			const originalQuestion = inputData[originalMessageField] || 'the user query';
			const queryType = inputData.queryType || 'events';

			// Prepare context for OpenRouter
			let context = '';
			let systemPrompt = '';
			let totalCount: number = 0;

			if (queryType === 'variphi') {
				// Handle ChromaDB Variphi results
				const variphiResults = inputData.results || [];
				totalCount = inputData.totalResults || variphiResults.length;

				if (totalCount > 0) {
					// Limit to top 3 most relevant results to avoid context length issues
					const topResults = variphiResults.slice(0, 3);
					context = `Found ${totalCount} relevant documents about Variphi company (showing top ${topResults.length}):\n\n`;
					topResults.forEach((result: any, idx: number) => {
						context += `Document ${idx + 1}:\n`;
						// Truncate document content to avoid token limits
						const docContent = result.document || '';
						const truncatedDoc = docContent.length > 300 ? docContent.substring(0, 300) + '...' : docContent;
						context += `Content: ${truncatedDoc}\n`;
						if (result.metadata && Object.keys(result.metadata).length > 0) {
							context += `Category: ${result.metadata.category || 'N/A'}, Topic: ${result.metadata.topic || 'N/A'}\n`;
						}
						context += '\n';
					});
				} else {
					context = 'No relevant information found about Variphi company.';
				}

				systemPrompt = `You are a helpful assistant that answers questions about Variphi company.

Guidelines:
- Answer directly and naturally about Variphi company, its history, founder, mission, vision, services, or technology
- Use the retrieved documents to provide accurate information about the company
- Be clear about facts like founding year (2024), founder (Nitish Mishra), and company focus (AI solutions)
- Synthesize information from multiple documents coherently
- Be concise but informative with a friendly tone

User question: "${originalQuestion}"`;
			} else if (queryType === 'nvr') {
				// Handle ChromaDB NVR results
				const chromaResults = inputData.results || [];
				totalCount = inputData.totalResults || chromaResults.length;

				if (totalCount > 0) {
					// Limit to top 3 most relevant results to avoid context length issues
					const topResults = chromaResults.slice(0, 3);
					context = `Found ${totalCount} relevant documents about NVR streaming and recording (showing top ${topResults.length}):\n\n`;
					topResults.forEach((result: any, idx: number) => {
						context += `Document ${idx + 1}:\n`;
						// Truncate document content to avoid token limits
						const docContent = result.document || '';
						const truncatedDoc = docContent.length > 300 ? docContent.substring(0, 300) + '...' : docContent;
						context += `Content: ${truncatedDoc}\n`;
						if (result.metadata && Object.keys(result.metadata).length > 0) {
							context += `Category: ${result.metadata.category || 'N/A'}, Topic: ${result.metadata.topic || 'N/A'}\n`;
						}
						context += '\n';
					});
				} else {
					context = 'No relevant information found about NVR streaming and recording.';
				}

				systemPrompt = `You are a helpful assistant that answers questions about NVR (Network Video Recorder) streaming and recording.

Guidelines:
- Answer directly and naturally about NVR streaming, recording, or configuration
- Use the retrieved documents to provide accurate technical details
- Be clear about protocols (RTSP, RTMP, HLS), settings, bitrate, resolution, codecs
- Synthesize information from multiple documents coherently
- Be concise but informative with a friendly tone

User question: "${originalQuestion}"`;
			} else {
				// Handle Elasticsearch events results
				const esData = inputData.hits?.hits || inputData.hits || [];
				totalCount = inputData.hits?.total?.value || inputData.count || esData.length;

				if (totalCount !== undefined) {
					context = `Total results: ${totalCount}\n\n`;
				}

				// Detect if this is a count/total query (doesn't need full event details)
				const isCountQuery = originalQuestion.toLowerCase().match(/\b(how many|total|count|number of)\b/i);
				
				// For count queries, only send summary data (not full events) to avoid token limit
				if (isCountQuery && totalCount > 0) {
					context += `User is asking for a count/total. Total events found: ${totalCount}\n`;
					context += 'Note: Do not list individual events, just provide the total count in a natural way.\n';
				} else if (Array.isArray(esData) && esData.length > 0) {
					// Limit to max 15 events to avoid token overflow (even for detail queries)
					const maxEvents = Math.min(esData.length, 15);
					context += `Events data (showing ${maxEvents} of ${totalCount}):\n`;
					
					for (let idx = 0; idx < maxEvents; idx++) {
						const hit = esData[idx];
						const source = hit._source || hit;
						
						// Convert UTC capture_time to configured timezone
						const captureTimeUtc = source.capture_time;
						const captureTimeLocal = captureTimeUtc ? convertToTimezone(captureTimeUtc, timezone) : captureTimeUtc;
						
						// Extract relevant fields for better context
						const eventInfo: any = {
							id: source.id,
							capture_time: captureTimeLocal,
							capture_time_utc: captureTimeUtc, // Keep UTC for reference
							status: source.status,
							resolution_status: source.resolution_status,
						};

						// Camera details
						if (source.pre_event_capture?.camera_detail) {
							eventInfo.camera = {
								name: source.pre_event_capture.camera_detail.name,
								location: source.pre_event_capture.camera_detail.location?.name,
								admin_client: source.pre_event_capture.camera_detail.admin_client?.company_name,
							};
						}

						// Annotations (detected objects/events) - keep only essential info
						if (source.annotations && Array.isArray(source.annotations)) {
							eventInfo.annotations = source.annotations.slice(0, 3).map((ann: any) => ({
								type: ann.type,
								labels: ann.value?.rectanglelabels?.[0], // Only first label
								ai_class: ann.ai_meta_data?.class,
							}));
						}

						// Labelled captain info
						if (source.labelled_captain) {
							eventInfo.labelled_by = source.labelled_captain.username || source.labelled_captain.email;
						}

						context += `\nEvent ${idx + 1}:\n${JSON.stringify(eventInfo, null, 2)}\n`;
					}
					
					if (totalCount > maxEvents) {
						context += `\n... and ${totalCount - maxEvents} more events not shown.\n`;
					}
				} else if (totalCount === 0) {
					context += 'No events found matching the criteria.';
				} else {
					context += `Data:\n${JSON.stringify(inputData, null, 2)}`;
				}

				systemPrompt = `You are a helpful assistant that converts Elasticsearch security camera event query results into natural, conversational responses.

Guidelines:
- Answer the user's question directly and naturally
- For count queries: State the number clearly (e.g., "There were 5 events today")
- For specific data requests (like camera name): Extract and present the exact information requested
- For event details: Mention capture time, camera name, location, event type, status
- IMPORTANT: All timestamps in the data are in ${timezoneDisplay} (${timezone}). Always use these local times when mentioning dates/times in your response.
- Use camera names naturally in sentences (e.g., "Camera Echo recorded the latest event at 10:30 AM ${timezoneDisplay}")
- If multiple events, summarize or list them clearly
- Be concise but informative
- Use a friendly, conversational tone
- If no results found, say so politely and suggest alternatives

The user asked: "${originalQuestion}"`;
			}

			try {
				const response = await axios.post(
					'https://openrouter.ai/api/v1/chat/completions',
					{
						model,
						messages: [
							{ role: 'system', content: systemPrompt },
							{ role: 'user', content: `Based on this Elasticsearch data, answer the user's question:\n\n${context}` },
						],
						temperature: 0.7,
						max_tokens: 1000,
					},
					{
						headers: {
							'Authorization': `Bearer ${apiKey}`,
							'Content-Type': 'application/json',
							'HTTP-Referer': 'https://n8n.io',
						},
					}
				);

			const aiResponse = response.data.choices[0].message.content.trim();

			output.push({
				json: {
					message: aiResponse,
					originalMessage: originalQuestion,  // Use originalMessage for consistency
					originalQuestion,  // Keep for backward compatibility
					rawData: inputData,
					totalCount,
					// Pass through important fields for downstream nodes
					adminClientId: inputData.adminClientId,
					viewerClientId: inputData.viewerClientId,
					storageClientId: inputData.storageClientId,
					clientId: inputData.clientId || inputData.storageClientId,  // Backward compatibility
					queryType: inputData.queryType || 'unknown',
				}
			});
			} catch (error: any) {
				throw new Error(
					`OpenRouter Error: ${error.response?.data?.error?.message || error.message}`
				);
			}
		}

		return [output];
	}
}

