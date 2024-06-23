<script setup lang="ts">
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
    msg: String
})

function copy() {
    console.log(props.msg + " copied...")
    window.navigator.clipboard.writeText(props.msg);
}

</script>

<template>
    <div class="msg-container">
        <div class="message" v-html="markdown.render(props.msg)">
        </div>
        <div class="button-area">
            <button @click="copy" class="button">
                <svg class="button-icon"><use xlink:href="#iconCopy"></use></svg>
            </button>
        </div>
    </div>
</template>

<style scoped>
.button-icon {
    width: 24px;
    height: 24px;
    border: 0px;
}

.button {
    width: 32px;
    height: 32px;
    border: 0px;
    padding: 2px;
    background-color: transparent;
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

</style>
