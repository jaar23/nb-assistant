<script setup lang="ts">
const props = defineProps({
    msg: String,
    aiEmoji: String,
    actionType: String,
});

function copy() {
    console.log("action:", props.aiEmoji + " " + props.msg + " copied...");
    window.navigator.clipboard.writeText(
        `${props.aiEmoji !== undefined ? props.aiEmoji : ""} ${props.msg}`,
    );
}
</script>

<template>
    <div class="msg-container">
        <div class="message">{{props.msg}}</div>
        <div class="button-area">
            <button @click="copy" class="button">
                <svg class="button-icon">
                    <use xlink:href="#iconCopy"></use>
                </svg>
            </button>
        </div>
    </div>
</template>

<style scoped>
.button-icon {
    width: 16px;
    height: 16px;
    border: 0px;
}

.button {
    width: 24px;
    height: 24px;
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

.button:active {
    transform: scale(0.98);
    /* Scaling button to 0.98 to its original size */
    box-shadow: 3px 2px 22px 1px rgba(0, 0, 0, 0.24);
    /* Lowering the shadow */
}
</style>
