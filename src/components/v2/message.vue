<script setup lang="ts">
import MarkdownIt from "markdown-it";
import MarkdownItAbbr from "markdown-it-abbr";
import MarkdownItAnchor from "markdown-it-anchor";
import MarkdownItFootnote from "markdown-it-footnote";
import MarkdownItHighlightjs from "markdown-it-highlightjs";
import MarkdownItSub from "markdown-it-sub";
import MarkdownItSup from "markdown-it-sup";
import MarkdownItTasklists from "markdown-it-task-lists";
import MarkdownItStyle from "markdown-it-style";
import { ref, watch } from "vue";
import { FilePenLine, Copy, X, CircleCheckBig, Trash, RefreshCcw } from 'lucide-vue-next';

const markdown = new MarkdownIt()
  .use(MarkdownItAbbr)
  .use(MarkdownItAnchor)
  .use(MarkdownItFootnote)
  .use(MarkdownItHighlightjs)
  .use(MarkdownItSub)
  .use(MarkdownItSup)
  .use(MarkdownItTasklists)
  .use(MarkdownItStyle, {
    'code': 'border: 1px solid var(--b3-border-color);border-radius: var(--b3-border-radius);background: var(--b3-theme-background)',
    'p': 'line-height: 1.75;',
    'ul': 'line-height: 1.75;',
    'ol': 'line-height: 1.75;'
  })

const props = defineProps({
  id: {
    type: String,
    required: true
  },
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
const isEditing = ref<boolean>(false);
const editedMessage = ref<string>("");
const emit = defineEmits(["updateMessage", "removeMessage", "regenMessage"]);

function copy() {  
  const textToCopy = `${props.question}\n${props.fullMessage || props.streamMessage}`;
  console.log('Copying text:', textToCopy);
  window.navigator.clipboard.writeText(textToCopy);
}

function startEditing() {
  isEditing.value = true;
  editedMessage.value = props.question.trim();
}

function cancelEdit() {
  isEditing.value = false;
}

function saveEdit() {
  isEditing.value = false;
  message.value = editedMessage.value;
  emit('updateMessage', props.id, message.value);
}

function removeMessage(whoseMessage: string) {
  if (whoseMessage === "question") {
    emit("removeMessage", {question: props.question, answer: "", id: props.id});
  } else if (whoseMessage === "answer") {
    emit("removeMessage", {question: "", answer: props.fullMessage, id: props.id});
  }
}

function regenMessage() {
  const rewriteMessage = `Regenerate response with following context\n${props.question}\n${props.fullMessage}`;
  emit("regenMessage", props.id, rewriteMessage);
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
    <div v-if="props.question && !isEditing" class="question" v-html="markdown.render(props.question)"></div>
    <div class="ques-button-area" v-if="props.question && !isEditing">
      <button @click="copy" class="msg-button">
        <Copy :size="20" color="#fafafa" :stroke-width="1" />
      </button>
      <button @click="startEditing" class="msg-button">
        <FilePenLine :size="20" color="#fafafa" :stroke-width="1" />
      </button>
      <button @click="removeMessage('question')" class="msg-button">
        <Trash :size="20" color="#fafafa" :stroke-width="1" />
      </button>
    </div>
    <div v-if="isEditing" class="question">
      <textarea class="inline-edit-textarea" v-model="editedMessage"></textarea>
      <button @click="saveEdit" class="msg-button">
        <CircleCheckBig :size="20" color="#fafafa" :stroke-width="1" />
      </button>
      <button @click="cancelEdit" class="msg-button">
        <X :size="20" color="#fafafa" :stroke-width="1" />
      </button>
    </div>
    <div v-if="props.fullMessage" class="answer" v-html="markdown.render(props.fullMessage)"></div>
    <div v-else-if="props.streamMessage && !isEditing" class="answer" v-html="markdown.render(props.streamMessage)"></div>
    <div class="ans-button-area" v-if="props.fullMessage && !isEditing">
      <button @click="copy" class="msg-button">
        <Copy :size="20" color="#fafafa" :stroke-width="1" />
      </button>
      <button @click="regenMessage" class="msg-button">
        <RefreshCcw :size="20" color="#fafafa" :stroke-width="1" />
      </button>
      <button @click="removeMessage('answer')" class="msg-button">
        <Trash :size="20" color="#fafafa" :stroke-width="1" />
      </button>
    </div>
  </div>
</template>

<style scoped>
svg {
  fill: var(--b3-bq-background);
  display: inline-block;
}

code {
  border: 1px solid var(--b3-border-color) !important;
  border-radius: var(--b3-border-radius) !important;
  background: var(--b3-theme-background) !important;
}

p {
  line-height: 2 !important;
}

ul {
  line-height: 2 !important;
}

.button-icon {
  width: 16px;
  height: 16px;
  border: 0px;
}

.inline-edit-textarea {
  width: 100%; 
  min-height: 100px; 
  padding: 8px; 
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);
  font-family: inherit; 
  font-size: inherit; 
  color: inherit;
  line-height: 1.5; 
  resize: vertical; 
  outline: none; 
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
  background-color: var(--b3-theme-background);
  transition: var(--b3-background-transition);
  text-align: left;
  direction: ltr;
}

.inline-edit-textarea:focus {
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1), 0 0 8px rgba(102, 175, 233, 0.6); /* Add a glow effect on focus */
}


.msg-button {
  width: 24px;
  height: 24px;
  border: 0px;
  padding: 2px;
  background-color: transparent;
}

.ans-button {
  width: 24px;
  height: 24px;
  border: 0px;
  padding: 2px;
  background-color: transparent;
}

.ques-button-area {
  margin: 0px 10px 0px 10px;
  border: 0px;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}


.ans-button-area {
  margin: 0px 10px 0px 10px;
  border: 0px;
  display: flex;
  gap: 10px;
  justify-content: flex-start;
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
  padding: 0.4em;
}

.msg-container {
  padding: 0.75em;
  margin: 0.5em;
}

.msg-button:active {
  transform: scale(0.98);
  box-shadow: 3px 2px 22px 1px rgba(0, 0, 0, 0.24);
}
</style>