<script setup lang="ts">
import {
  initDb,
  getAllBlocksByNotebook,
  promptPersistPermission,
  dataPath,
  initDbV2,
  transformModelNamePathSafeStr,
} from "@/embedding";
import { createModel, createEmbedding } from "@/model";
import {
  lsNotebooks,
  getNotebookConf,
  pushMsg,
  pushErrMsg,
  readDir,
} from "@/api";
import { ref, onMounted } from "vue";
import Loading from "vue-loading-overlay";
import "vue-loading-overlay/dist/css/index.css";

const notebooks = ref([]);
const selectedNotebook = defineModel("selectedNotebook");
const localEmbeddingEnable = ref(false);
const plugin: any = defineModel("plugin");
const isLoading = ref(false);
const vectorizedDb = ref([]);
const embeddingUsedIn = ref("local");
const embeddingProvider = ref("");
const embeddingModel = ref("Xenova/all-MiniLM-L6-v2");
// async function enableDb() {
//   const pluginSetting = plugin.value.settingUtils.dump();
//   plugin.value.settingUtils.setAndSave(
//     "localEmbeddingEnable",
//     !pluginSetting.localEmbeddingEnable,
//   );
// }

async function setupVectorDb() {
  if (localEmbeddingEnable.value) {
    try {
      //plugin.value.settingUtils.setAndSave("localEmbeddingEnable", true);
      await promptPersistPermission();
      isLoading.value = true;
      await pushMsg(plugin.value.i18n.downloadOnnxRuntime);
      const model = await createModel();
      console.log("model created");
      await pushMsg(plugin.value.i18n.embeddingModelCreated);
      const _embeddings = await createEmbedding(model, "hello");
      // console.log("embeddings created", embeddings);
      await pushMsg(plugin.value.i18n.createdEmbeddingsSuccess);
      isLoading.value = false;
    } catch (err) {
      console.error(err);
      await pushErrMsg(plugin.value.i18n.unableToSetupVDB);
      await pushErrMsg(err.stack);
      isLoading.value = false;
    }
  } else {
    //plugin.value.settingUtils.setAndSave("localEmbeddingEnable", false);
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
      if (dir.filter((f) => f.name.includes(`${nb.id}-${modelSafePathName}`)).length > 0) {
        vectorizedDb.value.push(nb.name);
      }
    }
  } else {
    for (const nb of notebooks.notebooks) {
      if (dir.filter((f) => f.name.includes(nb.id)).length > 0) {
        vectorizedDb.value.push(nb.name);
      }
    }
  }
}
async function initVectorDb() {
  try {
    isLoading.value = true;
    let nbId = selectedNotebook.value;
    let nbs = [];
    if (nbId === "*") {
      nbs = notebooks.value;
    } else {
      const nb = await getNotebookConf(nbId as NotebookId);
      nbs.push({
        id: nb.box,
        name: nb.name,
      });
    }
    let nbDocs = [];
    let nbFlatList = [];
    let vectorList = [];
    for (const nb of nbs) {
      await pushMsg(`${plugin.value.i18n.getContentFromNotebook} [${nb.name}]`);
      const docs = await getAllBlocksByNotebook(nb.id, "/", 32);
      nbDocs.push({
        id: nb.id,
        name: nb.name,
        docs: docs,
      });
    }


    for (const nb of nbDocs) {
      await pushMsg(`${plugin.value.i18n.embeddedAndChunk} [${nb.name}]`);
      if (embeddingUsedIn.value === "local") {
        // create model, storing embeddings
        const embeddingModelName = plugin.value.settingUtils.settings.get("embedding.model");
        const model = await createModel(embeddingModelName);
        await initDb(nb.id, nb.name, nb.docs, model, plugin.value);
      } else if (embeddingUsedIn.value === "ai-provider") {
        console.log("using v2 embedding", embeddingModel.value);
        await initDbV2(nb.id, nb.name, nb.docs, embeddingModel.value, plugin.value);
      }
      console.log("notebook vector and md splitted db inited", nb.id, nb.name);
      await pushMsg(`${plugin.value.i18n.createdEmbeddingsSuccess} [${nb.name}]`);
    }

    await checkVectorizedDb();
    isLoading.value = false;
    selectedNotebook.value = "";
  } catch (err) {
    console.error(err);
    await pushErrMsg(err.stack);
    isLoading.value = false;
  }
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
  localEmbeddingEnable.value = pluginSetting.localEmbeddingEnable;
  await checkVectorizedDb();
  localEmbeddingEnable.value = await window.caches.has("transformers-cache");
  embeddingModel.value = plugin.value.settingUtils.settings.get("embedding.model") ?? "Xenova/all-MiniLM-L6-v2";
  embeddingUsedIn.value = plugin.value.settingUtils.settings.get("embedding.used_in") ?? "local";
  embeddingProvider.value = plugin.value.settingUtils.settings.get("embedding.provider") ?? "";
});
</script>

<template>
  <div class="vectordb-container">
    <loading 
      v-model:active="isLoading" 
      :can-cancel="false" 
      :on-cancel="loadingCancel" 
      loader="bars"
      background-color="var(--b3-theme-background)" 
      :opacity="0.25" 
      :is-full-page="false" 
    />

    <div class="vectordb-header">
      <div v-if="embeddingUsedIn === 'local'" class="model-section">
        <label class="model-toggle">
          <span class="toggle-label">{{ plugin.i18n.cacheModel }}</span>
          <input type="checkbox" class="b3-switch" @change="setupVectorDb" v-model="localEmbeddingEnable" />
        </label>
        <small class="hint-text">{{ plugin.i18n.cacheModelDesc }}</small>
      </div>

      <div class="model-info">
        <small class="model-description" v-if="embeddingUsedIn === 'local'">
          {{ plugin.i18n.localEmbeddingSuppDesc1 }} <b>{{ embeddingModel }}</b>{{ plugin.i18n.localEmbeddingSuppDesc2 }}
          <i>{{ plugin.i18n.localEmbeddingSuppDesc3 }}</i>
        </small>
        <small class="model-description" v-if="embeddingUsedIn === 'ai-provider'">
          {{ plugin.i18n.providerEmbeddingSuppDesc1 }} <b>{{ embeddingProvider }}/{{ embeddingModel }}</b>
          <br/>
          <i>{{ plugin.i18n.providerEmbeddingSuppDesc3 }}</i>
        </small>
      </div>

      <div class="notebook-section">
        <label class="search-label">{{ plugin.i18n.selectNotebook }}</label>
        <select class="b3-select modern-select" v-model="selectedNotebook">
          <option value="" disabled>{{ plugin.i18n.pleaseSelect }}</option>
          <option value="*">{{ plugin.i18n.allNotebook }}</option>
          <option v-for="nb in notebooks" :value="nb.id">{{ nb.name }}</option>
        </select>

        <div class="db-info">
          <div class="tags-wrapper">
            <span v-for="vdb of vectorizedDb" class="tag">{{ vdb }}</span>
          </div>
          <small class="hint-text">{{ plugin.i18n.createdEmbeddings }}</small>
        </div>

        <div class="notes-section">
          <small class="hint-text">{{ plugin.i18n.createEmbeddingsNote1 }}</small>
          <small class="hint-text">{{ plugin.i18n.createEmbeddingsNote2 }}</small>
          <small class="hint-text">{{ plugin.i18n.embeddingHint }}</small>
          <small v-if="selectedNotebook === '*'" class="hint-text">
            {{ plugin.i18n.createEmbeddingsNote3 }}
          </small>
        </div>

        <div v-if="selectedNotebook !== ''" class="action-section">
          <p class="alert-text">{{ plugin.i18n.embeddingAlert }}</p>
          <div class="button-group">
            <button @click="selectedNotebook = ''" class="b3-button button-cancel">
              {{ plugin.i18n.cancel }}
            </button>
            <button @click="initVectorDb" class="b3-button button-confirm">
              {{ plugin.i18n.confirm }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vectordb-container {
  height: 100%;
  padding: 0 1rem;
  background: var(--b3-theme-background);
  overflow-y: scroll;
}

.vectordb-header {
  padding: 1rem 0;
}

.model-section {
  margin-bottom: 1rem;
}

.model-toggle {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.toggle-label {
  color: var(--b3-theme-on-background);
  font-size: 0.9em;
}

.model-info {
  margin: 1rem 0;
}

.model-description {
  color: var(--b3-empty-color);
  font-size: 0.85em;
  line-height: 1.6;
  display: block;
  margin-bottom: 0.5rem;
}

.notebook-section {
  margin: 1.5rem 0;
}

.search-label {
  display: block;
  color: var(--b3-theme-on-background);
  font-size: 0.9em;
  margin-bottom: 0.5rem;
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
  margin: 1rem 0;
}

.tags-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
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
  display: block;
  margin-bottom: 0.5rem;
}

.notes-section {
  margin: 1rem 0;
}

.action-section {
  margin-top: 1.5rem;
}

.alert-text {
  color: var(--b3-theme-on-background);
  margin-bottom: 1rem;
}

.button-group {
  display: flex;
  gap: 0.5rem;
}

.button-confirm, .button-cancel {
  font-size: 0.9em;
  transition: all 0.2s ease;
}

.button-confirm {
  background-color: var(--b3-theme-primary);
  color: white;
}

.button-cancel {
  background-color: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  border: 1px solid var(--b3-border-color);
}

.button-confirm:hover, .button-cancel:hover {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
  .modern-select {
    background: var(--b3-theme-surface);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .modern-select:hover {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .modern-select:focus {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .button-cancel {
    background-color: var(--b3-theme-surface);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .button-confirm:hover, .button-cancel:hover {
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
}

/* Mobile-specific styles */
@media (max-width: 480px) {
  .action-section {
    margin-top: 1.5rem;
    position: absolute;
    bottom: 4%;
    font-size: 0.9rem;
  }

  .vectordb-container {
    height: 500px;
    padding: 0 1rem;
    background: var(--b3-theme-background);
    overflow-y: scroll;
    font-size: 0.85rem;
  }
}

/* Tablet-specific styles */
@media (min-width: 481px) and (max-width: 1024px) {

}
</style>