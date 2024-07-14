<script setup lang="ts">
import { request, pushErrMsg, readDir, lsNotebooks } from "@/api.ts";
import { dataPath } from "@/embedding.ts";
import { ref, onMounted } from "vue";
import Loading from "vue-loading-overlay";
import "vue-loading-overlay/dist/css/index.css";
import { promptAI, countWords, searchNotebook, tokenize } from "@/utils.ts";
//import { Mentionable } from "vue-mention";
import Mentionable from "@/components/mentionable.vue";

const chatInput = defineModel("chatInput");
const plugin = defineModel("plugin");
const chatHistory = ref([]);
const emit = defineEmits(["response"]);
const isLoading = defineModel("inferencing");
const enterToSend = defineModel("enterToSend");
const previousRole = ref("");
const selectedNotebook = ref("");
const vectorizedDb = ref([]);
const extraContext = ref("");

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

      emit(
        "tokenCount",
        countWords(
          chatInput.value +
          (previousRole.value !== pluginSetting.systemPrompt ? "" : history),
        ),
      );
      
      const respMessage = await promptAI(
        systemConf,
        previousRole.value !== pluginSetting.systemPrompt ? "" : history,
        extraContext.value !== "" ? `${extraContext.value} ${chatInput.value}`: chatInput.value,
        pluginSetting.systemPrompt,
        pluginSetting.customSystemPrompt,
        pluginSetting.customUserPrompt,
      );

      emit("response", { question: "", answer: respMessage });
      previousRole.value = pluginSetting.systemPrompt;
      chatInput.value = "";
      selectedNotebook.value = "";
      extraContext.value = "";
      isLoading.value = false;
    } else {
      await pushErrMsg(
        "AI setting is not configured, please configure under Setting > AI",
      );
    }
  } catch (err) {
    isLoading.value = false;
    selectedNotebook.value = "";
    extraContext.value = "";
    await pushErrMsg(err);
  }
}

async function typing(ev) {
  if (ev.key === "Enter" && !ev.shiftKey) {
    if (selectedNotebook.value !== "") {
      const tokens = tokenize(chatInput.value);
      let query = "";
      for (const t of tokens) {
        if (!t.startsWith("@")) {
          query += `${t} `;
        }
      }
      const searchResult = await searchNotebook(selectedNotebook.value, query, 0.2, 20);
      console.log("search result", searchResult);
      let evaluateResult = "";
      for (const sr of searchResult) {
        for (const block of sr.blocks) {
          evaluateResult += `${block.markdown} \n`
        }
      }
      console.log("extra context", evaluateResult);
      //extraContext.value = `Base on the details below\n${evaluateResult}\n Extract the relevant details for query below:\n`;
      extraContext.value = `Base on this query ${chatInput.value}.\n1. Extract the topic of the query.\n2. Extract the relevant details from below ${evaluateResult}.\nStrictly response using the details provide, do not generate your own answer.`
    } else {
      extraContext.value = "";
    }
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

async function checkVectorizedDb() {
  vectorizedDb.value = [];
  const dir = await readDir(dataPath);
  const notebooks = await lsNotebooks();
  for (const nb of notebooks.notebooks) {
    if (dir.filter((f) => f.name.includes(nb.id)).length > 0) {
      vectorizedDb.value.push({ id: nb.id, name: nb.name, value: nb.name, key: nb.id });
    }
  }
  console.log("vectorized db", vectorizedDb.value);
}

async function onMention(key, currentKeyVal, value) {
  // console.log("key", key);
  // console.log("curr key", currentKeyVal);
  // console.log("val", value);
  for (const nb of vectorizedDb.value) {
    if (nb.id === key.id) {
      selectedNotebook.value = nb.id;
    }
  }
  console.log("selected ", selectedNotebook.value);
}

async function onApply(item, key, replacedWith) {
  console.log(item, `has been replaced with ${replacedWith}`);
  console.log("key", key);
  console.log(text.value);
}

onMounted(async () => {
  await checkVectorizedDb();
  // for (const nb of vectorizedDb.value) {
  //   userMentionTrigger.items.push({ value: nb.name });
  // }
  // console.log("user mention trigger", userMentionTrigger);
});

defineExpose({
  updateHistory,
});
</script>

<template>
  <div class="input-area">
    <loading v-model:active="isLoading" :can-cancel="false" :on-cancel="loadingCancel" loader="bars"
      background-color="#eee" opacity="0.25" :is-full-page="false" />
    <Mentionable class="mention" :keys="['@']" :items="vectorizedDb" offset="6" insert-space @apply="onMention">
      <textarea class="textarea b3-text-field" v-model="chatInput" :placeholder="plugin.i18n.chatPlaceHolder"
        @keypress="typing"></textarea>

      <template #no-result>
        <div class="dim">No result</div>
      </template>

      <template #item-@="{ item }">
        <div class="mention-item">
          {{ item.name }}
          <!-- <span class="dim"> ({{ item.name }}) </span> -->
        </div>
      </template>
    </Mentionable>
    <!-- <SmartSuggest :triggers="[userMentionTrigger]"> -->
    <!--   <textarea class="textarea b3-text-field" v-model="chatInput" :placeholder="plugin.i18n.chatPlaceHolder" -->
    <!--     @keypress="typing"></textarea> -->
    <!-- </SmartSuggest> -->
    <button class="button b3-button" @click="prompt">
      <!--       {{ plugin.i18n.send}} -->
      <svg width="32px" height="32px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="#000000"
        stroke-width="1.5">
        <path fill-rule="evenodd" clip-rule="evenodd"
          d="M3.29106 3.3088C3.00745 3.18938 2.67967 3.25533 2.4643 3.47514C2.24894 3.69495 2.1897 4.02401 2.31488 4.30512L5.40752 11.25H13C13.4142 11.25 13.75 11.5858 13.75 12C13.75 12.4142 13.4142 12.75 13 12.75H5.40754L2.31488 19.6949C2.1897 19.976 2.24894 20.3051 2.4643 20.5249C2.67967 20.7447 3.00745 20.8107 3.29106 20.6912L22.2911 12.6913C22.5692 12.5742 22.75 12.3018 22.75 12C22.75 11.6983 22.5692 11.4259 22.2911 11.3088L3.29106 3.3088Z"
          fill="#000000"></path>
      </svg>
    </button>
  </div>
</template>

<style scoped>
.input-area {
  margin: 0.5em;
  padding: 0.5em;
  position: relative;
  border: 0px solid #ccc;
}

.mention {
  height: 100%;
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
  border: 1px solid #b7b7b7;
  padding: 4px 10px;
}

.mention-selected {
  background-color: var(--b3-theme-success)
}

</style>
