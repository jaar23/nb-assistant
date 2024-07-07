interface IResGetNotebookConf {
    box: string;
    conf: NotebookConf;
    name: string;
}

interface IReslsNotebooks {
    notebooks: Notebook[];
}

interface IResUpload {
    errFiles: string[];
    succMap: { [key: string]: string };
}

interface IResdoOperations {
    doOperations: doOperation[];
    undoOperations: doOperation[] | null;
}

interface IResGetBlockKramdown {
    id: BlockId;
    kramdown: string;
}

interface IResGetChildBlock {
    id: BlockId;
    type: BlockType;
    subtype?: BlockSubType;
}

interface IResGetTemplates {
    content: string;
    path: string;
}

interface IResReadDir {
    isDir: boolean;
    isSymlink: boolean;
    name: string;
}

interface IResExportMdContent {
    hPath: string;
    content: string;
}

interface IResBootProgress {
    progress: number;
    details: string;
}

interface IResForwardProxy {
    body: string;
    contentType: string;
    elapsed: number;
    headers: { [key: string]: string };
    status: number;
    url: string;
}

interface IResExportResources {
    path: string;
}


interface IResFile {
    alias: string;
    bookmark: string;
    count: number;
    ctime: number;
    dueFlashcardCount: number;
    hCtime: string;
    hMtime: string;
    hSize: string;
    hiddle: boolean;
    icon: string;
    id: string;
    memo: string;
    mtime: number;
    name: string;
    name1: string;
    newFlashcardCount: number;
    path: string;
    size: number;
    sort: number;
    subFileCount: number;
}

interface IResListDocPath {
    box: string;
    files: IResFile[];
    path: string;
}

interface IResExportMD {
    content: string;
    hPath: string;
}
