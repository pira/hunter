// Monster Hunter API — AWS Lambda entry point (Node.js 22, function URL) + DynamoDB.
// All request handling lives in app.mjs; this file only wires it to the AWS SDK.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand, TransactWriteCommand
} from '@aws-sdk/lib-dynamodb';
import { createApp } from './app.mjs';

const TABLE = process.env.TABLE_NAME;
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
const COMMANDS = { Get: GetCommand, Put: PutCommand, Update: UpdateCommand, Query: QueryCommand };

function send(type, input) {
    if (type === 'TransactWrite') {
        const TransactItems = input.TransactItems.map(item => {
            const [op, body] = Object.entries(item)[0];
            return { [op]: { TableName: TABLE, ...body } };
        });
        return db.send(new TransactWriteCommand({ TransactItems }));
    }
    return db.send(new COMMANDS[type]({ TableName: TABLE, ...input }));
}

export const handler = createApp({ send, tokenSecret: process.env.TOKEN_SECRET });
