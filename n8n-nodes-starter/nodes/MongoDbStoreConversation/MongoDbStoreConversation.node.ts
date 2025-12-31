import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { MongoClient, ObjectId } from 'mongodb';

export class MongoDbStoreConversation implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MongoDB - Store Conversation',
		name: 'mongoDbStoreConversation',
		icon: 'file:mongodb.svg',
		group: ['transform'],
		version: 1,
		description: 'Store conversation history in MongoDB with clientId, conversationId, and chatId',
		defaults: { name: 'MongoDB - Store Conversation' },
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'MongoDB Connection String',
				name: 'connectionString',
				type: 'string',
				default: 'mongodb://localhost:27017',
				required: true,
				description: 'MongoDB connection string',
			},
			{
				displayName: 'Database Name',
				name: 'databaseName',
				type: 'string',
				default: 'n8n_conversations',
				required: true,
				description: 'MongoDB database name',
			},
			{
				displayName: 'Collection Name',
				name: 'collectionName',
				type: 'string',
				default: 'conversations',
				required: true,
				description: 'MongoDB collection name',
			},
			{
				displayName: 'Client ID',
				name: 'clientId',
				type: 'string',
				default: '={{ $json.clientId }}',
				required: true,
				description: 'Unique identifier for the client',
			},
			{
				displayName: 'User Message',
				name: 'userMessage',
				type: 'string',
				default: '={{ $json.originalMessage }}',
				required: true,
				description: 'The user query/message',
			},
			{
				displayName: 'Assistant Response',
				name: 'assistantResponse',
				type: 'string',
				default: '={{ $json.message }}',
				required: true,
				description: 'The assistant formatted response',
			},
			{
				displayName: 'Query Type',
				name: 'queryType',
				type: 'string',
				default: '={{ $json.queryType }}',
				required: false,
				description: 'Type of query (events or nvr)',
			},
			{
				displayName: 'Raw Results (JSON)',
				name: 'rawResults',
				type: 'json',
				default: '={{ $json }}',
				required: false,
				description: 'Raw results from the query for reference',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const output: INodeExecutionData[] = [];
		const items = this.getInputData();

		for (let i = 0; i < items.length; i++) {
			let client: MongoClient | null = null;
			try {
				const connectionString = this.getNodeParameter('connectionString', i) as string;
				const databaseName = this.getNodeParameter('databaseName', i) as string;
				const collectionName = this.getNodeParameter('collectionName', i) as string;
				const clientId = this.getNodeParameter('clientId', i) as string;
				const userMessage = this.getNodeParameter('userMessage', i) as string;
				const assistantResponse = this.getNodeParameter('assistantResponse', i) as string;
				const queryType = this.getNodeParameter('queryType', i) as string;
				const rawResultsParam = this.getNodeParameter('rawResults', i);

				// Validate clientId is not empty
				if (!clientId || clientId.trim() === '' || clientId === 'null' || clientId === 'undefined') {
					throw new Error('Client ID is required and cannot be empty or null');
				}

				console.log('MongoDB Store Conversation - clientId:', clientId);

				// Parse raw results
				let rawResults: any = {};
				if (typeof rawResultsParam === 'string' && rawResultsParam.trim()) {
					try {
						rawResults = JSON.parse(rawResultsParam);
					} catch (e) {
						rawResults = { data: rawResultsParam };
					}
				} else if (typeof rawResultsParam === 'object') {
					rawResults = rawResultsParam;
				}

				// Connect to MongoDB
				client = new MongoClient(connectionString);
				await client.connect();

				const db = client.db(databaseName);
				const collection = db.collection(collectionName);

				// For now, each client has only one conversation
				// Find existing conversation for this client
				const existingConversation = await collection.findOne({ clientId });

				const chatMessage = {
					chatId: new ObjectId().toString(),
					userMessage,
					assistantResponse,
					queryType: queryType || 'unknown',
					rawResults,
					timestamp: new Date(),
				};

				let conversationId: string;

				if (existingConversation) {
					// Append to existing conversation
					conversationId = existingConversation.conversationId;
					await collection.updateOne(
						{ clientId },
						{
							$push: { messages: chatMessage } as any,
							$set: { updatedAt: new Date() },
						}
					);
				} else {
					// Create new conversation
					conversationId = new ObjectId().toString();
					await collection.insertOne({
						conversationId,
						clientId,
						messages: [chatMessage],
						createdAt: new Date(),
						updatedAt: new Date(),
					});
				}

				output.push({
					json: {
						success: true,
						conversationId,
						clientId,
						chatId: chatMessage.chatId,
						operation: existingConversation ? 'updated' : 'created',
						messageCount: existingConversation ? (existingConversation.messages?.length || 0) + 1 : 1,
					},
				});
			} catch (error: any) {
				throw new Error(`MongoDB Store Conversation Error: ${error.message}`);
			} finally {
				if (client) {
					await client.close();
				}
			}
		}

		return [output];
	}
}

