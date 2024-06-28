
# nb-assistant

[中文版](./README_zh_CN.md)

Notebook Assistant (nb-assistant /  思源 笔记本助手) is an plugin that build for SiYuan to enhance its AI capability. 

![preview](./preview.png)

It has the following features:

✅ Chat interface using openai standard API

✅ Summarise current opened page

✅ Generated content starting with an AI emoji to identify content is AI generated. 

✅ Auto generate tag for current opened page. (classification and entity extraction) 

✅ Save AI chat in history

✅ Custom prompt in setting

✅ Clear chat

✅ Change of role

To use the plugin, you will first complete default SiYuan AI setting, for example:

![demo4](./images/demo5.png)

*btw, the settings above can be apply for using local llama or llamafile (https://github.com/Mozilla-Ocho/llamafile) as well. Since SiYuan default AI settings support for OpenAI API spec, you can try to connect with other service provider too.*

Features plan in the future roadmap:

* RAG using your document, LLM is just very good with text, while having a powerful notebook app, the plugin can make use of your content to response.
* Embeddings your content for similarity search and enhance the RAG.
* Check balance.
* Support LLM services, such as IBM watsonx.ai, Llama, etc..


---

Current limitation

* Zero shot. You are only prompting the LLM to response, so the result is all depends how well the LLM is trained.
* This plugin is still in development and expect to be under preview for quite a long time to make it work good.

---

![demo3](./images/demo3.png)

![demo2](./images/demo2.png)

