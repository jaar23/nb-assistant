<script setup lang="ts">
import { request, lsNotebooks, pushErrMsg } from "@/api.ts";
import { ref, onMounted } from "vue";
import { getCurrentTabs, promptAI, countWords, parseTags } from "../utils.ts";

const notebooks = ref<any[]>([]);
const openTabs = ref<any[]>([]);
const selectedSumTab = ref<string>("");
const selectedTagTab = ref<string>("");
const emit = defineEmits(["response"]);
const chatHistory = ref([]);
const isLoading = defineModel("inferencing");
const saveFileName = defineModel("saveFilename");
const shortcutShow = ref(false);
const savingState = ref("");
const plugin = defineModel("plugin");

async function getOpenTabs() {
  const systemConf = await request("/api/system/getConf");
  openTabs.value = getCurrentTabs(systemConf.conf.uiLayout.layout);
  console.log("tabs: ", openTabs);
}

async function summarizeOpenDoc(ev: any) {
  try {
    const systemConf = await request("/api/system/getConf");
    const blockArr = ev.target.value.split("|");
    const blockId = blockArr[0];
    const blockTitle = blockArr[1];
    const doc = await request("/api/export/exportMdContent", { id: blockId });
    const pluginSetting = plugin.value.settingUtils.dump();

    emit("response", { question: `Summarize ${blockTitle}`, answer: "" });

    isLoading.value = true;
    expandOrClose();

    const respMessage = await promptAI(
      systemConf,
      "",
      "Summarize this document: " + doc.content,
      pluginSetting.systemPrompt,
      pluginSetting.customSystemPrompt,
      pluginSetting.customUserPrompt,
    );
    emit("response", { question: "", answer: respMessage, actionable: false });
    isLoading.value = false;
    selectedSumTab.value = "";
  } catch (err) {
    isLoading.value = false;
    await pushErrMsg(err);
  }
}

async function autoTagOpenDoc(ev: any) {
  try {
    const systemConf = await request("/api/system/getConf");
    const blockArr = ev.target.value.split("|");
    const blockId = blockArr[0];
    const blockTitle = blockArr[1];
    const doc = await request("/api/export/exportMdContent", { id: blockId });
    const pluginSetting = plugin.value.settingUtils.dump();

    emit("response", { question: `Auto tag ${blockTitle}`, answer: "" });

    isLoading.value = true;
    expandOrClose();

    const respMessage = await promptAI(
      systemConf,
      "",
      `Extract the entity for this document and generate 3 to 5 tags from the provided text. 
Example: A computer is a machine that can be programmed to automatically carry out sequences of arithmetic or logical operations (computation). Modern digital electronic computers can perform generic sets of operations known as programs. These programs enable computers to perform a wide range of tasks. 
Response: computer, computer system, technology
Example: Physics is the natural science of matter, involving the study of matter, its fundamental constituents, its motion and behavior through space and time, and the related entities of energy and force.[1] Physics is one of the most fundamental scientific disciplines.[2][3][4] A scientist who specializes in the field of physics is called a physicist. 
Response: Physics, Natural Science, Science
Remember ALWAYS Response only in text format
---
${doc.content}`,
      pluginSetting.systemPrompt,
      pluginSetting.customSystemPrompt,
      pluginSetting.customUserPrompt,
    );

    const tags = parseTags(respMessage);
    console.log("tags:", tags);
    let message = { question: "", answer: respMessage };
    if (tags.length > 0) {
      message["actionable"] = true;
      message["actionType"] = "Checkbox";
    }
    console.log("tag message", message);
    emit("response", message);
    isLoading.value = false;
    selectedTagTab.value = "";
  } catch (err) {
    isLoading.value = false;
    await pushErrMsg(err);
  }
}

async function getAllNoteBook() {
  notebooks.value = await lsNotebooks();
}

async function saveChat() {
  if (savingState.value === "") {
    savingState.value = "PENDING";
  } else if (savingState.value === "PENDING") {
    emit("save", saveFileName.value);
    saveFileName.value = "";
    savingState.value = "";
  }
}

async function typing(ev) {
  if (ev.key === "Enter" && !ev.shiftKey) {
    await saveChat();
  }
}

function exitSave() {
  console.log("esc....");
  savingState.value = "";
  saveFileName.value = "";
}

function updateHistory(history) {
  chatHistory.value = [];
  chatHistory.value = history;
  console.log("shortcut history", chatHistory.value);
}

function clearChat() {
  chatHistory.value = [];
  emit("clear");
}

function expandOrClose() {
  shortcutShow.value = !shortcutShow.value;
  emit("onShortcutView");
}

onMounted(async () => {
  getOpenTabs();
});

defineExpose({
  updateHistory,
});
</script>

<template>
  <div class="dropdown" v-if="openTabs.length > 0">
    <button class="b3-button dropdown-btn" @click="expandOrClose" v-if="shortcutShow">
      <svg width="32px" height="32px" stroke-width="1.5" viewBox="0 0 24 24" fill="none"
        xmlns="http://www.w3.org/2000/svg" color="#000000">
        <path d="M6 12H18" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    </button>
    <button class="b3-button dropdown-btn" @click="expandOrClose" v-if="!shortcutShow">
      <svg width="32px" height="32px" stroke-width="1.5" viewBox="0 0 24 24" fill="none"
        xmlns="http://www.w3.org/2000/svg" color="#000000">
        <path d="M6 12H12M18 12H12M12 12V6M12 12V18" stroke="#000000" stroke-width="1.5" stroke-linecap="round"
          stroke-linejoin="round"></path>
      </svg>
    </button>
    <ul v-if="savingState === ''">
      <li>
        <button class="b3-button button-confirm" @click="saveChat" v-if="shortcutShow"
          :disabled="chatHistory.length === 0">
          {{ plugin.i18n.saveChat }}
        </button>
      </li>
      <li>
        <button class="b3-button button-warning" @click="clearChat" v-if="shortcutShow"
          :disabled="chatHistory.length === 0">
          {{ plugin.i18n.clear }}
        </button>
      </li>
      <li>
        <select class="b3-select" v-model="selectedSumTab" :disabled="isLoading" @change="summarizeOpenDoc"
          @focus="getOpenTabs" v-if="shortcutShow">
          <option class="b3-option" disabled value="">
            {{ plugin.i18n.summarize }}
          </option>
          <option class="b3-option" v-for="opt in openTabs" :value="opt.children.blockId + '|' + opt.title">
            {{ opt.title }}
          </option>
        </select>
      </li>
      <li>
        <select class="b3-select" v-model="selectedTagTab" :disabled="isLoading" @change="autoTagOpenDoc"
          @focus="getOpenTabs" v-if="shortcutShow">
          <option class="b3-option" disabled value="">
            {{ plugin.i18n.autoTag }}
          </option>
          <option class="b3-option" v-for="opt in openTabs" :value="opt.children.blockId + '|' + opt.title">
            {{ opt.title }}
          </option>
        </select>
      </li>
    </ul>
    <div class="dropdown-content" v-if="savingState === 'PENDING'">
      <input class="input-container b3-text-field" v-model="saveFileName" placeholder="Provide filename to save"
        v-if="savingState === 'PENDING'" @keypress="typing" />
      <button class="b3-button button-cancel" v-if="savingState === 'PENDING'" @click="exitSave">
        <svg width="32px" height="32px" stroke-width="1.5" viewBox="0 0 24 24" fill="none"
          xmlns="http://www.w3.org/2000/svg" color="#000000">
          <path
            d="M6.75827 17.2426L12.0009 12M17.2435 6.75736L12.0009 12M12.0009 12L6.75827 6.75736M12.0009 12L17.2435 17.2426"
            stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
      </button>
      <button class="b3-button button-confirm" @click="saveChat" v-if="savingState === 'PENDING'">
        <svg width="32px" height="32px" stroke-width="1.5" viewBox="0 0 24 24" fill="none"
          xmlns="http://www.w3.org/2000/svg" color="#000000">
          <path d="M5 13L9 17L19 7" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          </path>
        </svg>
      </button>
    </div>
  </div>
</template>
<style scoped>
.dropdown {
  z-index: 1;
}

.dropdown ul {
  list-style: none;
  padding-top: 35px;
}

.dropdown select {
  margin: 4px;
  max-width: 80%;
  float: right;
}

.dropdown button {
  float: right;
}

.dropdown-btn {
  background-color: var(--b3-empty-color) !important;
}

.input-container {
  width: 100%;
  height: 35px;
  margin-top: 45px;
  display: flex;
  flex-direction: row;
  padding: 1px;
}

input {
  flex-grow: 2;
}

.shortcut-container {
  min-width: 400px;
}

.button-confirm {
  height: 26px;
  margin: 0.4em 0.5em;
  width: 90px;
}

.button-warning {
  height: 26px;
  margin: 0.4em 0.5em;
  background-color: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-secondary);
}

.button-cancel {
  background-color: var(--b3-theme-secondary);
  margin: 0.4em 0.5em;
  height: 26px;
  width: 90px;
}

.dropdown-btn {
  float: right;
}
</style>
