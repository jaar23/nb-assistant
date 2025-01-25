import { BaseAIModel } from './base-model';
import { CompletionRequest, CompletionResponse, CompletionCallback, EmbeddingRequest, EmbeddingResponse } from './types';

export class DeepseekModel extends BaseAIModel {
    private client: { baseURL: string, headers: {} };

    constructor(config: { apiKey: string; baseUrl?: string }) {
        super(config);
        this.client = {
            baseURL: config.baseUrl || 'https://api.deepseek.com',
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
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
        const response = await fetch(`${this.client.baseURL}/chat/completions`, {
            method: "POST",
            headers: this.client.headers,
            body: JSON.stringify({
                model: request.model,
                max_tokens: request.maxTokens ? request.maxTokens : 2048,
                stream: false,
                temperature: request.temperature ? request.temperature : 0,
                messages: messages,
            })
        });

        if (!response.ok) {
            console.error("unable to fetch request from ai provider");
            throw new Error(await response.text());
        }
        let fullResponse = "";
        let response_json = await response.json();
        for (const choice of response_json.choices) {
            fullResponse += choice.message.content + "\n";
        }
        return { text: fullResponse };

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

        const resp = await fetch(`${this.client.baseURL}/chat/completions`, {
            method: "POST",
            headers: this.client.headers,
            body: JSON.stringify({
                model: request.model,
                max_tokens: request.maxTokens ? request.maxTokens : 2048,
                stream: true,
                temperature: request.temperature ? request.temperature : 0,
                messages: messages,
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
                    const content = json.choices[0]?.delta?.content || '';
                    if (content !== '') {
                        callback({ text: content, isComplete: false });
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


    async createEmbedding(_request: EmbeddingRequest): Promise<EmbeddingResponse> {
        const embedding = {
            embeddings: [], 
            text: `This provider do not have provide embeddings API, use ollama or openai instead`, 
            status: false
        };
        return embedding
    }
}