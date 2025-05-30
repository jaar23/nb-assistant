import { OpenAI } from 'openai';
import { BaseAIModel } from './base-model';
import { CompletionRequest, CompletionResponse, CompletionCallback, EmbeddingRequest, EmbeddingResponse, ListModelResponse, CompletionJSONResponse, ImageGenerationRequest, ImageGenerationResponse } from './types';
import { Stream } from 'openai/streaming';
import { ChatCompletionChunk } from 'openai/resources';

type OpenAIRole = "assistant" | "user" | "system" | "developer" | any;

export class CustomAIModel extends BaseAIModel {
    private client: OpenAI;
    private abortController: AbortController | null = null;

    constructor(config: { apiKey: string, baseUrl?: string }) {
        super(config);
        this.client = new OpenAI({ baseURL: config.baseUrl, apiKey: config.apiKey, dangerouslyAllowBrowser: true });
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
            role: msg.role as OpenAIRole, 
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
        let request_body = {};
        if (request.model.startsWith("o1") || request.model.startsWith("o3")) {
            request_body = {
                model: request.model,
                messages: messages,
                stream: false,
                store: true,
            };
        } else {
            request_body = {
                model: request.model,
                messages: messages,
                max_tokens: request.max_tokens ? request.max_tokens : 2048,
                temperature: request.temperature ? request.temperature : 0,
                stream: false
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
        }
        try {
            //@ts-ignore
            const response = await this.client.chat.completions.create(request_body, { signal: this.abortController.signal });

            return {
                text: response.choices[0].message.content || '',
            };
        } catch (error) {
            throw new Error(error);
        }
    }

    async streamCompletions(request: CompletionRequest, callback: CompletionCallback): Promise<void> {
        this.validateRequest(request);
        this.abortController = new AbortController();
        let messages = request.history?.map(msg => ({
            role: msg.role as OpenAIRole, 
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
        let request_body = {};
        if (request.model.startsWith("o1") || request.model.startsWith("o3") || request.model.includes("search")) {
            request_body = {
                model: request.model,
                messages: messages,
                stream: true,
                store: true,
            };
        } else {
            request_body = {
                model: request.model,
                messages: messages,
                max_tokens: request.max_tokens ? request.max_tokens : 2048,
                temperature: request.temperature ? request.temperature : 0,
                stream: true
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
        }
        
        let response = "";
        try {
            //@ts-ignore
            const stream = await this.client.chat.completions.create(request_body, { signal: this.abortController.signal });
            const isStream = (response: any): response is Stream<ChatCompletionChunk> => {
                return typeof response[Symbol.asyncIterator] === 'function';
            };
            if (isStream(stream)) {
                for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content || '';
                    response += content;
                    callback({
                        text: content,
                        isComplete: false,
                    });
                }

                callback({ text: '', isComplete: true });
            }
        } catch (error) {
            console.log("abort error");
            callback({ text: response, isComplete: false });
            callback({ text: "", isComplete: true });
            throw new Error(error);
        }
    }

    async createEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
        let input;
        if (request.chunks) {
            input = request.chunks;
        } else if (request.chunk) {
            input = request.chunk;
        } else {
            return { embeddings: [], status: false };
        }
        try {
            const resp = await this.client.embeddings.create({
                model: request.model,
                input: input,
                encoding_format: "float",
            });
            let embeddings = resp.data.filter((emb) => emb.object === "embedding").map(emb => emb.embedding);
            return { embeddings: embeddings, status: true };
        } catch (e) {
            console.error(e);
            return { embeddings: [], status: false };
        }
    }

    async listModels(_request: any): Promise<ListModelResponse> {
        try {
            const list = await this.client.models.list();
            let models = { models: [] }
            for (const d of list.data) {
                // not supported currently
                if (d.id.includes("tts") || d.id.includes("whisper") || d.id.includes("realtime") 
                    || d.id.includes("transcribe") || d.id.includes("audio") || d.id.includes("babbage")
                    || d.id.includes("moderation") || d.id.includes("davinci") || d.id === "dall-e-2") continue
                models.models.push({
                    type: "model",
                    id: d.id,
                    name: d.id,
                    createdAt: new Date(d.created * 1000)
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
        let messages = request.history?.map(msg => ({
            role: msg.role as OpenAIRole, 
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
        messages.push({ role: "user", content: `${request.prompt}, response in JSON format` });
        let request_body = {
            model: request.model,
            messages: messages,
            max_tokens: request.max_tokens ? request.max_tokens : 2048,
            temperature: request.temperature ? request.temperature : 0,
            response_format: { type: "json_object" }
        };
        if (request.top_p) {
            request_body["top_p"] = request.top_p;
        }
        if (request.presence_penalty) {
            request_body["presence_penalty"] = request.presence_penalty;
        }
        
        try {
            // @ts-ignore
            const response = await this.client.chat.completions.create(request_body, { signal: this.abortController.signal });

            return {
                json: JSON.parse(response.choices[0].message.content),
            };
        } catch (error) {
            throw new Error(error);
        }
    }

    async imageGeneration(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
        try {
            const response = await this.client.images.generate({
                model: request.model,
                prompt: request.prompt,
                n: 1,
                quality: request.quality || "standard",
                response_format: "b64_json",
                style: request.style || "vivid",
                size: request.size || "1024x1024",
            });
    
            if (response.data && response.data[0]?.b64_json) {
                return {
                    data: response.data[0].b64_json,
                };
            } else {
                throw new Error("No image data received from OpenAI");
            }
        } catch (error) {
            console.error("Image generation error:", error);
            return {
                data: ""
            };
        }
    }
}