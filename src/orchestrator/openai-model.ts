import { OpenAI } from 'openai';
import { BaseAIModel } from './base-model';
import { CompletionRequest, CompletionResponse, CompletionCallback, EmbeddingRequest, EmbeddingResponse } from './types';

export class OpenAIModel extends BaseAIModel {
    private client: OpenAI;

    constructor(config: { apiKey: string }) {
        super(config);
        this.client = new OpenAI({ apiKey: config.apiKey });
    }

    async completions(request: CompletionRequest): Promise<CompletionResponse> {
        this.validateRequest(request);
        let messages = [];
        if (request.systemPrompt) {
            switch(request.systemPrompt.role) {
                case "system":
                    messages.push({role: "system", content: request.systemPrompt.content});
                    break;
                case "developer":
                    messages.push({role: "developer", content: request.systemPrompt.content});
                    break;
                case "assistant":
                    messages.push({role: "assistant", content: request.systemPrompt.content});
                    break;
                default:
                    messages.push({role: request.systemPrompt.role, content: request.systemPrompt.content});
                    break;
            }
        }
        messages.push({role: "user", content: request.prompt});
        const response = await this.client.chat.completions.create({
            model: request.model,
            messages: messages,
            max_tokens: request.maxTokens ? request.maxTokens : 2048,
            temperature: request.temperature? request.temperature : 0,
        });

        return {
            text: response.choices[0].message.content || '',
        };
    }

    async streamCompletions(request: CompletionRequest, callback: CompletionCallback): Promise<void> {
        this.validateRequest(request);
        let messages = [];
        if (request.systemPrompt) {
            switch(request.systemPrompt.role) {
                case "system":
                    messages.push({role: "system", content: request.systemPrompt.content});
                    break;
                case "developer":
                    messages.push({role: "developer", content: request.systemPrompt.content});
                    break;
                case "assistant":
                    messages.push({role: "assistant", content: request.systemPrompt.content});
                    break;
                default:
                    messages.push({role: request.systemPrompt.role, content: request.systemPrompt.content});
                    break;
            }
        }
        messages.push({role: "user", content: request.prompt});
        const stream = await this.client.chat.completions.create({
            model: request.model,
            messages: messages,
            max_tokens: request.maxTokens ? request.maxTokens : 2048,
            temperature: request.temperature? request.temperature : 0,
            stream: true,
        });

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            callback({
                text: content,
                isComplete: false,
            });
        }

        callback({ text: '', isComplete: true });
    }

    async createEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
        const embedding = {embeddings: [], status: false};
        return embedding
    }
}