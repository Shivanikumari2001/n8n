import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import axios from 'axios';

export class AiFormatFinal implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AI - Format Final Response',
		name: 'aiFormatFinalResponse',
		icon: 'file:format.svg',
		group: ['transform'],
		version: 1,
		description: 'Uses OpenAI to generate natural language response from Elasticsearch results',
		defaults: {
			name: 'AI - Format Final Response',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'OpenAI API Key',
				name: 'apiKey',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				required: false,
				description: 'Your OpenAI API key (optional if OPENAI_API_KEY env var is set)',
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'string',
				default: 'gpt-4o-mini',
				required: true,
				description: 'OpenAI model to use',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const output: INodeExecutionData[] = [];
		const items = this.getInputData();

		for (let i = 0; i < items.length; i++) {
			// Get API key from parameter or fallback to environment variable
			const apiKeyParam = this.getNodeParameter('apiKey', i) as string;
			const apiKey = apiKeyParam || process.env.OPENAI_API_KEY || '';
			if (!apiKey) {
				throw new Error('OpenAI API key is required. Set it in node parameters or OPENAI_API_KEY environment variable.');
			}
			const model = this.getNodeParameter('model', i) as string;

			const inputData: any = items[i].json;
			
			// Get original question if available
			const originalQuestion = (inputData.originalQuestion as string) || 'the user query';
			
			// Get Elasticsearch results
			const esData = inputData.hits?.hits || inputData.hits || inputData;
			const totalCount = inputData.hits?.total?.value || inputData.count;
			
			// Prepare context for OpenAI
			let context = '';
			
			if (totalCount !== undefined) {
				context = `Count: ${totalCount} results found.\n`;
			}
			
			if (Array.isArray(esData) && esData.length > 0) {
				context += 'Results:\n';
				esData.forEach((hit: any, idx: number) => {
					const source = hit._source || hit;
					context += `\nResult ${idx + 1}:\n${JSON.stringify(source, null, 2)}\n`;
				});
			} else if (typeof esData === 'object') {
				context += `Data:\n${JSON.stringify(esData, null, 2)}`;
			}

			const systemPrompt = `You are a helpful assistant that converts Elasticsearch query results into natural, conversational responses.

Guidelines:
- Answer the user's question directly and naturally
- For count queries: State the number clearly (e.g., "There were 5 events today")
- For safety reports: Include the report link if available
- For events: Summarize key details like timestamps, camera IDs, event types
- Be concise but informative
- Use a friendly, conversational tone
- If no results found, say so politely

The user asked: "${originalQuestion}"`;

			try {
				const response = await axios.post(
					'https://api.openai.com/v1/chat/completions',
					{
						model,
						messages: [
							{ role: 'system', content: systemPrompt },
							{ role: 'user', content: `Based on this data, answer the question:\n\n${context}` },
						],
						temperature: 0.7,
					},
					{
						headers: {
							'Authorization': `Bearer ${apiKey}`,
							'Content-Type': 'application/json',
						},
					}
				);

				const aiResponse = response.data.choices[0].message.content.trim();

				output.push({ 
					json: { 
						formatted: aiResponse,
						rawData: inputData,
					} 
				});
			} catch (error: any) {
				throw new Error(
					`OpenAI Error: ${error.response?.data?.error?.message || error.message}`
				);
			}
		}

		return [output];
	}
}
