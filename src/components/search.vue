<script setup lang="ts">
import { lsNotebooks, getNotebookConf, pushMsg, pushErrMsg } from "@/api";
import { ref, onMounted } from "vue";
import Loading from "vue-loading-overlay";
import "vue-loading-overlay/dist/css/index.css";
import { queryMdChunk } from "@/embedding";

const selectedNotebook = defineModel("selectedNotebook");
const searchInput = defineModel("searchInput");
const notebooks = ref([]);
const isLoading = ref(false);
const vectorizedDb = ref([]);
const dbEnable = ref(false);
const plugin = defineModel("plugin");
const searchResult = ref([]);

async function search(ev) {
    let entered = false;
    if (ev.key === "Enter" && !ev.shiftKey) {
        entered = true;
    }
    if (!entered) return;
    try {
        isLoading.value = true;
        const notebookId = selectedNotebook.value;
        const chunkResult = await queryMdChunk(notebookId, searchInput.value);
        searchResult.value = chunkResult;
        console.log(chunkResult);
        // for (const chunk of chunkResult) {
        //     console.log(chunk.content);
        //
        // }
        isLoading.value = false;
    } catch (err) {
        await pushErrMsg(err);
        isLoading.value = false;
    }
}
async function checkVectorizedDb() {
    vectorizedDb.value = [];
    const databases = await window.indexedDB.databases();
    const notebooks = await lsNotebooks();
    for (const nb of notebooks.notebooks) {
        if (databases.filter((db) => db.name === nb.id).length > 0) {
            vectorizedDb.value.push(nb.name);
        }
    }
    console.log("vectorized db", vectorizedDb.value);
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
    <div class="search-container">
        <loading v-model:active="isLoading" :can-cancel="false" :on-cancel="loadingCancel" loader="bars"
            background-color="#eee" opacity="0.25" :is-full-page="false" />

        <div class="container-row">
            <label> Search Notebook </label>
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
        </div>

        <div class="container-row" style="height: 32px;">
            <input class="b3-text-field" :disabled="selectedNotebook === ''" @keypress="search" v-model="searchInput"
                placeholder="search for your document" />
        </div>
        <small v-if="searchResult.length > 0">
            Result found: {{ searchResult.length}}
        </small>

        <div class="result-row">
            <ul v-if="searchResult.length > 0">
                <li v-for="result in searchResult">
                    <div class="result-card">
                        {{ result.content }}
                    </div>
                </li>
            </ul>
        </div>
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
    height: 90px;
}

.result-row {
    overflow-x: hidden;
    overflow-y: auto;
    width: 95%;
    margin: 10px 0px;
    position: absolute;
    bottom: 5px;
    top: 215px;
}

small {
    color: #b9b9b9;
    padding: 0px 0.5em;
}

.result-row ul {
    list-style-type: none;
}

.result-card {
    border: 1px solid #eee;
    border-radius: 5px;
    min-height: 125px;
    padding: 1em;
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
}
</style>
