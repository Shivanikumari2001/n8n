import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { ChromaClient } from 'chromadb';
import OpenAI from 'openai';

export class ChromaDbVariphiQuery implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ChromaDB - Variphi Query',
		name: 'chromaDbVariphiQuery',
		icon: 'file:chroma.svg',
		group: ['transform'],
		version: 1,
		description: 'Query ChromaDB for Variphi company information using semantic search',
		defaults: { name: 'ChromaDB - Variphi Query' },
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'ChromaDB Host',
				name: 'host',
				type: 'string',
				default: 'localhost',
				required: true,
				description: 'ChromaDB server host',
			},
			{
				displayName: 'ChromaDB Port',
				name: 'port',
				type: 'string',
				default: '8000',
				required: true,
				description: 'ChromaDB server port',
			},
			{
				displayName: 'Collection Name',
				name: 'collectionName',
				type: 'string',
				default: 'variphi',
				required: true,
				description: 'ChromaDB collection name for Variphi company information',
			},
			{
				displayName: 'Query Text',
				name: 'queryText',
				type: 'string',
				default: '',
				required: true,
				description: 'Natural language query about Variphi company',
			},
			{
				displayName: 'Number of Results',
				name: 'nResults',
				type: 'number',
				default: 5,
				required: true,
				description: 'Number of similar documents to retrieve',
			},
			{
				displayName: 'Where Filter (JSON)',
				name: 'whereFilter',
				type: 'json',
				default: '',
				required: false,
				description: 'Optional metadata filter in JSON format (e.g., {"category": "company"})',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const output: INodeExecutionData[] = [];
		const items = this.getInputData();

		for (let i = 0; i < items.length; i++) {
			try {
				const host = this.getNodeParameter('host', i) as string;
				const port = this.getNodeParameter('port', i) as string;
				const collectionName = this.getNodeParameter('collectionName', i) as string;
				const queryTextParam = this.getNodeParameter('queryText', i);
				const nResults = this.getNodeParameter('nResults', i) as number;
				const whereFilterParam = this.getNodeParameter('whereFilter', i) as string;

				// Safely convert queryText to string (handle objects, numbers, etc.)
				let queryText: string;
				if (typeof queryTextParam === 'string') {
					queryText = queryTextParam;
				} else if (queryTextParam && typeof queryTextParam === 'object') {
					// If it's an object, try to extract query or message field
					queryText = (queryTextParam as any).query || (queryTextParam as any).message || JSON.stringify(queryTextParam);
				} else {
					queryText = String(queryTextParam || '');
				}

				if (!queryText || queryText.trim() === '') {
					throw new Error('Query text is required. Provide a query string in the queryText parameter.');
				}

				// Parse where filter if provided
				let where: any = undefined;
				if (whereFilterParam?.trim()) {
					try {
						where = JSON.parse(whereFilterParam);
					} catch (parseError) {
						throw new Error(`Invalid where filter JSON: ${parseError}`);
					}
				}

				// Use ChromaDB JavaScript client with OpenRouter embeddings
				const chromaClient = new ChromaClient({
					path: `http://${host}:${port}`,
				});

				// Get OpenRouter API key from environment
				const openrouterApiKey = process.env.OPENROUTER_API_KEY;
				if (!openrouterApiKey) {
					throw new Error('ChromaDB Error: OPENROUTER_API_KEY environment variable is required for embeddings');
				}

				// Create custom OpenRouter embedding function
				// ChromaDB's OpenAIEmbeddingFunction doesn't support base_url, so we create our own
				class OpenRouterEmbeddingFunction {
					private client: OpenAI;
					private model: string;

					constructor(apiKey: string) {
						this.client = new OpenAI({
							apiKey: apiKey,
							baseURL: 'https://openrouter.ai/api/v1',
						});
						this.model = 'text-embedding-3-small';
					}

					async generate(input: string[]): Promise<number[][]> {
						const response = await this.client.embeddings.create({
							model: this.model,
							input: input,
						});
						return response.data.map((item) => item.embedding);
					}
				}

				const embeddingFunction = new OpenRouterEmbeddingFunction(openrouterApiKey);

				// Get collection with OpenRouter embedding function
				let collection;
				try {
					collection = await chromaClient.getCollection({
						name: collectionName,
						embeddingFunction: embeddingFunction,
					});
				} catch (error: any) {
					if (error.message?.includes('not found') || error.message?.includes('does not exist') || error.message?.includes('could not be found')) {
						throw new Error(
							`ChromaDB Error: Collection '${collectionName}' does not exist. ` +
								`Please run populate_chromadb_variphi.py to create and populate the collection.`
						);
					}
					throw new Error(`ChromaDB Error: Failed to get collection: ${error.message}`);
				}

				// Query the collection using OpenRouter embeddings
				let results;
				try {
					const queryOptions: any = {
						queryTexts: [queryText],
						nResults: nResults,
					};

					if (where) {
						queryOptions.where = where;
					}

					results = await collection.query(queryOptions);
				} catch (error: any) {
					throw new Error(`ChromaDB Error: Query failed: ${error.message}`);
				}

				// Format results
				output.push({
					json: {
						query: queryText,
						results: (results.ids?.[0] || []).map((id: string, idx: number) => ({
							id,
							document: results.documents?.[0]?.[idx] || '',
							metadata: results.metadatas?.[0]?.[idx] || {},
							distance: results.distances?.[0]?.[idx] ?? null,
						})),
						totalResults: results.ids?.[0]?.length || 0,
					},
				});
			} catch (error: any) {
				throw new Error(`ChromaDB Error: ${error.message}`);
			}
		}

		return [output];
	}
}

