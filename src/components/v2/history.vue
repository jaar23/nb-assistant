<script setup lang="ts">
import message from "./message.vue";
import { ref, watch } from "vue";

export type Message = {
  question: string,
  answer: string,
  aiEmoji: string,
  actionable: boolean,
  actionType: string,
  blockId: string,
};

const messages = defineModel<Message[]>("messages");
const plugin = defineModel("plugin");
const streamingMessage = ref("");

const props = defineProps({
  isStreaming: {
    type: Boolean,
    required: true,
  },
  streamMessage: {
    type: String,
    required: true,
  },
  question: {
    type: String,
    required: false
  }
});

// Handle streaming chunks
watch(() => props.streamMessage, (newVal) => {
  if (props.isStreaming) {
    streamingMessage.value = newVal;
  }
});

watch(() => props.isStreaming, (newVal) => {
  if (!newVal && streamingMessage.value) {
    console.log('Streaming stopped. Adding to history:', streamingMessage.value);
    // messages.value.push({
    //   question: props.question,
    //   answer: streamingMessage.value,
    //   aiEmoji: "",
    //   actionable: false,
    //   actionType: "",
    //   blockId: "",
    // });
    streamingMessage.value = "";
    console.log('Updated history:', messages.value);
  }
});
</script>

<template>
  <ul>
    <li v-for="(msg, index) in messages" :key="index">
      <message :question="msg.question" :fullMessage="msg.answer" :isStreaming="false" />
    </li>
    <message style="border: 1px solid red" v-if="props.isStreaming && streamingMessage !== ''" :question="props.question" :streamMessage="streamingMessage" :isStreaming="props.isStreaming" />
  </ul>
</template>

<style scoped>
ul {
  list-style-type: none;
  margin: 0;
  padding: 0;
  overflow: scroll;
  min-height: 40px;
}

.question {
  background-color: var(--b3-theme-background);
  border-radius: 20px 20px 0px 20px;
  width: 85%;
  float: right;
  padding: 1em;
}

.answer {
  background-color: var(--b3-theme-background);
  border-radius: 20px 20px 20px 0px;
  width: 85%;
  float: left;
  padding: 1em;
  line-height: 15pt;
  /* border: 1px solid var(--b3-empty-color); */
}
</style>
