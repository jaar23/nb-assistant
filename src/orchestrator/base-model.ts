import { AIModelConfig, AIModelInterface, CompletionRequest, CompletionResponse, CompletionCallback, EmbeddingRequest, EmbeddingResponse } from './types';

export abstract class BaseAIModel implements AIModelInterface {
    protected config: AIModelConfig;

    constructor(config: AIModelConfig) {
        this.config = config;
    }

    abstract completions(request: CompletionRequest): Promise<CompletionResponse>;
    abstract streamCompletions(request: CompletionRequest, callback: CompletionCallback): Promise<void>;
    abstract createEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse>;

    protected validateRequest(request: CompletionRequest): void {
        if (!request.prompt) {
            throw new Error('Prompt is required');
        }
        if (!request.model) {
            throw new Error('Model is required');
        }
    }
}