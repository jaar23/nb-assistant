<script setup lang="ts">
import {
  createVectorDb,
  getMemVectorDb,
  saveVector,
  queryVector,
  queryMemVector,
  loadVector,
  embedDoc,
  embedDocList,
  deleteVectorDb,
  createMDTextDb,
  deleteMDTextDb,
  getMDTextDbInstance,
  saveMDTextDb,
  closeMDTextDbInstance,
  initDb,
  queryMdChunk,
  getAllBlocksByNotebook,
  promptPersistPermission,
  dataPath,
} from "@/embedding";
import { createModel, createEmbedding } from "@/model";
import {
  lsNotebooks,
  getNotebookConf,
  pushMsg,
  pushErrMsg,
  readDir,
} from "@/api";
import { flat } from "@/utils";
import { ref, onMounted } from "vue";
import Loading from "vue-loading-overlay";
import "vue-loading-overlay/dist/css/index.css";

const notebooks = ref([]);
const selectedNotebook = defineModel("selectedNotebook");
const localEmbeddingEnable = ref(false);
const plugin = defineModel("plugin");
const isLoading = ref(false);
const vectorizedDb = ref([]);

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
      const embeddings = await createEmbedding(model, "hello");
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
  vectorizedDb.value = [];
  const dir = await readDir(dataPath);
  const notebooks = await lsNotebooks();
  for (const nb of notebooks.notebooks) {
    if (dir.filter((f) => f.name.includes(nb.id)).length > 0) {
      vectorizedDb.value.push(nb.name);
    }
  }
  console.log("vectorized db", vectorizedDb.value);
}

async function initVectorDb() {
  try {
    isLoading.value = true;
    let nbId = selectedNotebook.value;
    let nbs = [];
    if (nbId === "*") {
      nbs = notebooks.value;
    } else {
      const nb = await getNotebookConf(nbId);
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

    // create model, storing embeddings
    const model = await createModel();

    for (const nb of nbDocs) {
      await pushMsg(`${plugin.value.i18n.embeddedAndChunk} [${nb.name}]`);
      await initDb(nb.id, nb.name, nb.docs, model, plugin.value);
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
});
</script>
<template>
  <div class="vectordb-container">
    <loading v-model:active="isLoading" :can-cancel="false" :on-cancel="loadingCancel" loader="bars"
      background-color="#eee" :opacity="0.25" :is-full-page="false" />

    <br />
    <div>
      <label style="display: inline-flex; width: 100%">
        <div class="switch">{{ plugin.i18n.cacheModel}}</div>
        <input type="checkbox" class="b3-switch" @change="setupVectorDb" v-model="localEmbeddingEnable" />
      </label>
      <small>
        {{ plugin.i18n.cacheModelDesc}}
      </small>
    </div>
    <br />
    <div>
      <label> {{ plugin.i18n.selectNotebook }} </label>
      <select class="b3-select" v-model="selectedNotebook">
        <option value="" disabled>{{ plugin.i18n.pleaseSelect }}</option>
        <option value="*">{{ plugin.i18n.allNotebook }}</option>
        <option v-for="nb in notebooks" :value="nb.id">
          {{ nb.name }}
        </option>
      </select>
      <br />
      <span class="tag" v-for="vdb of vectorizedDb">{{ vdb }}</span>
      <small>{{ plugin.i18n.createdEmbeddings }}</small>
      <br />
      <small>{{ plugin.i18n.createEmbeddingsNote1 }}</small>
      <small>{{ plugin.i18n.createEmbeddingsNote2 }}</small>
      <small>{{ plugin.i18n.embeddingHint }}</small>
      <small v-if="selectedNotebook === '*'">
        {{ plugin.i18n.createEmbeddingsNote3 }}
      </small>
      <div>
        <p v-if="selectedNotebook !==''">{{ plugin.i18n.embeddingAlert }}</p>
        <button v-if="selectedNotebook !== ''" @click="selectedNotebook = ''" class="b3-button button-cancel">
          {{ plugin.i18n.cancel }}
        </button>
        <button v-if="selectedNotebook !== ''" @click="initVectorDb" class="b3-button button-confirm">
          {{ plugin.i18n.confirm }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vectordb-container {
  width: 100%;
  padding: 1em;
}

.vectordb-container select {
  width: 95%;
  margin: 5px;
}

.vectordb-container .switch {
  width: 85%;
}

.vectordb-container p {
  margin: 10px 0px;
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

/* .vectordb-container input { */
/*     width: 95%; */
/*     margin: 5px; */
/* } */

small {
  color: #b9b9b9;
  display: block;
}

.button-confirm {
  height: 26px;
  margin: 0.4em 0.5em;
  width: 90px;
}

.button-warning {
  height: 26px;
  margin: 0.4em 0.5em;
  background-color: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-secondary);
}

.button-cancel {
  background-color: var(--b3-theme-secondary);
  margin: 0.4em 0.5em;
  height: 26px;
  width: 90px;
}
</style>
