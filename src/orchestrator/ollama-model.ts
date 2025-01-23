import axios, { AxiosInstance } from 'axios';
import { BaseAIModel } from './base-model';
import { CompletionRequest, CompletionResponse, CompletionCallback } from './types';

export class OllamaModel extends BaseAIModel {
    private client: AxiosInstance;

    constructor(config: { apiKey: string, baseUrl?: string }) {
        super(config);
        this.client = axios.create({
            baseURL: config.baseUrl || 'http://localhost:11434',
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    async completions(request: CompletionRequest): Promise<CompletionResponse> {
        this.validateRequest(request);

        const response = await this.client.post('/api/generate', {
            prompt: request.prompt,
            model: 'llama2',  // or any other model
            options: {
                temperature: request.temperature,
            },
        });

        return {
            text: response.data.response,
        };
    }

    async streamCompletions(request: CompletionRequest, callback: CompletionCallback): Promise<void> {
        this.validateRequest(request);

        const response = await this.client.post('/api/generate', {
            prompt: request.prompt,
            model: 'llama2',
            options: {
                temperature: request.temperature,
            },
            stream: true,
        }, {
            responseType: 'stream',
        });

        for await (const chunk of response.data) {
            const parsed = JSON.parse(chunk.toString());
            if (parsed.response) {
                callback({
                    text: parsed.response,
                    isComplete: false,
                });
            }
        }

        callback({ text: '', isComplete: true });
    }
}