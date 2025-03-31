import { BaseAIModel } from './base-model';
import { CompletionRequest, CompletionResponse, CompletionCallback, EmbeddingRequest, EmbeddingResponse, ListModelResponse, CompletionJSONResponse, ImageGenerationRequest, ImageGenerationResponse } from './types';
import Anthropic from '@anthropic-ai/sdk';

type ClaudeRole = "assistant" | "user" | "system" | "developer" | any;

export class ClaudeModel extends BaseAIModel {
    private client: Anthropic;
    private abortController: AbortController | null = null;

    constructor(config: { apiKey: string; baseURL?: string }) {
        super(config);
        if (config.baseURL) {
            this.client = new Anthropic({
                apiKey: config.apiKey,
                baseURL: config.baseURL,
                dangerouslyAllowBrowser: true
            })
        } else {
            this.client = new Anthropic({
                apiKey: config.apiKey,
                dangerouslyAllowBrowser: true
            })
        }
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
        let messages = request.history?.map(msg => ({
            role: msg.role as ClaudeRole, 
            content: msg.content
        })) || [];
        if (request.systemPrompt) {
            switch (request.systemPrompt.role) {
                case "system":
                    messages.push({ role: "system", content: request.systemPrompt.content });
                    break;
                case "developer":
                    messages.push({ role: "developer", content: request.systemPrompt.content });
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
            max_tokens: request.max_tokens ? request.max_tokens : 2048,
            messages: messages,
            model: request.model,
            temperature: request.temperature ? request.temperature : 0,
        };

        if (request.top_p) {
            request_body["top_p"] = request.top_p;
        }
        if (request.top_k) {
            request_body["top_k"] = request.top_k;
        }
        if (request.stop) {
            request_body["stop"] = request.stop;
        }
        try {
            const message = await this.client.messages.create(request_body, { signal: this.abortController.signal });

            const textContent = message.content
                .filter(block => block.type === 'text' && block.text)
                .map(block => block["text"])
                .join('');

            if (!textContent) {
                throw new Error('No text content found in the response');
            }

            return {
                text: textContent
            };
        } catch (error) {
            if (error.name === 'AbortError') {
                return { text: "request cancelled" };
            }
            throw new Error(error);
        }
        // console.log(message.content);
        // return message.content[0].text;
    }

    async streamCompletions(request: CompletionRequest, callback: CompletionCallback): Promise<void> {
        this.validateRequest(request);
        this.abortController = new AbortController();
        let messages = request.history?.map(msg => ({
            role: msg.role as ClaudeRole, 
            content: msg.content
        })) || [];
        if (request.systemPrompt) {
            switch (request.systemPrompt.role) {
                case "system":
                    messages.push({ role: "system", content: request.systemPrompt.content });
                    break;
                case "developer":
                    messages.push({ role: "developer", content: request.systemPrompt.content });
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
            max_tokens: request.max_tokens ? request.max_tokens : 2048,
            temperature: request.temperature ? request.temperature : 0,
            messages: messages,
            model: request.model
        };
        if (request.top_p) {
            request_body["top_p"] = request.top_p;
        }
        if (request.top_k) {
            request_body["top_k"] = request.top_k;
        }
        if (request.stop) {
            request_body["stop"] = request.stop;
        }
        // await this.client.messages.stream(request_body).on('text', (text) => {
        //     callback({
        //         text: text,
        //         isComplete: false,
        //     });
        // }) 
        let response = "";
        try {
            const stream = await this.client.messages.stream(request_body, { signal: this.abortController.signal });
            for await (const event of stream) {
                if (event.type === "message_start") continue;
                if (event.type === "message_stop") break;
                if (event.type === "content_block_start") continue;
                if (event.type === "content_block_stop") continue;
                console.log("claude response", event);
                if (event.delta && 'text' in event.delta) {
                    response += event?.delta?.text ?? "";
                    callback({
                        text: event?.delta?.text ?? "",
                        isComplete: false
                    })
                }
            }
            callback({ text: "", isComplete: true });
        } catch (error) {
            console.log("abort error");
            callback({ text: response, isComplete: false });
            callback({ text: "", isComplete: true });
            throw new Error(error);
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
            const resp = await this.client.models.list();
            const data = resp.data;
            let models = { models: [] }
            for (const d of data) {
                models.models.push({
                    type: d.type,
                    id: d.id,
                    name: d.display_name,
                    createdAt: new Date(d.created_at)
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
        // if (request.systemPrompt) {
        //     switch (request.systemPrompt.role) {
        //         case "system":
        //             messages.push({ role: "system", content: request.systemPrompt.content });
        //             break;
        //         case "developer":
        //             messages.push({ role: "developer", content: request.systemPrompt.content });
        //             break;
        //         case "assistant":
        //             messages.push({ role: "assistant", content: request.systemPrompt.content });
        //             break;
        //         default:
        //             messages.push({ role: request.systemPrompt.role, content: request.systemPrompt.content });
        //             break;
        //     }
        // }
        messages.push({ role: "user", content: `${request.prompt}\n JSON Schema Output format: ${jsonSchema}` });

        let request_body = {
            max_tokens: request.max_tokens ? request.max_tokens : 2048,
            messages: messages,
            model: request.model,
            temperature: request.temperature ? request.temperature : 0,
        };

        if (request.top_p) {
            request_body["top_p"] = request.top_p;
        }
        if (request.top_k) {
            request_body["top_k"] = request.top_k;
        }
        try {
            const message = await this.client.messages.create(request_body, { signal: this.abortController.signal });

            const textContent = message.content
                .filter(block => block.type === 'text' && block.text)
                .map(block => block["text"])
                .join('');

            if (!textContent) {
                throw new Error('No text content found in the response');
            }

            return {
                json: JSON.parse(textContent)
            };
        } catch (error) {
            if (error.name === 'AbortError') {
                return { json: null };
            }
            throw new Error(error);
        }
        // console.log(message.content);
        // return message.content[0].text;
    }

    async imageGeneration(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
        throw new Error("This provider does not support image generation currently");
    }
}