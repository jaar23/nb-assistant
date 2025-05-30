// Common interfaces and types

export interface CompletionRequest {
    prompt: string;
    model: string;
    max_tokens?: number;
    temperature?: number;
    stream?: boolean;
    systemPrompt?: {role: string, content: string};
    response_format?: string;
    json_schema?: string;
    top_k?: number;
    top_p?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
    stop?: string[];
    history?: {role: string, content: string}[];
}

export interface CompletionResponse {
    text: string;
    images?: Object;
}


export interface CompletionJSONResponse {
    json: Object
}


export interface StreamChunk {
    text: string;
    image?: Object;
    isComplete: boolean;
}

export type CompletionCallback = (chunk: StreamChunk) => void;

export interface EmbeddingRequest {
    model: string;
    chunk?: string;
    chunks?: string[];
}

export interface EmbeddingResponse {
    embeddings: any[];
    status: boolean;
    text?: string;
}

export type ImageQuality = "standard" | "hd"
export type ImageSize2 = "256x256" | "512x512" | "1024x1024"
export type ImageSize3 = "1024x1024" | "1792x1024" | "1024x1792"
export type ImageStyle = "vivid" | "natural"

export interface ImageGenerationRequest {
    model: string;
    prompt: string;
    quality: ImageQuality;
    size: ImageSize2 | ImageSize3;
    style: ImageStyle
}

export interface ImageGenerationResponse {
    data: string
}

export interface ListModelResponse {
    models: {
        type: string,
        id: string,
        name: string,
        createdAt: Date
    }[]
}

export interface AIModelConfig {
    apiKey: string;
    baseUrl?: string;
}

export interface AIModelInterface {
    completions(request: CompletionRequest): Promise<CompletionResponse>;
    streamCompletions(request: CompletionRequest, callback: CompletionCallback): Promise<void>;
    createEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse>;
    listModels(request: any): Promise<ListModelResponse>;
    locallyInstalled(request: any): Promise<boolean>;
    jsonCompletions(request: CompletionRequest, jsonSchema: any): Promise<CompletionJSONResponse>;
    imageGeneration(request: ImageGenerationRequest): Promise<ImageGenerationResponse>;
    cancelRequest(): void;
}