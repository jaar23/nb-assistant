<script setup lang="ts">
import {
  pushMsg,
  checkBlockExist,
} from "@/api";
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
  .use(MarkdownItHighlightjs, { inline: true })
  .use(MarkdownItSub)
  .use(MarkdownItSup)
  .use(MarkdownItTasklists);


const searchResult = defineModel("result");
const plugin: any = defineModel("plugin");

async function openBlock(blockId) {
  const url = "siyuan://blocks/";
  const blockExist = await checkBlockExist(blockId);
  if (!blockExist) {
    await pushMsg(plugin.i18n.blockNotFound);
    return;
  }
  window.openFileByURL(url + blockId);
}

</script>

<template>
    <div class="result-row" v-if="!isLoading">
      <ul v-if="searchResult.length > 0">
        <li v-for="(result, index) in searchResult">
          <div class="result-card" :key="index">
            <span @click="openBlock(block.id)" class="block" v-for="block in result.blocks" data-type="block-ref"
              data-subtype="d" :data-id="block.id" v-html="markdown.render(block.markdown)">
            </span>
            <small>{{ plugin.i18n.similarity }} {{ result.score }}</small>
            <small v-if="result.fts">{{ plugin.i18n.fts }}</small>
            <small v-if="!result.fts">{{ plugin.i18n.ss }}</small>
          </div>
        </li>
      </ul>
    </div>
</template>

<style scoped>
.result-row {
  overflow-x: hidden;
  overflow-y: auto;
  width: 95%;
  margin: 10px 0px;
  position: absolute;
  bottom: 5px;
  top: 225px;
}

small {
  color: #7e7e7e;
  padding: 0px 0.5em;
}

.result-row ul {
  list-style-type: none;
}

.result-card {
  border: 1px solid #353535;
  border-radius: 5px;
  min-height: 125px;
  padding: 1.25em;
  width: 90%;
  margin: 5px auto;
}

.block {
  cursor: pointer;
}
</style>
