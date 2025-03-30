<script setup lang="ts">
import { lsNotebooks } from '@/api';
import { onMounted, onUnmounted, ref } from 'vue';
import { AIWrapper } from '@/orchestrator/ai-wrapper';
import Loading from "vue-loading-overlay";
import { getFrontend } from 'siyuan';

const plugin: any = defineModel<any>("plugin");

const sections = ref([
    { id: 'general', name: 'General', visible: true },
    { id: 'claude', name: 'Claude', visible: false },
    { id: 'deepseek', name: 'DeepSeek', visible: false },
    { id: 'ollama', name: 'Ollama', visible: false },
    { id: 'openai', name: 'OpenAI', visible: false },
    { id: 'embedding', name: 'Embedding', visible: false }
]);

const isLoading = ref(false);
const enterToSend = ref(true);
const aiEmoji = ref("aiEmoji");
const truncateHistory = ref(7);
const selectedNotebook = ref("-");
const nbOptions = ref([]);
const embedOpts = ref([{ label: plugin.value.i18n.aiLocalEmbedding, value: "local" }, { label: plugin.value.i18n.aiAiproviderEmbedding, value: "ai-provider" }]);
const embeddingModels = ref([
    { label: 'Xenova/all-MiniLM-L6-v2', value: 'Xenova/all-MiniLM-L6-v2', provider: 'xenova', used_in: 'local', exists: true },
    { label: 'Xenova/all-MiniLM-L12-v2', value: 'Xenova/all-MiniLM-L12-v2', provider: 'xenova', used_in: 'local', exists: true },
    { label: 'Xenova/all-mpnet-base-v2', value: 'Xenova/all-mpnet-base-v2', provider: 'xenova', used_in: 'local', exists: true },
    { label: 'Supabase/gte-small', value: 'Supabase/gte-small', provider: 'xenova', used_in: 'local', exists: true },
    { label: 'Xenova/gte-base', value: 'Xenova/gte-base', provider: 'xenova', used_in: 'local', exists: true },
    { label: 'Xenova/e5-base-v2', value: 'Xenova/e5-base-v2', provider: 'xenova', used_in: 'local', exists: true },
    { label: 'ollama/nomic-embed-text', value: 'ollama/nomic-embed-text', provider: 'ollama', used_in: 'ai-provider', exists: false },
    { label: 'ollama/mxbai-embed-large', value: 'ollama/mxbai-embed-large', provider: 'ollama', used_in: 'ai-provider', exists: false },
    { label: 'ollama/all-minilm:22m', value: 'ollama/all-minilm:22m', provider: 'ollama', used_in: 'ai-provider', exists: false },
    { label: 'ollama/all-minilm:33m', value: 'ollama/all-minilm:33m', provider: 'ollama', used_in: 'ai-provider', exists: false },
    { label: 'ollama/bge-m3:567m', value: 'ollama/bge-m3:567m', provider: 'ollama', used_in: 'ai-provider', exists: false },
    { label: 'ollama/bge-m3', value: 'ollama/bge-m3', provider: 'ollama', used_in: 'ai-provider', exists: false },
    { label: 'ollama/bge-large:335m', value: 'ollama/bge-large:335m', provider: 'ollama', used_in: 'ai-provider', exists: false },
    { label: 'ollama/bge-large', value: 'ollama/bge-large', provider: 'ollama', used_in: 'ai-provider', exists: false },
    { label: 'ollama/snowflake-artic-embed:22m', value: 'ollama/snowflake-artic-embed:22m', provider: 'ollama', used_in: 'ai-provider', exists: false },
    { label: 'ollama/snowflake-artic-embed:33m', value: 'ollama/snowflake-artic-embed:33m', provider: 'ollama', used_in: 'ai-provider', exists: false },
    { label: 'ollama/snowflake-artic-embed:110m', value: 'ollama/snowflake-artic-embed:110m', provider: 'ollama', used_in: 'ai-provider', exists: false },
    { label: 'ollama/snowflake-artic-embed:137m', value: 'ollama/snowflake-artic-embed:137m', provider: 'ollama', used_in: 'ai-provider', exists: false },
    { label: 'ollama/snowflake-artic-embed:335m', value: 'ollama/snowflake-artic-embed:335m', provider: 'ollama', used_in: 'ai-provider', exists: false },    
    { label: 'ollama/snowflake-artic-embed2', value: 'ollama/snowflake-artic-embed2', provider: 'ollama', used_in: 'ai-provider', exists: false },
    { label: 'ollama/snowflake-artic-embed2:568m', value: 'ollama/snowflake-artic-embed2:568m', provider: 'ollama', used_in: 'ai-provider', exists: false },
    { label: 'ollama/paraphrase-multilingual', value: 'ollama/paraphrase-multilingual', provider: 'ollama', used_in: 'ai-provider', exists: false },
    { label: 'ollama/paraphrase-multilingual:278m', value: 'ollama/paraphrase-multilingual:278m', provider: 'ollama', used_in: 'ai-provider', exists: false },
    { label: 'ollama/granite-embedding:30m', value: 'ollama/granite-embedding:30m', provider: 'ollama', used_in: 'ai-provider', exists: false },
    { label: 'ollama/granite-embedding:278m', value: 'ollama/granite-embedding:278m', provider: 'ollama', used_in: 'ai-provider', exists: false },
    { label: 'openai/text-embedding-3-small', value: 'openai/text-embedding-3-small', provider: 'openai', used_in: 'ai-provider', exists: false },
    { label: 'openai/text-embedding-3-large', value: 'openai/text-embedding-3-large', provider: 'openai', used_in: 'ai-provider', exists: false },
    { label: 'openai/text-embedding-ada-002', value: 'openai/text-embedding-ada-002', provider: 'openai', used_in: 'ai-provider', exists: false },
]);


// claude ai
const claudeSettings = ref({
    customSystemPrompt: '',
    customUserPrompt: '',
    model: '',
    apiKey: '',
    url: 'https://api.anthropic.com',
    max_tokens: 2048,
    temperature: 0,
    top_p: 1.0,
    top_k: 40,
    stop: ""
});

const deepseekSettings = ref({
    customSystemPrompt: '',
    customUserPrompt: '',
    model: '',
    apiKey: '',
    url: 'https://api.deepseek.com',
    max_tokens: 2048,
    temperature: 0,
    top_p: 1.0,
    presence_penalty: 0.5,
    stop: ""
});

const ollamaSettings = ref({
    customSystemPrompt: '',
    customUserPrompt: '',
    model: '',
    apiKey: '',
    url: 'http://localhost:11434',
    max_tokens: 2048,
    temperature: 0,
    top_p: 1.0,
    top_k: 40,
    presence_penalty: 0.5,
    frequency_penalty: 0.5,
    stop: ""
});

const openaiSettings = ref({
    customSystemPrompt: '',
    customUserPrompt: '',
    model: '',
    apiKey: '',
    url: 'https://api.openai.com',
    max_tokens: 2048,
    temperature: 0,
    top_p: 1.0,
    presence_penalty: 0.5,
    stop: ""
});

const embeddingSettings = ref({
    used_in: '',
    provider: '',
    model: ''
})

const claudeModels = ref([]);
const deepseekModels = ref([]);
const ollamaModels = ref([]);
const openaiModels = ref([]);

async function listModels(aiProvider: string) {
    switch (aiProvider) {
        case "claude":
            if (claudeModels.value.length > 0) {
                return;
            }
            const claude = new AIWrapper("claude", {
                apiKey: claudeSettings.value.apiKey
            });
            console.log("list claude models");
            const list1 = await claude.listModels({});
            console.log("list", list1);
            for (const m of list1.models) {
                claudeModels.value.push({ value: m.id, label: m.name });
            }
            break;
        case "deepseek":
            if (deepseekModels.value.length > 0) {
                return;
            }
            const deepseek = new AIWrapper("deepseek", {
                apiKey: deepseekSettings.value.apiKey
            });
            console.log("list deepseek models");
            const list2 = await deepseek.listModels({});
            console.log("list", list2);
            for (const m of list2.models) {
                deepseekModels.value.push({ value: m.id, label: m.name });
            }
            break;
        case "ollama":
            if (ollamaModels.value.length > 0) {
                return;
            }
            const ollama = new AIWrapper("ollama", {
                apiKey: "",
                baseUrl: ollamaSettings.value.url
            });
            if (! await ollama.locallyInstalled({})) return;
            console.log("list ollma models");
            const list3 = await ollama.listModels({});
            console.log("list", list3);
            for (const m of list3.models) {
                ollamaModels.value.push({ value: m.id, label: m.name });
            }
            break;
        case "openai":
            if (openaiModels.value.length > 0) {
                return;
            }
            const openai = new AIWrapper("openai", {
                apiKey: openaiSettings.value.apiKey
            });
            console.log("list openai models");
            const list4 = await openai.listModels({});
            console.log("list", list4);
            for (const m of list4.models) {
                openaiModels.value.push({ value: m.id, label: m.name });
            }
            break;
        default:
            throw new Error("unrecognize ai provider");
    }
}

async function saveSetting() {
    plugin.value.settingUtils.settings.set("chatSaveNotebook", selectedNotebook.value);
    plugin.value.settingUtils.settings.set("aiEmoji", aiEmoji.value);
    plugin.value.settingUtils.settings.set("enterToSend", enterToSend.value);
    plugin.value.settingUtils.settings.set("chatHistoryTruncate", truncateHistory.value);
    console.log("update setting");
    await plugin.value.settingUtils.save();
    console.log("setting updated");
}

async function saveClaudeSetting(key: string, value: any) {
    plugin.value.settingUtils.settings.set(`claude.${key}`, value);
    await plugin.value.settingUtils.save();
}

async function saveDeepseekSetting(key: string, value: any) {
    plugin.value.settingUtils.settings.set(`deepseek.${key}`, value);
    await plugin.value.settingUtils.save();
}

async function saveOllamaSetting(key: string, value: any) {
    plugin.value.settingUtils.settings.set(`ollama.${key}`, value);
    await plugin.value.settingUtils.save();
}

async function saveOpenAISetting(key: string, value: any) {
    plugin.value.settingUtils.settings.set(`openai.${key}`, value);
    await plugin.value.settingUtils.save();
}

async function saveEmbeddingSetting(key: string, value: any) {
    if (value.includes("|")) {
        const embeddingOption = value.split("|");
        plugin.value.settingUtils.settings.set(`embedding.used_in`, embeddingOption[0]);
        plugin.value.settingUtils.settings.set(`embedding.provider`, embeddingOption[1]);
        let model = embeddingOption[2];
        model = model.replace(`${embeddingOption[1]}/`, "");
        plugin.value.settingUtils.settings.set(`embedding.model`, model);
    } else {
        plugin.value.settingUtils.settings.set(`embedding.${key}`, value);
    }
    await plugin.value.settingUtils.save();
    embeddingSettings.value.used_in = plugin.value.settingUtils.settings.get("embedding.used_in") || "local";
    embeddingSettings.value.provider = plugin.value.settingUtils.settings.get("embedding.provider") || "";
    if (embeddingSettings.value.used_in === "local") {
        embeddingSettings.value.model = `${embeddingSettings.value.used_in}|${embeddingSettings.value.provider}|${plugin.value.settingUtils.settings.get("embedding.model")}` || "";
    } else {
        embeddingSettings.value.model = `${embeddingSettings.value.used_in}|${embeddingSettings.value.provider}|${embeddingSettings.value.provider}/${plugin.value.settingUtils.settings.get("embedding.model")}` || "";
    }
    await embeddingModelChange();
    loadingCancel();
}

async function embeddingModelChange() {
    try {
        isLoading.value = true;
        if (openaiSettings.value.apiKey !== "" && openaiModels.value.length === 0
            && embeddingSettings.value.used_in !== "local") {
            await listModels("openai");
        }
        if (ollamaSettings.value.url !== "" && ollamaModels.value.length === 0
            && embeddingSettings.value.used_in !== "local") {
            const ollama = new AIWrapper("ollama", {
                apiKey: "",
                baseUrl: ollamaSettings.value.url
            });
            const isInstalled = await ollama.locallyInstalled({});
            if (isInstalled) {
                await listModels("ollama");
            }
        }

        embeddingModels.value.forEach(m => {
            if (embeddingSettings.value.used_in === "local") {
                if (m.used_in !== "local") {
                    m.exists = false;
                } else {
                    m.exists = true;
                }
            } else {
                if (m.used_in === "local") {
                    m.exists = false;
                }
                const matches = openaiModels.value.find(m2 => `openai/${m2.value}` === m.value);
                if (matches) {
                    m.exists = true;
                }
                const matches2 = ollamaModels.value.find(m2 => `ollama/${m2.value}`.includes(m.value));
                if (matches2) {
                    m.exists = true;
                }
            }
        });
    } catch (e) {
        console.error(e);
        isLoading.value = false;
    } finally {
        isLoading.value = false;
    }
}

async function showPanel(id: string) {
    sections.value.find(sec => sec.id === id).visible = true;
    sections.value.filter(sec => sec.id !== id).map(sec => sec.visible = false);
    if (["claude", "deepseek", "ollama", "openai"].includes(id)) {
        try {
            isLoading.value = true;
            await listModels(id);
        } catch (e) {
            isLoading.value = false;
        } finally {
            isLoading.value = false;
        }
    }
    if (id === "embedding") {
        await embeddingModelChange();
    }
}

function loadingCancel() {
    isLoading.value = false;
}

onMounted(async () => {
    isLoading.value = true;
    await plugin.value.settingUtils.load();
    if (!plugin.value.settingUtils.settings.get("aiEmoji")) {
        await plugin.value.settingUtils.settings.set("aiEmoji", "[AI]");
    }
    aiEmoji.value = plugin.value.settingUtils.settings.get("aiEmoji");

    const notebooks = await lsNotebooks();
    nbOptions.value = [{ value: "-", label: plugin.value.i18n.pleaseSelect }];
    for (const nb of notebooks.notebooks) {
        nbOptions.value.push({ label: nb.name, value: nb.id });
    }

    if (!plugin.value.settingUtils.settings.get("chatSaveNotebook")) {
        await plugin.value.settingUtils.settings.set("chatSaveNotebook", "-");
    }
    selectedNotebook.value = plugin.value.settingUtils.settings.get("chatSaveNotebook");

    if (!plugin.value.settingUtils.settings.get("enterToSend")) {
        await plugin.value.settingUtils.settings.set("enterToSend", true);
    }
    enterToSend.value = plugin.value.settingUtils.settings.get("enterToSend");

    if (!plugin.value.settingUtils.settings.get("chatHistoryTruncate")) {
        await plugin.value.settingUtils.settings.set("chatHistoryTruncate", 7);
    }
    truncateHistory.value = plugin.value.settingUtils.settings.get("chatHistoryTruncate");

    claudeSettings.value.customSystemPrompt = plugin.value.settingUtils.settings.get("claude.customSystemPrompt") || '';
    claudeSettings.value.customUserPrompt = plugin.value.settingUtils.settings.get("claude.customUserPrompt") || '';
    claudeSettings.value.model = plugin.value.settingUtils.settings.get("claude.model") || 'claude-3-5-haiku-20241022';
    claudeSettings.value.apiKey = plugin.value.settingUtils.settings.get("claude.apiKey") || '';
    claudeSettings.value.url = plugin.value.settingUtils.settings.get("claude.url") || 'https://api.anthropic.com';
    claudeSettings.value.max_tokens = plugin.value.settingUtils.settings.get("claude.max_tokens") || 2048;
    claudeSettings.value.temperature = plugin.value.settingUtils.settings.get("claude.temperature") || 0;
    claudeSettings.value.top_k = plugin.value.settingUtils.settings.get("claude.top_k") || 40;
    claudeSettings.value.top_p = plugin.value.settingUtils.settings.get("claude.top_p") || 0.5;
    claudeSettings.value.stop = plugin.value.settingUtils.settings.get("claude.stop") || "";


    deepseekSettings.value.customSystemPrompt = plugin.value.settingUtils.settings.get("deepseek.customSystemPrompt") || '';
    deepseekSettings.value.customUserPrompt = plugin.value.settingUtils.settings.get("deepseek.customUserPrompt") || '';
    deepseekSettings.value.model = plugin.value.settingUtils.settings.get("deepseek.model") || '';
    deepseekSettings.value.apiKey = plugin.value.settingUtils.settings.get("deepseek.apiKey") || '';
    deepseekSettings.value.url = plugin.value.settingUtils.settings.get("deepseek.url") || 'https://api.deepseek.com';
    deepseekSettings.value.max_tokens = plugin.value.settingUtils.settings.get("deepseek.max_tokens") || 2048;
    deepseekSettings.value.temperature = plugin.value.settingUtils.settings.get("deepseek.temperature") || 0;
    deepseekSettings.value.top_p = plugin.value.settingUtils.settings.get("deepseek.top_p") || 0.5;
    deepseekSettings.value.presence_penalty = plugin.value.settingUtils.settings.get("deepseek.presence_penalty") || 0.5;
    deepseekSettings.value.stop = plugin.value.settingUtils.settings.get("deepseek.stop") || "";


    ollamaSettings.value.customSystemPrompt = plugin.value.settingUtils.settings.get("ollama.customSystemPrompt") || '';
    ollamaSettings.value.customUserPrompt = plugin.value.settingUtils.settings.get("ollama.customUserPrompt") || '';
    ollamaSettings.value.model = plugin.value.settingUtils.settings.get("ollama.model") || '';
    ollamaSettings.value.apiKey = plugin.value.settingUtils.settings.get("ollama.apiKey") || '';
    ollamaSettings.value.url = plugin.value.settingUtils.settings.get("ollama.url") || 'http://localhost:11434';
    ollamaSettings.value.max_tokens = plugin.value.settingUtils.settings.get("ollama.max_tokens") || 2048;
    ollamaSettings.value.temperature = plugin.value.settingUtils.settings.get("ollama.temperature") || 0;
    ollamaSettings.value.top_k = plugin.value.settingUtils.settings.get("ollama.top_k") || 40;
    ollamaSettings.value.top_p = plugin.value.settingUtils.settings.get("ollama.top_p") || 0.5;
    ollamaSettings.value.presence_penalty = plugin.value.settingUtils.settings.get("ollama.presence_penalty") || 0.5;
    ollamaSettings.value.frequency_penalty = plugin.value.settingUtils.settings.get("ollama.frequency_penalty") || 0.5;
    ollamaSettings.value.stop = plugin.value.settingUtils.settings.get("ollama.stop") || "";

    openaiSettings.value.customSystemPrompt = plugin.value.settingUtils.settings.get("openai.customSystemPrompt") || '';
    openaiSettings.value.customUserPrompt = plugin.value.settingUtils.settings.get("openai.customUserPrompt") || '';
    openaiSettings.value.model = plugin.value.settingUtils.settings.get("openai.model") || '';
    openaiSettings.value.apiKey = plugin.value.settingUtils.settings.get("openai.apiKey") || '';
    openaiSettings.value.url = plugin.value.settingUtils.settings.get("openai.url") || 'https://api.openai.com';
    openaiSettings.value.max_tokens = plugin.value.settingUtils.settings.get("openai.max_tokens") || 2048;
    openaiSettings.value.temperature = plugin.value.settingUtils.settings.get("openai.temperature") || 0;
    openaiSettings.value.top_p = plugin.value.settingUtils.settings.get("openai.top_p") || 0.5;
    openaiSettings.value.presence_penalty = plugin.value.settingUtils.settings.get("openai.presence_penalty") || 0.5;
    openaiSettings.value.stop = plugin.value.settingUtils.settings.get("openai.stop") || "";

    embeddingSettings.value.used_in = plugin.value.settingUtils.settings.get("embedding.used_in") || "";
    embeddingSettings.value.provider = plugin.value.settingUtils.settings.get("embedding.provider") || "";
    if (embeddingSettings.value.used_in === "local") {
        embeddingSettings.value.model = `${embeddingSettings.value.used_in}|${embeddingSettings.value.provider}|${plugin.value.settingUtils.settings.get("embedding.model")}` || "";
    } else {
        embeddingSettings.value.model = `${embeddingSettings.value.used_in}|${embeddingSettings.value.provider}|${embeddingSettings.value.provider}/${plugin.value.settingUtils.settings.get("embedding.model")}` || "";
    }
    isLoading.value = false;

    const frontEnd = getFrontend();
    const isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
    if (isMobile) {
        sections.value = sections.value.map(s => {
            if (s.id === 'ollama') {
                s.visible = false;
            }
            return s;
        });
    }
})

onUnmounted(async () => {
    await saveSetting();
})
</script>

<template>
    <div class="settings-container">
        <loading v-model:active="isLoading" :can-cancel="false" :on-cancel="loadingCancel" loader="bars"
            background-color="#eee" :opacity="0.25" :is-full-page="false" />
        <div class="settings-sidebar">
            <nav class="sidebar-nav">
                <ul>
                    <li v-for="section in sections" :key="section.id" @click="showPanel(section.id)"
                        :class="sections.find(sec => sec.id === section.id).visible ? 'active-panel' : ''">
                        <span
                            :class="sections.find(sec => sec.id === section.id).visible ? 'active-provider' : ''">
                            {{ section.name }}
                        </span>
                    </li>
                </ul>
            </nav>
        </div>
        <div v-if="sections.find(sec => sec.id === 'general').visible">
            <div class="settings-content">
                <div class="settings-group">
                    <div class="setting-item">
                        <div class="setting-header">
                            <span>{{ plugin.i18n.enterToSend }}</span>
                            <div class="form-item">
                                <input type="checkbox" class="enter2send" v-model="enterToSend" @change="saveSetting"
                                    @focusout="saveSetting">
                            </div>
                        </div>
                        <p class="setting-description">{{ plugin.i18n.enterToSendDesc }}</p>
                    </div>

                    <div class="setting-item">
                        <div class="setting-header">
                            <span>{{ plugin.i18n.aiEmoji }}</span>
                            <div class="form-item">
                                <input type="text" class="emoji-input" v-model="aiEmoji" @focusout="saveSetting">
                            </div>
                        </div>
                        <p class="setting-description">{{ plugin.i18n.aiEmojiDesc }}</p>
                    </div>

                    <div class="setting-item">
                        <div class="setting-header">
                            <span>{{ plugin.i18n.saveChatTitle }}</span>
                            <div class="form-item">
                                <select v-model="selectedNotebook" class="notebook-select" @change="saveSetting">
                                    <option v-for="nbopt in nbOptions" :key="nbopt.value" :value="nbopt.value">
                                        {{ nbopt.label }}
                                    </option>
                                </select>
                            </div>
                        </div>
                        <p class="setting-description">{{ plugin.i18n.saveChatDesc }}</p>
                    </div>

                    <div class="setting-item">
                        <div class="setting-header">
                            <span>{{ plugin.i18n.truncateHistory }}</span>
                            <div class="form-item">
                                <input type="number" class="emoji-input" v-model="truncateHistory" @focusout="saveSetting">
                            </div>
                        </div>
                        <p class="setting-description">{{ plugin.i18n.truncateHistoryDesc }}</p>
                    </div>
                </div>
            </div>
        </div>
        <div v-if="sections.find(sec => sec.id === 'claude').visible" class="settings-content">
            <div class="settings-group">
                <div class="setting-item">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleApiKey }}</span>
                        <div class="form-item">
                            <input type="password" v-model="claudeSettings.apiKey"
                                @change="listModels('claude'); saveClaudeSetting('apiKey', claudeSettings.apiKey)"
                                class="provider-input" placeholder="Enter your Claude API key">
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiApiKey }}</p>
                </div>

                <div class="setting-item">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleApiUrl }}</span>
                        <div class="form-item">
                            <input type="text" v-model="claudeSettings.url"
                                placeholder="Do not change if you are using Claude provide by Anthropic"
                                @change="listModels('claude'); saveClaudeSetting('url', claudeSettings.url)"
                                class="provider-input">
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiApiUrl }}</p>
                </div>

                <div class="setting-item" v-if="claudeSettings.apiKey !== '' && claudeModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleModel }}</span>
                        <div class="form-item">
                            <select v-model="claudeSettings.model" class="provider-select"
                                @change="saveClaudeSetting('model', claudeSettings.model)">
                                <option v-for="model in claudeModels" :key="model.value" :value="model.value">
                                    {{ model.label }}
                                </option>
                            </select>
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiModel }}</p>
                </div>

                <div class="setting-item" v-if="claudeModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleCustomSystemPrompt }}</span>
                        <div class="form-item">
                            <textarea v-model="claudeSettings.customSystemPrompt"
                                @change="saveClaudeSetting('customSystemPrompt', claudeSettings.customSystemPrompt)"
                                class="provider-textarea" placeholder="Enter custom system prompt"></textarea>
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiCustomSystemPrompt }}</p>
                </div>

                <div class="setting-item" v-if="claudeModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleCustomUserPrompt }}</span>
                        <div class="form-item">
                            <textarea v-model="claudeSettings.customUserPrompt"
                                @change="saveClaudeSetting('customUserPrompt', claudeSettings.customUserPrompt)"
                                class="provider-textarea" placeholder="Enter custom user prompt"></textarea>
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiCustomUserPrompt }}</p>
                </div>

                <div class="setting-item" v-if="claudeModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleMaxTokens }}</span>
                        <div class="form-item">
                            <input type="number" v-model="claudeSettings.max_tokens"
                                @change="saveClaudeSetting('max_tokens', claudeSettings.max_tokens)"
                                class="provider-input" min="1" max="200000">
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiMaxTokens }}</p>
                </div>

                <div class="setting-item" v-if="claudeModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleTemperature }}</span>
                        <div class="form-item">
                            <input type="number" v-model="claudeSettings.temperature"
                                @change="saveClaudeSetting('temperature', claudeSettings.temperature)"
                                class="provider-input" min="0" max="1" step="0.1">
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiTemperature }}</p>
                </div>

                <div class="setting-item" v-if="claudeModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleTopP }}</span>
                        <div class="form-item">
                            <input type="number" v-model="claudeSettings.top_p"
                                @change="saveClaudeSetting('top_p', claudeSettings.top_p)"
                                class="provider-input" min="0" max="1" step="0.1">
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiTopP }}</p>
                </div>

                <div class="setting-item" v-if="claudeModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleTopK }}</span>
                        <div class="form-item">
                            <input type="number" v-model="claudeSettings.top_k"
                                @change="saveClaudeSetting('top_k', claudeSettings.top_k)"
                                class="provider-input" min="0" max="100" step="1">
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiTopK }}</p>
                </div>

                <div class="setting-item" v-if="claudeModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleStopWords }}</span>
                        <div class="form-item">
                            <input type="text" v-model="claudeSettings.stop" 
                                placeholder="delimited by ,"
                                @change="saveClaudeSetting('stop', claudeSettings.stop)"
                                class="provider-input">
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiStopWords }}</p>
                </div>
            </div>
        </div>
        <div v-if="sections.find(sec => sec.id === 'deepseek').visible" class="settings-content">
            <div class="settings-group">
                <div class="setting-item">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleApiKey }}</span>
                        <div class="form-item">
                            <input type="password" v-model="deepseekSettings.apiKey"
                                @change="listModels('deepseek'); saveDeepseekSetting('apiKey', deepseekSettings.apiKey)"
                                class="provider-input" placeholder="Enter your DeepSeek API key">
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiApiKey }}</p>
                </div>

                <div class="setting-item" v-if="deepseekSettings.apiKey !== '' && deepseekModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleModel }}</span>
                        <div class="form-item">
                            <select v-model="deepseekSettings.model" class="provider-select"
                                @change="saveDeepseekSetting('model', deepseekSettings.model)">
                                <option v-for="model in deepseekModels" :key="model.value" :value="model.value">
                                    {{ model.label }}
                                </option>
                            </select>
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiModel }}</p>
                </div>

                <div class="setting-item" v-if="deepseekModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleCustomSystemPrompt }}</span>
                        <div class="form-item">
                            <textarea v-model="deepseekSettings.customSystemPrompt"
                                @change="saveDeepseekSetting('customSystemPrompt', deepseekSettings.customSystemPrompt)"
                                class="provider-textarea" placeholder="Enter custom system prompt"></textarea>
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiCustomSystemPrompt }}</p>
                </div>

                <div class="setting-item" v-if="deepseekModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleCustomUserPrompt }}</span>
                        <div class="form-item">
                            <textarea v-model="deepseekSettings.customUserPrompt"
                                @change="saveDeepseekSetting('customUserPrompt', deepseekSettings.customUserPrompt)"
                                class="provider-textarea" placeholder="Enter custom user prompt"></textarea>
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiCustomUserPrompt }}</p>
                </div>

                <div class="setting-item" v-if="deepseekModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleMaxTokens }}</span>
                        <div class="form-item">
                            <input type="number" v-model="deepseekSettings.max_tokens"
                                @change="saveDeepseekSetting('max_tokens', deepseekSettings.max_tokens)"
                                class="provider-input" min="1" max="200000">
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiMaxTokens }}</p>
                </div>

                <div class="setting-item" v-if="deepseekModels.length > 0">
                    <div class="setting-header">
                        <span>{{plugin.i18n.aiTitleTemperature}}</span>
                        <div class="form-item">
                            <input type="number" v-model="deepseekSettings.temperature"
                                @change="saveDeepseekSetting('temperature', deepseekSettings.temperature)"
                                class="provider-input" min="0" max="1" step="0.1">
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiTemperature }}</p>
                </div>

                <div class="setting-item" v-if="deepseekModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleTopP }}</span>
                        <div class="form-item">
                            <input type="number" v-model="deepseekSettings.top_p"
                                @change="saveDeepseekSetting('top_p', deepseekSettings.top_p)"
                                class="provider-input" min="0" max="1" step="0.1">
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiTopP }}</p>
                </div>

                <div class="setting-item" v-if="deepseekModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitlePresencePenalty }}</span>
                        <div class="form-item">
                            <input type="number" v-model="deepseekSettings.presence_penalty"
                                @change="saveDeepseekSetting('presence_penalty', deepseekSettings.presence_penalty)"
                                class="provider-input" min="-2" max="2" step="0.1">
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiPresencePenalty }}</p>
                </div>

                <div class="setting-item" v-if="deepseekModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleStopWords }}</span>
                        <div class="form-item">
                            <input type="text" v-model="deepseekSettings.stop" 
                                placeholder="delimited by ,"
                                @change="saveDeepseekSetting('stop', deepseekSettings.stop)"
                                class="provider-input">
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiStopWords }}</p>
                </div>
            </div>
        </div>
        <div v-if="sections.find(sec => sec.id === 'ollama').visible" class="settings-content">
            <div class="settings-group">
                <div class="setting-item">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleApiUrl }}</span>
                        <div class="form-item">
                            <input type="text" v-model="ollamaSettings.url"
                                placeholder="Provide the ollama endpoint running in your local machine"
                                @change="listModels('ollama'); saveOllamaSetting('url', ollamaSettings.url)"
                                @focusout="listModels('ollama'); saveOllamaSetting('url', ollamaSettings.url)"
                                class="provider-input">
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiApiUrl }}</p>
                </div>

                <div class="setting-item" v-if="ollamaSettings.url !== '' && ollamaModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleModel }}</span>
                        <div class="form-item">
                            <select v-model="ollamaSettings.model" class="provider-select"
                                @change="saveOllamaSetting('model', ollamaSettings.model)">
                                <option v-for="model in ollamaModels" :key="model.value" :value="model.value">
                                    {{ model.label }}
                                </option>
                            </select>
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiModel }}</p>
                </div>

                <div class="setting-item" v-if="ollamaModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.customSystemPrompt }}</span>
                        <div class="form-item">
                            <textarea v-model="ollamaSettings.customSystemPrompt"
                                @change="saveOllamaSetting('customSystemPrompt', ollamaSettings.customSystemPrompt)"
                                class="provider-textarea" placeholder="Enter custom system prompt"></textarea>
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiCustomSystemPrompt }}</p>
                </div>

                <div class="setting-item" v-if="ollamaModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleCustomUserPrompt }}</span>
                        <div class="form-item">
                            <textarea v-model="ollamaSettings.customUserPrompt"
                                @change="saveOllamaSetting('customUserPrompt', ollamaSettings.customUserPrompt)"
                                class="provider-textarea" placeholder="Enter custom user prompt"></textarea>
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiCustomUserPrompt }}</p>
                </div>

                <div class="setting-item" v-if="ollamaModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleMaxTokens }}</span>
                        <div class="form-item">
                            <input type="number" v-model="ollamaSettings.max_tokens"
                                @change="saveOllamaSetting('max_tokens', ollamaSettings.max_tokens)"
                                class="provider-input" min="1" max="200000">
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiMaxTokens }}</p>
                </div>

                <div class="setting-item" v-if="ollamaModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleTemperature }}</span>
                        <div class="form-item">
                            <input type="number" v-model="ollamaSettings.temperature"
                                @change="saveOllamaSetting('temperature', ollamaSettings.temperature)"
                                class="provider-input" min="0" max="1" step="0.1">
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiTemperature }}</p>
                </div>


                <div class="setting-item" v-if="ollamaModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleTopP }}</span>
                        <div class="form-item">
                            <input type="number" v-model="ollamaSettings.top_p"
                                @change="saveOllamaSetting('top_p', ollamaSettings.top_p)"
                                class="provider-input" min="0" max="1" step="0.1">
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiTopP }}</p>
                </div>

                <div class="setting-item" v-if="ollamaModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleTopK }}</span>
                        <div class="form-item">
                            <input type="number" v-model="ollamaSettings.top_k"
                                @change="saveOllamaSetting('top_k', ollamaSettings.top_k)"
                                class="provider-input" min="0" max="100" step="1">
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiTopK }}</p>
                </div>

                <div class="setting-item" v-if="ollamaModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitlePresencePenalty }}</span>
                        <div class="form-item">
                            <input type="number" v-model="ollamaSettings.presence_penalty"
                                @change="saveOllamaSetting('presence_penalty', ollamaSettings.presence_penalty)"
                                class="provider-input" min="-2" max="2" step="0.1">
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiPresencePenalty }}</p>
                </div>

                <div class="setting-item" v-if="ollamaModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleFrequencyPenalt }}</span>
                        <div class="form-item">
                            <input type="number" v-model="ollamaSettings.frequency_penalty"
                                @change="saveOllamaSetting('frequency_penalty', ollamaSettings.frequency_penalty)"
                                class="provider-input" min="-2" max="2" step="0.1">
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiFrequencyPenalty }}</p>
                </div>

                <div class="setting-item" v-if="ollamaModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleStopWords }}</span>
                        <div class="form-item">
                            <input type="text" v-model="ollamaSettings.stop" 
                                placeholder="delimited by ,"
                                @change="saveOllamaSetting('stop', ollamaSettings.stop)"
                                class="provider-input">
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiStopWords }}</p>
                </div>
            </div>
        </div>
        <div v-if="sections.find(sec => sec.id === 'openai').visible" class="settings-content">
            <div class="settings-group">
                <div class="setting-item">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleApiKey }}</span>
                        <div class="form-item">
                            <input type="password" v-model="openaiSettings.apiKey"
                                @change="listModels('openai'); saveOpenAISetting('apiKey', openaiSettings.apiKey)"
                                class="provider-input" placeholder="Enter your OpenAI API key">
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiApiKey }}</p>
                </div>
                <div class="setting-item" v-if="openaiSettings.apiKey !== '' && openaiModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleModel }}</span>
                        <div class="form-item">
                            <select v-model="openaiSettings.model" class="provider-select"
                                @change="saveOpenAISetting('model', openaiSettings.model)">
                                <option v-for="model in openaiModels" :key="model.value" :value="model.value">
                                    {{ model.label }}
                                </option>
                            </select>
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiModel }}</p>
                </div>

                <div class="setting-item" v-if="openaiModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleCustomSystemPrompt }}</span>
                        <div class="form-item">
                            <textarea v-model="openaiSettings.customSystemPrompt"
                                @change="saveOpenAISetting('customSystemPrompt', openaiSettings.customSystemPrompt)"
                                class="provider-textarea" placeholder="Enter custom system prompt"></textarea>
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiCustomSystemPrompt }}</p>
                </div>

                <div class="setting-item" v-if="openaiModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleCustomUserPrompt }}</span>
                        <div class="form-item">
                            <textarea v-model="openaiSettings.customUserPrompt"
                                @change="saveOpenAISetting('customUserPrompt', openaiSettings.customUserPrompt)"
                                class="provider-textarea" placeholder="Enter custom user prompt"></textarea>
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.aiCustomUserPrompt }}</p>
                </div>

                <div class="setting-item" v-if="openaiModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleMaxTokens }}</span>
                        <div class="form-item">
                            <input type="number" v-model="openaiSettings.max_tokens"
                                @change="saveOpenAISetting('max_tokens', openaiSettings.max_tokens)"
                                class="provider-input" min="1" max="200000">
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.notWorkingInO1 }}</p>
                    <p class="setting-description">{{ plugin.i18n.aiMaxTokens }}</p>
                </div>

                <div class="setting-item" v-if="openaiModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleTemperature }}</span>
                        <div class="form-item">
                            <input type="number" v-model="openaiSettings.temperature"
                                @change="saveOpenAISetting('temperature', openaiSettings.temperature)"
                                class="provider-input" min="0" max="1" step="0.1">
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.notWorkingInO1 }}</p>
                    <p class="setting-description">{{ plugin.i18n.aiTemperature }}</p>
                </div>


                <div class="setting-item" v-if="openaiModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleTopP }}</span>
                        <div class="form-item">
                            <input type="number" v-model="openaiSettings.top_p"
                                @change="saveOpenAISetting('top_p', openaiSettings.top_p)"
                                class="provider-input" min="0" max="1" step="0.1">
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.notWorkingInO1 }}</p>
                    <p class="setting-description">{{ plugin.i18n.aiTopP }}</p>
                </div>

                <div class="setting-item" v-if="openaiModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitlePresencePenalty }}</span>
                        <div class="form-item">
                            <input type="number" v-model="openaiSettings.presence_penalty"
                                @change="saveOpenAISetting('presence_penalty', openaiSettings.presence_penalty)"
                                class="provider-input" min="-2" max="2" step="0.1">
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.notWorkingInO1 }}</p>
                    <p class="setting-description">{{ plugin.i18n.aiPresencePenalty }}</p>
                </div>

                <div class="setting-item" v-if="openaiModels.length > 0">
                    <div class="setting-header">
                        <span>{{ plugin.i18n.aiTitleStopWords }}</span>
                        <div class="form-item">
                            <input type="text" v-model="openaiSettings.stop" 
                                placeholder="delimited by ,"
                                @change="saveOpenAISetting('stop', openaiSettings.stop)"
                                class="provider-input">
                        </div>
                    </div>
                    <p class="setting-description">{{ plugin.i18n.notWorkingInO1 }}</p>
                    <p class="setting-description">{{ plugin.i18n.aiStopWords }}</p>
                </div>
            </div>
        </div>
        <div v-if="sections.find(sec => sec.id === 'embedding').visible">
            <div class="settings-content">
                <div class="settings-group">
                    <div class="setting-item">
                        <div class="setting-header">
                            <span>{{ plugin.i18n.aiEmbeddingModelProvider }}</span>
                            <div class="form-item">
                                <label v-for="opt in embedOpts" :key="opt.value" class="radio-option">
                                    <input type="radio" :value="opt.value"
                                        :checked="embeddingSettings.used_in == opt.value ? true : false"
                                        @click="saveEmbeddingSetting('used_in', opt.value);" />
                                    <span class="radio-label">{{ opt.label }}</span>
                                </label>
                            </div>
                        </div>
                        <p class="setting-description">{{ plugin.i18n.aiChooseEmbedding }}</p>
                    </div>

                    <div class="setting-item" v-if="embeddingSettings.provider !== ''">
                        <div class="setting-header">
                            <span>{{ plugin.i18n.aiEmbeddingModel }}</span>
                            <div class="form-item">
                                <select v-model="embeddingSettings.model" class="provider-select"
                                    @change="saveEmbeddingSetting('model', embeddingSettings.model)">
                                    <option v-for="model in embeddingModels.filter(m => m.exists)" :key="model.value"
                                        :value="`${model.used_in}|${model.provider}|${model.value}`">
                                        {{ model.label }}
                                    </option>
                                </select>
                            </div>
                        </div>
                        <p class="setting-description"> {{ plugin.i18n.aiEmbeddingModelDesc }}</p>
                    </div>

                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.settings-container {
    display: flex;
    height: 100%;
    max-height: 450px;
    padding: 1rem 1rem 1rem 0rem;
}

.settings-sidebar {
    width: 80px;
    border-right: 1px solid var(--b3-border-color);
    padding: 20px;
}

.sidebar-title {
    font-size: 16px;
    margin-bottom: 20px;
}

.sidebar-nav ul {
    list-style: none;
    padding: 0;
    min-width: 80px;
}

.sidebar-nav li {
    padding: 8px;
    cursor: pointer;
}

.settings-content {
    flex: 1;
    padding: 20px;
}

.setting-item {
    margin-bottom: 24px;
}

.setting-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.setting-header h3 {
    font-size: 14px;
    margin: 0;
}

.setting-header span {
    width: 25%;
}

.setting-description {
    color: #666;
    font-size: 12px;
    margin: 0;
}

.enter2send {
    padding: 1em;
    width: 15px;
    height: 18px;
    border-radius: var(--b3-border-radius);
}

.emoji-input {
    width: 100%;
    padding: 4px 8px;
    border: 1px solid var(--b3-border-color);
    border-radius: var(--b3-border-radius);
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
}

.notebook-select {
    width: 100%;
    padding: 4px 8px;
    border: 1px solid var(--b3-border-color);
    border-radius: var(--b3-border-radius);
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
}

.notebook-select option {
    border-radius: var(--b3-border-radius);
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
}

.form-item {
    width: 60%;
    display: flex;
    justify-content: flex-end;
}

.provider-input {
    width: 100%;
    padding: 4px 8px;
    border: 1px solid var(--b3-border-color);
    border-radius: var(--b3-border-radius);
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
}

.provider-select {
    width: 100%;
    padding: 4px 8px;
    border: 1px solid var(--b3-border-color);
    border-radius: var(--b3-border-radius);
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
}

.provider-select option {
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
}

.provider-textarea {
    width: 100%;
    padding: 4px 8px;
    border: 1px solid var(--b3-border-color);
    border-radius: var(--b3-border-radius);
    min-height: 100px;
    resize: vertical;
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
}

.active-panel {
    background: var(--b3-highlight-color);
    padding: 1em;
    border: 1px solid var(--b3-border-color);
    border-radius: var(--b3-border-radius-code);
}

.active-provider {
    color: var(--b3-highlight-current-background);
}

.radio-option {
    min-width: 120px;
    width: 40%;
    margin: 1em 0em;
}

.radio-label {
    padding: 10px;
}
</style>
