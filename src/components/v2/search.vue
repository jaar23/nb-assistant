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
  transformModelNamePathSafeStr,
} from "@/embedding";
import { ref, onMounted } from "vue";
import Loading from "vue-loading-overlay";
import "vue-loading-overlay/dist/css/index.css";
import { dataPath } from "@/embedding";
import searchresult from "@/components/v2/searchresult.vue";


const selectedNotebook = defineModel<string>("selectedNotebook");
const searchInput = defineModel<string>("searchInput");
const notebooks = ref([]);
const isLoading = ref(false);
const vectorizedDb = ref([]);
const dbEnable = ref(false);
const plugin = defineModel<any>("plugin");
const searchResult = ref([]);

//0.1.4

async function search(ev) {
  if (ev.key === "Enter" && !ev.shiftKey) {
    try {
      if (searchInput.value === "") {
        return;
      }
      isLoading.value = true;
      searchResult.value = await searchNotebook(
        selectedNotebook.value,
        searchInput.value,
        plugin.value
      );
      isLoading.value = false;
    } catch (err) {
      await pushErrMsg(err.stack);
      isLoading.value = false;
    }
  }
}

async function checkVectorizedDb() {
  const provider = plugin.value.settingUtils.settings.get("embedding.provider");
  const used_in = plugin.value.settingUtils.settings.get("embedding.used_in");
  const model = plugin.value.settingUtils.settings.get("embedding.model");
  const modelSafePathName = transformModelNamePathSafeStr(model);
  const dir: any = await readDir(dataPath);
  const notebooks = await lsNotebooks();
  vectorizedDb.value = [];
  if (used_in === "ai-provider" && ["ollama", "openai"].includes(provider)) {
    for (const nb of notebooks.notebooks) {
      if (dir.filter((f) => f.name.includes(`${nb.id}-${modelSafePathName}`)).length > 0 && !nb.closed) {
        vectorizedDb.value.push(nb.name);
      }
    }
  } else {
    for (const nb of notebooks.notebooks) {
      if (dir.filter((f) => f.name.includes(nb.id)).length > 0 && !nb.closed) {
        vectorizedDb.value.push(nb.name);
      }
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
    // @ts-ignore: plugin available i18n
    await pushMsg(plugin.i18n.blockNotFound);
    return;
  }
  // @ts-ignore: siyuan specific function
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
    <loading 
      v-model:active="isLoading" 
      :can-cancel="false" 
      :on-cancel="loadingCancel" 
      loader="bars"
      background-color="var(--b3-theme-background)" 
      :opacity="0.25" 
      :is-full-page="false" 
    />

    <div class="search-header">
      <div class="notebook-section">
        <label class="search-label">
          {{ plugin.i18n.searchNotebook }}
        </label>
        <select class="b3-select modern-select" v-model="selectedNotebook">
          <option value="" disabled>{{ plugin.i18n.pleaseSelect }}</option>
          <option 
            v-for="nb in notebooks" 
            :value="nb.id" 
            :disabled="disableSelection(nb.name)">
            {{ nb.name }}
          </option>
        </select>

        <div class="db-info">
          <div class="tags-wrapper">
            <span v-for="vdb of vectorizedDb" class="tag">{{ vdb }}</span>
          </div>
          <small class="hint-text">{{ plugin.i18n.createdEmbeddings }}</small>
        </div>
      </div>

      <div class="search-box-wrapper">
        <div class="search-box">
          <input 
            class="b3-text-field modern-input" 
            :disabled="selectedNotebook === ''" 
            @keypress="search" 
            v-model="searchInput"
            :placeholder="plugin.i18n.searchContent"
          />
          <div class="search-icon">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
          </div>
        </div>
      </div>
    </div>

    <searchresult 
      v-if="(searchResult || []).length > 0" 
      v-model:result="searchResult" 
      v-model:plugin="plugin"
    />
  </div>
</template>

<style scoped>
.search-container {
  height: 100%;
  padding: 0 1rem;
  background: var(--b3-theme-background);
}

.search-header {
  padding: 1rem 0rem 0rem 0rem;
}

.notebook-section {
  margin-bottom: 16px;
}

.search-label {
  display: block;
  color: var(--b3-theme-on-background);
  font-size: 0.9em;
  margin-bottom: 8px;
}

.modern-select {
  width: 100%;
  padding: 0rem 1rem;
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  transition: all 0.2s ease;
  margin-bottom: 12px;
}

.modern-select:hover {
  box-shadow: 0 1px 3px rgba(122, 122, 122, 0.1);
}

.modern-select:focus {
  border-color: var(--b3-theme-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  outline: none;
}

.db-info {
  margin: 12px 0;
}

.tags-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.tag {
  background-color: var(--b3-theme-primary);
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.85em;
  display: inline-flex;
  align-items: center;
  transition: all 0.2s ease;
}

.hint-text {
  color: var(--b3-empty-color);
  font-size: 0.85em;
}

.search-box-wrapper {
  margin: 16px 0;
}

.search-box {
  position: relative;
  width: 100%;
}

.modern-input {
  width: 100%;
  padding: 0.25rem 0.25rem 0.25rem 2.5rem;
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 1em;
  transition: all 0.2s ease;
}

.modern-input:hover {
  box-shadow: 0 1px 3px rgba(122, 122, 122, 0.1);
}

.modern-input:focus {
  border-color: var(--b3-theme-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  outline: none;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 55%;
  transform: translateY(-50%);
  color: var(--b3-empty-color);
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
  .modern-select,
  .modern-input {
    background: var(--b3-theme-surface);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .modern-select:hover,
  .modern-input:hover {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .modern-select:focus,
  .modern-input:focus {
    border-color: var(--b3-theme-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .tag {
    background-color: var(--b3-theme-primary);
  }
}

</style>