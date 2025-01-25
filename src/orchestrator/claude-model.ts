import { BaseAIModel } from './base-model';
import { CompletionRequest, CompletionResponse, CompletionCallback, EmbeddingRequest, EmbeddingResponse } from './types';
import Anthropic from '@anthropic-ai/sdk';


export class ClaudeModel extends BaseAIModel {
    private client: Anthropic;

    constructor(config: { apiKey: string; }) {
        super(config);
        this.client = new Anthropic({
            apiKey: config.apiKey
        })
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

    async createEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
        const embedding = {embeddings: [], status: false};
        return embedding
    }
}