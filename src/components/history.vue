<script setup lang="ts">
import message from "./message.vue";
import action from "./action.vue";

const messages = defineModel<{
  question: string;
  answer: string;
  aiEmoji: string;
  actionable: boolean;
  actionType: string;
  blockId: string;
}>();
</script>

<template>
  <ul>
    <li v-for="(msg, index) in messages">
      <message class="question" v-if="msg.question != '' && !msg.actionable" :msg="msg.question"></message>
      <message class="answer" v-if="msg.answer != '' && !msg.actionable" :msg="msg.answer" :aiEmoji="msg.aiEmoji"></message>
      <action class="answer" v-if="msg.answer != '' && msg.actionable" :msg="msg.answer" :aiEmoji="msg.aiEmoji" :actionType="msg.actionType" :blockId="msg.blockId"></action>
    </li>
  </ul>
</template>

<style scoped>
ul {
  list-style-type: none;
  margin: 0;
  padding: 0;
  overflow: scroll;
}

.question {
  background-color: var(--b3-theme-background);
  border-radius: 20px 20px 0px 20px;
  width: 85%;
  float: right;
  border: 1px solid var(--b3-empty-color);
  padding: 1em;
}

.answer {
  background-color: var(--b3-theme-background);
  border-radius: 20px 20px 20px 0px;
  width: 85%;
  float: left;
  padding: 1em;
  line-height: 15pt;
  border: 1px solid var(--b3-empty-color);
}
</style>
