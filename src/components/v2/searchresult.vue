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
import MarkdownItStyle from "markdown-it-style";

const markdown = new MarkdownIt()
  .use(MarkdownItAbbr)
  .use(MarkdownItAnchor)
  .use(MarkdownItFootnote)
  .use(MarkdownItHighlightjs, { inline: true })
  .use(MarkdownItSub)
  .use(MarkdownItSup)
  .use(MarkdownItTasklists)
  .use(MarkdownItStyle, {
    'p': 'line-height: 1.6; margin: 0;',
    'ul': 'line-height: 1.6; margin: 0.5em 0;',
    'ol': 'line-height: 1.6; margin: 0.5em 0;',
    'h1': 'font-size: medium',
    'h2': 'font-size: medium',
    'h3': 'font-size: medium',
    'h4': 'font-size: medium'
  });

const searchResult = defineModel<any>("result");
const plugin: any = defineModel("plugin");

async function openBlock(blockId) {
  const url = "siyuan://blocks/";
  const blockExist = await checkBlockExist(blockId);
  if (!blockExist) {
    await pushMsg(plugin.i18n.blockNotFound);
    return;
  }
  //@ts-ignore
  window.openFileByURL(url + blockId);
}
</script>

<template>
  <div class="result-container">
    <div class="result-count" v-if="searchResult.length > 0">
      {{ searchResult.length }} results found
    </div>
    <div class="result-list" v-if="searchResult.length > 0">
      <div v-for="(result, index) in searchResult" :key="index" class="result-card">
        <div class="result-content">
          <div v-for="block in result.blocks" @click="openBlock(block.id)" class="block-content" :data-id="block.id"
            v-html="markdown.render(block.markdown)">
          </div>
        </div>
        <div class="result-meta">
          <span class="result-score">
            {{ plugin.i18n.similarity }}: {{ (result.score * 100).toFixed(1) }}%
          </span>
          <span class="result-type">
            {{ result.fts ? plugin.i18n.fts : plugin.i18n.ss }}
          </span>
        </div>
      </div>
    </div>
    <div v-else class="no-results">
      No results found
    </div>
  </div>
</template>

<style scoped>
.result-container {
  height: calc(100vh - 400px);
  overflow-y: auto;
  padding: 1rem 0rem;
}

.result-count {
  color: var(--b3-empty-color);
  font-size: 0.9em;
  margin: 10px 0;
  padding-left: 8px;
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.result-card {
  background: var(--b3-theme-background);
  border-radius: 8px;
  padding: 16px;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(122, 122, 122, 0.1);
}

.result-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.result-content {
  margin-bottom: 8px;
}

.block-content {
  cursor: pointer;
  color: var(--b3-theme-on-background);
  padding: 0rem 1rem;
  overflow-x: scroll;
}

.result-meta {
  display: flex;
  gap: 12px;
  font-size: 0.85em;
  color: var(--b3-empty-color);
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.result-score,
.result-type {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 12px;
  font-size: 0.85em;
}

.no-results {
  text-align: center;
  padding: 40px;
  color: #70757a;
  font-size: 1.1em;
}

.result-container::-webkit-scrollbar {
  width: 8px;
}

.result-container::-webkit-scrollbar-track {
  background: transparent;
}

.result-container::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

.result-container::-webkit-scrollbar-thumb:hover {
  background: #666;
}

@media (prefers-color-scheme: dark) {
  .result-card {
    background: var(--b3-theme-surface);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .result-meta {
    border-top-color: rgba(255, 255, 255, 0.1);
  }

  .result-score,
  .result-type {
    background: rgba(255, 255, 255, 0.1);
  }
}

</style>
