<script setup lang="ts">
import {
  request,
  pushErrMsg,
  readDir,
  lsNotebooks,
  getAllDocsByNotebook,
  transformDocToList,
  exportMdContent,
  insertBlock,
  getFile,
  putFile,
  checkBlockExist,
  pushMsg,
} from "@/api";
import { ref, onMounted, watch, nextTick } from "vue";
import Loading from "vue-loading-overlay";
import "vue-loading-overlay/dist/css/index.css";
import {
  countWords,
  searchNotebook,
  tokenize,
  rephrasePrompt,
  sleep,
  generateUUID,
  getCurrentTabs,
  strToFile
} from "@/utils";
import history from "./history.vue";
import { CircleStop, Settings2, History, Plus, MessageCircle, Database, Search } from 'lucide-vue-next';
import { AIWrapper } from "@/orchestrator/ai-wrapper";
import { CompletionRequest } from "@/orchestrator/types";
import { Message } from "../history.vue";
import savedchat from "./savedchat.vue";
import vectordb from "./vectordb.vue";
import search from "./search.vue";
import { transformModelNamePathSafeStr } from "@/embedding";

const chatInput = defineModel<string>("chatInput");
const plugin: any = defineModel<any>("plugin");

const emit = defineEmits(["response", "streamChunk"]);
const isLoading = ref(false);
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
const models = ref<{ value: string, label: string, apiKey: string, apiURL: string, provider: string }[]>([]);
const selectedModel = ref("");
const wrapper = ref<AIWrapper>();
const messageWindowRef = ref(null);
const dataPath = "temp/nb-assistant";
const chatUUID = ref("");
const chatHistories = ref([]);
const view = ref("chat");
const chatControl = ref("");
const showChatAction = ref(false);
const openTabs = ref([]);
const selectedSumTab = ref("");
const chatAlias = ref("");
const summarizeTemplate = `
Provide a comprehensive summary of the given text. The summary should cover all the key points and main ideas presented 
in the original text, while also condensing the information into a concise and easy-to-understand format. 
Please ensure that the summary includes relevant details and examples that support the main ideas, 
while avoiding any unnecessary information or repetition. The length of the summary should be appropriate for the 
length and complexity of the original text, providing a clear and accurate overview without omitting any important information.

Input: {text}
`

const isDropdownOpen = ref(false);

async function prompt(stream = true, withHistory = true) {
  try {
    console.log('Starting stream...');
    const settings = plugin.value.settingUtils.settings;

    if (selectedModel.value !== "") {
      const model = models.value.find(m => m.value === selectedModel.value);
      wrapper.value = new AIWrapper(model.provider, { apiKey: model.apiKey, baseUrl: model.apiURL });

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
        request["systemPrompt"] = { role: "system", content: modelConfig.get("customSystemPrompt") };
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
      if (messages.value.length > 0 && withHistory) {
        const chatHistory = messages.value.reduce((box, m) => {
          box.push({ role: "user", content: m.question[m.questionIndex] });
          box.push({ role: "assistant", content: m.answer[m.answerIndex] });
          return box;
        }, [] as Array<{ role: string, content: string }>);
        request["history"] = chatHistory;
      }
      request["prompt"] = prompt;
      request["model"] = selectedModel.value;

      let fullResponse = "";
      if (stream) {
        if (chatAlias.value !== "") {
          question.value = chatAlias.value;
        } else {
          question.value = chatInput.value;
        }
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
    await pushErrMsg(`${error.message}, try again with another model`);
  } finally {
    isLoading.value = false;
    isStreaming.value = false;
    question.value = "";
    chatInput.value = "";
    chatAlias.value = "";
    console.log('Streaming ended');
  }
}

async function handleUpdateMessage(id: string, updatedMessage: string) {
  chatInput.value = updatedMessage;
  const message = await prompt(false);
  historyRef.value.resetMessage(id, message);
  await saveChatHistory();
}

async function handleRegenMessage(id: string, question: string) {
  chatInput.value = question;
  const message = await prompt(false);
  historyRef.value.resetMessage(id, message);
  await saveChatHistory();
}

async function handleRemoveMessage() {
  await saveChatHistory();
}

async function typing(ev) {
  if (ev.key === "Enter" && !ev.shiftKey && enterToSend.value) {
    ev.preventDefault();
    try {
      await prompt();
      await saveChatHistory();
    } catch (e) {
      console.error(e);
      isLoading.value = false;
      pushErrMsg(e.stack);
    }
  }
}

async function saveChatHistory() {
  let historyIndex = []
  const indexResp = await getFile(`${dataPath}/history-index.json`);
  if (indexResp !== null) {
    historyIndex = indexResp;
  }
  console.log(historyIndex);
  // if new
  if (!historyIndex.find(hist => hist.id == chatUUID.value)) {
    const firstMessage = messages.value?.[0].question[messages.value?.[0].questionIndex];
    historyIndex.push({
      name: firstMessage,
      id: chatUUID.value,
      date: new Date(),
      length: 0
    });
  }
  const jsonStr = JSON.stringify(messages.value ?? []);
  const file = strToFile(jsonStr, `${chatUUID.value}-history`, "application/json");
  const historyResp = await putFile(`${dataPath}/${chatUUID.value}-history.json`, false, file);
  console.log("history", historyResp);

  const jsonStr2 = JSON.stringify(historyIndex ?? []);
  const file2 = strToFile(jsonStr2, `${chatUUID.value}-history`, "application/json");
  const historyIndexResp = await putFile(`${dataPath}/history-index.json`, false, file2)
  console.log("history index", historyIndexResp);
}


async function getChatHistories() {
  const indexResp = await getFile(`${dataPath}/history-index.json`);
  let latestIndex: { id: string, date: Date, length: number, name: string };
  if (indexResp !== null) {
    if (indexResp.code === 404) {
        console.log("history updated to 0.1.4 onwards");
    } else {
      chatHistories.value = indexResp;
      latestIndex = (indexResp ?? []).reduce((a, b) => {
        return new Date(a.date) > new Date(b.date) ? a : b;
      });
    }
  }
  console.log("latest index", latestIndex);
  if (latestIndex) {
    const latestHistory: Message[] = await getFile(`${dataPath}/${latestIndex.id}-history.json`);
    if (latestHistory) {
      chatUUID.value = latestIndex.id;
      messages.value = latestHistory;
    }
  }
}


async function getChatHistory() {
  const history: Message[] = await getFile(`${dataPath}/${chatUUID.value}-history.json`);
  if (history) {
    messages.value = history;
  }
}

async function getOpenTabs() {
  const systemConf = await request("/api/system/getConf", {});
  openTabs.value = getCurrentTabs(systemConf.conf.uiLayout.layout);
}

async function openBlock(blockId) {
  const url = "siyuan://blocks/";
  const blockExist = await checkBlockExist(blockId);
  if (!blockExist) {
    await pushMsg(plugin.i18n.blockNotFound);
    return;
  }
  // @ts-ignore: siyuan specific function
  window.openFileByURL(url + blockId);
}


async function summarizeOpenDoc(ev) {
  try {
    // const systemConf = await request("/api/system/getConf", {});
    const blockArr = ev.target.value.split("|");
    const blockId = blockArr[0];
    const blockTitle = blockArr[1];
    const doc = await request("/api/export/exportMdContent", { id: blockId });
    // const pluginSetting = plugin.value.settingUtils.dump()
    chatAlias.value = `Summarize <a href="siyuan://blocks/${blockId}" 
            data-type="block-ref"
            data-subtype="d" :data-id="${blockId}">${blockTitle}</a>`
    isLoading.value = true;
    chatInput.value = summarizeTemplate.replace("{text}", doc.content);
    await prompt(true, false);
    isLoading.value = false;
  } catch (err) {
    isLoading.value = false;
    await pushErrMsg(err.stack);
  }
}

// async function handleChatControl(e) {
//   if (chatControl.value === "summary")  {
//     summarizeOpenDoc()
//   }
// }


function loadingCancel() {
  isLoading.value = false;
}

function cancelPrompt() {
  wrapper.value.cancelRequest();
  loadingCancel()
}

async function checkVectorizedDb() {
  const provider = plugin.value.settingUtils.settings.get("embedding.provider");
  const used_in = plugin.value.settingUtils.settings.get("embedding.used_in");
  const model = plugin.value.settingUtils.settings.get("embedding.model");
  const modelSafePathName = transformModelNamePathSafeStr(model);
  const dir: any = await readDir(dataPath);
  const notebooks = await lsNotebooks();
  vectorizedDb.value = [];
  if (used_in === "ai-provider" && ["ollama", "openai"].includes(provider)) {
    for (const nb of notebooks.notebooks) {
      if ((nb.name === "SiYuan User Guide" || nb.name === "思源笔记用户指南") || nb.closed) {
        continue;
      }
      if (dir.filter((f) => f.name.includes(`${nb.id}-${modelSafePathName}`)).length > 0) {
        vectorizedDb.value.push({
          id: nb.id,
          name: nb.name,
          value: `@${nb.name}`,
          key: nb.id,
        });
      }
    }
  } else {
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
  }
}

// async function checkVectorizedDb() {
//   vectorizedDb.value = [];
//   const dir: any = await readDir(dataPath);
//   const notebooks = await lsNotebooks();
//   for (const nb of notebooks.notebooks) {
//     if ((nb.name === "SiYuan User Guide" || nb.name === "思源笔记用户指南") || nb.closed) {
//       continue;
//     }

//     if (dir.filter((f) => f.name.includes(nb.id)).length > 0) {
//       vectorizedDb.value.push({
//         id: nb.id,
//         name: nb.name,
//         value: `@${nb.name}`,
//         key: nb.id,
//       });
//     }
//   }
//   console.log("vectorized db", vectorizedDb.value);
// }

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

async function openSavedChat() {
  view.value = "saved_chat";
}

async function openNewChat() {
  view.value = "chat";
  chatUUID.value = generateUUID();
  messages.value = [];
  let historyIndex = [];
  const indexResp = await getFile(`${dataPath}/history-index.json`);
  if (indexResp !== null) {
    if (indexResp.code === 404) {
      console.log("history updated to 0.1.4 onwards");
    } else { 
      historyIndex = indexResp;
    }
  }
  console.log(historyIndex);
}

async function openChat() {
  view.value = "chat";
}

async function openVectorDb() {
  view.value = "vectordb";
}

async function openSearchView() {
  view.value = "similar_search";
}

async function handleOpenChatHistory(id: string) {
  chatUUID.value = id;
  await getChatHistory();
  view.value = "chat";
}


async function handleGetStarted() {
  console.log("display tutorial")
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
    chatUUID.value = generateUUID();
    isLoading.value = true;
    await plugin.value.settingUtils.load();
    await loadModels();
    // await checkVectorizedDb();
    // await checkAllDocuments();
    enterToSend.value = plugin.value.settingUtils.settings.get("enterToSend") ? plugin.value.settingUtils.settings.get("enterToSend") : true;
    isLoading.value = false;
    messages.value = [];
    if (models.value.length > 0) {
      selectedModel.value = plugin.value.settingUtils.settings.get("selectedModel") ? plugin.value.settingUtils.settings.get("selectedModel") : models.value[0].value;
    } else {
      throw new Error("No available model, please complete the setups in plugin setting.");
    }
    await getChatHistories()
  } catch (e) {
    console.error(e);
    isLoading.value = false;
    await pushErrMsg(e);
  }
});

</script>

<template>
  <div class="page-container">
    <div class="chat-wrapper">
      <div class="toolbar">
        <div class="toolbar-left">
          <h3>nb</h3>
        </div>
        <div class="toolbar-right">
          <div class="dropdown-wrapper">
            <span @click="openSearchView" class="toolbar-btn">
              <Search :size="20" color="#fafafa" :stroke-width="1"/>
            </span>
            <span @click="openVectorDb" class="toolbar-btn">
              <Database :size="20" color="#fafafa" :stroke-width="1"/>
            </span>
            <span @click="openNewChat" class="toolbar-btn">
              <Plus :size="20" color="#fafafa" :stroke-width="1" />
            </span>
            <span @click="openSavedChat" class="toolbar-btn">
              <History :size="20" color="#fafafa" :stroke-width="1" />
            </span>
            <span @click="openChat" class="toolbar-btn">
              <MessageCircle :size="20" color="#fafafa" :stroke-width="1" />
            </span>
          </div>
        </div>
      </div>

      <div class="chat-overlay" v-if="view == 'chat' && messages.length === 0">
        <h2>nb</h2>
        <br/>
        <p>Hi, I'm your notebook assistant. </p>
        <br/>
        <p>How can I help you today?</p>
        <br/>
        <span class="get-started" @click="handleGetStarted">Getting started</span>
      </div>
      <div v-if="view == 'chat'" class="chat-container" ref="messageWindowRef">
        <history class="history" ref="historyRef" v-model:messages="messages" v-model:plugin="plugin"
          :question="question" :streamMessage="reply" :isStreaming="isStreaming" @updateMessage="handleUpdateMessage"
          @regenMessage="handleRegenMessage" @removeMessage="handleRemoveMessage"></history>
      </div>

      <!-- Popup Container -->
      <div id="popup" class="popup" v-if="showChatAction">
          <div class="popup-content">
              <span id="closePopup" @click="showChatAction = false" class="close">&times;</span>
              <p>This is a centered popup!</p>
          </div>
      </div>

      <div v-if="view == 'chat'" class="control-container">
        <!-- <select class="b3-select" v-model="selectedSumTab" :disabled="isStreaming" @change="summarizeOpenDoc"
          @focus="getOpenTabs">
          <option class="b3-option" disabled value="">
            {{ plugin.i18n.summarize }}
          </option>
          <option class="b3-option" v-for="opt in openTabs" :value="opt.children.blockId + '|' + opt.title">
            {{ opt.title }}
          </option>
        </select> -->
        <!-- move selection of doc to here -->
        <!-- move save chat to here -->
        <!-- move auto tag to here -->
        <!-- move attach external file to here  -->
      </div>

      <div v-if="view == 'chat'" class="input-wrapper">
        <loading v-model:active="isLoading" :can-cancel="false" :on-cancel="loadingCancel" loader="bars"
          background-color="#eee" :opacity="0.25" :is-full-page="false" />
        <div class="chat-control">
          <span @click="openSetting" class="btn-a">
            <Settings2 class="settings" :size="20" color="#fafafa" :stroke-width="1" />
          </span>
          <span class="model-label">model</span>
          <div class="model-dropdown">
            <select class="model-select" v-model="selectedModel" @change="handleModelChange">
              <option v-for="model in models" :key="model.value" :value="model.value">
                {{ model.label }}
              </option>
            </select>
          </div>
          <span class="btn-a" @click="showChatAction = !showChatAction">
             more action
          </span>
          <button @click="cancelPrompt" class="cancel-prompt" v-if="isLoading">
            <CircleStop :size="20" color="#fafafa" :stroke-width="1" />
          </button>
        </div>
        <div class="input-area">
          <textarea class="textarea" v-model="chatInput" :placeholder="plugin.i18n.chatPlaceHolder" @keypress="typing"
            @focus="handleFocus" @blur="handleBlur"></textarea>
          <div class="enter-indicator">[ Enter ] to Send</div>
        </div>
      </div>
      <div v-if="view == 'saved_chat'">
        <savedchat @openChatHistory="handleOpenChatHistory"/>
      </div>
      <div v-if="view == 'vectordb'">
        <vectordb v-model:plugin="plugin"/>
      </div>
      <div v-if="view == 'similar_search'">
        <search v-model:plugin="plugin"></search>
      </div>
    </div>
  </div>
</template>


<style scoped>
svg {
  fill: var(--b3-bq-background);
  display: inline-block;
}

h3 {
  display: inline;
  padding: 0.65em;
}

h2 {
  display: inline;
  padding: 0.65em;
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);
}

.page-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: calc(95vh - env(safe-area-inset-bottom));
  /* Adjust for safe area */
}

.chat-wrapper {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow: hidden;
  position: relative;
}

.chat-container {
  flex-grow: 1;
  overflow-y: auto;
  padding: 0.25em 0.5em;
  scroll-behavior: smooth;
}

.control-container {
  display: flex;
  justify-content: center;
  overflow: hidden;
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
  margin-top: auto;
  /* Push the input area to the bottom */
  padding-bottom: env(safe-area-inset-bottom);
  /* Adjust for safe area */
  position: relative;
  z-index: 6;
}

.chat-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chat-overlay {
  background: transparent;
  z-index: 11;
  position: absolute;
  width: 100%;
  height: calc(85vh - env(safe-area-inset-bottom));
  top: 3%;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
}

.get-started {
  cursor: pointer;
  text-decoration: underline;
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
  appearance: none;
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
  background: transparent;
  color: var(--b3-theme-on-surface);
  border: 0px;
  width: 50px;
  z-index: 12;
}


.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25em 0em;
  background: var(--b3-theme-background);
  border-bottom: 1px solid var(--b3-border-color);
  position: relative;
  z-index: 10;
  /* Ensure toolbar is above chat container */
}

.toolbar-right {
  display: flex;
  justify-content: end;
  gap: 10px;
  height: 20px;
}

.toolbar-btn {
  width: 24px;
  height: 24px;
  padding: 4px;
  margin: 0px 5px;
  cursor: pointer;
}

/* Popup Container */
.popup {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 5; /* Ensure it's above other elements */
}

/* Popup Content */
.popup-content {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%); /* Center the popup */
    background: var(--b3-theme-background);
    padding: 1em;
    border-radius: var(--b3-border-radius);
    box-shadow: 0 10px 8px rgba(0, 0, 0, 0.2);
    max-width: 90%;
    width: 90%;
    text-align: center;
    min-height: 50%;
}

/* Close Button */
.close {
    position: absolute;
    top: 10px;
    right: 10px;
    font-size: 24px;
    cursor: pointer;
    color: var(--b3-empty-color);
}

.close:hover {
    color: #000;
}
.block {
  cursor: pointer;
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
    margin-bottom: 150px;
    /* Adjust this value based on your keyboard height */
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
    margin-bottom: 100px;
    /* Adjust this value based on your keyboard height */
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