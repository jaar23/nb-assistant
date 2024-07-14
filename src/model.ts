import { env, pipeline, PipelineType, AutoModelForSequenceClassification, AutoTokenizer } from "@xenova/transformers";
import { getFile } from "@/api";
export type ModelType = "embedding" | "rerank";

// export async function createModel(modelType: ModelType = "embedding") {
//     //const pipe = await pipeline("feature-extraction", "Xenova/all-MiniLM-L12-v2");
//     const rerankModel = "Xenova/bge-reranker-base";
//     const embeddingModel = "Xenova/all-MiniLM-L6-v2";
//     if (modelType === "embedding") {
//         const pipe = await pipeline("feature-extraction", embeddingModel);
//         return pipe;
//     } else if (modelType === "rerank") {
//         const pipe = await AutoModelForSequenceClassification.from_pretrained("text-classification", {quantized: true});
//         return pipe;
//     } else {
//         throw new Error("Invalid model type");
//     }
// }

export async function createModel() {
    //const pipe = await pipeline("feature-extraction", "Xenova/all-MiniLM-L12-v2");
    const pipe = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    //const pipe = await pipeline("feature-extraction", "Xenova/paraphrase-MiniLM-L6-v2");
    // const onnx = await getFile("temp/nb-assistant/model_quantized.onnx");
    // const onnxURL = URL.createObjectURL(onnx);
    // env.customCache = fetch(onnxURL).then(resp => {
    //     console.log("cache resp", resp);
    //     if (!resp.ok) {
    //         throw new TypeError("bad response status");
    //     }
    //     return cache.put(onnxURL, resp);
    // }).catch(err => console.error(err));
    // env.useCustomCache = true;
    // console.log(env);
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
