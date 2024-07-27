//import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0';

addEventListener("message", async(e) => {
  console.log("worker", e);
  try {
    const message = JSON.parse(e.data);
    console.log(message);
    let model;
    if (message.type === "init-model") {
      const {pipeline} = await import("@xenova/transformers");
      model = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
      console.log("model is init");
      postMessage("model is init")
      // pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2").then((pipe) => {
      //   model = pipe;
      // });
    } else if (message.type === "create-embedding") {
      if (model) {
        model(message.data, { pooling: "mean" }).then((output) => {
          console.log("output", output);
          postMessage(output.data);
        });
      }
    } else {
      console.log("worker do nothing...");
    }
  } catch (err) {
    console.log(err);
  }
});
