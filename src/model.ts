import { pipeline } from "@xenova/transformers";
import { sleep } from "@/utils";

export async function createModel() {
    //const pipe = await pipeline("feature-extraction", "Xenova/all-MiniLM-L12-v2");
    //const pipe = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    const pipe = await pipeline("feature-extraction", "Xenova/paraphrase-MiniLM-L6-v2");

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
