<script setup lang="ts">
import message from "./message.vue";
import { ref, watch } from "vue";

//include versions of each generate message
export type Message = {
  id: string,
  question: string[],
  questionIndex: number,
  answer: string[],
  answerIndex: number,
  aiEmoji: string,
  actionable: boolean,
  actionType: string,
  blockId: string,
  context?: string
};

const messages = defineModel<Message[]>("messages");
const plugin: any = defineModel("plugin");
const streamingMessage = ref("");
const emit = defineEmits(["updateMessage", "regenMessage", "removeMessage"]);;
const slideMsgKey = ref(0);
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
  let extraContext = null;
  for (let msg of messages.value) {
    if (msg.id === id) {
      msg.question.push(updatedMessage);
      msg.questionIndex = msg.question.length - 1;
      extraContext = msg.context;
      break;
    }
  }
  if (extraContext) {
    emit("updateMessage", id, updatedMessage, extraContext);
  } else {
    emit("updateMessage", id, updatedMessage);
  }
}


function handleRemoveMessage(messagePair: Object) {
  const question = messagePair['question'];
  const answer = messagePair['answer'];
  const id = messagePair['id'];
  for (let msg of messages.value) {
    if (msg.id === id && question === msg.question[msg.questionIndex]) {
      msg.question.splice(msg.questionIndex, 1);
      msg.questionIndex = Math.max(0, msg.questionIndex - 1);
    }
    if (msg.id === id && answer === msg.answer[msg.answerIndex]) {
      msg.answer.splice(msg.answerIndex, 1);
      msg.answerIndex = Math.max(0, msg.answerIndex - 1);
    }
  }
  emit("removeMessage");
}


function handleRegenMessage(id: string, message: string, blockId?: string, actionType?: string) {
  if (blockId && actionType) {
    emit("regenMessage", id, message, blockId, actionType);
  } else {
    emit("regenMessage", id, message);
  }
}


function resetMessage(id: string, message: string) {
  for (let msg of messages.value) {
    if (msg.id === id) {
      msg.answer.push(message);
      msg.answerIndex = msg.answer.length - 1;
      break;
    }
  }
}

function handleSlideMessage(id: string, which: string, direction: string) {
  for (let msg of messages.value) {
    if (msg.id === id) {
      if (which === "question") {
        msg.questionIndex = direction === "left" ? Math.max(0, msg.questionIndex - 1): Math.min(msg.questionIndex + 1, msg.question.length - 1);
        slideMsgKey.value += 1;
      } else if (which === "answer") {
        const answerIndex = direction === "left" ? Math.max(0, msg.answerIndex - 1): Math.min(msg.answerIndex + 1, msg.answer.length - 1);
        if (msg.answer[answerIndex]) {
          msg.answerIndex = answerIndex;
          slideMsgKey.value += 1;
        }
      }
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
      <message
        :question="msg.question.length > 0 ? msg.question[msg.questionIndex]:''" 
        :fullMessage="msg.answer.length > 0 ?msg.answer[msg.answerIndex] : ''" :isStreaming="false" :id="msg.id"
        @updateMessage="handleUpdateMessage" @removeMessage="handleRemoveMessage" 
        @regenMessage="handleRegenMessage" @slideMessage="handleSlideMessage" v-model:plugin="plugin"
        :actionable="msg.actionable" :blockId="msg.blockId" :actionType="msg.actionType" :slideKey="slideMsgKey"/>
    </li>
    <message class="focus-msg" v-if="props.isStreaming && streamingMessage !== ''" :question="props.question" 
      :streamMessage="streamingMessage" :isStreaming="props.isStreaming" :id="'temp'" v-model:plugin="plugin"/>
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

.focus-msg {
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);
}
</style>
