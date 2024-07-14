import {
    Plugin,
    showMessage,
    confirm,
    Dialog,
    Menu,
    openTab,
    getFrontend,
    getBackend,
    IModel,
    Protyle,
    openWindow,
    IOperation,
    Constants,
    openMobileFileById,
    lockScreen,
    ICard,
    ICardData,
    fetchPost,
} from "siyuan";
import "@/index.scss";

// vue
import { createApp } from "vue";
import App from "@/App.vue";
import { lsNotebooks, pushMsg, pushErrMsg } from "./api";
import { createModel, createEmbedding } from "./model";

import { SettingUtils } from "./libs/setting-utils";
const STORAGE_NAME = "nb-assistant-config";
const DOCK_TYPE = "nbassistant_tab";

export default class PluginSample extends Plugin {
    customTab: () => IModel;
    private isMobile: boolean;
    private settingUtils: SettingUtils;

    async onload() {
        this.data[STORAGE_NAME] = { readonlyText: "Readonly" };

        console.log("loading plugin-sample", this.i18n);

        const frontEnd = getFrontend();
        this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
        // 图标的制作参见帮助文档
        this.addIcons(`<symbol id="iconChat" viewBox="0 0 32 32">
<?xml version="1.0" encoding="UTF-8"?><svg width="32px" height="32px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke-width="1.5"><path fill-rule="evenodd" clip-rule="evenodd" d="M1.25 16.5C1.25 13.0482 4.04822 10.25 7.5 10.25C10.9518 10.25 13.75 13.0482 13.75 16.5C13.75 19.9518 10.9518 22.75 7.5 22.75C6.4644 22.75 5.48586 22.4976 4.6244 22.0505L2.41228 22.4623C2.16923 22.5076 1.91949 22.4301 1.74467 22.2553C1.56985 22.0805 1.49242 21.8308 1.53767 21.5877L1.94953 19.3756C1.50244 18.5141 1.25 17.5356 1.25 16.5Z"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M22.7499 10C22.7499 5.16751 18.8325 1.25 13.9999 1.25C9.73442 1.25 5.90197 4.4993 5.33758 8.7588C5.33709 8.76059 5.33669 8.76183 5.33638 8.76263C5.33741 8.74858 5.33662 8.75058 5.33597 8.75509C5.33532 8.75961 5.33481 8.76664 5.33638 8.76263C5.33561 8.77306 5.33385 8.79231 5.33029 8.82591C5.32628 8.86551 5.32098 8.92185 5.3153 8.99325C5.31354 9.01533 5.31174 9.03885 5.30994 9.06378C6.00443 8.85957 6.73944 8.75 7.50004 8.75C11.7803 8.75 15.25 12.2198 15.25 16.5C15.25 17.2591 15.1409 17.9927 14.9375 18.6859C15.0164 18.6798 15.086 18.6736 15.1454 18.6678C15.2187 18.6607 15.2765 18.6542 15.3171 18.6493L15.365 18.6434L15.3789 18.6416L15.3832 18.641L15.3848 18.6408L15.3859 18.6406L15.4016 18.6383C16.3735 18.4817 17.2918 18.165 18.1285 17.7165L21.4627 18.3373C21.7057 18.3826 21.9555 18.3051 22.1303 18.1303C22.3051 17.9555 22.3825 17.7058 22.3373 17.4627L21.7165 14.1285C22.3761 12.8981 22.7499 11.4917 22.7499 10Z"></path></svg>
</symbol>
`);

        const topBarElement = this.addTopBar({
            icon: "iconChat",
            title: this.i18n.pluginName,
            position: "right",
            callback: () => {
                if (this.isMobile) {
                    this.addMenu();
                } else {
                    let rect = topBarElement.getBoundingClientRect();
                    // 如果被隐藏，则使用更多按钮
                    if (rect.width === 0) {
                        rect = document.querySelector("#barMore").getBoundingClientRect();
                    }
                    if (rect.width === 0) {
                        rect = document
                            .querySelector("#barPlugins")
                            .getBoundingClientRect();
                    }
                    this.addMenu(rect);
                }
            },
        });

        this.addDock({
            config: {
                position: "RightTop",
                size: { width: 400, height: 0 },
                icon: "iconChat",
                title: this.i18n.pluginName,
                hotkey: "⌥⌘B",
            },
            data: {
                text: "",
            },
            type: DOCK_TYPE,
            resize() {
                console.log(DOCK_TYPE + " resize");
                // if (window.navigator.storage && window.navigator.storage.persist) {
                //     window.navigator.storage.persist().then(function(persistent) {
                //         if (persistent)
                //             console.log(
                //                 "Storage will not be cleared except by explicit user action",
                //             );
                //         else
                //             console.log(
                //                 "Storage may be cleared by the UA under storage pressure.",
                //             );
                //     });
                // }
                // store().then(() => "store ended...");
            },
            update() {
                console.log(DOCK_TYPE + " update");
            },
            init: (dock) => {
                dock.element.innerHTML = `<div id="nb-assistant" style="height: 98%"></div>`;
                createApp(App, { plugin: this}).mount("#nb-assistant");
            },
            destroy() {
                console.log("destroy dock:", DOCK_TYPE);
            },
        });

        const notebooks = await lsNotebooks();
        let nbOptions = { "-": this.i18n.pleaseSelect };
        for (const nb of notebooks.notebooks) {
            nbOptions[nb.id] = nb.name;
        }

        this.settingUtils = new SettingUtils({
            plugin: this,
            name: STORAGE_NAME,
        });

        this.settingUtils.addItem({
            key: "Hint",
            value: "",
            type: "hint",
            title: this.i18n.AIConfigTitle,
            description: this.i18n.AIConfigDesc,
        });

        this.settingUtils.addItem({
            key: "chatSaveNotebook",
            value: "-",
            type: "select",
            title: this.i18n.saveChatTitle,
            description: this.i18n.saveChatDesc,
            options: nbOptions,
            action: {
                // Called when focus is lost and content changes
                callback: () => {
                    // Return data and save it in real time
                    let value = this.settingUtils.takeAndSave("chatSaveNotebook");
                    console.log(value);
                },
            },
        });

        this.settingUtils.addItem({
            key: "systemPrompt",
            value: "PA",
            type: "select",
            title: this.i18n.role,
            description: this.i18n.roleDesc,
            options: {
                PA: this.i18n.PA,
                CD: this.i18n.CD,
                SE: this.i18n.SE,
                SA: this.i18n.SA,
                ET: this.i18n.ET,
                TG: this.i18n.TG,
                PC: this.i18n.PC,
                ST: this.i18n.ST,
                MT: this.i18n.MT,
                CS: this.i18n.CS,
                FA: this.i18n.FA,
                ML: this.i18n.ML,
                DS: this.i18n.DS,
            },
            action: {
                callback: () => {
                    let selected = this.settingUtils.takeAndSave("systemPrompt");
                    console.log(selected);
                },
            },
        });

        this.settingUtils.addItem({
            key: "aiEmoji",
            value: "[AI]",
            type: "textinput",
            title: this.i18n.aiEmoji,
            description: this.i18n.aiEmojiDesc,
            action: {
                callback: () => {
                    // Return data and save it in real time
                    let value = this.settingUtils.takeAndSave("aiEmoji");
                    console.log(value);
                },
            },
        });

        // this.settingUtils.addItem({
        //     key: "checkToken",
        //     value: true,
        //     type: "checkbox",
        //     title: "Estimate token used on every calls",
        //     description: `This is a simply word counting feature, do not match with the actual token consume on the LLM.
        //         ONLY USING THIS FOR REFERENCE!`,
        //     action: {
        //         callback: () => {
        //             // Return data and save it in real time
        //             let value = !this.settingUtils.get("checkToken");
        //             this.settingUtils.setAndSave("checkToken", value);
        //             console.log(value);
        //         },
        //     },
        // });

        this.settingUtils.addItem({
            key: "enterToSend",
            value: true,
            type: "checkbox",
            title: this.i18n.enterToSend,
            description: this.i18n.enterToSendDesc,
            action: {
                callback: () => {
                    // Return data and save it in real time
                    let value = !this.settingUtils.get("enterToSend");
                    this.settingUtils.setAndSave("enterToSend", value);
                    console.log(value);
                },
            },
        });

        this.settingUtils.addItem({
            key: "customSystemPrompt",
            value: "",
            type: "textarea",
            title: this.i18n.customSystemPrompt,
            description: this.i18n.customSystemPromptDesc,
            action: {
                callback: () => {
                    // Read data in real time
                    let value = this.settingUtils.takeAndSave("customSystemPrompt");
                    console.log(value);
                },
            },
        });

        this.settingUtils.addItem({
            key: "customUserPrompt",
            value: "",
            type: "textarea",
            title: this.i18n.customUserPrompt,
            description: this.i18n.customUserPromptDesc,
            action: {
                callback: () => {
                    // Read data in real time
                    let value = this.settingUtils.takeAndSave("customUserPrompt");
                    console.log(value);
                },
            },
        });

        this.settingUtils.addItem({
            key: "dbEnable",
            value: false,
            type: "checkbox",
            title: this.i18n.dbEnabled,
            description: this.i18n.dbEnabledDesc,
            action: {
                callback: () => {
                    // Return data and save it in real time
                    let value = !this.settingUtils.get("dbEnable");
                    this.settingUtils.setAndSave("dbEnable", value);
                    console.log(value);
                    if (value) {
                        pushMsg("Downloading model from huggingface and setup onyxruntime")
                            .then(() => createModel())
                            .then((model) => {
                                pushMsg("Embedding model is setup");
                                console.log("model created");
                                return model;
                            })
                            .then((model) => createEmbedding(model, "hello"))
                            .then((embeddings) => {
                                console.log("embedding created", embeddings);
                                pushMsg("Successfully created embeddings");
                            })
                            .catch((err) => {
                                console.error(err);
                                pushErrMsg(`unable to setup vectordb, ${err}`);
                            });
                    }
                },
            },
        });

        try {
            this.settingUtils.load();
        } catch (error) {
            console.error(
                "Error loading settings storage, probably empty config json:",
                error,
            );
        }

        console.log(this.i18n.helloPlugin);
    }

    onLayoutReady() {
        // this.loadData(STORAGE_NAME);
        this.settingUtils.load();
        console.log(`frontend: ${getFrontend()}; backend: ${getBackend()}`);
        console.log("nb-assistant settings", this.settingUtils.dump());
    }

    async onunload() {
        console.log(this.i18n.byePlugin);
        showMessage("Goodbye Notebook Assistant");
        console.log("onunload");
    }

    uninstall() {
        console.log("uninstall");
    }

    private addMenu(rect?: DOMRect) {
        const menu = new Menu("nb-assistant", () => {
            console.log(this.i18n.byeMenu);
        });
        menu.addItem({
            icon: "iconSettings",
            label: this.i18n.settings,
            click: () => {
                this.openSetting();
            },
        });
        if (this.isMobile) {
            menu.fullscreen();
        } else {
            menu.open({
                x: rect.right,
                y: rect.bottom,
                isLeft: true,
            });
        }
    }
}
