<script setup lang="ts">
import {
  request,
  pushErrMsg,
  readDir,
  lsNotebooks,
  listDocsByPath,
  getAllDocsByNotebook,
  transformDocToList,
  exportMdContent,
} from "@/api.ts";
import { dataPath } from "@/embedding.ts";
import { ref, onMounted } from "vue";
import Loading from "vue-loading-overlay";
import "vue-loading-overlay/dist/css/index.css";
import {
  promptAI,
  countWords,
  searchNotebook,
  tokenize,
  promptAIChain,
} from "@/utils.ts";
import Mentionable from "@/components/mentionable.vue";

const chatInput = defineModel("chatInput");
const plugin = defineModel("plugin");
const chatHistory = ref([]);
const emit = defineEmits(["response"]);
const isLoading = defineModel("inferencing");
const enterToSend = defineModel("enterToSend");
const previousRole = ref("");
const selectedNotebook = ref("");
const selectedDocument = ref([]);
const vectorizedDb = ref([]);
const documents = ref([]);
const extraContext = ref("");
const mentionItems = ref([]);

async function prompt() {
  try {
    const systemConf = await request("/api/system/getConf");
    const pluginSetting = plugin.value.settingUtils.dump();
    console.log("chat setting", pluginSetting);

    if (
      systemConf.conf.ai.openAI.apiBaseURL !== "" &&
      systemConf.conf.ai.openAI.apiKey !== "" &&
      systemConf.conf.ai.openAI.apiModel !== "" &&
      systemConf.conf.ai.openAI.apiProvider !== ""
    ) {
      isLoading.value = true;
      let history = "";
      if (chatHistory.value.length > 0) {
        history = chatHistory.value
          .map(
            (x) =>
              `${x.question !== "" ? "Question: " + x.question : ""} ${x.answer !== "" ? "Answer: " + x.answer : ""}`,
          )
          .join("\n");
      }
      emit("response", { question: chatInput.value, answer: "" });

      contextLen = countWords(`${extraContext.value} ${chatInput.value}`);
      let respMessage = "";
      if (contextLen > 500) {
        console.log("using prompt chain");
        respMessage = await promptAIChain(
          systemConf,
          extraContext.value,
          chatInput.value,
          pluginSetting.systemPrompt,
        );
      } else {
        console.log("usng prompt with context only");
        respMessage = await promptAI(
          systemConf,
          previousRole.value !== pluginSetting.systemPrompt ? "" : history,
          extraContext.value !== ""
            ? `${extraContext.value} ${chatInput.value}`
            : chatInput.value,
          pluginSetting.systemPrompt,
          pluginSetting.customSystemPrompt,
          pluginSetting.customUserPrompt,
        );
      }

      emit("response", { question: "", answer: respMessage });
      previousRole.value = pluginSetting.systemPrompt;
      chatInput.value = "";
      selectedNotebook.value = "";
      extraContext.value = "";
      selectedDocument.value = [];
      isLoading.value = false;
    } else {
      await pushErrMsg(
        "AI setting is not configured, please configure under Setting > AI",
      );
    }
  } catch (err) {
    isLoading.value = false;
    selectedNotebook.value = "";
    selectedDocument.value = [];
    extraContext.value = "";
    await pushErrMsg(err);
  }
}

async function typing(ev) {
  if (ev.key === "Enter" && !ev.shiftKey) {
    try {
      isLoading.value = true;
      if (selectedNotebook.value !== "") {
        const tokens = tokenize(chatInput.value);
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
        //extraContext.value = `Base on the details below\n${evaluateResult}\n Extract the relevant details for query below:\n`;
      } else if (selectedDocument.value.length > 0) {
        for (const doc of selectedDocument.value) {
          const markdown = await exportMdContent(doc);
          extraContext.value = `${extraContext.value}\n---\n${markdown.content}`;
        }
      } else {
        extraContext.value = "";
      }
      await prompt();
      isLoading.value = false;
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
  const dir = await readDir(dataPath);
  const notebooks = await lsNotebooks();
  for (const nb of notebooks.notebooks) {
    if (nb.name === "SiYuan User Guide") {
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
    if (nb.name === "SiYuan User Guide") {
      continue;
    }

    const alldocs = await getAllDocsByNotebook(nb.id, "/");
    let flatlist = [];
    transformDocToList(flatlist, alldocs, nb.name, nb.id);
    // console.log("flat list", flatlist);
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
  console.log("documents", documents.value);
}

async function onMention(item, currentKeyVal, value) {
  // console.log("key", item.key);
  // console.log("curr key", currentKeyVal);
  // console.log("val", value);
  for (const nb of vectorizedDb.value) {
    if (nb.id === item.key) {
      selectedNotebook.value = nb.id;
      break;
    }
  }
  if (selectedNotebook.value !== "") {
    return;
  }
  for (const doc of documents.value) {
    if (doc.key === item.key) {
      selectedDocument.value.push(doc.key);
      break;
    }
  }
  console.log("selected notebook", selectedNotebook.value);
  console.log("selected document", selectedDocument.value);
}

async function onApply(item, key, replacedWith) {
  console.log(item, `has been replaced with ${replacedWith}`);
  console.log("key", key);
  console.log(text.value);
}

async function onOpen(key) {
  if (key === "@") {
    mentionItems.value = vectorizedDb.value;
  } else if (key === "/") {
    mentionItems.value = documents.value;
  }
}

onMounted(async () => {
  try {
    isLoading.value = true;
    await checkVectorizedDb();
    await checkAllDocuments();
    isLoading.value = false;
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
  <div class="input-area">
    <loading v-model:active="isLoading" :can-cancel="false" :on-cancel="loadingCancel" loader="bars"
      background-color="#eee" opacity="0.25" :is-full-page="false" />
    <Mentionable class="mention" :keys="['@', '/']" :items="mentionItems" omit-key insert-space @apply="onMention"
      @open="onOpen" :limit="10">
      <textarea class="textarea b3-text-field" v-model="chatInput" :placeholder="plugin.i18n.chatPlaceHolder"
        @keypress="typing"></textarea>

      <template #no-result>
        <div class="dim">No result</div>
      </template>

      <template #item-@="{ item }">
        <div class="mention-item">
          {{ item.name }}
        </div>
      </template>

      <template #item-%2F="{ item }">
        <div class="mention-item">
          {{ item.name }}
        </div>
      </template>
    </Mentionable>
    <button class="button b3-button" @click="prompt">
      <svg width="32px" height="32px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="#000000"
        stroke-width="1.5">
        <path fill-rule="evenodd" clip-rule="evenodd"
          d="M3.29106 3.3088C3.00745 3.18938 2.67967 3.25533 2.4643 3.47514C2.24894 3.69495 2.1897 4.02401 2.31488 4.30512L5.40752 11.25H13C13.4142 11.25 13.75 11.5858 13.75 12C13.75 12.4142 13.4142 12.75 13 12.75H5.40754L2.31488 19.6949C2.1897 19.976 2.24894 20.3051 2.4643 20.5249C2.67967 20.7447 3.00745 20.8107 3.29106 20.6912L22.2911 12.6913C22.5692 12.5742 22.75 12.3018 22.75 12C22.75 11.6983 22.5692 11.4259 22.2911 11.3088L3.29106 3.3088Z"
          fill="#000000"></path>
      </svg>
    </button>
  </div>
</template>

<style>
.input-area {
  margin: 0.5em;
  padding: 0.5em;
  position: relative;
  border: 0px solid #ccc;
}

.mention {
  height: 100%;
  background-color: transparent;
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
  background-color: var(--b3-theme-success) !important;
}

.mention-item {
  background-color: var(--b3-theme-surface);
  /*border: 1px solid #b7b7b7;*/
  padding: 4px 4px;
  min-height: 28px;
}

.mention-selected {
  background-color: var(--b3-theme-success);
}

.v-popper__wrapper .resize-observer object {
  display: none;
}
</style>
