<script lang="ts" setup>
import { getFile, pushErrMsg, putFile, removeFile } from "@/api";
import { ref, onMounted, watch, nextTick } from "vue";
import Loading from "vue-loading-overlay";
import { ArrowRight, Trash } from "lucide-vue-next";
import { strToFile } from "@/utils";

const plugin: any = defineModel("plugin");
const chatHistories = ref<{ id: string, date: string, length: number, name: string }[]>([]);
const isLoading = defineModel("inferencing");
const dataPath = "temp/nb-assistant";
const emit = defineEmits(["openChatHistory"]);

async function getChatHistories() {
  const indexResp = await getFile(`${dataPath}/history-index.json`);
  if (indexResp !== null) {
    if (indexResp.data) {
      console.log("history updated to 0.1.4 onwards");
    }
    chatHistories.value = indexResp.sort((a, b) => a.date > b.date? -1 : 1);
  }
}

async function openChatHistory(id: string) {
  emit("openChatHistory", id);
}

function formatDateTime(dt: string): string {
  const date = new Date(dt);
  const pad = (n: number) => n.toString().padStart(2, '0');

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

async function deleteSavedChat(id: string) {
  try {
    isLoading.value = true;
    const savedChatResp = await getFile(`${dataPath}/history-index.json`);
    console.log("saved chat", savedChatResp);
    if (savedChatResp !== null) {
      if (savedChatResp.code === 404) {
        console.log("history updated to 0.1.4 onwards");
      } else {
        const newHistoryIndex = (savedChatResp ?? []).filter(hist => hist.id !== id);
        const jsonStr = JSON.stringify(newHistoryIndex ?? []);
        const file = strToFile(jsonStr, "history-index.json", "application/json");
        await putFile(`${dataPath}/history-index.json`, false, file);
        await removeFile(`${dataPath}/${id}-history.json`);
        await getChatHistories();
      }
    }
  } catch (error) {
    await pushErrMsg(error.message);
  } finally {
    isLoading.value = false;
  }
}

function loadingCancel() {
  isLoading.value = false;
}


onMounted(async () => {
  try {
    isLoading.value = true;
    await getChatHistories();
  } catch (e) {
    console.error(e);
    await pushErrMsg(e);
  } finally {
    isLoading.value = false;
  }
});

</script>

<template>
  <div>
    <h3>{{ plugin.i18n.chatHistory }}</h3>
    <loading v-model:active="isLoading" :can-cancel="false" :on-cancel="loadingCancel" loader="bars"
      background-color="#eee" :opacity="0.25" :is-full-page="false" />
    <ul>
      <li v-for="hist in chatHistories" :key="hist.id" :value="hist.id">
        <div class="message-section">
          {{ hist.name }}
        </div>
        <div class="action-section">
          {{ formatDateTime(hist.date) }}
          <div>
            <button class="action-button" @click="openChatHistory(hist.id)">
              <ArrowRight :size="20" :stroke-width="1" />
            </button>
            <button @click="deleteSavedChat(hist.id)" class="action-button">
              <Trash :size="20" :stroke-width="1" />
            </button>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style lang="css" scoped>
h3 {
  padding: 1rem;
}

ul {
  height: calc(85vh - env(safe-area-inset-bottom));
  overflow-y: scroll;
}

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

li {
  border: 1px solid var(--b3-border-color);
  padding: 0.5em;
  margin: 0.5em;
  cursor: pointer;
  background: var(--b3-theme-background-light);
  border-radius: var(--b3-border-radius);
}

.message-section {
  display: block;
  padding: 0.5em;
  font-size: larger;
}

.action-section {
  display: flex;
  justify-content: space-between;
  padding: 0.25em 1em;
  color: var(--b3-empty-color);
  font-size: smaller;
}

.action-button:active {
  transform: scale(0.98);
  box-shadow: 3px 2px 22px 1px rgba(0, 0, 0, 0.24);
}

.action-button {
  width: 24px;
  height: 24px;
  border: 0px;
  padding: 0.25rem;
  background-color: transparent;
  margin: 0rem 1rem;
}

</style>