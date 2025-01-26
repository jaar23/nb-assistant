<script setup lang="ts">
import { lsNotebooks } from '@/api';
import { onMounted, onUnmounted, ref } from 'vue';
import { AIWrapper } from '@/orchestrator/ai-wrapper';
import Loading from "vue-loading-overlay";

const plugin: any = defineModel<any>("plugin");

const sections = ref([
    { id: 'general', name: 'General' , visible: true},
    { id: 'claude', name: 'Claude' , visible: false},
    { id: 'deepseek', name: 'DeepSeek' , visible: false},
    { id: 'ollama', name: 'Ollama' , visible: false},
    { id: 'openai', name: 'OpenAI' , visible: false},
]);

const isLoading = ref(false);
const enterToSend = ref(true);
const aiEmoji = ref("aiEmoji");
const selectedNotebook = ref("-");
const nbOptions = ref([]);

// claude ai
const claudeSettings = ref({
    customSystemPrompt: '',
    customUserPrompt: '',
    model: '',
    apiKey: '',
    url: 'https://api.anthropic.com',
    maxTokens: 2048,
    temperature: 0
});

const deepseekSettings = ref({
    customSystemPrompt: '',
    customUserPrompt: '',
    model: '',
    apiKey: '',
    url: 'https://api.deepseek.com',
    maxTokens: 2048,
    temperature: 0
});

const ollamaSettings = ref({
    customSystemPrompt: '',
    customUserPrompt: '',
    model: '',
    apiKey: '',
    url: 'http://localhost:11434',
    maxTokens: 2048,
    temperature: 0
});

const openaiSettings = ref({
    customSystemPrompt: '',
    customUserPrompt: '',
    model: '',
    apiKey: '',
    url: 'https://api.openai.com',
    maxTokens: 2048,
    temperature: 0
});

const claudeModels = ref([]);
const deepseekModels = ref([]);
const ollamaModels = ref([]);
const openaiModels = ref([]);

async function listModels(aiProvider: string) {
    try {
        isLoading.value = true;
        switch (aiProvider) {
            case "claude":
                const claude = new AIWrapper("claude", {
                    apiKey: claudeSettings.value.apiKey
                });
                console.log("list claude models");
                const list1 = await claude.listModels({});
                console.log("list", list1);
                for (const m of list1.models) {
                    claudeModels.value.push({value: m.id, label: m.name});
                }
                break;
            case "deepseek":
                const deepseek = new AIWrapper("deepseek", {
                    apiKey: deepseekSettings.value.apiKey
                });
                console.log("list deepseek models");
                const list2 = await deepseek.listModels({});
                console.log("list", list2);
                for (const m of list2.models) {
                    deepseekModels.value.push({value: m.id, label: m.name});
                }
                break;
            case "ollama":
                const ollama = new AIWrapper("ollama", {
                    apiKey: "",
                    baseURL: ollamaSettings.value.url
                });
                console.log("list ollma models");
                const list3 = await ollama.listModels({});
                console.log("list", list3);
                for (const m of list3.models) {
                    ollamaModels.value.push({value: m.id, label: m.name});
                }
                break;
            case "openai":
                const openai = new AIWrapper("openai", {
                    apiKey: ""
                });
                console.log("list openai models");
                const list4 = await openai.listModels({});
                console.log("list", list4);
                for (const m of list4.models) {
                    openaiModels.value.push({value: m.id, label: m.name});
                }
                break;
            
            default:
                throw new Error("unrecognize ai provider");
        }
    } catch (e) {
        console.error(e);
    } finally {
        isLoading.value = false;
    }
}

async function saveSetting() {
    plugin.value.settingUtils.settings.set("chatSaveNotebook", selectedNotebook.value);
    plugin.value.settingUtils.settings.set("aiEmoji", aiEmoji.value);
    plugin.value.settingUtils.settings.set("enterToSend", enterToSend.value);
    console.log("update setting");
    await plugin.value.settingUtils.save();
    console.log("setting updated");
}

async function saveClaudeSetting(key: string, value: any) {
    await plugin.value.settingUtils.settings.set(`claude.${key}`, value);
    await plugin.value.settingUtils.save();
}

async function saveDeepseekSetting(key: string, value: any) {
    await plugin.value.settingUtils.settings.set(`deepseek.${key}`, value);
    await plugin.value.settingUtils.save();
}

async function saveOllamaSetting(key: string, value: any) {
    await plugin.value.settingUtils.settings.set(`ollama.${key}`, value);
    await plugin.value.settingUtils.save();
}

async function saveOpenAISetting(key: string, value: any) {
    await plugin.value.settingUtils.settings.set(`openai.${key}`, value);
    await plugin.value.settingUtils.save();
}

async function showPanel(id: string) {
    sections.value.find(sec => sec.id === id).visible = true;
    sections.value.filter(sec => sec.id !== id).map(sec => sec.visible = false);
    if (["claude", "deepseek", "ollama", "openai"].includes(id)) {
        await listModels(id);
    }
}

function loadingCancel() {
  isLoading.value = false;
}

onMounted(async() => {
    await plugin.value.settingUtils.load();
    if (!plugin.value.settingUtils.settings.get("aiEmoji")) {
        await plugin.value.settingUtils.settings.set("aiEmoji", "[AI]");
    }
    aiEmoji.value = plugin.value.settingUtils.settings.get("aiEmoji");

    const notebooks = await lsNotebooks();
    nbOptions.value = [{ value: "-", label: plugin.value.i18n.pleaseSelect }];
    for (const nb of notebooks.notebooks) {
        nbOptions.value.push({label: nb.name, value: nb.id});
    }

    if (!plugin.value.settingUtils.settings.get("chatSaveNotebook")) {
        await plugin.value.settingUtils.settings.set("chatSaveNotebook", "-");
    }
    selectedNotebook.value = plugin.value.settingUtils.settings.get("chatSaveNotebook");

    if (!plugin.value.settingUtils.settings.get("enterToSend")) {
        await plugin.value.settingUtils.settings.set("enterToSend", true);
    }
    enterToSend.value = plugin.value.settingUtils.settings.get("enterToSend");

    claudeSettings.value.customSystemPrompt = plugin.value.settingUtils.settings.get("claude.customSystemPrompt") || '';
    claudeSettings.value.customUserPrompt = plugin.value.settingUtils.settings.get("claude.customUserPrompt") || '';
    claudeSettings.value.model = plugin.value.settingUtils.settings.get("claude.model") || 'claude-3-5-haiku-20241022';
    claudeSettings.value.apiKey = plugin.value.settingUtils.settings.get("claude.apiKey") || '';
    claudeSettings.value.url = plugin.value.settingUtils.settings.get("claude.url") || 'https://api.anthropic.com';
    claudeSettings.value.maxTokens = plugin.value.settingUtils.settings.get("claude.maxTokens") || 2048;
    claudeSettings.value.temperature = plugin.value.settingUtils.settings.get("claude.temperature") || 0;

    deepseekSettings.value.customSystemPrompt = plugin.value.settingUtils.settings.get("deepseek.customSystemPrompt") || '';
    deepseekSettings.value.customUserPrompt = plugin.value.settingUtils.settings.get("deepseek.customUserPrompt") || '';
    deepseekSettings.value.model = plugin.value.settingUtils.settings.get("deepseek.model") || '';
    deepseekSettings.value.apiKey = plugin.value.settingUtils.settings.get("deepseek.apiKey") || '';
    deepseekSettings.value.url = plugin.value.settingUtils.settings.get("deepseek.url") || 'https://api.deepseek.com';
    deepseekSettings.value.maxTokens = plugin.value.settingUtils.settings.get("deepseek.maxTokens") || 2048;
    deepseekSettings.value.temperature = plugin.value.settingUtils.settings.get("deepseek.temperature") || 0;

    ollamaSettings.value.customSystemPrompt = plugin.value.settingUtils.settings.get("ollama.customSystemPrompt") || '';
    ollamaSettings.value.customUserPrompt = plugin.value.settingUtils.settings.get("ollama.customUserPrompt") || '';
    ollamaSettings.value.model = plugin.value.settingUtils.settings.get("ollama.model") || '';
    ollamaSettings.value.apiKey = plugin.value.settingUtils.settings.get("ollama.apiKey") || '';
    ollamaSettings.value.url = plugin.value.settingUtils.settings.get("ollama.url") || 'http://localhost:11434';
    ollamaSettings.value.maxTokens = plugin.value.settingUtils.settings.get("ollama.maxTokens") || 2048;
    ollamaSettings.value.temperature = plugin.value.settingUtils.settings.get("ollama.temperature") || 0;

    openaiSettings.value.customSystemPrompt = plugin.value.settingUtils.settings.get("openai.customSystemPrompt") || '';
    openaiSettings.value.customUserPrompt = plugin.value.settingUtils.settings.get("openai.customUserPrompt") || '';
    openaiSettings.value.model = plugin.value.settingUtils.settings.get("openai.model") || '';
    openaiSettings.value.apiKey = plugin.value.settingUtils.settings.get("openai.apiKey") || '';
    openaiSettings.value.url = plugin.value.settingUtils.settings.get("openai.url") || 'https://api.openai.com';
    openaiSettings.value.maxTokens = plugin.value.settingUtils.settings.get("openai.maxTokens") || 2048;
    openaiSettings.value.temperature = plugin.value.settingUtils.settings.get("openai.temperature") || 0;

    isLoading.value = false;
})

onUnmounted(async() => {
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
                    <li v-for="section in sections" :key="section.id">
                        <span @click="showPanel(section.id)">
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
                                <input type="checkbox" class="enter2send" v-model="enterToSend" @change="saveSetting" @focusout="saveSetting">
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
                                        {{  nbopt.label }}
                                    </option>
                                </select>
                            </div>
                        </div>
                        <p class="setting-description">{{ plugin.i18n.saveChatDesc }}</p>
                    </div>
                </div>
            </div>
        </div>
        <div v-if="sections.find(sec => sec.id === 'claude').visible" class="settings-content">
            <div class="settings-group">
                <div class="setting-item">
                    <div class="setting-header">
                        <span>API Key</span>
                        <div class="form-item">
                            <input
                                type="password"
                                v-model="claudeSettings.apiKey"
                                @change="listModels('claude');saveClaudeSetting('apiKey', claudeSettings.apiKey)"
                                class="claude-input"
                                placeholder="Enter your Claude API key"
                            >
                        </div>
                    </div>
                </div>

                <div class="setting-item">
                    <div class="setting-header">
                        <span>API URL</span>
                        <div class="form-item">
                            <input
                                type="text"
                                v-model="claudeSettings.url"
                                placeholder="Do not change if you are using Claude provide by Anthropic"
                                @change="listModels('claude');saveClaudeSetting('url', claudeSettings.url)"
                                class="claude-input"
                            >
                        </div>
                    </div>
                </div>

                <div class="setting-item" v-if="claudeSettings.apiKey !== '' && claudeModels.length > 0">
                    <div class="setting-header">
                        <span>Model</span>
                        <div class="form-item">
                            <select
                                v-model="claudeSettings.model"
                                class="claude-select"
                                @change="saveClaudeSetting('model', claudeSettings.model)"
                            >
                                <option v-for="model in claudeModels" :key="model.value" :value="model.value">
                                    {{ model.label }}
                                </option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="setting-item" v-if="claudeModels.length > 0">
                    <div class="setting-header">
                        <span>Custom System Prompt</span>
                        <div class="form-item">
                            <textarea
                                v-model="claudeSettings.customSystemPrompt"
                                @change="saveClaudeSetting('customSystemPrompt', claudeSettings.customSystemPrompt)"
                                class="claude-textarea"
                                placeholder="Enter custom system prompt"
                            ></textarea>
                        </div>
                    </div>
                </div>

                <div class="setting-item" v-if="claudeModels.length > 0">
                    <div class="setting-header">
                        <span>Custom User Prompt</span>
                        <div class="form-item">
                            <textarea
                                v-model="claudeSettings.customUserPrompt"
                                @change="saveClaudeSetting('customUserPrompt', claudeSettings.customUserPrompt)"
                                class="claude-textarea"
                                placeholder="Enter custom user prompt"
                            ></textarea>
                        </div>
                    </div>
                </div>

                <div class="setting-item" v-if="claudeModels.length > 0">
                    <div class="setting-header">
                        <span>Max Tokens</span>
                        <div class="form-item">
                            <input
                                type="number"
                                v-model="claudeSettings.maxTokens"
                                @change="saveClaudeSetting('maxTokens', claudeSettings.maxTokens)"
                                class="claude-input"
                                min="1"
                                max="200000"
                            >
                        </div>
                    </div>
                </div>

                <div class="setting-item" v-if="claudeModels.length > 0">
                    <div class="setting-header">
                        <span>Temperature</span>
                        <div class="form-item">
                            <input
                                type="number"
                                v-model="claudeSettings.temperature"
                                @change="saveClaudeSetting('temperature', claudeSettings.temperature)"
                                class="claude-input"
                                min="0"
                                max="1"
                                step="0.1"
                            >
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div v-if="sections.find(sec => sec.id === 'deepseek').visible" class="settings-content">
            <div class="settings-group">
                <div class="setting-item">
                    <div class="setting-header">
                        <span>API Key</span>
                        <div class="form-item">
                            <input
                                type="password"
                                v-model="deepseekSettings.apiKey"
                                @change="listModels('deepseek');saveDeepseekSetting('apiKey', deepseekSettings.apiKey)"
                                class="claude-input"
                                placeholder="Enter your DeepSeek API key"
                            >
                        </div>
                    </div>
                </div>

                <!-- <div class="setting-item">
                    <div class="setting-header">
                        <span>API URL</span>
                        <div class="form-item">
                            <input
                                type="text"
                                v-model="deepseekSettings.url"
                                placeholder="Do not change if you are using Claude provide by Anthropic"
                                @change="listModels('deepseek');saveClaudeSetting('url', deepseekSettings.url)"
                                class="claude-input"
                            >
                        </div>
                    </div>
                </div> -->

                <div class="setting-item" v-if="deepseekSettings.apiKey !== '' && deepseekModels.length > 0">
                    <div class="setting-header">
                        <span>Model</span>
                        <div class="form-item">
                            <select
                                v-model="deepseekSettings.model"
                                class="claude-select"
                                @change="saveDeepseekSetting('model', deepseekSettings.model)"
                            >
                                <option v-for="model in deepseekModels" :key="model.value" :value="model.value">
                                    {{ model.label }}
                                </option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="setting-item" v-if="deepseekModels.length > 0">
                    <div class="setting-header">
                        <span>Custom System Prompt</span>
                        <div class="form-item">
                            <textarea
                                v-model="deepseekSettings.customSystemPrompt"
                                @change="saveDeepseekSetting('customSystemPrompt', deepseekSettings.customSystemPrompt)"
                                class="claude-textarea"
                                placeholder="Enter custom system prompt"
                            ></textarea>
                        </div>
                    </div>
                </div>

                <div class="setting-item" v-if="deepseekModels.length > 0">
                    <div class="setting-header">
                        <span>Custom User Prompt</span>
                        <div class="form-item">
                            <textarea
                                v-model="deepseekSettings.customUserPrompt"
                                @change="saveDeepseekSetting('customUserPrompt', deepseekSettings.customUserPrompt)"
                                class="claude-textarea"
                                placeholder="Enter custom user prompt"
                            ></textarea>
                        </div>
                    </div>
                </div>

                <div class="setting-item" v-if="deepseekModels.length > 0">
                    <div class="setting-header">
                        <span>Max Tokens</span>
                        <div class="form-item">
                            <input
                                type="number"
                                v-model="deepseekSettings.maxTokens"
                                @change="saveDeepseekSetting('maxTokens', deepseekSettings.maxTokens)"
                                class="claude-input"
                                min="1"
                                max="200000"
                            >
                        </div>
                    </div>
                </div>

                <div class="setting-item" v-if="deepseekModels.length > 0">
                    <div class="setting-header">
                        <span>Temperature</span>
                        <div class="form-item">
                            <input
                                type="number"
                                v-model="deepseekSettings.temperature"
                                @change="saveDeepseekSetting('temperature', deepseekSettings.temperature)"
                                class="claude-input"
                                min="0"
                                max="1"
                                step="0.1"
                            >
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div v-if="sections.find(sec => sec.id === 'ollama').visible" class="settings-content">
            <div class="settings-group">
                <!-- <div class="setting-item">
                    <div class="setting-header">
                        <span>API Key</span>
                        <div class="form-item">
                            <input
                                type="password"
                                v-model="ollamaSettings.apiKey"
                                @change="listModels('ollama');saveOllamaSetting('apiKey', ollamaSettings.apiKey)"
                                class="claude-input"
                                placeholder="Enter your DeepSeek API key"
                            >
                        </div>
                    </div>
                </div> -->

                <div class="setting-item">
                    <div class="setting-header">
                        <span>API URL</span>
                        <div class="form-item">
                            <input
                                type="text"
                                v-model="ollamaSettings.url"
                                placeholder="Provide the ollama endpoint running in your local machine"
                                @change="listModels('ollama');saveClaudeSetting('url', ollamaSettings.url)"
                                class="claude-input"
                            >
                        </div>
                    </div>
                </div>

                <div class="setting-item" v-if="ollamaSettings.url !== '' && ollamaModels.length > 0">
                    <div class="setting-header">
                        <span>Model</span>
                        <div class="form-item">
                            <select
                                v-model="ollamaSettings.model"
                                class="claude-select"
                                @change="saveOllamaSetting('model', ollamaSettings.model)"
                            >
                                <option v-for="model in ollamaModels" :key="model.value" :value="model.value">
                                    {{ model.label }}
                                </option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="setting-item" v-if="ollamaModels.length > 0">
                    <div class="setting-header">
                        <span>Custom System Prompt</span>
                        <div class="form-item">
                            <textarea
                                v-model="ollamaSettings.customSystemPrompt"
                                @change="saveOllamaSetting('customSystemPrompt', ollamaSettings.customSystemPrompt)"
                                class="claude-textarea"
                                placeholder="Enter custom system prompt"
                            ></textarea>
                        </div>
                    </div>
                </div>

                <div class="setting-item" v-if="ollamaModels.length > 0">
                    <div class="setting-header">
                        <span>Custom User Prompt</span>
                        <div class="form-item">
                            <textarea
                                v-model="ollamaSettings.customUserPrompt"
                                @change="saveOllamaSetting('customUserPrompt', ollamaSettings.customUserPrompt)"
                                class="claude-textarea"
                                placeholder="Enter custom user prompt"
                            ></textarea>
                        </div>
                    </div>
                </div>

                <div class="setting-item" v-if="ollamaModels.length > 0">
                    <div class="setting-header">
                        <span>Max Tokens</span>
                        <div class="form-item">
                            <input
                                type="number"
                                v-model="ollamaSettings.maxTokens"
                                @change="saveOllamaSetting('maxTokens', ollamaSettings.maxTokens)"
                                class="claude-input"
                                min="1"
                                max="200000"
                            >
                        </div>
                    </div>
                </div>

                <div class="setting-item" v-if="ollamaModels.length > 0">
                    <div class="setting-header">
                        <span>Temperature</span>
                        <div class="form-item">
                            <input
                                type="number"
                                v-model="ollamaSettings.temperature"
                                @change="saveOllamaSetting('temperature', ollamaSettings.temperature)"
                                class="claude-input"
                                min="0"
                                max="1"
                                step="0.1"
                            >
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div v-if="sections.find(sec => sec.id === 'openai').visible">
            openai
        </div>
    </div>
</template>

<style scoped>
.settings-container {
    display: flex;
    height: 100%;
}

.settings-sidebar {
    width: 200px;
    border-right: 1px solid #e0e0e0;
    padding: 20px;
}

.sidebar-title {
    font-size: 16px;
    margin-bottom: 20px;
}

.sidebar-nav ul {
    list-style: none;
    padding: 0;
}

.sidebar-nav li {
    padding: 8px 0;
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

.setting-description {
    color: #666;
    font-size: 12px;
    margin: 0;
}

.emoji-input {
    width: 100%;
    padding: 4px 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
}

.notebook-select {
    width: 100%;
    padding: 4px 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
}

.form-item {
    width: 60%;
    display: flex;
    justify-content: flex-end;
}

.claude-input {
    width: 100%;
    padding: 4px 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
}

.claude-select {
    width: 100%;
    padding: 4px 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
}

.claude-textarea {
    width: 100%;
    padding: 4px 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    min-height: 100px;
    resize: vertical;
}
</style>
