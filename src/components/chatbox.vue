<script setup lang="ts">
import { request, pushErrMsg } from "@/api.ts";
import { ref } from "vue";
import Loading from "vue-loading-overlay";
import "vue-loading-overlay/dist/css/index.css";
import { promptAI, countWords } from "@/utils.ts";

const chatInput = defineModel("chatInput");
const plugin = defineModel("plugin");
const chatHistory = ref([]);
const emit = defineEmits(["response"]);
const isLoading = defineModel("inferencing");
const enterToSend = defineModel("enterToSend");
const previousRole = ref("");

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
      emit("response", { question: chatInput.value, answer: "" });
      
      isLoading.value = true;
      const history = chatHistory.value.map(
        (x) =>
          `${x.question !== "" ? "Question: " + x.question : ""} ${x.answer !== "" ? "Answer: " + x.answer : ""}---\n`,
      );
      
      emit("tokenCount", countWords(chatInput.value + (previousRole.value !== pluginSetting.systemPrompt ? "" : history)))

      const respMessage = await promptAI(
        systemConf,
        previousRole.value !== pluginSetting.systemPrompt ? "" : history,
        chatInput.value,
        pluginSetting.systemPrompt,
        pluginSetting.customSystemPrompt,
        pluginSetting.customUserPrompt,
      );

      emit("response", { question: "", answer: respMessage });
      previousRole.value = pluginSetting.systemPrompt;
      chatInput.value = "";
      isLoading.value = false;
    } else {
      await pushErrMsg(
        "AI setting is not configured, please configure under Setting > AI",
      );
    }
  } catch (err) {
    isLoading.value = false;
    await pushErrMsg(err);
  }
}

async function typing(ev) {
  if (ev.key === "Enter" && !ev.shiftKey) {
    await prompt();
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

defineExpose({
  updateHistory,
});
</script>

<template>
  <div class="input-area">
    <loading
      v-model:active="isLoading"
      :can-cancel="false"
      :on-cancel="loadingCancel"
      loader="bars"
      background-color="#eee"
      opacity="0.25"
      :is-full-page="false"
    />
    <textarea
      class="textarea b3-text-field"
      v-model="chatInput"
      placeholder="how can I help you today?"
      @keypress="typing"
    ></textarea>
    <button class="button b3-button" @click="prompt">Send</button>
  </div>
</template>

<style scoped>
.input-area {
  margin: 0.5em;
  padding: 0.5em;
  position: relative;
  border: 0px solid #ccc;
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
}
</style>
