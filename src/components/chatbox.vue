<script setup lang="ts">
import { request } from "@/api.ts";
import { ref } from "vue";
import Loading from 'vue-loading-overlay';
import 'vue-loading-overlay/dist/css/index.css';

const chatInput = defineModel("chatInput");
const plugin = defineModel("plugin");
const chatHistory = ref([]);
const emit = defineEmits(["response"]);
const isLoading = ref(false);

async function promptAI() {
  const systemConf = await request("/api/system/getConf");

  const codeSystemPrompt = `You are an AI programming assistant, utilizing the DeepSeek Coder model, 
        developed by DeepSeek Company, and you only answer questions related to computer science. 
        For politically sensitive questions, security and privacy issues, and other non-computer 
        science questions, you will refuse to answer.`;

  const chatSystemPrompt = `You are a helpful, respectful and honest assistant.
        Always answer as helpfully as possible, while being safe.
        Your answers should not include any harmful, unethical, racist, sexist, toxic, dangerous, or illegal content.
        Please ensure that your responses are socially unbiased and positive in nature. If a question does not make
        any sense, or is not factually coherent, explain why instead of answering something incorrectly.
        If you don't know the answer to a question, please don't share false information.`;

  const systemMessage = {
    content: chatSystemPrompt,
    role: "system",
  };

  const userMessage = {
    content:
      chatHistory.value.length > 0
        ? `Here is the context:\n ${chatHistory.value.map((x) => `Question: ${x.question}\nAnswer: ${x.answer}`).join("\n")} ---\n ${chatInput.value}`
        : chatInput.value,
    role: "user",
  };

  if (
    systemConf.conf.ai.openAI.apiBaseURL !== "" &&
    systemConf.conf.ai.openAI.apiKey !== "" &&
    systemConf.conf.ai.openAI.apiModel !== "" &&
    systemConf.conf.ai.openAI.apiProvider !== ""
  ) {
    isLoading.value = true;
    const aiconf = systemConf.conf.ai.openAI;
    const endpoint = `${aiconf.apiBaseURL}/chat/completions`;
    const apiKey = aiconf.apiKey;
    const model = aiconf.apiModel;
    const temperature = aiconf.apiTemperature;
    const maxToken = aiconf.apiMaxTokens;
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        max_tokens: maxToken,
        stream: false,
        temperature,
        messages: [systemMessage, userMessage],
      }),
    });
    if (!resp.ok) {
      console.error("unable to fetch request from ai provider");
      throw new Error(await resp.text());
    }
    let response = await resp.json();
    console.log(response);
    let respMessage = "";
    for (const choice of response.choices) {
      respMessage += choice.message.content + "\n";
      isLoading.value = false;
    }
    emit("response", { question: chatInput.value, answer: respMessage });
    chatInput.value = "";
    isLoading.value = false;
  }
}

function updateHistory(history) {
  chatHistory.value = [];
  chatHistory.value = history;
  console.log("chatbox history", chatHistory.value);
}

function loadingCancel() {
    isLoading.value = false
}

defineExpose({
  updateHistory,
});
</script>

<template>
  <div class="input-area">
    <loading v-model:active="isLoading"
                 :can-cancel="false"
                 :on-cancel="loadingCancel"
                 loader="bars"
                 background-color="#eee"
                 opacity="0.25"
                 :is-full-page="false"/>
    <textarea
      class="textarea b3-text-field"
      v-model="chatInput"
      placeholder="how can I help you today?"
    ></textarea>
    <button class="button b3-button" @click="promptAI">Send</button>
  </div>
</template>

<style scoped>
.input-area {
  margin: 0.5em;
  padding: 0.5em;
  position: relative;
  border: 0px solid #ccc;
}

.textarea {
  margin: 0.1em;
  width: 88%;
  height: 100%;
  position: relative;
  resize: none;
  border: 0px;
}

.button {
  margin: 0.1em;
  position: absolute;
  top: 4%;
  right: 3px;
  bottom: 3px;
  width: 10%;
  min-width: 40px;
}
</style>
