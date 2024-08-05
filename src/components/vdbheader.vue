<script setup lang="ts">
const emit = defineEmits(["onVectorDbView", "onSearchView"]);

function onVectorDbView() {
    emit("onVectorDbView");
}

function onSearchView() {
    emit("onSearchView", true);
}
</script>
<template>
    <div class="dropdown">
        <button class="b3-button dropdown-btn" @click="onVectorDbView">
            <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"
                width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M6 18 17.94 6M18 18 6.06 6" />
            </svg>
        </button>

        <button class="b3-button dropdown-btn" @click="onVectorDbView">
            <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"
                width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                <path
                    d="M12 7.205c4.418 0 8-1.165 8-2.602C20 3.165 16.418 2 12 2S4 3.165 4 4.603c0 1.437 3.582 2.602 8 2.602ZM12 22c4.963 0 8-1.686 8-2.603v-4.404c-.052.032-.112.06-.165.09a7.75 7.75 0 0 1-.745.387c-.193.088-.394.173-.6.253-.063.024-.124.05-.189.073a18.934 18.934 0 0 1-6.3.998c-2.135.027-4.26-.31-6.3-.998-.065-.024-.126-.05-.189-.073a10.143 10.143 0 0 1-.852-.373 7.75 7.75 0 0 1-.493-.267c-.053-.03-.113-.058-.165-.09v4.404C4 20.315 7.037 22 12 22Zm7.09-13.928a9.91 9.91 0 0 1-.6.253c-.063.025-.124.05-.189.074a18.935 18.935 0 0 1-6.3.998c-2.135.027-4.26-.31-6.3-.998-.065-.024-.126-.05-.189-.074a10.163 10.163 0 0 1-.852-.372 7.816 7.816 0 0 1-.493-.268c-.055-.03-.115-.058-.167-.09V12c0 .917 3.037 2.603 8 2.603s8-1.686 8-2.603V7.596c-.052.031-.112.059-.165.09a7.816 7.816 0 0 1-.745.386Z" />
            </svg>
        </button>
        <button class="b3-button dropdown-btn" @click="onSearchView">
            <svg class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"
                width="24" height="24" fill="none" viewBox="0 0 24 24">
                <path stroke="currentColor" stroke-linecap="round" stroke-width="2"
                    d="m21 21-3.5-3.5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
            </svg>
        </button>
    </div>
</template>
<style scoped>
.dropdown {
    z-index: 1;
}

.dropdown ul {
    list-style: none;
    padding-top: 35px;
}

.dropdown select {
    margin: 4px;
    max-width: 80%;
    float: right;
}

.dropdown button {
    float: right;
    margin: 0px 5px;
}

.dropdown-btn {
    background-color: var(--b3-empty-color) !important;
}

.input-container {
    width: 100%;
    height: 35px;
    margin-top: 45px;
    display: flex;
    flex-direction: row;
    padding: 1px;
}

input {
    flex-grow: 2;
}

.shortcut-container {
    min-width: 400px;
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

.dropdown-btn {
    float: right;
}
</style>
