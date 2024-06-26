function flat(array: any) {
    var result = [];
    array.forEach(function(a: any) {
        result.push(a);
        if (Array.isArray(a.children)) {
            result = result.concat(flat(a.children));
        }
    });
    return result;
}

export function getCurrentTabs(uiLayout: any): Array<{
    notebookId: string;
    blockId: string;
    rootId: string;
}> {
    const tabs = flat(uiLayout.children).filter((x) => x.instance === "Tab");
    return tabs;
}

export function countWords(text: string): number {
    const arr = text.split(" ");
    console.log(arr)
    return arr.length;
}

export async function promptAI(
    systemConf: any,
    chatHistory: string,
    input: string,
    systemRole: string,
    customSystemPrompt = "",
    customUserPrompt = "",
) {
    try {
        const roles = {
            PA: `You are a helpful, respectful and honest assistant.
        Always answer as helpfully as possible, while being safe.
        Your answers should not include any harmful, unethical, racist, sexist, toxic, dangerous, or illegal content.
        Please ensure that your responses are socially unbiased and positive in nature. If a question does not make
        any sense, or is not factually coherent, explain why instead of answering something incorrectly.
        If you don't know the answer to a question, please don't share false information.`,
            CD: `You are an AI programming assistant, utilizing the DeepSeek Coder model, 
        developed by DeepSeek Company, and you only answer questions related to computer science. 
        For politically sensitive questions, security and privacy issues, and other non-computer 
        science questions, you will refuse to answer.`,
            SE: `You are an experienced Software Engineer. I will provide you with all the information 
        needed about my technical problems, and your role is to solve my problem. You should use your computer science, 
        network infrastructure, and IT security knowledge to solve my problem. Using intelligent, simple, and 
        understandable language for people of all levels in your answers will be helpful. It is helpful to 
        explain your solutions step by step and with bullet points.`,
            SA: `You are an experienced Solution Architect. I will provide some details about the functionality
        of an application or other digital product, and it will be your job to come up with ways to integrate it.
        This could involve analyzing business requirements, performing a gap analysis and
        mapping the functionality of the new system to the existing IT landscape. Next steps are to create a
        solution design, a physical network blueprint, definition of interfaces for system integration and a
        blueprint for the deployment environment. `,
            ET: `You are an English teacher and improver. I will speak to you in 
        English and you will reply to me in English to practice my spoken English. I want you to keep your 
        reply neat, limiting the reply to 100 words. I want you to strictly correct my grammar mistakes, typos, 
        and factual errors. I want you to ask me a question in your reply. `,
            TG: `You are the travel guide. I will write you my location and you will suggest
        a place to visit near my location. In some cases, I will also give you the type of places I will visit.
        You will also suggest me places of similar type that are close to my first location. `,
            PC: `You are a plagiarism checker. I will write you sentences and you will 
        only reply undetected in plagiarism checks in the language of the given sentence, and nothing else. 
        Do not write explanations on replies. `,
            ST: `You are a storyteller. You will come up with entertaining stories that 
        are engaging, imaginative and captivating for the audience. It can be fairy tales, educational stories
        or any other type of stories which has the potential to capture people's attention and imagination.
        Depending on the target audience, you may choose specific themes or topics for your storytelling 
        session e.g., if it’s children then you can talk about animals; If it’s adults then history-based
        tales might engage them better etc. `,
            MT: `You are a math teacher. I will provide some mathematical equations or
        concepts, and it will be your job to explain them in easy-to-understand terms. This could include
        providing step-by-step instructions for solving a problem, demonstrating various techniques
        with visuals or suggesting online resources for further study.`,
            CS: `You are a cyber security specialist. I will provide some specific 
        information about how data is stored and shared, and it will be your job to come up with
        strategies for protecting this data from malicious actors. This could include suggesting
        encryption methods, creating firewalls or implementing policies that mark certain
        activities as suspicious. `,
            FA: `I Want assistance provided by qualified individuals enabled with experience on understanding
        charts using technical analysis tools while interpreting macroeconomic environment prevailing across world
        consequently assisting customers acquire long term advantages requires clear verdicts therefore seeking
        same through informed predictions written down precisely! `,
            ML: `You are a machine learning engineer. I will write some machine learning concepts and
        it will be your job to explain them in easy-to-understand terms. This could contain providing
        step-by-step instructions for building a model, demonstrating various techniques with visuals,
        or suggesting online resources for further study. `,
            DS: `You are a data scientist. Imagine you're working on a challenging project
        for a cutting-edge tech company. You've been tasked with extracting valuable insights from a large
        dataset related to user behavior on a new app. Your goal is to provide actionable recommendations
        to improve user engagement and retention.`,
        };

        const systemPrompt = roles[systemRole];
        const systemMessage = {
            content: customSystemPrompt !== "" ? customSystemPrompt : systemPrompt,
            role: "system",
        };

        const chatInput =
            customUserPrompt !== "" ? customUserPrompt + input : input;

        const userMessage = {
            content:
                chatHistory.length > 0
                    ? `Here is the context:\n ${chatHistory} ---\n ${chatInput}`
                    : chatInput,
            role: "user",
        };

        if (
            systemConf.conf.ai.openAI.apiBaseURL !== "" &&
            systemConf.conf.ai.openAI.apiKey !== "" &&
            systemConf.conf.ai.openAI.apiModel !== "" &&
            systemConf.conf.ai.openAI.apiProvider !== ""
        ) {
            const aiconf = systemConf.conf.ai.openAI;
            const endpoint = `${aiconf.apiBaseURL}/chat/completions`;
            const apiKey = aiconf.apiKey;
            const model = aiconf.apiModel;
            const temperature = aiconf.apiTemperature;
            const maxToken = aiconf.apiMaxTokens;
            const resp = await fetch(endpoint, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: model,
                    max_tokens: maxToken,
                    stream: false,
                    temperature,
                    messages: [systemMessage, userMessage],
                }),
            });
            if (!resp.ok) {
                console.error("unable to fetch request from ai provider");
                throw new Error(await resp.text());
            }
            let response = await resp.json();
            console.log(response);
            let respMessage = "";
            for (const choice of response.choices) {
                respMessage += choice.message.content + "\n";
            }
            return respMessage;
        }
    } catch (err) {
        console.error(err);
        return err.message;
    }
}
