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
  fullTextSearchBlock,
  getBlocksByIds,
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
  strToFile,
  cosineSimilarity,
  pluginCreateEmbedding
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

const extraContext = ref("");
const rephrasedInput = ref("");
// 0.1.4
const vectorizedDb = ref([]);
const documents = ref([]);
const notebooks = ref([]);
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
// chat control
const showChatAction = ref(false);
const actionCommand = ref("add context");
const chatActions = [
  { label: "Save Chat", cmd: "save chat", action: saveChatToNote, shortcut: "sc" },
  { label: "Summarize Doc", cmd: "summarize doc", action: summarizeOpenDoc, shortcut: "sd" },
  { label: "Auto Tag Doc", cmd: "tag doc", action: autoTagOpenDoc, shortcut: "atd" },
  { label: "Add Context", cmd: "add context", action: addChatContext, shortcut: "ac" }
];
const actionParam = ref({
  blockId: "",
  blockTitle: ""
});
const actionTarget = ref("");
const actionInputRef = ref(null);
const chatInputRef = ref(null);
const isProcessing = ref(false);
const selectedTarget = ref<Set<string>>(new Set());

const openTabs = ref([]);
const selectedSumTab = ref("");
const chatAlias = ref("");
const SUMMARIZE_PROMPT = `
Provide a comprehensive summary of the given text. The summary should cover all the key points and main ideas presented
in the original text, while also condensing the information into a concise and easy-to-understand format.
Please ensure that the summary includes relevant details and examples that support the main ideas,
while avoiding any unnecessary information or repetition. The length of the summary should be appropriate for the
length and complexity of the original text, providing a clear and accurate overview without omitting any important information.

Input: {text}
`

const COMMAND_PARSER_PROMPT = `
You are a command parser. Parse the user input into structured commands.
Only respond with JSON format containing "command" and "target".
Only support these commands: "save chat", "summarize doc", "auto tag doc", "add context"
Output must be in JSON string, {"command": "value", target: ["value"]}

Examples:
Input: "save chat to my textbook\n available notebook target: ['textbook', 'textbook2', 'textbook3']\navailable doc target:[]"
Output: {"command": "save chat", "target": ["textbook"]}

Input: "summarize the document about architecture\n available notebook target: ['textbook', 'textbook2', 'textbook3']\navailable doc target: ['framework', 'arch', 'system']"
Output: {"command": "summarize doc", "target": ["arch", 'framework']}

Input: "add tags to development guide\n available notebook target: ['textbook', 'textbook2', 'textbook3']\navailable doc target: ['how-tos', 'development guide', 'storybook']"
Output: {"command": "auto tag doc", "target": ['how-tos', 'development guide']}

Input: "use project specs as context\n available notebook target: ['textbook', 'textbook2', 'textbook3']\navailable doc target: ['project specs', 'specification', 'document 123']"
Output: {"command": "add context", "target": ['project specs', 'specification']}

Keep the command exactly as listed above. If command is not recognized, return null for both values.
`;


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
        await wrapper.value.streamCompletions(request as CompletionRequest, async (chunk) => {
          if (!chunk.isComplete) {
            // console.log("chunk", chunk);
            fullResponse += chunk.text;
            reply.value = fullResponse;
            emit('streamChunk', fullResponse);
            // Add scroll after each chunk
            nextTick(() => scrollToBottom());
          } else {
            console.log('Streaming complete. Final message:', fullResponse);
            if (question.value !== '') {
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
              await saveChatHistory();
            }
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
    } catch (e) {
      console.error(e);
      isLoading.value = false;
      pushErrMsg(e.stack);
    }
  } else {
    // Check for @ command trigger
    if (chatInput.value?.trim() === "@") {
      setTimeout(async () => {
        if (chatInput.value?.trim() === "@") {
          showChatAction.value = true;          
          chatInput.value = "";
          await handleActionCommand();
          return;
        }
      }, 500)
    } else if (chatInput.value?.trim().endsWith("@")) {
      setTimeout(async () => {
        if (chatInput.value?.trim().endsWith("@")) {
          showChatAction.value = true;
          await handleActionCommand();
          return;
        }
      }, 500)
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


async function summarizeOpenDoc() {
  try {
    // const systemConf = await request("/api/system/getConf", {});
    const blockId = actionParam.value.blockId;
    const blockTitle = actionParam.value.blockTitle;
    const doc = await request("/api/export/exportMdContent", { id: blockId });
    // const pluginSetting = plugin.value.settingUtils.dump()
    chatAlias.value = `Summarize <a href="siyuan://blocks/${blockId}"
            data-type="block-ref"
            data-subtype="d" :data-id="${blockId}">${blockTitle}</a>`
    isLoading.value = true;
    chatInput.value = SUMMARIZE_PROMPT.replace("{text}", doc.content);
    await prompt(true, false);
    isLoading.value = false;
  } catch (err) {
    isLoading.value = false;
    await pushErrMsg(err.stack);
  }
}

async function autoTagOpenDoc() {

}

async function addChatContext() {

}


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

async function checkAllDocuments() {
  documents.value = [];
  notebooks.value = [];
  const nbs = await lsNotebooks();

  for (const nb of nbs.notebooks) {
    if ((nb.name === "SiYuan User Guide" || nb.name === "思源笔记用户指南") || nb.closed) {
      continue;
    }

    notebooks.value.push({
      key: nb.id,
      id: nb.id,
      value: nb.name,
      name: nb.name,
      embedding: []
    });

    const alldocs = await getAllDocsByNotebook(nb.id, "/");
    let flatlist = [];
    transformDocToList(flatlist, alldocs, nb.name, nb.id);
    for (const doc of flatlist) {
      const docName = doc.docName.replace(".sy", "");
      documents.value.push({
        ...doc,
        id: doc.docId,
        key: doc.docId,
        value: docName,
        name: docName,
        embedding: []
      });
    }
  }
  // console.log("all docs", documents.value)
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

async function handleActionCommand() {
  try {
    isProcessing.value = true;

    if (actionCommand.value) {
      if (actionCommand.value === "save chat") {
        if (!notebooks.value.some(nb => nb.embedding.length > 0)) {
          await pushMsg("generating index for search");
          for (let nb of notebooks.value) {
            nb.embedding = await pluginCreateEmbedding(plugin.value, nb.name);
          }
        }
      } else {
        if (!documents.value.some(doc => doc.embedding.length > 0)) {
          await pushMsg("generating index for search");
          for (let doc of documents.value) {
            doc.embedding = await pluginCreateEmbedding(plugin.value, doc.name);
          }
        }
      }
      actionInputRef.value?.focus();
    }
  } catch (error) {
    console.error("Error parsing command:", error);
    await pushErrMsg(error.message);
  } finally {
    isProcessing.value = false;
    actionInputRef.value?.focus();
  }
}

async function handleActionTarget(ev?: KeyboardEvent) {
  try {
    if (ev?.key === 'Backspace' && (actionTarget.value || "").trim() == "") {
      console.log("exit command menu");
      ev.preventDefault();
      setTimeout(() => {
        if (ev?.key === 'Backspace' && (actionTarget.value || "").trim() == "") {
          if (actionCommand.value.includes("save chat") || actionCommand.value.startsWith("sc")) {
            notebooks.value = notebooks.value.map(m => {
              delete m.matchScore;
              return m;
            });
          } else {
            documents.value = documents.value.map(d => {
              delete d.matchScore;
              return d;
            });
          }
          // showChatAction.value = false;
        }
      }, 500);
      return;
    }

    const matchedAction = chatActions.find(a => actionCommand.value.toLowerCase().includes(a.cmd));
    if (ev?.key !== 'Enter') {
      const tempquery = structuredClone(actionTarget.value);
      setTimeout(async () => {
        console.log(tempquery + '===' + actionTarget.value);
        if (actionCommand.value && (tempquery === actionTarget.value)) {
          const items = matchedAction.cmd === "save chat" ? notebooks.value : documents.value;

          const cmdEmbedding = await pluginCreateEmbedding(plugin.value, actionTarget.value);
          const matches = await Promise.all(
            items.map(async item => {
              if (item.name.toLowerCase().includes(actionTarget.value)) {
                return {
                  item,
                  score: 0.99
                };
              } else {
                return {
                  item,
                  score: cosineSimilarity(cmdEmbedding, item.embedding)
                };
              }
            })
          );
          // console.log("item filtered", matches);

          // Update the relevant list with similarity scores
          const filteredMatches = matches
            .filter(m => m.score > 0.5)
            .sort((a, b) => b.score - a.score);

          if (actionCommand.value.includes("save chat") || actionCommand.value.startsWith("sc")) {
            notebooks.value = filteredMatches.map(m => ({
              ...m.item,
              matchScore: m.score
            }));
          } else {
            documents.value = filteredMatches.map(m => ({
              ...m.item,
              matchScore: m.score
            }));
          }
          // Execute the action
          // await matchedAction.action();
          // await pushMsg(`Action completed: ${matchedAction.label}`);
        }
      }, 1500);
    } else {
      const selectedIds = Array.from(selectedTarget.value);
      
      if (selectedIds.length === 0) {
        await pushErrMsg("Please select target(s) first");
        return;
      }
      await matchedAction.action();
      await pushMsg(`Action completed: ${matchedAction.label}`);
      showChatAction.value = false;
    }
    
  } catch (error) {
    console.error("Error parsing command:", error);
    await pushErrMsg(error.message);
  } finally {
    isProcessing.value = false;
    actionInputRef.value.removeAttribute('disabled');
  }
}

function toggleSelection(id: string) {
  if (actionCommand.value === 'add context') {
    // Allow multiple selections for 'add context'
    if (selectedTarget.value.has(id)) {
      selectedTarget.value.delete(id);
    } else {
      selectedTarget.value.add(id);
    }
  } else {
    // Single selection for other commands
    if (selectedTarget.value.has(id)) {
      selectedTarget.value.delete(id);
    } else {
      selectedTarget.value.clear(); // Clear previous selection
      selectedTarget.value.add(id);
    }
  }
}
async function saveChatToNote() {
  const content = messages.value
    .map(m => `Q: ${m.question[0]}\nA: ${m.answer[0]}`)
    .join("\n\n");

  // const blockId = await insertBlock(
  //   "markdown",
  //   content,
  //   "Chat History"
  // );

  // await pushMsg(`Chat saved to note: ${blockId}`);
  console.log("save chat", content);
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

watch(() => showChatAction.value, (newValue) => {
  if (newValue) {
    nextTick(() => {
      console.log("action input focus")
      actionInputRef.value?.focus();
    });
  } else {
    // Only clear selections if not 'add context'
    if (actionCommand.value !== 'add context') {
      selectedTarget.value.clear();
    }
    nextTick(() => {
      console.log("chat input focus")
      chatInputRef.value?.focus();
    })
  }
});

watch(() => isProcessing.value, (newValue) => {
  if (!newValue) {
    nextTick(() => {
      console.log("action input focus")
      actionInputRef.value?.focus();
    });
  }
});

watch(() => actionCommand.value, (newValue, oldValue) => {
  // Only clear selections when changing from 'add context' to another command
  if (oldValue === 'add context' && newValue !== 'add context') {
    selectedTarget.value.clear();
  }
});

onMounted(async () => {
  try {
    chatUUID.value = generateUUID();
    isLoading.value = true;
    await plugin.value.settingUtils.load();
    await loadModels();
    // await checkVectorizedDb();
    await checkAllDocuments();
    enterToSend.value = plugin.value.settingUtils.settings.get("enterToSend") ? plugin.value.settingUtils.settings.get("enterToSend") : true;
    isLoading.value = false;
    messages.value = [];
    if (models.value.length > 0) {
      selectedModel.value = plugin.value.settingUtils.settings.get("selectedModel") ? plugin.value.settingUtils.settings.get("selectedModel") : models.value[0].value;
    } else {
      throw new Error("No available model, please complete the setups in plugin setting.");
    }
    await getChatHistories();
    plugin.value.addCommand({
      langKey: "ExitChatControl",
      hotkey: "⌫",
      dockCallback: (_element: HTMLElement) => {
        showChatAction.value = false;
      }
    });
    setTimeout(() => {
      chatInputRef.value?.focus();
    }, 1000);
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
              <Search :size="20" color="#fafafa" :stroke-width="1" />
            </span>
            <span @click="openVectorDb" class="toolbar-btn">
              <Database :size="20" color="#fafafa" :stroke-width="1" />
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

      <div class="chat-overlay" v-if="view == 'chat' && (messages || []).length === 0">
        <h2>nb</h2>
        <br />
        <p>Hi, I'm your notebook assistant. </p>
        <br />
        <p>How can I help you today?</p>
        <br />
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
          <loading v-model:active="isProcessing" :can-cancel="false" :on-cancel="loadingCancel" loader="bars"
            background-color="#eee" :opacity="0.25" :is-full-page="false" />
          <span id="closePopup" @click="showChatAction = false" class="close">&times;</span>
          <div class="action-input-wrapper">
            <div class="command-hints">
              <span class="hint">Action: </span>
              <span v-for="act of chatActions" :key="act.cmd" class="hint-example"
                @click="actionCommand = act.cmd; handleActionCommand()" :title="'shortcut: ' + act.shortcut"
                :class="{ 'cmd-matches': ((actionCommand || '').trim().toLowerCase().includes(act.cmd.toLowerCase())) || (actionCommand || '').trim().toLowerCase().startsWith(act.shortcut.toLowerCase()) }">
                {{ act.label }}
              </span>
            </div>
            <input ref="actionInputRef" type="text" class="b3-text-field" v-model="actionTarget"
              placeholder="Notebook name / Document name" @keypress="handleActionTarget" @keyup="handleActionTarget"
              :disabled="isProcessing || actionCommand === ''" :class="{ 'processing': isProcessing }" />
            <small>
              Search for notebook or document
            </small>
            <div class="doc-list" 
              v-if="actionCommand.toLowerCase().includes('save chat') || actionCommand.toLowerCase().startsWith('sc')">
              <ul>
                <li v-for="nb in notebooks" 
                    :key="nb.key"
                    :class="{ 
                      'high-match': nb.matchScore > 0.8, 
                      'medium-match': nb.matchScore > 0.6,
                      'selected': selectedTarget.has(nb.id)
                    }"
                    @click="toggleSelection(nb.id)">
                  <div class="list-item-content">
                    <span class="item-name">{{ nb.name }}</span>
                    <div class="item-indicators">
                      <span v-if="selectedTarget.has(nb.id)" class="tick-icon">✓</span>
                      <span class="match-score" v-if="nb.matchScore">
                        {{ Math.round(nb.matchScore * 100) }}% match
                      </span>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
            <div class="doc-list" v-else>
              <ul>
                <li v-for="doc in documents" 
                    :key="doc.key"
                    :class="{ 
                      'high-match': doc.matchScore > 0.8, 
                      'medium-match': doc.matchScore > 0.6,
                      'selected': selectedTarget.has(doc.id)
                    }"
                    @click="toggleSelection(doc.id)">
                  <div class="list-item-content">
                    <span class="item-name">{{ doc.name }}</span>
                    <div class="item-indicators">
                      <span v-if="selectedTarget.has(doc.id)" class="tick-icon">✓</span>
                      <span class="match-score" v-if="doc.matchScore">
                        {{ Math.round(doc.matchScore * 100) }}% match
                      </span>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </div>
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
          <span class="btn-a" @click="showChatAction = !showChatAction; handleActionCommand()">
            @ more action
          </span>
          <button @click="cancelPrompt" class="cancel-prompt" v-if="isLoading">
            <CircleStop :size="20" color="#fafafa" :stroke-width="1" />
          </button>
        </div>
        <div class="input-area">
          <textarea ref="chatInputRef" class="textarea" v-model="chatInput" :placeholder="plugin.i18n.chatPlaceHolder"
            @keypress="typing" @keyup="typing" @focus="handleFocus" @blur="handleBlur"></textarea>
          <div class="enter-indicator">[ Enter ] to Send</div>
        </div>
      </div>
      <div v-if="view == 'saved_chat'">
        <savedchat @openChatHistory="handleOpenChatHistory" />
      </div>
      <div v-if="view == 'vectordb'">
        <vectordb v-model:plugin="plugin" />
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
  z-index: 10000;
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
  z-index: 5;
  /* Ensure it's above other elements */
}

/* Popup Content */
.popup-content {
  position: absolute;
  top: 55%;
  left: 50%;
  transform: translate(-50%, -50%);
  /* Center the popup */
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

.popup-content small {
  color: var(--b3-empty-color);
  text-align: left;
}

/* Button Row */
.popup-action {
  display: flex;
  justify-content: space-evenly;
  /* Space buttons evenly */
  bottom: 0;
  position: absolute;
  width: 89%;
  padding: 1em;
}

/* Popup Buttons */
.popup-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background-color: #007bff;
  color: white;
  cursor: pointer;
  font-size: 14px;
}

.popup-btn:hover {
  background-color: #0056b3;
}

.action-input-wrapper {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-input {
  width: 95%;
  padding: 0.75rem;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  font-size: 14px;
}

.command-hints {
  display: flex;
  gap: 8px;
  align-items: center;
  color: var(--b3-empty-color);
}

.hint-example {
  cursor: pointer;
  padding: 4px 8px;
  background: var(--b3-border-color);
  border-radius: 4px;
  font-size: 12px;
}

.hint-example:hover {
  background: var(--b3-border-hover);
}

.cmd-matches {
  background: #0056b3;
}

.doc-list {
  height: 100%;
  overflow: scroll;
  max-height: 35rem;
  text-align: left;
}

.doc-list ul {
  list-style: none;
}

.doc-list ul li {
  list-style: none;
  padding: 1rem;
  border: 1px solid var(--b3-border-color);
  min-height: 2rem;
  transition: all 0.2s ease;
  cursor: pointer;
}

.doc-list li:hover {
  transform: translateX(2px) translateY(2px);
}

.high-match {
  background: var(--b3-theme-primary-light);
  border-left: 3px solid var(--b3-theme-primary);
}

.medium-match {
  background: var(--b3-theme-background-light);
  border-left: 3px solid var(--b3-theme-secondary);
}

.match-score {
  float: right;
  font-size: 0.8em;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
}

.list-item-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.item-indicators {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tick-icon {
  color: var(--b3-theme-primary);
  font-weight: bold;
}

.doc-list ul li.selected {
  background-color: var(--b3-theme-primary-light);
  border-left: 3px solid var(--b3-theme-primary);
}

.item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
