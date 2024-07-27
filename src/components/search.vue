<script setup lang="ts">
import {
  lsNotebooks,
  pushMsg,
  pushErrMsg,  
  checkBlockExist,
  readDir,
} from "@/api";
import {  
  searchNotebook,
} from "@/utils";
import { ref, onMounted } from "vue";
import Loading from "vue-loading-overlay";
import "vue-loading-overlay/dist/css/index.css";
import { dataPath } from "@/embedding";
import MarkdownIt from "markdown-it";
import MarkdownItAbbr from "markdown-it-abbr";
import MarkdownItAnchor from "markdown-it-anchor";
import MarkdownItFootnote from "markdown-it-footnote";
import MarkdownItHighlightjs from "markdown-it-highlightjs";
import MarkdownItSub from "markdown-it-sub";
import MarkdownItSup from "markdown-it-sup";
import MarkdownItTasklists from "markdown-it-task-lists";
import MarkdownItTOC from "markdown-it-toc-done-right";
import searchresult from "@/components/searchresult.vue";

const markdown = new MarkdownIt()
  .use(MarkdownItAbbr)
  .use(MarkdownItAnchor)
  .use(MarkdownItFootnote)
  .use(MarkdownItHighlightjs, { inline: true })
  .use(MarkdownItSub)
  .use(MarkdownItSup)
  .use(MarkdownItTasklists);

const selectedNotebook = defineModel("selectedNotebook");
const searchInput = defineModel("searchInput");
const notebooks = ref([]);
const isLoading = ref(false);
const vectorizedDb = ref([]);
const dbEnable = ref(false);
const plugin = defineModel("plugin");
const searchResult = ref([]);
const dir = ref([]);

async function search(ev) {
  if (ev.key === "Enter" && !ev.shiftKey) {
    try {
      isLoading.value = true;
      searchResult.value = await searchNotebook(
        selectedNotebook.value,
        searchInput.value,
      );
      isLoading.value = false;
    } catch (err) {
      await pushErrMsg(err.stack);
      isLoading.value = false;
    }
  }
}

async function checkVectorizedDb() {
  vectorizedDb.value = [];
  const dir = await readDir(dataPath);
  const notebooks = await lsNotebooks();
  for (const nb of notebooks.notebooks) {
    if (dir.filter((f) => f.name.includes(nb.id)).length > 0) {
      vectorizedDb.value.push(nb.name);
    }
  }
}

function disableSelection(nbName: string) {
  return vectorizedDb.value.filter((x) => x === nbName).length === 0;
}

async function openBlock(blockId) {
  const url = "siyuan://blocks/";
  const blockExist = await checkBlockExist(blockId);
  if (!blockExist) {
    await pushMsg(plugin.i18n.blockNotFound);
    return;
  }
  window.openFileByURL(url + blockId);
}

function loadingCancel() {
  isLoading.value = false;
}

onMounted(async () => {
  const nbs = await lsNotebooks();
  notebooks.value = nbs.notebooks.filter(
    (nb) =>
      !nb.name.includes("SiYuan User Guide") &&
      !nb.name.includes("思源笔记用户指南"),
  );
  selectedNotebook.value = "";
  const pluginSetting = plugin.value.settingUtils.dump();
  dbEnable.value = pluginSetting.dbEnable;
  await checkVectorizedDb();
});
</script>

<template>
  <div class="search-container">
    <loading v-model:active="isLoading" :can-cancel="false" :on-cancel="loadingCancel" loader="bars"
      background-color="#eee" :opacity="0.25" :is-full-page="false" />

    <div class="container-row">
      <label :title="plugin.i18n.searchNote"> {{ plugin.i18n.searchNotebook }} </label>
      <select class="b3-select" v-model="selectedNotebook" placeholder="Select a notebook">
        <option value="" disabled>{{ plugin.i18n.pleaseSelect }}</option>
        <option value="*">{{ plugin.i18n.allNotebook }}</option>
        <option v-for="nb in notebooks" :value="nb.id" :disabled="disableSelection(nb.name)">
          {{ nb.name }}
        </option>
      </select>
      <br />
      <span class="tag" v-for="vdb of vectorizedDb">{{ vdb }}</span>
      <small>{{ plugin.i18n.createdEmbeddings }}</small>
    </div>

    <div class="container-row" style="height: 32px">
      <input class="b3-text-field" :disabled="selectedNotebook === ''" @keypress="search" v-model="searchInput"
        :placeholder="plugin.i18n.searchContent" />
    </div>
    <small v-if="searchResult.length > 0">
      {{ plugin.i18n.resultFound }}: {{ searchResult.length }}
    </small>
    <searchresult v-model:result="searchResult" v-model:plugin="plugin"/>

    <!-- <div class="result-row" v-if="!isLoading"> -->
    <!--   <ul v-if="searchResult.length > 0"> -->
    <!--     <li v-for="(result, index) in searchResult"> -->
    <!--       <div clss="result-card" :key="index"> -->
    <!--         <span @click="openBlock(block.id)" class="block" v-for="block in result.blocks" data-type="block-ref" -->
    <!--           data-subtype="d" :data-id="block.id" v-html="markdown.render(block.markdown)"> -->
    <!--         </span> -->
    <!--         <small>{{ plugin.i18n.similarity }} {{ result.score }}</small> -->
    <!--         <small v-if="result.fts">{{ plugin.i18n.fts }}</small> -->
    <!--         <small v-if="!result.fts">{{ plugin.i18n.ss }}</small> -->
    <!--       </div> -->
    <!--     </li> -->
    <!--   </ul> -->
    <!-- </div> -->
  </div>
</template>

<style scoped>
.search-container {
  width: 100%;
  padding: 1em;
}

.search-container select {
  width: 95%;
  margin: 5px;
}

.search-container input {
  width: 95%;
  margin: 5px;
}

.container-row {
  margin: 10px 0px;
  height: 95px;
}

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

.tag {
  background-color: var(--b3-theme-success);
  padding: 0.25em;
  color: #fefefe;
  margin: 2px;
  display: inline;
  border-radius: 8px;
  line-height: 2.5;
}

</style>
