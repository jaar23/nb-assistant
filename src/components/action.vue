<script setup lang="ts">
import { parseTags } from "@/utils";
import { ref, onMounted } from "vue";
import { setBlockAttrs, pushMsg, pushErrMsg, appendBlock } from "@/api";
import MarkdownIt from "markdown-it";
import MarkdownItAbbr from "markdown-it-abbr";
import MarkdownItAnchor from "markdown-it-anchor";
import MarkdownItFootnote from "markdown-it-footnote";
import MarkdownItHighlightjs from "markdown-it-highlightjs";
import MarkdownItSub from "markdown-it-sub";
import MarkdownItSup from "markdown-it-sup";
import MarkdownItTasklists from "markdown-it-task-lists";
import MarkdownItTOC from "markdown-it-toc-done-right";

const markdown = new MarkdownIt()
  .use(MarkdownItAbbr)
  .use(MarkdownItAnchor)
  .use(MarkdownItFootnote)
  .use(MarkdownItHighlightjs)
  .use(MarkdownItSub)
  .use(MarkdownItSup)
  .use(MarkdownItTasklists);


const props = defineProps({
    msg: String,
    blockId: String,
    aiEmoji: String,
    actionType: String,
    plugin: Object
});
const checklist = ref([]);

function copy() {
    // console.log("action:", props.aiEmoji + " " + props.msg + " copied...");
    window.navigator.clipboard.writeText(
        `${props.aiEmoji !== undefined ? props.aiEmoji : ""} ${props.msg}`,
    );
}

function msgToList() {
    checklist.value = [];
    const tags = parseTags(props.msg);
    for (const tag of tags) {
        checklist.value.push({
            checked: false,
            tag: tag,
        });
    }
}

async function saveTags() {
    const tags = checklist.value.filter((x) => x.checked).map((x) => x.tag);
    if (tags.length > 0) {
        const attrs = {
            tags: tags.join(","),
        };
        await setBlockAttrs(props.blockId, attrs);
        await pushMsg(props.plugin.i18n.tagsAdded);
    } else {
        await pushMsg(props.plugin.i18n.noTagsSelected);
    }
}

async function saveSummary() {
    const data = `### ${props.plugin.i18n.summaryText}\n${props.aiEmoji !== undefined ? props.aiEmoji : ""} ${props.msg}`;
    await appendBlock("markdown", data, props.blockId);
    await pushMsg(props.plugin.i18n.summarySaved);
}

async function save() {
    if (props.actionType === "Checkbox") {
        await saveTags();
    } else if (props.actionType === "SaveSummary") {
        await saveSummary();
    }
}

onMounted(() => {
    if (props.actionType === "Checkbox") {
        msgToList();
    }
});
</script>

<template>
    <div class="msg-container">
        <div v-if="['Message', 'SaveSummary'].includes(props.actionType)" class="message" v-html="markdown.render(props.msg)">
        </div>
        <div v-if="props.actionType === 'Checkbox'" class="action">
            <span>{{ plugin.i18n.selectTags }}</span>
            <ul>
                <li v-for="item in checklist">
                    <input type="checkbox" :value="item.tag" @click="item.checked = !item.checked" />
                    <label>{{ item.tag }}</label>
                </li>
            </ul>
        </div>
        <div class="button-area">
            <button @click="copy" class="act-button">
                <svg class="button-icon">
                    <use xlink:href="#iconCopy"></use>
                </svg>
            </button>
            <button @click="save" class="act-button" title="Save to document">
                <svg class="button-icon w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                    <path fill-rule="evenodd"
                        d="M5 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7.414A2 2 0 0 0 20.414 6L18 3.586A2 2 0 0 0 16.586 3H5Zm10 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM8 7V5h8v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1Z"
                        clip-rule="evenodd" />
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

.act-button {
    width: 24px;
    height: 24px;
    border: 0px;
    padding: 2px;
    background-color: transparent;
    margin: 0px 5px;
}

.button-area {
    margin-top: 10px;
    border: 0px;
}

.message {
    margin: 0.25em;
    text-align: justify;
    text-justify: inter-word;
    padding: 0.4em;
}

.msg-container {
    border: 1px solid var(--b3-border-color);
    padding: 0.75em;
    margin: 0.5em;
    border-radius: var(--b3-border-radius);
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
</style>
