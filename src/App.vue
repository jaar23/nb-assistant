<script setup lang="ts">
import chatbox from "@/components/chatbox.vue";
import history from "@/components/history.vue";
import { ref, onMounted } from "vue";
import { SettingUtils } from "./libs/setting-utils";
import { request } from "./api.ts";

const props = defineProps({ plugin: Object });
const chatInput = defineModel();
const historyMessages = ref<{question: string, answer: string}>([]);
const historyRetain = ref(7);
const isAIEnable = ref(false);
const chatboxCompRef = ref(null);

function updateHistory(response) {
    if (historyMessages.value.length >= historyRetain) {
        historyRetain.value.shift();
    }
    historyMessages.value.push(response);
    chatboxCompRef.value.updateHistory(historyMessages.value)
}

onMounted(async () => {
  const systemConf = await request("/api/system/getConf");

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
  console.log("settings: ", props.plugin.settingUtils);
});
</script>

<template>
  <div class="nb-container">
    <div v-if="isAIEnable">
      <history class="history" v-model="historyMessages"></history>
      <chatbox
        class="chat" ref="chatboxCompRef"
        v-model:chatInput="chatInput"
        v-model:plugin="props.plugin"
        @response="updateHistory"
      />
    </div>
    <div v-else>
      <div>
        <p>You need to configure the AI setting before using this plugin.</p>
        <p>Under Setting > AI</p>
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
  height: 20%;
  max-height: 150px;
  bottom: 2px;
  position: absolute;
  background: var(--b3-theme-background);
  width: 95%;
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
