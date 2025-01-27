<script setup lang="ts">
import {
  request,
  pushErrMsg,
  readDir,
  lsNotebooks,
  getAllDocsByNotebook,
  transformDocToList,
  exportMdContent,
} from "@/api";
import { dataPath } from "@/embedding";
import { ref, onMounted, watch, nextTick } from "vue";
import Loading from "vue-loading-overlay";
import "vue-loading-overlay/dist/css/index.css";
import {
  promptAI,
  countWords,
  searchNotebook,
  tokenize,
  promptAIChain,
  rephrasePrompt,
  sleep,
  generateUUID
} from "@/utils";
import history from "./history.vue";
import { CircleStop, Settings2 } from 'lucide-vue-next';
import { AIWrapper } from "@/orchestrator/ai-wrapper";
import { CompletionRequest } from "@/orchestrator/types";

const chatInput = defineModel<string>("chatInput");
const plugin: any = defineModel<any>("plugin");
const chatHistory = ref([]);
const emit = defineEmits(["response", "streamChunk"]);
const isLoading = defineModel("inferencing");
const enterToSend = defineModel("enterToSend");
const previousRole = ref("");
const selectedNotebook = ref("");
const selectedDocument = ref([]);
const vectorizedDb = ref([]);
const documents = ref([]);
const extraContext = ref("");
const rephrasedInput = ref("");
// 0.1.4
const messages = ref<any[]>();
const reply = ref<string>("");
const question = ref<string>("");
const isStreaming = ref<boolean>(false);
const isFocused = ref(false);
const historyRef = ref(null);
const models = ref<{value: string, label: string, apiKey: string, apiURL: string, provider: string}[]>([]);
const selectedModel = ref("");
const wrapper = ref<AIWrapper>();
const messageWindowRef = ref(null);

async function prompt(stream = true) {
  try {
    console.log('Starting stream...');
    const settings = plugin.value.settingUtils.settings;

    if (selectedModel.value !== "") {
      const model = models.value.find(m => m.value === selectedModel.value);
      wrapper.value = new AIWrapper(model.provider, {apiKey: model.apiKey, baseUrl: model.apiURL});

      isLoading.value = true;
      isStreaming.value = true;

      const extractByKey = (map, keyPrefix) => {
        const result = new Map();
        for (const [key, value] of map) {
          if (key.startsWith(keyPrefix)) {
            result.set(key, value);
          }
        }
        return result;
      };
      const modelConfig = extractByKey(settings, `${model.provider}.`);
      console.log("model config", modelConfig);
      let request = {};

      if (modelConfig.get("customSystemPrompt")) {
        request["systemPrompt"] = {role: "system", content: modelConfig.get("customSystemPrompt")};
      }
      let prompt = chatInput.value;
      if (modelConfig.get("customUserPrompt")) {
        prompt = `${modelConfig.get("customUserPrompt")}\n${chatInput.value}`;
      }
      if (modelConfig.get("max_tokens")) {
        request["max_tokens"] = modelConfig.get("max_tokens");
      }
      if (modelConfig.get("temperature")) {
        request["temperature"] = modelConfig.get("temperature");
      }
      if (modelConfig.get("top_p")) {
        request["top_p"] = modelConfig.get("top_p");
      }
      if (modelConfig.get("top_k")) {
        request["top_k"] = modelConfig.get("top_k");
      }
      if (modelConfig.get("presence_penalty")) {
        request["presence_penalty"] = modelConfig.get("presence_penalty");
      }
      if (modelConfig.get("frequency_penalty")) {
        request["frequency_penalty"] = modelConfig.get("frequency_penalty");
      }
      if (modelConfig.get("stop")) {
        const stop_words = modelConfig.get("stop").split(",");
        request["stop"] = stop_words;
      }
      if (messages.value.length > 0) {
        const chatHistory = messages.value.reduce((box, m) => {
          box.push({role: "user", content: m.question[m.questionIndex]});
          box.push({role: "assistant", content: m.answer[m.answerIndex]});
          return box;
        }, [] as Array<{role: string, content: string}>);
        request["history"] = chatHistory;
      }
      request["prompt"] = prompt;
      request["model"] = selectedModel.value;

      let fullResponse = "";
      if (stream) {
        question.value = chatInput.value;
        await wrapper.value.streamCompletions(request as CompletionRequest, (chunk) => {
          if (!chunk.isComplete) {
            // console.log("chunk", chunk);
            fullResponse += chunk.text;
            reply.value = fullResponse;
            emit('streamChunk', fullResponse);
            // Add scroll after each chunk
            nextTick(() => scrollToBottom());
          } else {
            console.log('Streaming complete. Final message:', fullResponse);
            messages.value.push({
              id: generateUUID(),
              question: [question.value],
              questionIndex: 0,
              answer: [fullResponse],
              answerIndex: 0,
              aiEmoji: "",
              actionable: false,
              actionType: "",
              blockId: "",
            });
            console.log('Updated messages:', messages.value);
            // Add scroll after each chunk
            nextTick(() => scrollToBottom());
          }
        });

      } else {
        const response = await wrapper.value.completions(request as CompletionRequest);
        return response.text;

      }
    }
  } catch (error) {
    console.error('Error during streaming:', error);
    await pushErrMsg(error.stack);
  } finally {
    isLoading.value = false;
    isStreaming.value = false;
    question.value = "";
    chatInput.value = "";
    console.log('Streaming ended');
  }
}

async function handleUpdateMessage(id: string, updatedMessage: string) {
  chatInput.value = updatedMessage;
  const message = await prompt(false);
  historyRef.value.resetMessage(id, message);
}

async function handleRegenMessage(id: string, question: string) {
  chatInput.value = question;
  const message = await prompt(false);
  historyRef.value.resetMessage(id, message);
}


async function typing(ev) {
  if (ev.key === "Enter" && !ev.shiftKey && enterToSend.value) {
    try {
      await prompt();
    } catch (e) {
      console.error(e);
      isLoading.value = false;
      pushErrMsg(e.stack);
    }
  }
}

function updateHistory(history) {
  chatHistory.value = [];
  chatHistory.value = history;
  console.log("chatbox history", chatHistory.value);
}

function loadingCancel() {
  isLoading.value = false;
}

function cancelPrompt() {
  wrapper.value.cancelRequest();
  loadingCancel()
}

async function checkVectorizedDb() {
  vectorizedDb.value = [];
  const dir: any = await readDir(dataPath);
  const notebooks = await lsNotebooks();
  for (const nb of notebooks.notebooks) {
    if ((nb.name === "SiYuan User Guide" || nb.name === "思源笔记用户指南") || nb.closed) {
      continue;
    }

    if (dir.filter((f) => f.name.includes(nb.id)).length > 0) {
      vectorizedDb.value.push({
        id: nb.id,
        name: nb.name,
        value: `@${nb.name}`,
        key: nb.id,
      });
    }
  }
  console.log("vectorized db", vectorizedDb.value);
}

async function checkAllDocuments() {
  documents.value = [];
  const notebooks = await lsNotebooks();
  for (const nb of notebooks.notebooks) {
    if ((nb.name === "SiYuan User Guide" || nb.name === "思源笔记用户指南") || nb.closed) {
      continue;
    }

    const alldocs = await getAllDocsByNotebook(nb.id, "/");
    let flatlist = [];
    transformDocToList(flatlist, alldocs, nb.name, nb.id);
    for (const doc of flatlist) {
      const docName = doc.docName.replace(".sy", "");
      documents.value.push({
        ...doc,
        id: doc.docId,
        key: doc.docId,
        value: `/${docName}`,
        name: docName,
      });
    }
  }
}


async function openSetting() {
  plugin.value.openSetting();
}

async function handleModelChange() {
  plugin.value.settingUtils.settings.set("selectedModel", selectedModel.value);
  await plugin.value.settingUtils.save();
}

async function loadModels() {
  const settings = plugin.value.settingUtils.settings;
  const ollamaApiURL = settings.get("ollama.url")?.trim();
  const ollamaModel = settings.get("ollama.model")?.trim();
  if (ollamaApiURL && ollamaModel) {
    models.value.push({ label: ollamaModel, value: ollamaModel, apiKey: "", apiURL: ollamaApiURL, provider: "ollama" });
  }

  const addModel = (apiKey: string | undefined, model: string | undefined, provider: string, models: any[]) => {
    if (apiKey && model) {
      models.push({ label: model, value: model, apiKey, apiURL: null, provider });
    }
  };
  addModel(settings.get("claude.apiKey")?.trim(), settings.get("claude.model")?.trim(), "claude", models.value);
  addModel(settings.get("deepseek.apiKey")?.trim(), settings.get("deepseek.model")?.trim(), "deepseek", models.value);
  addModel(settings.get("openai.apiKey")?.trim(), settings.get("openai.model")?.trim(), "openai", models.value);
}

function handleFocus() {
  isFocused.value = true;
  setTimeout(() => {
    window.scrollTo(0, document.body.scrollHeight);
  }, 100);
}

function handleBlur() {
  isFocused.value = false;
}

function scrollToBottom() {
  if (messageWindowRef.value) {
    const container = messageWindowRef.value;
    container.scrollTop = container.scrollHeight;
  }
}

// Add watch for messages to ensure scroll on any message updates
watch(() => messages.value, () => {
  nextTick(() => scrollToBottom());
}, { deep: true });

onMounted(async () => {
  try {
    isLoading.value = true;
    await plugin.value.settingUtils.load();
    await loadModels();
    // await checkVectorizedDb();
    // await checkAllDocuments();
    enterToSend.value = plugin.value.settingUtils.settings.get("enterToSend") ? plugin.value.settingUtils.settings.get("enterToSend") : true;
    isLoading.value = false;
    messages.value = [];
    if (models.value.length > 0) {
      selectedModel.value = plugin.value.settingUtils.settings.get("selectedModel") ? plugin.value.settingUtils.settings.get("selectedModel"): models.value[0].value;
    } else {
      throw new Error("No available model, please complete the setups in plugin setting.");
    }
  } catch (e) {
    console.error(e);
    isLoading.value = false;
    await pushErrMsg(e);
  }
});

defineExpose({
  updateHistory,
});
</script>

<template>
  <div class="page-container">
    <div class="chat-wrapper">
      <div class="chat-container" ref="messageWindowRef">
        <history class="history" ref="historyRef" v-model:messages="messages" v-model:plugin="plugin" :question="question" 
          :streamMessage="reply" :isStreaming="isStreaming" @updateMessage="handleUpdateMessage" @regenMessage="handleRegenMessage"></history>
      </div>

      <button @click="cancelPrompt" class="cancel-prompt" v-if="isLoading">
        <CircleStop :size="20" color="#fafafa" :stroke-width="1" />
      </button>
      <!-- Model selector and input area wrapper -->
      <div class="input-wrapper">
        <!-- Model selector -->
        <loading v-model:active="isLoading" :can-cancel="false" :on-cancel="loadingCancel" loader="bars"
          background-color="#eee" :opacity="0.25" :is-full-page="false" />
        <div class="chat-control">
          <span @click="openSetting" class="btn-a">
            <Settings2 class="settings" />
          </span>
          <span class="model-label">model</span>
          <div class="model-dropdown">
            <select class="model-select" v-model="selectedModel" @change="handleModelChange">
              <option v-for="model of models" :key="model.value" :value="model.value">
                {{ model.label }}
              </option>
            </select>
          </div>
        </div>

        <!-- Chat input area -->
        <div class="input-area">
          <textarea class="textarea" v-model="chatInput" :placeholder="plugin.i18n.chatPlaceHolder"
            @keypress="typing" @focus="handleFocus" @blur="handleBlur"></textarea>
          <!-- Enter to send indicator -->
          <div class="enter-indicator">[ Enter ] to Send</div>
        </div>
      </div>
    </div>
  </div>
</template>


<style scoped>
.page-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: calc(95vh - env(safe-area-inset-bottom)); /* Adjust for safe area */
}

.chat-wrapper {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow: hidden;
}

.chat-container {
  flex-grow: 1;
  overflow-y: auto;
  padding: 1em;
  scroll-behavior: smooth; 
}

.input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-border-color);
  color: var(--b3-empty-color);
  border-radius: 4px;
  margin-top: auto; /* Push the input area to the bottom */
  padding-bottom: env(safe-area-inset-bottom); /* Adjust for safe area */
  position: relative;
}

.chat-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.settings {
  width: 20px;
  color: #666;
  cursor: pointer;
}

.model-label {
  color: var(--b3-empty-color);
  font-size: 14px;
}

.model-dropdown {
  position: relative;
  flex: 1;
}

.model-select {
  width: 200px;
  padding: 4px 8px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  background: var(--b3-select-background);
  font-size: 14px;
  cursor: pointer;
  color: var(--b3-empty-color);
}

.input-area {
  position: relative;
  width: 100%;
}

.mention {
  width: 100%;
  background-color: transparent;
}

.textarea {
  width: 100%;
  min-height: 40px;
  padding: 8px;
  border: none;
  resize: none;
  outline: none;
  font-size: 14px;
  background: transparent;
  color: var(--color-neutral-1);
}

.enter-indicator {
  position: absolute;
  bottom: 8px;
  right: 8px;
  color: #999;
  font-size: 12px;
  pointer-events: none;
}

.cancel-prompt {
  background: var(--b3-theme-surface-lighter);
  color: var(--b3-theme-on-surface);
  border: 0px;
}


/* Mobile-specific styles */
@media (max-width: 480px) {
  .page-container {
    height: 100vh;
    height: calc(95vh - env(safe-area-inset-bottom));
  }

  .input-wrapper {
    padding-bottom: calc(12px + env(safe-area-inset-bottom));
  }

  .textarea:focus {
    margin-bottom: 150px; /* Adjust this value based on your keyboard height */
  }
}

/* Tablet-specific styles */
@media (min-width: 481px) and (max-width: 1024px) {
  .page-container {
    height: 100vh;
    height: calc(95vh - env(safe-area-inset-bottom));
  }

  .input-wrapper {
    padding-bottom: calc(12px + env(safe-area-inset-bottom));
  }

  .textarea:focus {
    margin-bottom: 100px; /* Adjust this value based on your keyboard height */
  }
}

/* Laptop-specific styles */
/* @media (min-width: 1025px) {
  .page-container {
    height: 100vh;
    height: calc(95vh - env(safe-area-inset-bottom));
  }

  .input-wrapper {
    padding-bottom: calc(12px + env(safe-area-inset-bottom));
  }

  .textarea:focus {
    margin-bottom: 50px; 
  }
} */
</style>