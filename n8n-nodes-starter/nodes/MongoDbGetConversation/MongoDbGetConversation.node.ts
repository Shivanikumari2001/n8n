import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { MongoClient } from 'mongodb';

export class MongoDbGetConversation implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MongoDB - Get Conversation',
		name: 'mongoDbGetConversation',
		icon: 'file:mongodb.svg',
		group: ['transform'],
		version: 1,
		description: 'Retrieve full conversation history for a client from MongoDB',
		defaults: { name: 'MongoDB - Get Conversation' },
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
				default: '={{ $json.body.clientId || $json.clientId }}',
				required: true,
				description: 'Unique identifier for the client',
			},
			{
				displayName: 'Include Raw Results',
				name: 'includeRawResults',
				type: 'boolean',
				default: false,
				required: false,
				description: 'Whether to include raw query results in the response',
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
				const includeRawResults = this.getNodeParameter('includeRawResults', i) as boolean;

				if (!clientId || clientId.trim() === '') {
					throw new Error('Client ID is required');
				}

				// Connect to MongoDB
				client = new MongoClient(connectionString);
				await client.connect();

				const db = client.db(databaseName);
				const collection = db.collection(collectionName);

				// Find conversation for this client
				const conversation = await collection.findOne({ clientId });

				if (!conversation) {
					output.push({
						json: {
							success: true,
							found: false,
							clientId,
							conversationId: null,
							messages: [],
							messageCount: 0,
						},
					});
				} else {
					// Format messages for response
					const messages = (conversation.messages || []).map((msg: any) => {
						const formattedMsg: any = {
							chatId: msg.chatId,
							userMessage: msg.userMessage,
							assistantResponse: msg.assistantResponse,
							queryType: msg.queryType,
							timestamp: msg.timestamp,
						};

						if (includeRawResults) {
							formattedMsg.rawResults = msg.rawResults;
						}

						return formattedMsg;
					});

					output.push({
						json: {
							success: true,
							found: true,
							clientId,
							conversationId: conversation.conversationId,
							messages,
							messageCount: messages.length,
							createdAt: conversation.createdAt,
							updatedAt: conversation.updatedAt,
						},
					});
				}
			} catch (error: any) {
				throw new Error(`MongoDB Get Conversation Error: ${error.message}`);
			} finally {
				if (client) {
					await client.close();
				}
			}
		}

		return [output];
	}
}

