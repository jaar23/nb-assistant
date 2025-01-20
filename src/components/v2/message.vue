<script setup lang="ts">
import MarkdownIt from "markdown-it";
import MarkdownItAbbr from "markdown-it-abbr";
import MarkdownItAnchor from "markdown-it-anchor";
import MarkdownItFootnote from "markdown-it-footnote";
import MarkdownItHighlightjs from "markdown-it-highlightjs";
import MarkdownItSub from "markdown-it-sub";
import MarkdownItSup from "markdown-it-sup";
import MarkdownItTasklists from "markdown-it-task-lists";
import { ref, watch } from "vue";

const markdown = new MarkdownIt()
  .use(MarkdownItAbbr)
  .use(MarkdownItAnchor)
  .use(MarkdownItFootnote)
  .use(MarkdownItHighlightjs)
  .use(MarkdownItSub)
  .use(MarkdownItSup)
  .use(MarkdownItTasklists);

const props = defineProps({
  streamMessage: {
    type: String,
    required: false
  },
  isStreaming: {
    type: Boolean,
    required: true
  },
  fullMessage: {
    type: String,
    required: false
  },
  question: {
    type: String,
    required: false
  }
});

const message = ref<string>("");

function copy() {  
  const textToCopy = `${props.question}\n${props.fullMessage || props.streamMessage}`;
  console.log('Copying text:', textToCopy);
  window.navigator.clipboard.writeText(textToCopy);
}

watch(() => props.streamMessage, (newVal) => {
  if (newVal) {
    console.log('Stream message updated:', newVal);
    message.value = newVal;
  }
});

watch(() => props.fullMessage, (newVal) => {
  if (newVal) {
    console.log('Full message updated:', newVal);
    message.value = newVal;
  }
});
</script>

<template>
  <div class="msg-container">
    <div v-if="props.question" class="question" v-html="markdown.render(props.question)"></div>
    <div v-if="props.fullMessage" class="answer" v-html="markdown.render(props.fullMessage)"></div>
    <div v-else-if="props.streamMessage" class="answer" v-html="markdown.render(props.streamMessage)"></div>
    <div class="button-area" v-if="props.fullMessage">
      <button @click="copy" class="msg-button">
        <svg class="button-icon">
          <use xlink:href="#iconCopy"></use>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.button-icon {
  width: 16px;
  height: 16px;
  border: 0px;
}

.msg-button {
  width: 24px;
  height: 24px;
  border: 0px;
  padding: 2px;
  background-color: transparent;
}

.button-area {
  margin-top: 10px;
  border: 0px;
}

.answer {
  margin: 0.25em;
  text-align: justify;
  text-justify: inter-word;
  padding: 0.4em;
}

.question {
  margin: 0.25em;
  text-align: right;
  direction: rtl;
  text-justify: inter-word;
  padding: 0.4em;
}


.msg-container {
  padding: 0.75em;
  margin: 0.5em;
  min-height: 40px;
}

.msg-button:active {
  transform: scale(0.98);
  box-shadow: 3px 2px 22px 1px rgba(0, 0, 0, 0.24);
}
</style>