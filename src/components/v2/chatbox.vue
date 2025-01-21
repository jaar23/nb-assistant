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
import { ref, onMounted } from "vue";
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
import { Settings2 } from 'lucide-vue-next';

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

async function prompt(stream = true) {
  try {
    console.log('Starting stream...');
    const systemConf = await request("/api/system/getConf", {});
    const pluginSetting = plugin.value.settingUtils.dump();

    if (
      systemConf.conf.ai.openAI.apiBaseURL !== "" &&
      systemConf.conf.ai.openAI.apiKey !== "" &&
      systemConf.conf.ai.openAI.apiModel !== "" &&
      systemConf.conf.ai.openAI.apiProvider !== ""
    ) {
      isLoading.value = true;
      isStreaming.value = true;
      const aiconf = systemConf.conf.ai.openAI;
      const endpoint = `${aiconf.apiBaseURL}/chat/completions`;
      const apiKey = aiconf.apiKey;
      const model = aiconf.apiModel;
      const temperature = aiconf.apiTemperature;
      const maxToken = aiconf.apiMaxTokens;
      const systemPrompt = pluginSetting.systemPrompt;
      const customSystemPrompt = pluginSetting.customSystemPrompt;
      const customUserPrompt = pluginSetting.customUserPrompt;
      const systemMessage = {
          content: customSystemPrompt !== "" ? customSystemPrompt : systemPrompt,
          role: "system",
      };
      const userMessage = {
          content: chatInput.value,
          role: "user",
      };

      question.value = chatInput.value;
      console.log('Sending request with message:', userMessage.content);
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
              stream: stream,
              temperature,
              messages: [systemMessage, userMessage],
          }),
      });

      let fullResponse = "";
      if (stream) {
        const reader = resp.body?.getReader();
        const decoder = new TextDecoder('utf-8');

        while (true && reader) {
          const {done, value } = await reader.read();
          const chunk = decoder.decode(value);
          if (done) break;
          if (chunk.toLowerCase() === '[done]') {
            break;
          }
          const lines = chunk.split('\n').filter(line => line.trim() !== '')

          for (const line of lines) {
            if (line.includes('[DONE]')) continue
            
            try {
              const jsonString = line.replace(/^data: /, '').trim()
              const json = JSON.parse(jsonString)
              const content = json.choices[0]?.delta?.content || ''
              if (content) {
                fullResponse += content;
                reply.value = fullResponse;
                emit('streamChunk', fullResponse);
              }
            } catch (e) {
              console.error('Error parsing chunk:', e)
            }
          }
        }
        if (fullResponse) {
          console.log('Streaming complete. Final message:', fullResponse);
          messages.value.push({
            id: generateUUID(),
            question: question.value,
            answer: fullResponse,
            aiEmoji: "",
            actionable: false,
            actionType: "",
            blockId: "",
          });
          console.log('Updated messages:', messages.value);
        }
        return fullResponse
      } else {
        if (!resp.ok) {
          console.error("unable to fetch request from ai provider");
          throw new Error(await resp.text());
        }
        let response = await resp.json();
        for (const choice of response.choices) {
          fullResponse += choice.message.content + "\n";
        }
        return fullResponse;
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


// async function prompt() {
//   try {
//     await preparePrompt();

//     const systemConf = await request("/api/system/getConf", {});
//     const pluginSetting = plugin.value.settingUtils.dump();


//     if (
//       systemConf.conf.ai.openAI.apiBaseURL !== "" &&
//       systemConf.conf.ai.openAI.apiKey !== "" &&
//       systemConf.conf.ai.openAI.apiModel !== "" &&
//       systemConf.conf.ai.openAI.apiProvider !== ""
//     ) {
//       isLoading.value = true;
//       let history = "";
//       if (chatHistory.value.length > 0) {
//         history = chatHistory.value
//           .map(
//             (x) =>
//               `${x.question !== "" ? "Question: " + x.question : ""} ${x.answer !== "" ? "Answer: " + x.answer : ""}`,
//           )
//           .join("\n");
//       }
//       emit("response", { question: chatInput.value, answer: "" });

//       const contextLen = countWords(`${extraContext.value} ${chatInput.value}`);
//       let respMessage = "";
//       if (pluginSetting.usePromptChaining && contextLen > 1024) {
//         console.log("using prompt chain, context length: " + contextLen);
//         respMessage = await promptAIChain(
//           systemConf,
//           extraContext.value,
//           rephrasedInput.value,
//           pluginSetting.systemPrompt,
//         );
//       } else {
//         console.log(
//           "usng prompt with context only, context length:" + contextLen,
//         );
//         respMessage = await promptAI(
//           systemConf,
//           previousRole.value !== pluginSetting.systemPrompt ? "" : history,
//           extraContext.value !== ""
//             ? `${extraContext.value} ${rephrasedInput.value}`
//             : rephrasedInput.value,
//           pluginSetting.systemPrompt,
//           pluginSetting.customSystemPrompt,
//           pluginSetting.customUserPrompt,
//         );
//       }

//       emit("response", { question: "", answer: respMessage });
//       previousRole.value = pluginSetting.systemPrompt;
//       chatInput.value = "";
//       selectedNotebook.value = "";
//       extraContext.value = "";
//       selectedDocument.value = [];
//       isLoading.value = false;
//     } else {
//       await pushErrMsg(
//         "AI setting is not configured, please configure under Setting > AI",
//       );
//     }
//   } catch (err) {
//     isLoading.value = false;
//     selectedNotebook.value = "";
//     selectedDocument.value = [];
//     extraContext.value = "";
//     console.error(err);
//     await pushErrMsg(err.stack);
//   }
// }

async function preparePrompt() {
  try {
    isLoading.value = true;
    const systemConf = await request("/api/system/getConf", {});
    const pluginSetting = plugin.value.settingUtils.dump();
    if (
      pluginSetting.usePromptChaining &&
      countWords(chatInput.value) > 5 &&
      (selectedNotebook.value !== "" || selectedDocument.value.length > 0)
    ) {
      rephrasedInput.value = await rephrasePrompt(
        systemConf,
        chatInput.value,
        pluginSetting.systemPrompt,
      );
    } else {
      rephrasedInput.value = chatInput.value;
    }
    if (selectedNotebook.value !== "" && chatInput.value.includes("@")) {
      const tokens = tokenize(rephrasedInput.value);
      let query = "";
      for (const t of tokens) {
        if (!t.startsWith("@") && !t.startsWith("/")) {
          query += `${t} `;
        }
      }
      const searchResult = await searchNotebook(
        selectedNotebook.value,
        query,
        0.2,
        20,
      );
      console.log("search result", searchResult);
      let evaluateResult = "";
      for (const sr of searchResult) {
        for (const block of sr.blocks) {
          evaluateResult += `${block.markdown} \n`;
        }
      }
      console.log("extra context", evaluateResult);
      extraContext.value = evaluateResult;
    } else if (selectedDocument.value.length > 0 && chatInput.value.includes("/")) {
      for (const doc of selectedDocument.value) {
        const markdown = await exportMdContent(doc);
        extraContext.value = `${extraContext.value}\n---\n${markdown.content}`;
      }
    } else {
      extraContext.value = "";
      selectedDocument.value = [];
      selectedNotebook.value = "";
    }
    isLoading.value = false;
  } catch (e) {
    console.error(e);
    isLoading.value = false;
    pushErrMsg(e.stack);
  }
}

async function typing(ev) {
  const pluginSetting = plugin.value.settingUtils.dump();
  if (ev.key === "Enter" && !ev.shiftKey && pluginSetting.enterToSend) {
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

function handleFocus() {
  isFocused.value = true;
  // Optional: Scroll to the bottom when the textarea is focused
  setTimeout(() => {
    window.scrollTo(0, document.body.scrollHeight);
  }, 100);
}

function handleBlur() {
  isFocused.value = false;
}

onMounted(async () => {
  try {
    isLoading.value = true;
    // await checkVectorizedDb();
    // await checkAllDocuments();
    enterToSend.value = false;
    isLoading.value = false;
    messages.value = [];
  } catch (e) {
    console.error(e);
    isLoading.value = false;
  }
});

defineExpose({
  updateHistory,
});
</script>

<template>
  <div class="page-container">
    <div class="chat-wrapper">
      <div class="chat-container">
        <history class="history" ref="historyRef" v-model:messages="messages" v-model:plugin="plugin" :question="question" 
          :streamMessage="reply" :isStreaming="isStreaming" @updateMessage="handleUpdateMessage" @regenMessage="handleRegenMessage"></history>
        <loading v-model:active="isLoading" :can-cancel="false" :on-cancel="loadingCancel" loader="bars"
          background-color="#eee" :opacity="0.25" :is-full-page="false" />
      </div>

      <!-- Model selector and input area wrapper -->
      <div class="input-wrapper">
        <!-- Model selector -->
        <div class="chat-control">
          <span @click="openSetting" class="btn-a">
            <Settings2 class="settings" />
          </span>
          <span class="model-label">model</span>
          <div class="model-dropdown">
            <select class="model-select">
              <option value="deepseek-chat">deepseek-chat</option>
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