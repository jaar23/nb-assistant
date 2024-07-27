import { env, pipeline, PipelineType, AutoModelForSequenceClassification, AutoTokenizer } from "@xenova/transformers";
import { getFile } from "@/api";
export type ModelType = "embedding" | "rerank";


// TODO: choose model to be initialize
export async function createModel() {
    const pipe = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    return pipe;
}

export async function createEmbedding(model: any, sentences: string) {
    // Create a feature-extraction pipeline
    // http://localhost:6806/models/Xenova/all-MiniLM-L6-v2/onnx/model_quantized.onnx
    // http://localhost:6806/models/Xenova/all-MiniLM-L6-v2/config.json
    // http://localhost:6806/models/Xenova/all-MiniLM-L6-v2/tokenizer_config.json
    // http://localhost:6806/models/Xenova/all-MiniLM-L6-v2/tokenizer.json
    try {
        //await sleep(100);
        // Compute sentence embeddings
        if (sentences == undefined || sentences == null) {
            return null;
        }
        const output = await model(sentences.trim(), {
            pooling: "mean",
            normalize: true,
        });
        //console.log('embedding', output.data);
        return output.data;
    } catch (err) {
        console.log("sentences: ", sentences);
        console.log("sentences length", sentences.length);
        console.error(err);
    }
}

// Xenova/bge-reranker-base
export async function reranker(model: any, query: string, result: string[]) {
    console.log("result", result);
    let tokenizer = await AutoTokenizer.from_pretrained("Xenova/bge-reranker-base");
    let texts = query.repeat(result.length);
    let inputs = tokenizer(texts, {text_pair: result, padding: true, truncation: true});
    const score = await model(inputs);
    console.log("score", score);
    return score;
}
