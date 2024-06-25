<script setup lang="ts">
import chatbox from "@/components/chatbox.vue";
import history from "@/components/history.vue";
import shortcut from "@/components/shortcut.vue";
import { ref, onMounted } from "vue";
import { SettingUtils } from "./libs/setting-utils";
import {
  request,
  lsNotebooks,
  createDocWithMd,
  pushMsg,
  pushErrMsg,
} from "./api.ts";
import { getCurrentTabs } from "./utils.ts";

const props = defineProps({ plugin: Object });
const chatInput = defineModel("chatInput");
const historyMessages = ref<{
  question: string;
  answer: string;
  aiEmoji: string;
}>([]);
const historyRetain = ref(7);
const isAIEnable = ref(false);
const chatboxCompRef = ref(null);
const shortcutCompRef = ref(null);
const inferencing = defineModel("inferencing");
const aiEmoji = ref("");
const enterToSend = ref(false);
const tokenCount = ref(0);

function updateHistory(response) {
  console.log(response);
  if (historyMessages.value.length >= historyRetain) {
    historyRetain.value.shift();
  }
  response.aiEmoji = aiEmoji.value;
  historyMessages.value.push(response);
  chatboxCompRef.value.updateHistory(historyMessages.value);
}

function updateHistoryWithoutKeepTrack(response) {
  response.aiEmoji = aiEmoji.value;
  historyMessages.value.push(response);
}

function clearChat() {
  historyMessages.value = [];
  console.log("clear", historyMessages.value);
}

function showTokenCount(count: number) {
  tokenCount.value = count;
  setTimeout(() => {
    tokenCount.value = 0;
  }, 10000);
}

async function saveChat(title: string) {
  try {
    inferencing.value = true;
    const notebookId = props.plugin.settingUtils.dump().chatSaveNotebook;
    let markdown = `# ${title}`;
    for (const history of historyMessages.value) {
      if (history.question !== "") {
        markdown += "\n";
        markdown += `Question: ${history.question}`;
        markdown += "\n";
      }
      if (history.answer !== "") {
        markdown += "\n";
        markdown += `Answer: ${history.answer}`;
        markdown += "\n";
      }
    }
    if (notebookId === "-") {
      throw props.plugin.i18n.noNotebookSelected;
    } else {
      await createDocWithMd(notebookId, `/${title}`, markdown);
      await pushMsg("Successfully saved chat");
      inferencing.value = false;
    }
  } catch (err) {
    console.error(err);
    await pushErrMsg(err);
    inferencing.value = false;
  }
}

onMounted(async () => {
  const systemConf = await request("/api/system/getConf");
  console.log(systemConf);
  if (
    systemConf.conf.ai.openAI.apiBaseURL !== "" &&
    systemConf.conf.ai.openAI.apiKey !== "" &&
    systemConf.conf.ai.openAI.apiModel !== "" &&
    systemConf.conf.ai.openAI.apiProvider !== ""
  ) {
    isAIEnable.value = true;
    historyRetain.value = systemConf.conf.ai.openAI.apiMaxContexts;
  }
  console.log("ai configure? ", isAIEnable.value);
  console.log("context length? ", historyRetain.value);
  console.log("system conf: ", systemConf.conf.ai);
  console.log("i18n: ", props.plugin.i18n);
  aiEmoji.value = props.plugin.settingUtils.dump().aiEmoji;
  enterToSend.value = props.plugin.settingUtils.dump().enterToSend;

  // get current doc
  // const openTabs = getCurrentTabs(systemConf.conf.uiLayout.layout)
  // console.log("tabs: ", openTabs)
  // const doc = await request("/api/export/exportMdContent", {id: currFocusNotebook.blockId})
  // console.log(doc)
});
</script>

<template>
  <div class="nb-container">
    <div v-if="isAIEnable">
      <history
        class="history"
        v-model="historyMessages"
        v-if="historyMessages.length > 0"
      ></history>
      <shortcut
        class="shortcut"
        v-model:inferencing="inferencing"
        v-model:plugin="props.plugin"
        v-model:tokenCount="tokenCount"
        ref="shortcutCompRef"
        @response="updateHistoryWithoutKeepTrack"
        @clear="clearChat"
        @save="saveChat"
      ></shortcut>
      <chatbox
        class="chat"
        ref="chatboxCompRef"
        v-model:inferencing="inferencing"
        v-model:chatInput="chatInput"
        v-model:plugin="props.plugin"
        v-model:enterToSend="enterToSend"
        @tokenCount="showTokenCount"
        @response="updateHistory"
      />
    </div>
    <div v-else>
      <div>
        <p>{{ this.i18n.noAIDetected }}</p>
        <p>{{ this.i18n.noAIDetected2 }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.history {
  height: 80%;
  width: 100%;
  top: 2px;
  position: absolute;
}

.chat {
  height: 12%;
  bottom: 1px;
  position: absolute;
  width: 95%;
}

.shortcut {
  height: 7%;
  max-height: 80px;
  position: absolute;
  width: 95%;
  top: 82%;
  /*display: flex;*/
  padding: 1em;
}

.token-count {
  position: absolute;
  bottom: 2px;
  height: 12px;
}

.nb-container {
  height: 100%;
  position: relative;
}

p {
  padding: 1em;
  text-align: center;
}
</style>
