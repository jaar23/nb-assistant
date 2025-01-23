import axios, { AxiosInstance } from 'axios';
import { BaseAIModel } from './base-model';
import { CompletionRequest, CompletionResponse, CompletionCallback } from './types';

export class DeepseekModel extends BaseAIModel {
    private client: AxiosInstance;

    constructor(config: { apiKey: string; baseUrl?: string }) {
        super(config);
        this.client = axios.create({
            baseURL: config.baseUrl || 'https://api.deepseek.com',
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
            },
        });
    }

    async completions(request: CompletionRequest): Promise<CompletionResponse> {
        this.validateRequest(request);

        const response = await this.client.post('/v1/chat/completions', {
            messages: [{ role: 'user', content: request.prompt }],
            max_tokens: request.maxTokens,
            temperature: request.temperature,
        });

        return {
            text: response.data.choices[0].message.content,
        };
    }

    async streamCompletions(request: CompletionRequest, callback: CompletionCallback): Promise<void> {
        this.validateRequest(request);

        const response = await this.client.post('/v1/chat/completions', {
            messages: [{ role: 'user', content: request.prompt }],
            max_tokens: request.maxTokens,
            temperature: request.temperature,
            stream: true,
        }, {
            responseType: 'stream',
        });

        for await (const chunk of response.data) {
            const parsed = JSON.parse(chunk.toString());
            if (parsed.choices?.[0]?.delta?.content) {
                callback({
                    text: parsed.choices[0].delta.content,
                    isComplete: false,
                });
            }
        }

        callback({ text: '', isComplete: true });
    }
}