<script lang="ts" setup>
import { getFile, pushErrMsg } from "@/api";
import { ref, onMounted, watch, nextTick } from "vue";
import Loading from "vue-loading-overlay";
import { Message } from "./history.vue";
import { ArrowRight } from "lucide-vue-next";

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
    chatHistories.value = indexResp;
    console.log(chatHistories.value)
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

onMounted(async () => {
  try {
    isLoading.value = true;
    await getChatHistories()
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
        <ul>
            <li v-for="hist in chatHistories" :key="hist.id" :value="hist.id" @click="openChatHistory(hist.id)">
                <div class="message-section">
                    {{ hist.name }}
                </div>
                <div class="action-section">
                    {{ formatDateTime(hist.date) }}
                    <ArrowRight :size="20" color="#fafafa" :stroke-width="1" />
                </div>
            </li>
        </ul>
    </div>
</template>

<style lang="css" scoped>
li {
    border: 1px solid var(--b3-border-color);
    padding: 0.5em;
    margin: 0.5em;
    cursor: pointer;
}

.message-section {
    display: block;
    padding: 1em;
    font-size: larger;
}

.action-section {
    display: flex;
    justify-content: space-between;
    padding: 0.25em 1em;
    color: var(--b3-empty-color);
    font-size: smaller;
}
</style>