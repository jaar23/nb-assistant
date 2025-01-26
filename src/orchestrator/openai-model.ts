import { OpenAI } from 'openai';
import { BaseAIModel } from './base-model';
import { CompletionRequest, CompletionResponse, CompletionCallback, EmbeddingRequest, EmbeddingResponse, ListModelResponse } from './types';

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
        let input;
        if (request.chunks) {
            input = request.chunks;
        } else if (request.chunk) {
            input = request.chunk;
        } else {
            return {embeddings: [], status: false};
        }
        try {
            const resp = await this.client.embeddings.create({
                model: request.model,
                input: input,
                encoding_format: "float",
            });
            let embeddings = resp.data.filter((emb) => emb.object === "embedding").map(emb => emb.embedding);
            return {embeddings: embeddings, status: true};
        } catch (e) {
            console.error(e);
            return {embeddings: [], status: false};
        }
    }

    async listModels(_request: any): Promise<ListModelResponse> {
        try {
            const list = await this.client.models.list();
            let models = {models: []}
            for (const d of list.data) {
                models.models.push({
                    type: "model",
                    id: d.id,
                    name: d.id,
                    createdAt: new Date(d.created * 1000)
                })
            }
            return models;
        } catch(e) {
            console.error("unable to retrieve models");
            throw new Error(e);
        }
    }
}