import { AIModelConfig, AIModelInterface, CompletionRequest, CompletionResponse, CompletionCallback, EmbeddingRequest, EmbeddingResponse, ListModelResponse } from './types';

export abstract class BaseAIModel implements AIModelInterface {
    protected config: AIModelConfig;

    constructor(config: AIModelConfig) {
        this.config = config;
    }

    abstract completions(request: CompletionRequest): Promise<CompletionResponse>;
    abstract streamCompletions(request: CompletionRequest, callback: CompletionCallback): Promise<void>;
    abstract createEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse>;
    abstract listModels(request: any): Promise<ListModelResponse>;
    abstract locallyInstalled(request: any): Promise<boolean>;

    protected validateRequest(request: CompletionRequest): void {
        if (!request.prompt) {
            throw new Error('Prompt is required');
        }
        if (!request.model) {
            throw new Error('Model is required');
        }
    }
}