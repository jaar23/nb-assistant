import { BaseAIModel } from './base-model';
import { CompletionRequest, CompletionResponse, CompletionCallback, EmbeddingRequest, EmbeddingResponse, ListModelResponse } from './types';
import Anthropic from '@anthropic-ai/sdk';


export class ClaudeModel extends BaseAIModel {
    private client: Anthropic;

    constructor(config: { apiKey: string; baseURL?: string}) {
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

        const message = await this.client.messages.create({
            max_tokens: request.maxTokens ? request.maxTokens : 2048,
            messages: messages,
            model: request.model,
            temperature: request.temperature? request.temperature : 0,
        });

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
        // console.log(message.content);
        // return message.content[0].text;
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

        await this.client.messages.stream({
            max_tokens: request.maxTokens ? request.maxTokens : 2048,
            temperature: request.temperature ? request.temperature : 0,
            messages: messages,
            model: request.model
        }).on('text', (text) => {
            callback({
                text: text,
                isComplete: false,
            });
        })
        // .on('contentBlock', (content) => console.log('contentBlock', content))
        // .on('message', (message) => console.log('message', message));

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

    async listModels(_request: any): Promise<ListModelResponse> {
        try {
            const resp = await this.client.models.list();
            const data = resp.data;
            let models = {models: []}
            for (const d of data) {
                models.models.push({
                    type: d.type,
                    id: d.id,
                    name: d.display_name,
                    createdAt: new Date(d.created_at)
                })
            }
            return models;
        } catch(e) {
            console.error("unable to retrieve models");
            throw new Error(e);
        }
    }
    
}