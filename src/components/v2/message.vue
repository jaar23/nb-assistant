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
import { computed, onMounted, ref, watch } from "vue";
import { FilePenLine, Copy, X, CircleCheckBig, Trash, RefreshCcw, ChevronLeft, ChevronRight, BetweenHorizontalStart, Save } from 'lucide-vue-next';
import { getCurrentTabs } from "@/utils";
import { appendBlock, request, pushMsg, setBlockAttrs, upload } from "@/api";

const markdown = new MarkdownIt()
  .use(MarkdownItAbbr)
  .use(MarkdownItAnchor)
  .use(MarkdownItFootnote)
  .use(MarkdownItHighlightjs)
  .use(MarkdownItSub)
  .use(MarkdownItSup)
  .use(MarkdownItTasklists)
  .use(MarkdownItStyle, {
    'p': 'line-height: 1.75;',
    'ul': 'line-height: 1.75; padding: 0rem 1rem;',
    'ol': 'line-height: 1.75; padding: 0rem 1rem;',
    'img': 'border-radius: var(--b3-border-radius);',
    'h1': 'line-height: 2;',
    'h2': 'line-height: 2;',
    'h3': 'line-height: 2;',
    'h4': 'line-height: 2;',
    'h5': 'line-height: 2;',
    'h6': 'line-height: 2;',
  });
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
  },
  actionable: {
    type: Boolean,
    required: false
  },
  actionType: {
    type: String,
    required: false
  },
  blockId: {
    type: String,
    required: false
  },
  slideKey: {
    type: Number,
    required: false,
    default: 0
  }
});

const message = ref<string>("");
const isEditing = ref<boolean>(false);
const editedMessage = ref<string>("");
const showConfirmDialog = ref<boolean>(false);
const confirmAction = ref<{ type: string, whoseMessage: string } | null>(null);
const currentDoc = ref<any>();
const checklist = ref([]);
const emit = defineEmits(["updateMessage", "removeMessage", "regenMessage", "slideMessage"]);
const messageKey = computed(() => `${props.slideKey}-${props.fullMessage}`);
const thoughts = ref("");
const isThoughtCollapsed = ref(false);
const assetId = ref("");
const plugin: any = defineModel("plugin");

function copy(role) {
  if (role === "user") {
    const textToCopy = props.question || "";
    window.navigator.clipboard.writeText(textToCopy);
  } else if (role === "assistant") {
    const textToCopy = (props.fullMessage || props.streamMessage) || "";
    window.navigator.clipboard.writeText(textToCopy);
  }
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
  confirmAction.value = { type: 'remove', whoseMessage };
  showConfirmDialog.value = true;
}

function regenMessage() {
  const rewriteMessage = `Regenerate response with following context\n${props.question}\n${props.fullMessage}`;
  // generation tasks
  if (props.actionType === "generate_image") {
    emit("regenMessage", props.id, props.question, "N/A", props.actionType);    
  } else {
    if (props.blockId && props.actionType) {
      emit("regenMessage", props.id, rewriteMessage, props.blockId, props.actionType);
    } else {
      emit("regenMessage", props.id, rewriteMessage);
    }
  }
}

function slideMessage(which: string, direction: string) {
  emit("slideMessage", props.id, which, direction);
  assetId.value = "";
}

async function appendToDoc(message: string, actionType?: string) {
  try {
    const systemConf = await request("/api/system/getConf", {});
    const openTabs = getCurrentTabs(systemConf.conf.uiLayout.layout)
    console.log("system conf: ", systemConf)
    currentDoc.value = openTabs.filter(tab => tab?.active)[0] ?? null;
  } catch (e) {
    console.log("unable to get current active tab");
    console.error(e);
  }
  const children = currentDoc.value?.children ?? null;
  if (children) {
    const blockId = children.blockId;
    if (actionType === "generate_image") {
      if ((assetId.value === "")) {
        await save(props.id, actionType);
      }
      await appendBlock("markdown", `![${props.question}](${assetId.value})`, blockId);
    } else {
      await appendBlock("markdown", message, blockId);
    }
    console.log("appened to last part of the doc");
  }
}

async function save(id: string, action: string) {
  if (action === 'save_summary') {
    const data = `### ${plugin.value.i18n.summaryText}\n${props.fullMessage}`;
    await appendBlock("markdown", data, id);
    await pushMsg(plugin.value.i18n.summarySaved);
  } else if (action === 'save_tags') {
    const tags = checklist.value.filter((x) => x.checked).map((x) => x.tag);
    if (tags.length > 0) {
      const attrs = {
        tags: tags.join(","),
      };
      await setBlockAttrs(id, attrs);
      await pushMsg(plugin.value.i18n.tagsAdded);
    } else {
      await pushMsg(plugin.value.i18n.noTagsSelected);
    }
  } else if (action === "generate_image") {
    function generateFileName(): string {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const randomString = Math.random().toString(36).substring(2, 8);
      return `${year}${month}${day}-${randomString}`;
    }
    const base64Data = extractBase64FromMarkdown(message.value);
    const fileName = generateFileName();
    await saveGeneratedImage(fileName, base64Data);
  }
}

function extractBase64FromMarkdown(markdownStr: string): string {
  const base64Regex = /data:image\/png;base64,([^)]+)/;
  const match = markdownStr.match(base64Regex);
  
  if (match && match[1]) {
    return match[1];
  }
  
  return '';
}

function base64ToBlob(base64Data: string): Blob {
  // Decode base64
  const byteString = atob(base64Data);
  
  // Create byte array
  const byteArray = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    byteArray[i] = byteString.charCodeAt(i);
  }
  
  // Create blob
  return new Blob([byteArray], { type: 'image/png' });
}

async function saveGeneratedImage(title: string, base64Data: string) {
  try {
    // Convert base64 to blob
    const blob = base64ToBlob(base64Data);

    // Create File object from blob
    const file = new File([blob], `${title}.png`, { type: 'image/png' });
    
    // Upload using the provided upload function
    const uploadResponse = await upload("assets/", [file]);
    console.log(uploadResponse)
    if (uploadResponse) {
      assetId.value = uploadResponse.succMap[`${title}.png`];
    } else {
      assetId.value = "";
    }
    return uploadResponse;
  } catch (error) {
    console.error('Error saving image:', error);
    throw error;
  }
}


function confirmActionHandler() {
  if (confirmAction.value?.type === 'remove') {
    const { whoseMessage } = confirmAction.value;
    if (whoseMessage === "question") {
      emit("removeMessage", { question: props.question, answer: "", id: props.id });
    } else if (whoseMessage === "answer") {
      thoughts.value = "";
      emit("removeMessage", { question: "", answer: props.fullMessage, id: props.id });
    }
  }
  showConfirmDialog.value = false;
  confirmAction.value = null;
}

function cancelActionHandler() {
  showConfirmDialog.value = false;
  confirmAction.value = null;
}

function containsHTML(input) {
  const htmlRegex = /<([A-Za-z][A-Za-z0-9]*)\b[^>]*>(.*?)<\/\1>|<[A-Za-z][A-Za-z0-9]*\b[^>]*\/>/;
  return htmlRegex.test(input);
}

function msgToList() {
  if (props.fullMessage) {
    checklist.value = [];
    const content = JSON.parse(props.fullMessage);
    for (const tag of content.tags) {
        checklist.value.push({
            checked: false,
            tag: tag,
        });
    }
  }
}

function extractThought(text: string): string | null {
  // First try to match complete thought tags
  const completeThoughtRegex = /<thought>([\s\S]*?)<\/thought>/;
  const completeMatch = text.match(completeThoughtRegex);
  
  if (completeMatch) {
    return completeMatch[1].trim();
  }
  
  // if no complete match, try to match from <thought> to the end of the text
  const openTagIndex = text.indexOf('<thought>');
  if (openTagIndex !== -1) {
    // 8 is length of '<thought>'
    const thoughtContent = text.slice(openTagIndex + 8).trim(); 
    return thoughtContent;
  }
  console.log("extract null return null");
  return null;
}

function toggleThoughts() {
  isThoughtCollapsed.value = !isThoughtCollapsed.value;
}

function renderMessage() {
  if (!props.fullMessage && !props.streamMessage) return;
  let msg = props.fullMessage ? props.fullMessage : props.streamMessage;
  thoughts.value = extractThought(msg);
  if (thoughts.value) {
    msg = msg.replace(`${thoughts.value}`, "");
    msg = msg.replace(`<thought>`, "");
    msg = msg.replace(`</thought>`, "");
    msg = msg.replace(`<thought`, "");
    return msg || "...";
  } else {
    return props.fullMessage
  }
}


watch(() => props.streamMessage, (newVal) => {
  if (newVal) {
    // console.log('Stream message updated:', newVal);
    message.value = newVal;
  }
});

watch(() => props.fullMessage, (newVal) => {
  if (newVal) {
    console.log('Full message updated:', newVal);
    message.value = newVal;
    if (props.actionType === 'save_tags') {
      msgToList();
    }
    assetId.value = "";
  }
});

onMounted(async () => {
  // get current doc
  try {
    const systemConf = await request("/api/system/getConf", {});
    const openTabs = getCurrentTabs(systemConf.conf.uiLayout.layout)
    currentDoc.value = openTabs.filter(tab => tab?.active)[0] ?? null;
    if (props.actionType === 'save_tags') {
      msgToList();
    }
    if (props.fullMessage) {
      message.value = props.fullMessage;
    }
  } catch (e) {
    console.log("unable to get current active tab");
    console.error(e);
  }

})
</script>

<template>
  <div class="msg-container">
    <div class="question-area">
      <div v-if="props.question && !isEditing && containsHTML(props.question)" class="question" v-html="props.question">
      </div>
      <div v-if="props.question && !isEditing && !containsHTML(props.question)" class="question"
      v-html="markdown.render(props.question)"></div>
    </div>
    <div class="ques-button-area" v-if="props.question && !isEditing">
      <button @click="copy('user')" class="msg-button">
        <Copy :size="20" :stroke-width="1" />
      </button>
      <button @click="startEditing" class="msg-button">
        <FilePenLine :size="20" :stroke-width="1" />
      </button>
      <button @click="removeMessage('question')" class="msg-button">
        <Trash :size="20" :stroke-width="1" />
      </button>
      <button @click="slideMessage('question', 'left')" class="msg-button">
        <ChevronLeft :size="20" :stroke-width="1" />
      </button>
      <button @click="slideMessage('question', 'right')" class="msg-button">
        <ChevronRight :size="20" :stroke-width="1" />
      </button>
    </div>
    <div v-if="isEditing" class="question" :class="{'editing': isEditing}">
      <textarea class="inline-edit-textarea" v-model="editedMessage" :class="{'editing': isEditing}"></textarea>
      <div class="ques-button-area">
        <button @click="saveEdit" class="msg-button" :disabled="editedMessage.trim() === ''">
          <CircleCheckBig :size="20" :stroke-width="1" />
        </button>
        <button @click="cancelEdit" class="msg-button">
          <X :size="20" :stroke-width="1" />
        </button>
      </div>
    </div>
    <!-- answer section -->
    <div v-if="props.actionType === 'save_tags' && props.fullMessage" class="action" :key="messageKey">
      <span>{{ plugin.i18n.selectTags }}</span>
      <ul>
        <li v-for="item in checklist">
            <input type="checkbox" :value="item.tag" @click="item.checked = !item.checked" />
            <label>{{ item.tag }}</label>
        </li>
      </ul>
    </div>
    <div v-else>
      <div v-if="thoughts" class="thought">
        <div class="thought-header" @click="toggleThoughts">
          <span>{{ plugin.i18n.thoughtProcess }}</span>
          <ChevronRight v-if="isThoughtCollapsed" :size="20" :stroke-width="1" class="collapse-icon" />
          <ChevronDown v-else :size="20" :stroke-width="1" class="collapse-icon" />
        </div>
        <div v-show="!isThoughtCollapsed" class="thought-content" v-html="markdown.render(thoughts)"></div>
      </div>
      <div v-if="props.fullMessage && containsHTML(props.fullMessage)" class="answer" v-html="renderMessage()"></div>
      <div v-if="props.fullMessage && !containsHTML(props.fullMessage)" class="answer"
        v-html="markdown.render(renderMessage())"></div>
      <!-- <div v-else-if="props.streamMessage && !isEditing" class="answer" v-html="markdown.render(props.streamMessage)">
      </div> -->
      <div v-else-if="props.streamMessage && !isEditing" class="answer" v-html="markdown.render(renderMessage() || props.streamMessage)">
      </div>
    </div>
    <div class="ans-button-area" v-if="props.fullMessage && !isEditing">
      <button v-if="props.actionable" @click="save(props.blockId, props.actionType)" class="msg-button">
        <Save :size="20" :stroke-width="1" />
      </button>
      <button @click="copy('assistant')" class="msg-button">
        <Copy :size="20" :stroke-width="1" />
      </button>
      <button @click="regenMessage" class="msg-button">
        <RefreshCcw :size="20" :stroke-width="1" />
      </button>
      <button @click="appendToDoc(props.fullMessage, props.actionType)" class="msg-button">
        <BetweenHorizontalStart :size="20" :stroke-width="1" />
      </button>
      <button @click="removeMessage('answer')" class="msg-button">
        <Trash :size="20" :stroke-width="1" />
      </button>
      <button @click="slideMessage('answer', 'left')" class="msg-button">
        <ChevronLeft :size="20" :stroke-width="1" />
      </button>
      <button @click="slideMessage('answer', 'right')" class="msg-button">
        <ChevronRight :size="20" :stroke-width="1" />
      </button>
    </div>

    <!-- Confirmation Dialog -->
    <div v-if="showConfirmDialog" class="confirmation-dialog">
      <div class="confirmation-content">
        <p>{{ plugin.i18n.removeMessage }}</p>
        <div class="confirmation-buttons">
          <button @click="confirmActionHandler" class="confirm-button">{{ plugin.i18n.yes }}</button>
          <button @click="cancelActionHandler" class="cancel-button">{{ plugin.i18n.no }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* svg {
  display: inline-block;
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);
  padding: 2px;
  color: transparent !important;
} */

svg {
  fill: transparent;
  display: inline-block;
  background: transparent;
  color: currentColor;
  stroke: var(--b3-theme-on-background);
  padding: 2px;
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);
}


svg:hover {
  stroke: var(--b3-theme-primary);
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
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1), 0 0 8px rgba(102, 175, 233, 0.6);
}

.msg-button {
  width: 24px;
  height: 24px;
  border: 0px;
  padding: 4px;
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

.question-area {
  margin: 0.25em;
  display: flex;
  justify-content: flex-end;
}

.question {
  padding: 0.4em;
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);
  padding: 1rem;
  background: var(--b3-theme-background-light);
  width: fit-content;
  max-width: 92%;
}

.msg-container {
  padding: 0.75em;
  margin: 0.5em;
}

.msg-button:active {
  transform: scale(0.98);
  box-shadow: 3px 2px 22px 1px rgba(0, 0, 0, 0.24);
}

.confirmation-dialog {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.confirmation-content {
  background-color: var(--b3-theme-background);
  padding: 20px;
  border-radius: var(--b3-border-radius);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.confirmation-buttons {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 20px;
}

.confirm-button,
.cancel-button {
  padding: 8px 16px;
  border: none;
  border-radius: var(--b3-border-radius);
  cursor: pointer;
  font-size: 14px;
}

.confirm-button {
  background-color: var(--b3-theme-primary);
  color: white;
}

.cancel-button {
  background-color: var(--b3-theme-secondary);
  color: white;
}

.act-button:active {
    transform: scale(0.98);
    /* Scaling button to 0.98 to its original size */
    box-shadow: 3px 2px 22px 1px rgba(0, 0, 0, 0.24);
    /* Lowering the shadow */
}

.action {
    margin: 0.25em;
    text-align: justify;
    text-justify: inter-word;
    padding: 0.4em;
}

.action ul {
    list-style-type: none;
}

.action ul li input {
    cursor: pointer;
}

.action ul li label {
    margin: 10px;
}

.thought {
  padding: 0.5rem;
  background: var(--b3-theme-background-light);
  margin: 1rem 0rem 0rem 0rem;
  border-radius: var(--b3-border-radius);
  text-align: justify;
}

.thought-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding: 0.5rem;
  font-weight: bold;
}

.thought-header:hover {
  background: var(--b3-theme-background);
  border-radius: var(--b3-border-radius);
}

.collapse-icon {
  transition: transform 0.2s ease;
}

.thought-content {
  padding: 0.5rem;
  margin-top: 0.5rem;
  border-top: 1px solid var(--b3-border-color);
}

.editing {
  width: 96% !important;
}
</style>