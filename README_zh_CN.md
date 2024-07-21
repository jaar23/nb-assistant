
# 思源笔记本助手

[English](./README.md)

思源笔记本助手 (nb-assistant) 是一个为 SiYuan 构建的插件，旨在增强其 AI 能力。

0.1.3 目前处于预发布阶段！如果你正在使用它，你需要通过特定端口启动 SiYuan。

原因是因为 Electron 缓存问题。（https://github.com/siyuan-note/siyuan/issues/11969）
在 Linux 上执行此操作：

选项 1
```shell
siyuan --port=16806
```

选项 2
1. 编辑 /usr/share/applications/siyuan.desktop
2. 将 Exec 行修改为以下内容
```
Exec=/opt/SiYuan/siyuan --port=16806 %U
```
3. 像往常一样启动 SiYuan

尚未在 MacOS 和 Windows 上测试，如果你已经尝试过了，欢迎开一个 pull request 或 issue 来分享你的方法。

![preview](./preview.png)

它具有以下功能：

✅ 使用 OpenAI 标准 API 的聊天界面

✅ 总结当前打开的页面

✅ 生成的内容以 AI 表情符号开头，以识别内容是 AI 生成的

✅ 自动为当前打开的页面生成标签（分类和实体提取）

✅ 保存 AI 聊天记录

✅ 在设置中自定义提示

✅ 清除聊天记录

✅ 角色切换让大模型更好的回答你的问题

注意！这个插件使用思源原生AI设置，你需要完成AI设置才能使用这个插件。

![demo5](./images/demo4.png)

*以上设置同时也适用于本地LLM的配置，当然任何支持OpenAI API spec的服务也可以尝试配置。*

未来路线图中的功能计划：

* 使用您的文档进行 RAG，LLM 在文本处理方面非常出色，而拥有一个强大的笔记本应用程序，插件可以利用您的内容进行响应。
* 嵌入您的内容以进行相似性搜索并增强 RAG。
* 检查余额。
* 支持 LLM 服务，例如 IBM watsonx.ai、Llama 等。

---

当前版本限制

* Zero shot。您只是提示 LLM 进行响应，因此结果完全取决于 LLM 的训练程度。
* 该插件仍在开发中，预计需要相当长的时间进行预览，以使其表现良好。

---

![demo3](./images/demo3.png)

![demo2](./images/demo2.png)
