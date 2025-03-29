import { BaseAIModel } from './base-model';
import { CompletionRequest, CompletionResponse, CompletionCallback, EmbeddingRequest, EmbeddingResponse, ListModelResponse, CompletionJSONResponse, ImageGenerationResponse, ImageGenerationRequest } from './types';

export class DeepseekModel extends BaseAIModel {
    private client: { baseURL: string, headers: {} };
    private abortController: AbortController | null = null;

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

    public cancelRequest() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }

    async completions(request: CompletionRequest): Promise<CompletionResponse> {
        this.validateRequest(request);
        this.abortController = new AbortController();
        let messages = request.history || [];
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
        let request_body = {
            model: request.model,
            max_tokens: request.max_tokens ? request.max_tokens : 2048,
            stream: false,
            temperature: request.temperature ? request.temperature : 0,
            messages: messages,
        };
        if (request.top_p) {
            request_body["top_p"] = request.top_p;
        }
        if (request.presence_penalty) {
            request_body["presence_penalty"] = request.presence_penalty;
        }
        if (request.stop) {
            request_body["stop"] = request.stop;
        }
        try {
            const response = await fetch(`${this.client.baseURL}/chat/completions`, {
                method: "POST",
                headers: this.client.headers,
                body: JSON.stringify(request_body)
            });

            if (!response.ok) {
                console.error("unable to fetch request from ai provider");
                throw new Error(await response.text());
            }
            let fullResponse = "";
            let response_json = await response.json();
            for (const choice of response_json.choices) {
                if (choice.message.reasoning_content) {
                    fullResponse += choice.message.reasoning_content + "\n";
                } else {   
                    fullResponse += choice.message.content + "\n";
                }
            }
            return { text: fullResponse };
        } catch (error) {
            if (error.name === 'AbortError') {
                return { text: "request cancelled", images: null };
            }
            throw error;
        }


    }

    async streamCompletions(request: CompletionRequest, callback: CompletionCallback): Promise<void> {
        this.validateRequest(request);
        this.abortController = new AbortController();
        let messages = request.history || [];
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
        let request_body = {
            model: request.model,
            max_tokens: request.max_tokens ? request.max_tokens : 2048,
            stream: true,
            temperature: request.temperature ? request.temperature : 0,
            messages: messages,
        };
        if (request.top_p) {
            request_body["top_p"] = request.top_p;
        }
        if (request.presence_penalty) {
            request_body["presence_penalty"] = request.presence_penalty;
        }
        if (request.stop) {
            request_body["stop"] = request.stop;
        }
        try {
            const resp = await fetch(`${this.client.baseURL}/chat/completions`, {
                method: "POST",
                headers: this.client.headers,
                body: JSON.stringify(request_body)
            });

            const reader = resp.body?.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = "";
            let reasoning = false;
            while (true && reader) {
                try {
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
                            const reasoning_content = json.choices[0]?.delta?.reasoning_content || '';
                            if (reasoning_content !== '') {
                                if (!reasoning) {
                                    callback({ text: `<thought>${reasoning_content}`, isComplete: false });
                                    reasoning = true;
                                } else {
                                    callback({ text: reasoning_content, isComplete: false });
                                }
                            }
                            if (content !== '') {
                                if (reasoning) {
                                    callback({ text: `</thought>${content}`, isComplete: false });
                                    reasoning = false;
                                } else {
                                    callback({ text: content, isComplete: false });
                                }
                            } 
                        } catch (e) {
                            // console.error('Error parsing chunk:', e);
                            // console.log(line);
                            // console.log("line number", lines.length);
                            buffer = line + (buffer ? "\n" + buffer : "");
                        }
                    }
                } catch (error) {
                    if (error.name === 'AbortError') {
                        callback({ text: '\nRequest cancelled', isComplete: true });
                        return;
                    }
                    throw error;
                }
            }

            callback({ text: '', isComplete: true });
        } catch (error) {
            if (error.name === 'AbortError') {
                callback({ text: '\nRequest cancelled', isComplete: true });
                return;
            }
            throw error;
        }
    }


    async createEmbedding(_request: EmbeddingRequest): Promise<EmbeddingResponse> {
        const embedding = {
            embeddings: [],
            text: `This provider do not have provide embeddings API, use ollama or openai instead`,
            status: false
        };
        return embedding
    }

    async listModels(_request: any): Promise<ListModelResponse> {
        try {
            const response = await fetch(`${this.client.baseURL}/v1/models`, {
                method: "GET",
                headers: this.client.headers
            });
            const json = await response.json();
            let models = { models: [] }
            for (const d of json.data) {
                models.models.push({
                    type: "model",
                    id: d.id,
                    name: d.id,
                    createdAt: new Date()
                })
            }
            models.models = models.models.sort((a, b) => a.name > b.name ? 1 : -1);
            return models;
        } catch (e) {
            console.error("unable to retrieve models");
            throw new Error(e);
        }
    }

    async locallyInstalled(_request: any): Promise<boolean> {
        return false;
    }

    async jsonCompletions(request: CompletionRequest, jsonSchema: any): Promise<CompletionJSONResponse> {
        this.validateRequest(request);
        this.abortController = new AbortController();
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
        messages.push({ role: "user", content: `${request.prompt}. ALWAYS RESPONSE IN JSON ACCORDING TO THE SCHEMA PROVIDED` });
        let request_body = {
            model: request.model,
            max_tokens: request.max_tokens ? request.max_tokens : 2048,
            stream: false,
            temperature: request.temperature ? request.temperature : 0,
            messages: messages,
            response_format: {type: "json_object", json_schema: jsonSchema}
        };
        if (request.top_p) {
            request_body["top_p"] = request.top_p;
        }
        if (request.presence_penalty) {
            request_body["presence_penalty"] = request.presence_penalty;
        }
        
        try {
            const response = await fetch(`${this.client.baseURL}/chat/completions`, {
                method: "POST",
                headers: this.client.headers,
                body: JSON.stringify(request_body)
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
            return { json: JSON.parse(fullResponse) };
        } catch (error) {
            if (error.name === 'AbortError') {
                return { json: null };
            }
            throw error;
        }
    }

    async imageGeneration(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
        throw new Error("This provider does not support image generation currently");
    }
}