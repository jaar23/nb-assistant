<script setup lang="ts">
import Chatbox from '@/components/v2/chatbox.vue';

const props = defineProps({ plugin: Object });

</script>

<template>
<div>
    <Chatbox v-model:plugin="props.plugin"/>
</div>
</template>

<style lang="css" scoped>

</style>