import { BaseAIModel } from './base-model';
import { CompletionRequest, CompletionResponse, CompletionCallback, EmbeddingRequest, EmbeddingResponse, ListModelResponse } from './types';

export class OllamaModel extends BaseAIModel {
    private client: { baseURL: string, headers: {} };

    constructor(config: { apiKey: string; baseUrl?: string }) {
        super(config);
        this.client = {
            baseURL: config.baseUrl || 'http://localhost:11434',
            headers: {
                'Content-Type': 'application/json',
            },
        };
    }

    async completions(request: CompletionRequest): Promise<CompletionResponse> {
        this.validateRequest(request);
        let messages = [];
        if (request.systemPrompt) {
            switch (request.systemPrompt.role) {
                case "system":
                    messages.push({ role: "system", content: request.systemPrompt.content });
                    break;
                case "tool":
                    messages.push({ role: "tool", content: request.systemPrompt.content });
                    break;
                case "assistant":
                    messages.push({ role: "assistant", content: request.systemPrompt.content });
                    break;
                default:
                    messages.push({ role: request.systemPrompt.role, content: request.systemPrompt.content });
                    break;
            }
        }
        messages.push({ role: "user", content: request.prompt });
        const response = await fetch(`${this.client.baseURL}/api/chat`, {
            method: "POST",
            headers: this.client.headers,
            body: JSON.stringify({
                model: request.model,
                stream: false,
                messages: messages,
                options: {
                    max_tokens: request.maxTokens ? request.maxTokens : 2048,
                    temperature: request.temperature ? request.temperature : 0,
                }
            })
        });

        if (!response.ok) {
            console.error("unable to fetch request from ai provider");
            throw new Error(await response.text());
        }
        let response_json = await response.json();

        return { text: response_json.message.content, images: response_json.message.images};

    }

    async streamCompletions(request: CompletionRequest, callback: CompletionCallback): Promise<void> {
        this.validateRequest(request);
        let messages = [];
        if (request.systemPrompt) {
            switch (request.systemPrompt.role) {
                case "system":
                    messages.push({ role: "system", content: request.systemPrompt.content });
                    break;
                case "tool":
                    messages.push({ role: "tool", content: request.systemPrompt.content });
                    break;
                case "assistant":
                    messages.push({ role: "assistant", content: request.systemPrompt.content });
                    break;
                default:
                    messages.push({ role: request.systemPrompt.role, content: request.systemPrompt.content });
                    break;
            }
        }
        messages.push({ role: "user", content: request.prompt });

        const resp = await fetch(`${this.client.baseURL}/api/chat`, {
            method: "POST",
            headers: this.client.headers,
            body: JSON.stringify({
                model: request.model,
                stream: true,
                messages: messages,
                options: {
                    max_tokens: request.maxTokens ? request.maxTokens : 2048,
                    temperature: request.temperature ? request.temperature : 0,
                }
            })
        });

        const reader = resp.body?.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = "";

        while (true && reader) {
            const { done, value } = await reader.read();
            const chunk = decoder.decode(value);
            if (done) break;
            if (chunk.toLowerCase() === '[done]') {
                break;
            }
            buffer += chunk;

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.trim() === '' || line.includes('[DONE]')) continue;

                try {
                    const jsonString = line.replace(/^data: /, '').trim();
                    const json = JSON.parse(jsonString);
                    const content = json.message.content;
                    if (content !== '') {
                        callback({ text: content, isComplete: false});
                    }
                } catch (e) {
                    // console.error('Error parsing chunk:', e);
                    // console.log(line);
                    // console.log("line number", lines.length);
                    buffer = line + (buffer ? "\n" + buffer : "");
                }
            }
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
        const resp = await fetch(`${this.client.baseURL}/api/embed`, {
            method: "POST",
            headers: this.client.headers,
            body: JSON.stringify({
                model: request.model,
                input: input
            })
        });

        const response = await resp.json()
        return {
            embeddings: response.embeddings,
            status: true
        }
    }


    async listModels(_request: any): Promise<ListModelResponse> {
        try {
            const response = await fetch(`${this.client.baseURL}/api/tags`, {
                method: "GET",
                headers: this.client.headers
            });
            const json = await response.json();
            let models = {models: []}
            for (const d of json.models) {
                models.models.push({
                    type: "model",
                    id: d.name,
                    name: d.name,
                    createdAt: new Date(d.modified_at)
                })
            }
            return models;
        } catch(e) {
            console.error("unable to retrieve models");
            throw new Error(e);
        }
    }
}