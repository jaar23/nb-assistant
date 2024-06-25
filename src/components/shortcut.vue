<script setup lang="ts">
import { request, lsNotebooks, pushErrMsg } from "@/api.ts";
import { ref, onMounted } from "vue";
import { getCurrentTabs, promptAI, countWords } from "../utils.ts";

const notebooks = ref<any[]>([]);
const openTabs = ref<any[]>([]);
const selectedSumTab = ref<string>("");
const selectedTagTab = ref<string>("");
const emit = defineEmits(["response"]);
const chatHistory = ref([]);
const isLoading = defineModel("inferencing");
const saveFileName = defineModel("saveFilename");
const shortcutShow = ref(true);
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
    const respMessage = await promptAI(
      systemConf,
      "",
      "Summarize this document: " + doc.content,
      pluginSetting.systemPrompt,
      pluginSetting.customSystemPrompt,
      pluginSetting.customUserPrompt,
    );
    emit("response", { question: "", answer: respMessage });
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
    const respMessage = await promptAI(
      systemConf,
      "",
      "Extract the entity for this document, maximum 5, minimum 3. Response only in JSON string array format" +
        doc.content,
      pluginSetting.systemPrompt,
      pluginSetting.customSystemPrompt,
      pluginSetting.customUserPrompt,
    );
    emit("response", { question: "", answer: respMessage });
    isLoading.value = false;
    selectedSumTab.value = "";
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
  console.log("chatbox history", chatHistory.value);
}

function clearChat() {
  chatHistory.value = [];
  emit("clear");
}

function expandOrClose() {
  shortcutShow.value = !shortcutShow.value;
}

onMounted(async () => {
  getOpenTabs();
});

defineExpose({
  updateHistory,
});
</script>

<template>
  <div class="shortcut-container" v-if="openTabs.length > 0">
    <div class="input-container">
      <input
        class="input-container b3-text-field"
        v-model="saveFileName"
        placeholder="Provide filename to save"
        v-if="savingState === 'PENDING'"
        @keypress="typing"
      />
      <button
        class="b3-button button-cancel"
        v-if="savingState === 'PENDING'"
        @click="exitSave"
      >
        <svg
          width="32px"
          height="32px"
          stroke-width="1.5"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          color="#000000"
        >
          <path
            d="M6.75827 17.2426L12.0009 12M17.2435 6.75736L12.0009 12M12.0009 12L6.75827 6.75736M12.0009 12L17.2435 17.2426"
            stroke="#000000"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          ></path>
        </svg>
      </button>
    </div>
    <select
      class="b3-select"
      v-model="selectedSumTab"
      :disabled="isLoading"
      @change="summarizeOpenDoc"
      @focus="getOpenTabs"
      v-if="shortcutShow"
    >
      <option class="b3-option" disabled value="">Summarize</option>
      <option
        class="b3-option"
        v-for="opt in openTabs"
        :value="opt.children.blockId + '|' + opt.title"
      >
        {{ opt.title }}
      </option>
    </select>
    <select
      class="b3-select"
      v-model="selectedTagTab"
      :disabled="isLoading"
      @change="autoTagOpenDoc"
      @focus="getOpenTabs"
      v-if="shortcutShow"
    >
      <option class="b3-option" disabled value="">Auto-tag</option>
      <option
        class="b3-option"
        v-for="opt in openTabs"
        :value="opt.children.blockId + '|' + opt.title"
      >
        {{ opt.title }}
      </option>
    </select>
    <button
      class="b3-button button-warning"
      @click="expandOrClose"
      v-if="shortcutShow"
    >
      <svg
        width="32px"
        height="32px"
        stroke-width="1.5"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        color="#000000"
      >
        <path
          d="M6 12H18"
          stroke="#000000"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        ></path>
      </svg>
    </button>
    <button
      class="b3-button button-warning"
      @click="expandOrClose"
      v-if="!shortcutShow"
    >
      <svg
        width="32px"
        height="32px"
        stroke-width="1.5"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        color="#000000"
      >
        <path
          d="M6 12H12M18 12H12M12 12V6M12 12V18"
          stroke="#000000"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        ></path>
      </svg>
    </button>
    <button
      class="b3-button button-warning"
      @click="clearChat"
      v-if="shortcutShow"
    >
      Clear
    </button>

    <button
      class="b3-button button-confirm"
      @click="saveChat"
      v-if="shortcutShow"
    >
      Save Chat
    </button>
  </div>
</template>
<style scoped>
select {
  margin: 4px;
  max-width: 25%;
}

.input-container {
  width: 100%;
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
  float: right;
}

.button-warning {
  height: 26px;
  margin: 0.4em 0.5em;
  background-color: var(--b3-theme-surface);
  float: right;
  border: 1px solid var(--b3-theme-secondary);
}

.button-cancel {
  background-color: transparent;
  border: 0px;
}
</style>
