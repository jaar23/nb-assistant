<script setup lang="ts">
import message from "./message.vue";
import { ref, watch } from "vue";


export type Message = {
  id: string,
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
const emit = defineEmits(["updateMessage", "regenMessage"]);;

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

function handleUpdateMessage(id: string, updatedMessage: string) {
  for (let msg of messages.value) {
    if (msg.id === id) {
      msg.question = updatedMessage;
      break;
    }
  }
  emit("updateMessage", id, updatedMessage);
}


function handleRemoveMessage(messagePair: Object) {
  const question = messagePair['question'];
  const answer = messagePair['answer'];
  const id = messagePair['id'];
  for (let msg of messages.value) {
    if (msg.id === id && msg.question === question) {
      msg.question = "";
    }
    if (msg.id === id && msg.answer === answer) {
      msg.answer = "";
    }
  }
}


function handleRegenMessage(id: string, message: string) {
  emit("regenMessage", id, message);
}


function resetMessage(id: string, message: string) {
  for (let msg of messages.value) {
    if (msg.id === id) {
      msg.answer = message;
      break;
    }
  }
}

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

defineExpose({
  resetMessage
})
</script>

<template>
  <ul>
    <li v-for="(msg, index) in messages" :key="index">
      <message :question="msg.question" :fullMessage="msg.answer" :isStreaming="false" :id="msg.id"
        @updateMessage="handleUpdateMessage" @removeMessage="handleRemoveMessage" @regenMessage="handleRegenMessage"/>
    </li>
    <message style="border: 1px solid red" v-if="props.isStreaming && streamingMessage !== ''" :question="props.question" 
      :streamMessage="streamingMessage" :isStreaming="props.isStreaming" :id="'temp'" />
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
