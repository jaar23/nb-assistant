// Common interfaces and types

export interface CompletionRequest {
    prompt: string;
    model: string;
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
    systemPrompt?: {role: string, content: string};
    response_format?: string;
    json_schema?: string;
}

export interface CompletionResponse {
    text: string;
    // Add other common response fields
}

export interface StreamChunk {
    text: string;
    isComplete: boolean;
}

export type CompletionCallback = (chunk: StreamChunk) => void;

export interface AIModelConfig {
    apiKey: string;
    baseUrl?: string;
}

export interface AIModelInterface {
    completions(request: CompletionRequest): Promise<CompletionResponse>;
    streamCompletions(request: CompletionRequest, callback: CompletionCallback): Promise<void>;
}