import { AIModelInterface, CompletionRequest, CompletionResponse, CompletionCallback, EmbeddingRequest, EmbeddingResponse } from './types';
import { OpenAIModel } from './openai-model';
import { ClaudeModel } from './claude-model';
import { DeepseekModel } from './deepseek-model';
import { OllamaModel } from './ollama-model';

export class AIWrapper {
    private model: AIModelInterface;

    constructor(provider: string, config: any) {
        switch (provider.toLowerCase()) {
            case 'openai':
                this.model = new OpenAIModel(config);
                break;
            case 'claude':
                this.model = new ClaudeModel(config);
                break;
            case 'deepseek':
                this.model = new DeepseekModel(config);
                break;
            case 'ollama':
                this.model = new OllamaModel(config);
                break;
            default:
                throw new Error(`Unsupported model type: ${provider}`);
        }
    }

    async completions(request: CompletionRequest): Promise<CompletionResponse> {
        return this.model.completions(request);
    }

    async streamCompletions(request: CompletionRequest, callback: CompletionCallback): Promise<void> {
        return this.model.streamCompletions(request, callback);
    }

    async createEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
        return this.model.createEmbedding(request);
    }
}