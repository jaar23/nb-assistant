<script setup lang="ts">
import {
  request,
  pushErrMsg,
  readDir,
  lsNotebooks,
  getAllDocsByNotebook,
  transformDocToList,
  exportMdContent,
  getFile,
  putFile,
  checkBlockExist,
  pushMsg,
  createDocWithMd,
} from "@/api";
import { ref, onMounted, watch, nextTick } from "vue";
import Loading from "vue-loading-overlay";
import "vue-loading-overlay/dist/css/index.css";
import {
  countWords,
  generateUUID,
  getCurrentTabs,
  strToFile,
  cosineSimilarity,
  pluginCreateEmbedding
} from "@/utils";
import history from "./history.vue";
import { CircleStop, Settings2, History, Plus, MessageCircle, Database, Search, SquareArrowUp } from 'lucide-vue-next';
import { AIWrapper } from "@/orchestrator/ai-wrapper";
import { CompletionRequest } from "@/orchestrator/types";
import { Message } from "../history.vue";
import savedchat from "./savedchat.vue";
import vectordb from "./vectordb.vue";
import search from "./search.vue";
import { transformModelNamePathSafeStr } from "@/embedding";
import { createModel } from "@/model";
import { getFrontend } from "siyuan";

const chatInput = defineModel<string>("chatInput");
const plugin: any = defineModel<any>("plugin");

const emit = defineEmits(["response", "streamChunk"]);
const isLoading = ref(false);
const enterToSend = defineModel("enterToSend");

// 0.1.4
const isMobile = ref(false);
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
const userScrolling = ref(false);
const lastScrollTop = ref(0);

const dataPath = "temp/nb-assistant";
const chatUUID = ref("");
const chatHistories = ref([]);
const view = ref("chat");
const chatControl = ref("");
// chat control
const showChatAction = ref(false);
const actionCommand = ref("add context");
const chatActions = [
  { label: plugin.value.i18n.saveChat, cmd: "save chat", action: saveChatToNote, shortcut: "sc" },
  { label: plugin.value.i18n.summarizeDoc, cmd: "summarize doc", action: summarizeOpenDoc, shortcut: "sd" },
  { label: plugin.value.i18n.autoTag, cmd: "tag doc", action: autoTagDoc, shortcut: "atd" },
  { label: plugin.value.i18n.addContext, cmd: "add context", action: getChatContext, shortcut: "ac" },
  { label: plugin.value.i18n.imageGeneration, cmd: "image generation", action: generateImage, shortcut: "ig" }
];
const actionTarget = ref("");
const actionInputRef = ref(null);
const chatInputRef = ref(null);
const isProcessing = ref(false);
const selectedTarget = ref<Set<string>>(new Set());
const docListIndex = ref(-1);
const extraContext = ref("");
const newDocName = ref("");
const imagePrompt = ref("");
const imageStyle = ref("vivid");
const imageSize = ref("1024x1024");
const showImageOptions = ref(false);
let passingScore = 0.5;
const imageStyles = [
  { label: plugin.value.i18n.vivid, value: "vivid" },
  { label: plugin.value.i18n.natural, value: "natural" }
];

const imageSizes = [
  { label: "1024x1024", value: "1024x1024" },
  { label: "1792x1024", value: "1792x1024" },
  { label: "1024x1792", value: "1024x1792" }
];

const openTabs = ref([]);
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

const AUTO_TAG_PROMPT = `
Generate 3 to 5 tags from the provided text below. 
Example: A computer is a machine that can be programmed to automatically carry out sequences of arithmetic or logical operations (computation). Modern digital electronic computers can perform generic sets of operations known as programs. These programs enable computers to perform a wide range of tasks. 
Response: computer, computer system, technology
Example: Physics is the natural science of matter, involving the study of matter, its fundamental constituents, its motion and behavior through space and time, and the related entities of energy and force.[1] Physics is one of the most fundamental scientific disciplines.[2][3][4] A scientist who specializes in the field of physics is called a physicist. 
Response: Physics, Natural Science, Science
ALWAYS RESPONSE ONLY IN JSON FORMAT

Input: {text}
`;

// getting started
const isTutorialActive = ref(false);
const currentTutorialStep = ref(0);
const highlightStyle = ref({});
const currentStep = ref(null);
const tutorialSteps = [
  {
    target: '.toolbar-right',
    title: plugin.value.i18n.gettingStartedTitle1,
    content: plugin.value.i18n.gettingStarted1,
    position: 'bottom'
  },
  {
    target: '.model-select',
    title: plugin.value.i18n.gettingStartedTitle2,
    content: plugin.value.i18n.gettingStarted2,
    position: 'top'
  },
  {
    target: '.quick-action',
    title: plugin.value.i18n.gettingStartedTitle3,
    content: plugin.value.i18n.gettingStarted3,
    position: 'left'
  },
  {
    target: '.input-area',
    title: plugin.value.i18n.gettingStartedTitle4,
    content: plugin.value.i18n.gettingStarted4,
    position: 'top'
  },
  {
    target: '.settings',
    title: plugin.value.i18n.gettingStartedTitle5,
    content: plugin.value.i18n.gettingStarted5,
    position: 'right'
  }
];


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
            const key2 = key.replace(keyPrefix, "");
            console.log(key2);
            result.set(key2, value);
          }
        }
        return result;
      };
      const modelConfig = extractByKey(settings, `${model.provider}.`);
      // console.log("model config", modelConfig);
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
      // Handle chat history with truncation
      if (messages.value?.length > 0 && withHistory) {
        const historyLimit = settings.get("chatHistoryTruncate") || 7; // Default to 7 if not set
        const recentMessages = messages.value.slice(-historyLimit); // Take only the most recent messages
        
        const chatHistory = recentMessages.reduce((box, m) => {
          if (m.actionType !== "generate_image" && m.question[m.questionIndex] && m.answer[m.answerIndex]) {
            box.push({ role: "user", content: m.question[m.questionIndex] });
            box.push({ role: "assistant", content: m.answer[m.answerIndex] });
          }
          return box;
        }, [] as Array<{ role: string, content: string }>);
        
        request["history"] = chatHistory;
        
        // Log truncation info for debugging
        if (messages.value.length > historyLimit) {
          console.log(`Chat history truncated from ${messages.value.length} to ${historyLimit} messages`);
        }
      }

      request["prompt"] = `${extraContext.value !== '' ? extraContext.value + '\n' : ''}${prompt}`;
      request["model"] = selectedModel.value;

      let fullResponse = "";
      reply.value = "";
      if (stream) {
        if (chatAlias.value !== "") {
          question.value = `${chatAlias.value}\n${chatInput.value}`;
        } else {
          question.value = chatInput.value;
        }
        await wrapper.value.streamCompletions(request as CompletionRequest, async (chunk) => {
          if (!chunk.isComplete) {
            // console.log("chunk", chunk);
            fullResponse += chunk.text;
            if ((countWords(reply.value) % 20) === 0) {
              reply.value = fullResponse;
            } else {
              reply.value += chunk.text;
            }
            // reply.value += chunk.text;
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
                context: extraContext.value
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

async function handleUpdateMessage(id: string, updatedMessage: string, context?: string) {
  chatInput.value = updatedMessage;
  if (context) {
    extraContext.value = context;
  }
  const message = await prompt(false);
  historyRef.value.resetMessage(id, message);
  await saveChatHistory();
}

async function handleRegenMessage(id: string, question: string, blockId?: string, actionType?: string) {
  if (!blockId && !actionType) {
    chatInput.value = question;
    const message = await prompt(false);
    historyRef.value.resetMessage(id, message);
    await saveChatHistory();
  } else {
    if (actionType === "save_tags") {
      await autoTagDoc(id, blockId);
    } else if (actionType === "save_summary") {
      await summarizeOpenDoc(id, blockId);
    } else if (actionType === "generate_image") {
      imagePrompt.value = question;
      await generateImage(id);
    }
  }
}

async function handleRemoveMessage() {
  await saveChatHistory();
}

async function typing(ev) {
  if (ev.key === "Enter" && !ev.shiftKey && enterToSend.value) {
    ev.preventDefault();

    try {
      if ((chatInput.value || "").trim() === '') return;
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

async function send() {
  try {
    if ((chatInput.value || "").trim() === '') return;
    await prompt();
  } catch (e) {
    console.error(e);
    isLoading.value = false;
    pushErrMsg(e.stack);
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
      await pushMsg(plugin.value.i18n.newHistoryCreate);
      const jsonStr2 = JSON.stringify([]);
      const file2 = strToFile(jsonStr2, `${chatUUID.value}-history`, "application/json");
      const historyIndexResp = await putFile(`${dataPath}/history-index.json`, false, file2);
      console.log("history index", historyIndexResp);
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


async function summarizeOpenDoc(msgId?: string, id?: string) {
  try {
    isLoading.value = true;
    isProcessing.value = true;
    isStreaming.value = true;
    const selectedIds = id ? [id] : Array.from(selectedTarget.value);
    if (selectedIds.length === 0) throw new Error("Please select document before summarize");
    const blockId = selectedIds[0];
    const blockTitle = documents.value.find(d => d.id === selectedIds[0])?.name || "";
    await openBlock(blockId);
    const doc = await request("/api/export/exportMdContent", { id: blockId });
    const aiEmoji = plugin.value.settingUtils.settings.get("aiEmoji");
    const model = models.value.find(m => m.value === selectedModel.value);
    wrapper.value = new AIWrapper(model.provider, { apiKey: model.apiKey, baseUrl: model.apiURL });

    // const pluginSetting = plugin.value.settingUtils.dump()
    chatAlias.value = `Summarize <a href="siyuan://blocks/${blockId}"
            data-type="block-ref"
            data-subtype="d" :data-id="${blockId}">${blockTitle}</a>`
    let fullResponse = "";
    reply.value = "";
    question.value = SUMMARIZE_PROMPT.replace("{text}", doc.content);
    await wrapper.value.streamCompletions({
      prompt: question.value,
      model: model.value,
      temperature: 0,
      systemPrompt: { role: "system", content: "You are a content summarizer." }
    }, async (chunk) => {
      showChatAction.value = false;
      question.value = `Summarize document: ${chatAlias.value}`;
      if (!chunk.isComplete) {
        fullResponse += chunk.text;
        reply.value = fullResponse;
        emit('streamChunk', fullResponse);
        nextTick(() => scrollToBottom());
      } else {
        console.log('done action msgId', msgId);
        console.log('done action question', question.value)
        console.log('done action question', fullResponse)
        if (!msgId) {
          messages.value.push({
            id: generateUUID(),
            question: [`Summarize document: ${chatAlias.value}`],
            questionIndex: 0,
            answer: [fullResponse],
            answerIndex: 0,
            aiEmoji: aiEmoji,
            actionable: true,
            actionType: "save_summary",
            blockId: blockId,
            context: extraContext.value || ""
          });
          await saveChatHistory();
        } else {
          historyRef.value.resetMessage(msgId, fullResponse);
          await saveChatHistory();
        }
        // Add scroll after each chunk
        nextTick(() => scrollToBottom());
      }
    });
  } catch (err) {
    await pushErrMsg(err.stack);
  } finally {
    isLoading.value = false;
    isProcessing.value = false;
    isStreaming.value = false;
    question.value = "";
    chatInput.value = "";
    chatAlias.value = "";
    selectedTarget.value.clear();
  }
}

async function autoTagDoc(msgId?: string, id?: string) {
  try {
    isLoading.value = true;
    isProcessing.value = true;
    const selectedIds = id ? [id] : Array.from(selectedTarget.value);
    if (selectedIds.length === 0) throw new Error("Please select document before summarize");
    const blockId = selectedIds[0];
    const blockTitle = documents.value.find(d => d.id === selectedIds[0])?.name || "";
    await openBlock(blockId);

    const doc = await request("/api/export/exportMdContent", { id: blockId });
    const aiEmoji = plugin.value.settingUtils.settings.get("aiEmoji");

    const model = models.value.find(m => m.value === selectedModel.value);
    wrapper.value = new AIWrapper(model.provider, { apiKey: model.apiKey, baseUrl: model.apiURL });

    const response = await wrapper.value.jsonCompletions({
      prompt: AUTO_TAG_PROMPT.replace("{text}", doc.content),
      model: model.value,
      temperature: 0,
      stream: false,
      systemPrompt: { role: "system", content: "You are responsible extract entity and generate classification from the text user provided." }
    }, {
      "type": "object",
      "properties": {
        "tags": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "required": ["tags"]
    });
    console.log("json response", response);
    if (!id && !msgId) {
      messages.value.push({
        id: generateUUID(),
        question: [`Auto tags document: ${blockTitle}`],
        questionIndex: 0,
        answer: [JSON.stringify(response.json)],
        answerIndex: 0,
        aiEmoji: aiEmoji,
        actionable: true,
        actionType: "save_tags",
        blockId: blockId,
        context: extraContext.value || ""
      });
      nextTick(() => scrollToBottom());
      await saveChatHistory();
    } else {
      historyRef.value.resetMessage(msgId, JSON.stringify(response.json));
      await saveChatHistory();
    }
  } catch (err) {
    isLoading.value = false;
    await pushErrMsg(err.stack);
  } finally {
    isLoading.value = false;
    isProcessing.value = false;
    showChatAction.value = false;
    selectedTarget.value.clear();
  }
}

async function getChatContext() {
  let context = "";
  let title = "";
  const selectedIds = Array.from(selectedTarget.value);
  for (const doc of selectedIds) {
    const markdown = await exportMdContent(doc);
    context = `${context}\n---\n${markdown.content}`;
    title = `${title}\n - ${markdown.hPath.replace("/", "")}\n\n`
  }
  chatAlias.value = title;
  extraContext.value = context;
  console.log("extra context", extraContext.value);
  showChatAction.value = false;
}

async function saveChatToNote() {
  try {
    const selectedIds = Array.from(selectedTarget.value);
    if (selectedIds.length === 0) throw new Error("Please select document before summarize");
    if (newDocName.value === "") throw new Error("Please enter a document name");
    const content = messages.value
      .map(m => {
        if (m.question[m.questionIndex] && m.answer[m.answerIndex]) {
          return `Question: ${m.question[m.questionIndex]}\nAnswer: ${m.answer[m.answerIndex]}\n\n`;
        }
      })
      .join("\n\n");

    const response = await createDocWithMd(selectedIds[0], `/${newDocName.value}`, content);
    console.log("save chat", content);
    showChatAction.value = false;
    if (response) {
      await pushMsg(plugin.value.i18n.noteSaved);
      await openBlock(response);
    }
  } catch (error) {
    console.error(error)
    await pushErrMsg(error.message);
  } finally {
    selectedTarget.value.clear();
    newDocName.value = "";
  }
}

async function generateImage(msgId?: string) {
  try {
    isLoading.value = true;
    isProcessing.value = true;
    const model = models.value.find(m => m.provider === "openai");
    wrapper.value = new AIWrapper("openai", { apiKey: model.apiKey, baseUrl: model.apiURL });
    
    const response = await wrapper.value.imageGeneration({
      model: "dall-e-3",
      prompt: imagePrompt.value,
      //@ts-ignore
      style: imageStyle.value || "vivid",
      //@ts-ignore
      size: imageSize.value || "1024x1024"
    });

    if (response.data) {
      if (!msgId) {
        // Add to chat history
        messages.value.push({
          id: generateUUID(),
          question: [imagePrompt.value],
          questionIndex: 0,
          answer: [`![Generated image](data:image/png;base64,${response.data})`],
          answerIndex: 0,
          aiEmoji: "",
          actionable: true,
          actionType: "generate_image",
          blockId: "",
          context: extraContext.value || ""
        });
        nextTick(() => scrollToBottom());
      } else {
        historyRef.value.resetMessage(msgId, `![Generated image](data:image/png;base64,${response.data})`);
      }
      await saveChatHistory();
    }
    
    showChatAction.value = false;
  } catch (error) {
    console.error("Image generation error:", error);
    await pushErrMsg(error.message);
  } finally {
    isLoading.value = false;
    isProcessing.value = false;
    imagePrompt.value = "";
  }
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
      await pushMsg(plugin.value.i18n.newHistoryCreate);
      const jsonStr2 = JSON.stringify(historyIndex ?? []);
      const file2 = strToFile(jsonStr2, `${chatUUID.value}-history`, "application/json");
      const historyIndexResp = await putFile(`${dataPath}/history-index.json`, false, file2);
      console.log("history index", historyIndexResp);
    } else {
      historyIndex = indexResp;
    }
  }
  console.log(historyIndex);
}

async function openChat() {
  view.value = "chat";
  await getChatHistories();

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
  isTutorialActive.value = true;
  currentTutorialStep.value = 0;
  await nextTick();
  updateTutorialHighlight();
}

function updateTutorialHighlight() {
  const step = tutorialSteps[currentTutorialStep.value];
  currentStep.value = step;
  
  const element = document.querySelector(step.target);
  if (element) {
    const rect = element.getBoundingClientRect();
    highlightStyle.value = {
      top: `${rect.top - 4}px`,
      left: `${rect.left - 4}px`,
      width: `${rect.width + 8}px`,
      height: `${rect.height + 8}px`
    };
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function nextTutorialStep() {
  if (currentTutorialStep.value >= tutorialSteps.length - 1) {
    isTutorialActive.value = false;
    currentStep.value = null;
    return;
  }
  currentTutorialStep.value++;
  updateTutorialHighlight();
}

// Add a watch for window resize to update highlight position
window.addEventListener('resize', () => {
  if (isTutorialActive.value) {
    updateTutorialHighlight();
  }
});

async function handleModelChange() {
  plugin.value.settingUtils.settings.set("selectedModel", selectedModel.value);
  await plugin.value.settingUtils.save();
}

async function loadModels() {
  const settings = plugin.value.settingUtils.settings;
  const ollamaApiURL = settings.get("ollama.url")?.trim();
  const ollamaModel = settings.get("ollama.model")?.trim();
  const customApiURL = settings.get("customai.url")?.trim();
  const customModel = settings.get("customai.model")?.trim();
  const customApiKey = settings.get("customai.apiKey")?.trim();
  const frontEnd = getFrontend();
  isMobile.value = frontEnd === "mobile" || frontEnd === "browser-mobile";
  if (ollamaApiURL && ollamaModel && !isMobile.value) {
    models.value.push({ label: ollamaModel, value: ollamaModel, apiKey: "", apiURL: ollamaApiURL, provider: "ollama" });
  }
  if (customApiURL && customModel && customApiKey) {
    models.value.push({ label: customModel, value: customModel, apiKey: customApiKey, apiURL: customApiURL, provider: "customai" });
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
  // window.scrollTo(0, document.body.scrollHeight);
  setTimeout(() => {
    window.scrollTo(0, document.body.scrollHeight);
  }, 250);
}

function handleBlur() {
  isFocused.value = false;
}

async function handleActionCommand() {
  try {
    isProcessing.value = true;

    if (actionCommand.value) {
      let embeddingModel = null;
      const used_in = plugin.value.settingUtils.settings.get("embedding.used_in");
      if (used_in === "local") {
        const embeddingModelName = plugin.value.settingUtils.settings.get("embedding.model");
        embeddingModel = await createModel(embeddingModelName);
      }
      if (actionCommand.value === "save chat") {
        if (!notebooks.value.some(nb => nb.embedding.length > 0)) {
          await pushMsg(plugin.value.i18n.quckAct1);
          for (let nb of notebooks.value) {
            nb.embedding = await pluginCreateEmbedding(plugin.value, nb.name, embeddingModel);
          }
        }
      } else {
        if (!documents.value.some(doc => doc.embedding.length > 0)) {
          await pushMsg(plugin.value.i18n.quckAct1);
          for (let doc of documents.value) {
            doc.embedding = await pluginCreateEmbedding(plugin.value, doc.name, embeddingModel);
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
          // console.log("documents", documents.value)
        }
      }, 500);
      return;
    }

    if (ev?.key === 'ArrowDown') {
      ev.preventDefault();
      docListIndex.value = 0;
      const listElement = document.querySelector('.doc-list');
      // @ts-ignore
      listElement?.focus();
      return;
    }

    const matchedAction = chatActions.find(a => actionCommand.value.toLowerCase().includes(a.cmd));
    if (ev?.key !== 'Enter') {
      const tempquery = structuredClone(actionTarget.value);
      setTimeout(async () => {
        // console.log(tempquery + '===' + actionTarget.value);
        if (actionCommand.value && (tempquery === actionTarget.value)) {
          const items = matchedAction.cmd === "save chat" ? notebooks.value : documents.value;
          let embeddingModel = null;
          const used_in = plugin.value.settingUtils.settings.get("embedding.used_in");
          if (used_in === "local") {
            const embeddingModelName = plugin.value.settingUtils.settings.get("embedding.model");
            embeddingModel = await createModel(embeddingModelName);
          }
          const cmdEmbedding = await pluginCreateEmbedding(plugin.value, actionTarget.value, embeddingModel);
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
          if (used_in === "local") passingScore = 0.25
          const filteredMatches = matches
            .filter(m => m.score > passingScore)
            .sort((a, b) => b.score - a.score);

          if (actionCommand.value.includes("save chat") || actionCommand.value.startsWith("sc")) {
            // Create a map of matched items with their scores
            const matchScores = new Map(filteredMatches.map(m => [m.item.id, m.score]));

            // Update all notebooks, using matched scores where available, defaulting to 0
            notebooks.value = notebooks.value.map(notebook => ({
              ...notebook,
              matchScore: matchScores.get(notebook.id) || 0
            })).sort((a, b) => a.matchScore > b.matchScore ? -1 : 1);
          } else {
            // Create a map of matched items with their scores
            const matchScores = new Map(filteredMatches.map(m => [m.item.id, m.score]));

            // Update all documents, using matched scores where available, defaulting to 0
            documents.value = documents.value.map(document => ({
              ...document,
              matchScore: matchScores.get(document.id) || 0
            })).sort((a, b) => a.matchScore > b.matchScore ? -1 : 1);
          }
        }
      }, 1500);
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

function handleListKeydown(ev: KeyboardEvent, items: any[]) {
  if (ev.key === 'ArrowDown') {
    ev.preventDefault();
    docListIndex.value = Math.min(docListIndex.value + 1, items.length - 1);
    scrollIntoViewIfNeeded(docListIndex.value);
  } else if (ev.key === 'ArrowUp') {
    ev.preventDefault();
    docListIndex.value = Math.max(docListIndex.value - 1, 0);
    scrollIntoViewIfNeeded(docListIndex.value);
  } else if (ev.key === 'Enter' || ev.key === ' ') {
    ev.preventDefault();
    if (docListIndex.value >= 0) {
      const item = items[docListIndex.value];
      toggleSelection(item.id);
    }
  }
}

function scrollIntoViewIfNeeded(index: number) {
  const element = document.querySelector(`[data-index="${index}"]`);
  if (element) {
    element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

async function confirmQuickAction() {
  const matchedAction = chatActions.find(a => actionCommand.value.toLowerCase().includes(a.cmd));
  const selectedIds = Array.from(selectedTarget.value);

  if (selectedIds.length === 0 && actionCommand.value !== "image generation") {
    await pushErrMsg("Please select target(s) first");
    return;
  }
  await matchedAction.action();
  // await pushMsg(`Action completed: ${matchedAction.label}`);
  // showChatAction.value = false;
  // actionCommand.value = "add context";
}

function scrollToBottom() {
  if (messageWindowRef.value && !userScrolling.value) {
    const container = messageWindowRef.value;
    container.scrollTop = container.scrollHeight;
  }
}

function handleScroll(event: Event) {
  const container = event.target as HTMLElement;
  const isScrollingUp = container.scrollTop < lastScrollTop.value;
  const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;

  if (isScrollingUp) {
    userScrolling.value = true;
  }

  if (isNearBottom) {
    userScrolling.value = false;
  }

  lastScrollTop.value = container.scrollTop;
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
    docListIndex.value = -1;
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
  docListIndex.value = -1;
  if (actionCommand.value !== 'add context') {
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
    enterToSend.value = plugin.value.settingUtils.settings.get("enterToSend") ?? true;
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
    <!-- Add this new component to the template, just after the chat-wrapper div -->
    <div class="tutorial-overlay" v-if="isTutorialActive">
      <div class="tutorial-backdrop"></div>
      <div class="tutorial-highlight-container" v-if="currentStep">
        <div class="tutorial-highlight" :style="highlightStyle">
          <div class="tutorial-tooltip" :class="currentStep.position">
            <h4>{{ currentStep.title }}</h4>
            <p>{{ currentStep.content }}</p>
            <div class="tutorial-controls">
              <span class="tutorial-progress">{{ currentTutorialStep + 1 }} / {{ tutorialSteps.length }}</span>
              <button class="tutorial-next" @click="nextTutorialStep">
                {{ currentTutorialStep === tutorialSteps.length - 1 ? 'Finish' : 'Next' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
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

      <div class="chat-overlay" v-if="(view == 'chat' && (messages || []).length === 0) && !isStreaming">
        <h2>nb</h2>
        <br />
        <p>{{ plugin.i18n.intro1 }}</p>
        <br />
        <p>{{ plugin.i18n.intro2 }}</p>
        <br />
        <span class="get-started" @click="handleGetStarted">{{ plugin.i18n.gettingStarted }}</span>
      </div>
      <div v-if="view == 'chat'" class="chat-container" ref="messageWindowRef" @scroll="handleScroll">
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
              <!-- <span class="hint">Action: </span> -->
              <span v-for="act of chatActions" :key="act.cmd" class="hint-example"
                v-show="act.cmd !== 'image generation' || models.find(m => m.provider === 'openai' && m.apiKey)"
                @click="actionCommand = act.cmd; handleActionCommand()" :title="'shortcut: ' + act.shortcut"
                :class="{ 'cmd-matches': ((actionCommand || '').trim().toLowerCase().includes(act.cmd.toLowerCase())) || (actionCommand || '').trim().toLowerCase().startsWith(act.shortcut.toLowerCase()) }">
                {{ act.label }}
              </span>
            </div>
            <input ref="actionInputRef" type="text" class="b3-text-field" v-model="actionTarget" 
              v-show="actionCommand !== 'image generation'"
              :placeholder="plugin.i18n.nbNameOrDocName" @keypress="handleActionTarget" @keyup="handleActionTarget"
              :disabled="isProcessing || actionCommand === ''" :class="{ 'processing': isProcessing }" />
            <small v-show="actionCommand !== 'image generation'">
              {{ plugin.i18n.searchForNbOrDoc }}
            </small>
            <div class="doc-list"
              v-if="actionCommand.toLowerCase().includes('save chat') || actionCommand.toLowerCase().startsWith('sc')"
              @keydown="(e) => handleListKeydown(e, notebooks)" tabindex="0">
              <ul>
                <li v-for="(nb, index) in notebooks" :key="nb.key" :data-index="index"
                  :tabindex="docListIndex === index ? 0 : -1" :class="{
                    'high-match': nb.matchScore > 0.8,
                    'medium-match': nb.matchScore > passingScore,
                    'selected': selectedTarget.has(nb.id),
                    'cursor': docListIndex === index
                  }" @click="toggleSelection(nb.id)" @focus="docListIndex = index">
                  <div class="list-item-content">
                    <span class="item-name">{{ nb.name }}</span>
                    <div class="item-indicators">
                      <span v-if="selectedTarget.has(nb.id)" class="tick-icon">✓</span>
                      <span class="match-score" v-if="nb.matchScore">
                        {{ Math.round(nb.matchScore * 100) }}% {{ plugin.i18n.matching }}
                      </span>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
            <!-- Image Generation Options -->
            <div v-if="actionCommand === 'image generation'" class="image-generation-options">
              <small>{{ plugin.i18n.imageFnSupport1 }}</small>
              <textarea
                v-model="imagePrompt"
                class="image-prompt textarea"
                :placeholder="plugin.i18n.imageGenDesc"
                rows="3"
              ></textarea>
              
              <div class="image-settings">
                <div class="setting-group">
                  <label>{{ plugin.i18n.style }}</label>
                  <select v-model="imageStyle">
                    <option v-for="style in imageStyles" 
                            :key="style.value" 
                            :value="style.value">
                      {{ style.label }}
                    </option>
                  </select>
                </div>
                
                <div class="setting-group">
                  <label>{{ plugin.i18n.size }}</label>
                  <select v-model="imageSize">
                    <option v-for="size in imageSizes" 
                            :key="size.value" 
                            :value="size.value">
                      {{ size.label }}
                    </option>
                  </select>
                </div>
              </div>
            </div>
            <div class="doc-list" v-if="actionCommand !== 'save chat' && actionCommand !=='image generation'" @keydown="(e) => handleListKeydown(e, documents)" tabindex="0">
              <ul>
                <li v-for="(doc, index) in documents" :key="doc.key" :data-index="index"
                  :tabindex="docListIndex === index ? 0 : -1" :class="{
                    'high-match': doc.matchScore > 0.8,
                    'medium-match': doc.matchScore > passingScore,
                    'selected': selectedTarget.has(doc.id),
                    'cursor': docListIndex === index
                  }" @click="toggleSelection(doc.id)" @focus="docListIndex = index">
                  <div class="list-item-content">
                    <span class="item-name">{{ doc.name }}</span>
                    <div class="item-indicators">
                      <span v-if="selectedTarget.has(doc.id)" class="tick-icon">✓</span>
                      <span class="match-score" v-if="doc.matchScore">
                        {{ Math.round(doc.matchScore * 100) }}% {{ plugin.i18n.matching }}
                      </span>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </div>
          <div>
            <input class="b3-text-field doc-name-input" type="text" v-model="newDocName" :placeholder="plugin.i18n.documentName"
              v-if="actionCommand.toLowerCase().includes('save chat') || actionCommand.toLowerCase().startsWith('sc')" />
            <button class="b3-button action-confirm" @click="confirmQuickAction">{{ plugin.i18n.confirm }}</button>
          </div>
        </div>
      </div>

      <!-- Selected Context Items -->
      <div v-if="actionCommand === 'add context' && selectedTarget.size > 0" class="selected-contexts">
        <div class="context-scroll">
          <div v-for="id in selectedTarget" :key="id" class="context-item">
            <span class="context-name">
              {{documents.find(d => d.id === id)?.name}}
            </span>
            <span class="remove-context" @click="toggleSelection(id)">×</span>
          </div>
        </div>
      </div>
      <div v-if="view == 'chat'" class="input-wrapper">
        <loading v-model:active="isLoading" :can-cancel="false" :on-cancel="loadingCancel" loader="bars"
          background-color="#eee" :opacity="0.25" :is-full-page="false" />
        <div class="chat-control">
          <span @click="openSetting" class="btn-a">
            <Settings2 class="settings" :size="20" color="#fafafa" :stroke-width="1" />
          </span>
          <span class="model-label">{{ plugin.i18n.model }}</span>
          <div class="model-dropdown">
            <select class="model-select" v-model="selectedModel" @change="handleModelChange">
              <option v-for="model in models" :key="model.value" :value="model.value">
                {{ model.label }}
              </option>
            </select>
          </div>
          <span class="btn-a quick-action" @click="showChatAction = !showChatAction; handleActionCommand()">
            {{ plugin.i18n.aliasForMore }}
          </span>
          <button @click="cancelPrompt" class="cancel-prompt" v-if="isLoading">
            <CircleStop :size="24" color="#fafafa" :stroke-width="1" />
          </button>
        </div>
        <div class="input-area">
          <textarea ref="chatInputRef" class="textarea" v-model="chatInput" :placeholder="plugin.i18n.chatPlaceHolder"
            @keypress="typing" @keyup="typing" @focus="handleFocus" @blur="handleBlur"></textarea>
          <div class="enter-indicator" v-if="enterToSend">
            [ Enter ] {{ plugin.i18n.send }}
          </div>
          <span class="toolbar-btn send-btn" @click="send" v-if="!isLoading">
            <SquareArrowUp :size="24" :stroke-width="1" />
          </span>
        </div>
      </div>
      <div v-if="view == 'saved_chat'">
        <savedchat @openChatHistory="handleOpenChatHistory" :plugin="plugin" />
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
  fill: transparent;
  display: inline-block;
  background: transparent;
  color: currentColor;
  stroke: var(--b3-theme-on-background);
  padding: 2px;
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);
}

svg:hover {
  stroke: var(--b3-theme-primary);
}

.toolbar-btn:hover {
  color: var(--b3-theme-primary);
}

.btn-a:hover {
  color: var(--b3-theme-primary);
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
  height: calc(96.5vh - env(safe-area-inset-bottom));
  /* Adjust for safe area */
}

.chat-wrapper {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow: hidden;
  position: relative;
  background: var(--b3-theme-background);
}

.chat-container {
  flex-grow: 1;
  overflow-y: auto;
  padding: 0.25em 0.5em;
  scroll-behavior: smooth;
  background: var(--b3-menu-background);
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
  border-radius: var(--b3-border-radius);
  margin-top: auto;
  /* Push the input area to the bottom */
  padding-bottom: 1rem;
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
  height: calc(15vh - env(safe-area-inset-bottom));
  top: 20%;
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
  width: 89%;
  min-height: 40px;
  padding:1rem 0.5rem;
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
  margin-right: 10px;
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
  min-height: 2.7rem;
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
  z-index: 12;
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
  max-height: 600px;
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
  max-height: 525px;
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
  color: var(--b3-theme-on-primary);
  flex-wrap: wrap;
}

.hint {
  color: var(--b3-theme-on-background);
}

.hint-example {
  cursor: pointer;
  padding: 4px 8px;
  background: var(--b3-theme-on-surface);
  border-radius: 4px;
  font-size: 12px;
  min-width: 6.5rem;
}

.hint-example:hover {
  color: #000;
}

.cmd-matches {
  background: #0056b3;
}

.doc-list {
  height: 100%;
  overflow: scroll;
  max-height: 35rem;
  text-align: left;
  outline: none;
}

.doc-list ul {
  list-style: none;
}

.doc-list ul li:focus {
  outline: none;
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

.doc-list ul li.cursor {
  background-color: var(--b3-theme-surface);
  border-left: 3px solid var(--b3-theme-primary);
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

.doc-name-input {
  width: 90%;
  margin: 1rem 0rem;
}

.action-confirm {
  width: 90%;
}

/** selection context */
.selected-contexts {
  background: var(--b3-theme-background);
  border-bottom: 1px solid var(--b3-border-color);
  padding: 8px;
  position: relative;
  z-index: 5;
}

.context-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  scroll-behavior: smooth;
}

.context-scroll::-webkit-scrollbar {
  height: 4px;
}

.context-scroll::-webkit-scrollbar-track {
  background: var(--b3-theme-background);
}

.context-scroll::-webkit-scrollbar-thumb {
  background: var(--b3-theme-primary);
  border-radius: 4px;
}

.context-item {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  padding: 4px 8px;
  white-space: nowrap;
  user-select: none;
}

.context-name {
  color: var(--b3-theme-on-primary);
  font-size: 12px;
}

.remove-context {
  color: var(--b3-theme-on-primary);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0 2px;
  border-radius: 2px;
}

.remove-context:hover {
  background: var(--b3-theme-primary-light);
  color: var(--b3-theme-primary);
}

/** selection context */

/** getting started */
.tutorial-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 10000;
  pointer-events: none;
}

.tutorial-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  pointer-events: none;
}

.tutorial-highlight-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.tutorial-highlight {
  position: absolute;
  border: 2px solid var(--b3-theme-primary);
  border-radius: 4px;
  transition: all 0.3s ease;
  pointer-events: none;
}

.tutorial-tooltip {
  position: absolute;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  padding: 16px;
  width: 280px;
  pointer-events: all;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.tutorial-tooltip.top {
  bottom: calc(100% + 12px);
  left: 50%;
  transform: translateX(-50%);
}

.tutorial-tooltip.bottom {
  top: calc(100% + 12px);
  left: 30%;
  transform: translateX(-50%);
}

.tutorial-tooltip.left {
  right: calc(100% + 12px);
  top: 50%;
  transform: translateY(-50%);
}

.tutorial-tooltip.right {
  left: calc(100% + 12px);
  top: 50%;
  transform: translateY(-50%);
}

.tutorial-tooltip h4 {
  margin: 0 0 8px 0;
  color: var(--b3-theme-primary);
  font-size: 16px;
}

.tutorial-tooltip p {
  margin: 0 0 16px 0;
  color: var(--b3-theme-on-background);
  font-size: 14px;
  line-height: 1.5;
}

.tutorial-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tutorial-progress {
  color: var(--b3-theme-on-surface);
  font-size: 12px;
}

.tutorial-next {
  background: var(--b3-theme-primary);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s ease;
}

.tutorial-next:hover {
  background: var(--b3-theme-primary-dark);
}

/* Add position indicators */
.tutorial-tooltip::before {
  content: '';
  position: absolute;
  border: 8px solid transparent;
}

.tutorial-tooltip.top::before {
  border-top-color: var(--b3-border-color);
  bottom: -16px;
  left: 50%;
  transform: translateX(-50%);
}

.tutorial-tooltip.bottom::before {
  border-bottom-color: var(--b3-border-color);
  top: -16px;
  left: 50%;
  transform: translateX(-50%);
}

.tutorial-tooltip.left::before {
  border-left-color: var(--b3-border-color);
  right: -16px;
  top: 50%;
  transform: translateY(-50%);
}

.tutorial-tooltip.right::before {
  border-right-color: var(--b3-border-color);
  left: -16px;
  top: 50%;
  transform: translateY(-50%);
}
/** getting started */

/** image generation */
.image-generation-options {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0rem 1.5rem 0rem 0rem;
}

.image-prompt {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  resize: vertical;
  min-height: 80px;
}

.image-settings {
  display: flex;
  gap: 16px;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
}

.setting-group label {
  font-size: 14px;
  color: var(--b3-theme-on-background);
}

.setting-group select {
  padding: 8px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
}

.send-btn {
  position: absolute;
  bottom: 10px;
  right: 0px;
  font-size: 12px;
  margin-bottom: 1.5rem;
}

/* Mobile-specific styles */
@media (max-width: 480px) {
  .input-wrapper {
    padding-bottom: calc(12px + env(safe-area-inset-bottom));
  }

  .textarea:focus {
    margin-bottom: 100px;
    /* Adjust this value based on your keyboard height */
  }

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.7em 0em;
    background: var(--b3-theme-background);
    border-bottom: 1px solid var(--b3-border-color);
    position: relative;
    z-index: 10;
    min-height: 0.5rem;
    font-size: 0.9rem;
  }

    /* Popup Content */
  .popup-content {
    position: absolute;
    top: 45%;
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
    max-height: 600px;
    font-size: 0.8rem;
  }

  .page-container {
    display: flex;
    flex-direction: column;
    height: calc(92vh - env(safe-area-inset-bottom));
    /* Adjust for safe area */
  }
  .tutorial-tooltip {
    position: absolute;
    background: var(--b3-theme-background);
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    padding: 10px;
    width: 210px;
    pointer-events: all;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    font-size: 0.9rem;
  }

  .chat-control {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .cancel-prompt {
    background: transparent;
    color: var(--b3-theme-on-surface);
    border: 0px;
    width: 50px;
    z-index: 10000;
  }

  .model-select {
    width: 150px;
    padding: 4px 8px;
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    background: var(--b3-select-background);
    font-size: 14px;
    cursor: pointer;
    color: var(--b3-empty-color);
    appearance: none;
  }

}

/* Tablet-specific styles */
@media (min-width: 481px) and (max-width: 1024px) {
  .input-wrapper {
    padding-bottom: calc(12px + env(safe-area-inset-bottom));
  }

  .textarea:focus {
    margin-bottom: 100px;
    /* Adjust this value based on your keyboard height */
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
    min-height: 0.5rem;
    /* Ensure toolbar is above chat container */
  }

  /* Popup Content */
  .popup-content {
    position: absolute;
    top: 50%;
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
    max-height: 600px;
    font-size: 0.8rem;
  }

  .page-container {
    display: flex;
    flex-direction: column;
    height: calc(94.5vh - env(safe-area-inset-bottom));
    /* Adjust for safe area */
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
