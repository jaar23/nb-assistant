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
const dbEnable = ref(false);
const plugin = defineModel("plugin");
const isLoading = ref(false);
const vectorizedDb = ref([]);

async function enableDb() {
  const pluginSetting = plugin.value.settingUtils.dump();
  plugin.value.settingUtils.setAndSave("dbEnable", !pluginSetting.dbEnable);
}

async function setupVectorDb() {
  if (dbEnable.value) {
    try {
      plugin.value.settingUtils.setAndSave("dbEnable", true);
      await promptPersistPermission();
      isLoading.value = true;
      await pushMsg("Downloading model from huggingface and setup onyxruntime");
      const model = await createModel();
      console.log("model created");
      await pushMsg("Embedding model is setup.");
      const embeddings = await createEmbedding(model, "hello");
      console.log("embeddings created", embeddings);
      await pushMsg("Successfully created embeddings");
      isLoading.value = false;
    } catch (err) {
      console.error(err);
      await pushErrMsg("unable to setup vectordb");
      await pushErrMsg(err);
      isLoading.value = false;
    }
  } else {
    plugin.value.settingUtils.setAndSave("dbEnable", false);
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
    // let nbDocs2 = [];
    for (const nb of nbs) {
      await pushMsg(`Getting content from notebook [${nb.name}]`);
      const docs = await getAllBlocksByNotebook(nb.id, "/", 32);
      nbDocs.push({
        id: nb.id,
        name: nb.name,
        docs: docs,
      });
      // const docs2 = await getAllDocsByNotebook(nb.id, "/", 128);
      // nbDocs2.push({
      //   id: nb.id,
      //   name: nb.name,
      //   docs: docs2
      // })
    }
    console.log("init db docs", nbDocs);
    // console.log("init db docs2", nbDocs2);

    // create model, storing embeddings
    const model = await createModel();
    
    for (const nb of nbDocs) {
      await pushMsg(
        `Creating embeddings and chunking for notebook [${nb.name}]`,
      );
      await initDb(nb.id, nb.name, nb.docs, model);
      console.log("notebook vector and md splitted db inited", nb.id, nb.name);
      await pushMsg(
        `Successfully created embeddings and chunking for notebook [${nb.name}]`,
      );
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

async function testFn1() {
  const nbdocs2 = await getAllDocsByNotebook(selectedNotebook.value, "/", 256);
  console.log("notebooks docs split", nbdocs2);

}

onMounted(async () => {
  const nbs = await lsNotebooks();
  notebooks.value = nbs.notebooks.filter(
    (nb) => !nb.name.includes("SiYuan User Guide"),
  );
  selectedNotebook.value = "";
  const pluginSetting = plugin.value.settingUtils.dump();
  dbEnable.value = pluginSetting.dbEnable;
  await checkVectorizedDb();
});
</script>
<template>
  <div class="vectordb-container">
    <loading v-model:active="isLoading" :can-cancel="false" :on-cancel="loadingCancel" loader="bars"
      background-color="#eee" opacity="0.25" :is-full-page="false" />

    <br />
    <div>
      <label style="display: inline-flex; width: 100%">
        <div class="switch">Enable Database</div>
        <input type="checkbox" class="b3-switch" @change="setupVectorDb" v-model="dbEnable" />
      </label>
      <small>
        Enable database will persist your notebook and document for nb-assistant
        to perform similarity search. This feature is required for RAG
        (Retrieval-Augmented Generation) using your own data. All the data is
        stored within SiYuan application (IndexedDb).
      </small>
    </div>
    <br />
    <div>
      <label> Select notebook to create embeddings </label>
      <select class="b3-select" v-model="selectedNotebook" placeholder="Select a notebook">
        <option value="" disabled>Please select</option>
        <option value="*">All notebooks</option>
        <option v-for="nb in notebooks" :value="nb.id">
          {{ nb.name }}
        </option>
      </select>
      <br />
      <span class="tag" v-for="vdb of vectorizedDb">{{ vdb }}</span> has created
      an embeddings copies.
      <br />
      <p>
        This action will be create embedding based on your notebook and
        documents, it will take approximately 1 - 10 minutes, depending on your
        machine performance and the data you have. While running this action, DO
        NOT close nb-assistant or exit SiYuan. After this process is done, you
        will be able to use the embedding created by this notebook for RAG.
      </p>
      <p>
        Embeddings created is not auto updated as it is an heavy task that may
        affect SiYuan's performance. Therefore, it will required user effort to
        select the notebook to create embedding and chunking. Select the same
        notebook will drop the existing copies and re-create with latest
        notebook contents.
      </p>
      <p v-if="selectedNotebook === '*'">
        Creating embeddings for all notebooks will take longer time, depending
        on your machine performance and notebook contents. Please be patient
        while waiting.
      </p>
      <div>
        <button v-if="selectedNotebook !== ''" @click="selectedNotebook = ''" class="b3-button button-cancel">
          Cancel
        </button>
        <button v-if="selectedNotebook !== ''" @click="initVectorDb" class="b3-button button-confirm">
          Confirm
        </button>
      </div>
      <div>
        <button @click="testFn1">get all docs by notebookId</button>
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
