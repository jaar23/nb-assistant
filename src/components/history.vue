<script setup lang="ts">
import message from "./message.vue";
const messages = defineModel<{ question: string; answer: string, aiEmoji: string }>();
</script>

<template>
  <ul>
    <li v-for="(msg, index) in messages">
      <message
        class="question"
        v-if="msg.question != ''"
        :msg="msg.question"
      ></message>
      <message
        class="answer"
        v-if="msg.answer != ''"
        :msg="msg.answer"
        :aiEmoji="msg.aiEmoji"
      ></message>
    </li>
  </ul>
</template>

<style scoped>
ul {
  list-style-type: none;
  margin: 0;
  padding: 0;
  max-height: 80%;
  overflow: scroll;
}

.question {
  background-color: var(--b3-theme-primary);
  border-radius: 20px 20px 0px 20px;
  width: 85%;
  float: right;
}

.answer {
  /*background-color: var(--b3-theme-secondary);*/
  border-radius: 20px 20px 20px 0px;
  width: 85%;
  float: left;
  padding: 1em;
  line-height: 15pt;
}
</style>
