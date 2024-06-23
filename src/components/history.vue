<script setup lang="ts">
import message from "./message.vue"
const messages = defineModel<{question: string, answer: string}>()

</script>

<template>
    <ul>
        <li v-for="(msg, index) in messages">
            <message :msg="msg.answer"></message> 
        </li>
    </ul>
</template>

<style scoped>
ul {
    list-style-type: none;
    margin: 0;
    padding: 0;
    max-height: 75%;
    overflow: scroll;
}
</style>

