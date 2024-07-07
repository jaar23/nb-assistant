import { HNSW, HNSWWithDB } from "hnsw";
import { listDocsByPath, exportMdContent, pushMsg, pushErrMsg } from "@/api";
import { MarkdownTextSplitter } from "@langchain/textsplitters";
import { createEmbedding, createModel } from "@/model";
import { openDB, deleteDB } from "idb";
export async function store() {
  // With persistence
  const index = await HNSWWithDB.create(200, 16, "my-index");

  // Make some data
  const data = [
    { id: 1, vector: [1, 2, 3, 4, 5] },
    { id: 2, vector: [2, 3, 4, 5, 6] },
    { id: 3, vector: [3, 4, 5, 6, 7] },
    { id: 4, vector: [4, 5, 6, 7, 8] },
    { id: 5, vector: [5, 6, 7, 8, 9] },
  ];

  // Build the index
  await index.buildIndex(data);
  await index.saveIndex();
  await index.loadIndex();

  // Search for nearest neighbors
  const results2 = index.searchKNN([2, 3, 4, 5, 6], 2);
  console.log(results2);

  // // Delete the index
  // await index2.deleteIndex();
}

export const promptPersistPermission = async () => {
  if (window.navigator.storage && window.navigator.storage.persist) {
    window.navigator.storage.persist().then(function(persistent) {
      if (persistent)
        console.log(
          "Storage will not be cleared except by explicit user action",
        );
      else
        console.log("Storage may be cleared by the UA under storage pressure.");
    });
  }
};

export async function createVectorDb(
  numOfNeighbors: number,
  efConstruction: number,
  dbName: string,
): Promise<HNSWWithDB> {
  return await HNSWWithDB.create(numOfNeighbors, efConstruction, dbName);
}

export async function createMDTextDb(dbName: string) {
  const db = await openDB(dbName, 1, {
    upgrade(db) {
      db.createObjectStore("md-splitted");
    },
  });
  return db;
}

export async function getMDTextDbInstance(dbName: string) {
  const db = await openDB(dbName);
  return db;
}

export async function saveMDTextDb(dbInstance: any, mdSplitted: any[]) {
  await dbInstance.put("md-splitted", mdSplitted, "md-texts");
}

export async function getMDTextDb(dbInstance: any): Promise<any[]> {
  const mdJson = await dbInstance.get("md-splitted", "md-texts");
  return mdJson;
}

export async function queryMDTextDb(dbInstance: any, ids: number[]) {
  const mdJson = await getMDTextDb(dbInstance);
  let result = [];
  // include before and after chunk for bigger context
  let idss = [];
  for (const id of ids) {
    // idss.push(id - 1);
    idss.push(id);
    //idss.push(id + 1);
  }

  for (const md of mdJson) {
    if (idss.includes(md.id)) {
      result.push(md);
    }
  }
  return result;
}

export async function closeMDTextDbInstance(dbInstance: any) {
  await dbInstance.close();
}

export async function deleteMDTextDb(dbName: string) {
  await deleteDB(dbName, {
    blocked(currentVersion, event) {
      console.log("idb cannot be deleted");
    },
  });
}

export async function getMemVectorDb(dbName: string) {
  const hnswdb = await openDB(dbName);
  const hnswJson = await hnswdb.get("hnsw-index", "hnsw");
  //console.log("hnsw json", hnswJson);
  const db = HNSW.fromJSON(hnswJson);
  hnswdb.close();
  // console.log("hnsw", db)
  return db;
}

export async function saveVector(
  instance: HNSWWithDB,
  data: { id: number; vector: Float32Array | number[] }[],
) {
  await instance.buildIndex(data);
  await instance.saveIndex();
}

export async function loadVector(instance: HNSWWithDB) {
  await instance.loadIndex();
}

export async function queryVector(
  instance: HNSWWithDB,
  vector: number[] | Float32Array,
  resultLimit: number = 10,
) {
  console.log("instance", instance);
  return instance.searchKNN(vector, resultLimit);
}

export async function deleteVectorDb(notebookId: string) {
  await deleteDB(notebookId, {
    blocked(currentVersion, event) {
      console.log("idb cannot be deleted");
    },
  });
}

export async function initDb(
  nbId: string,
  nbName: string,
  nbDocs: any[],
  model: any,
) {
  try {
    await deleteVectorDb(nbId);
    await deleteMDTextDb(`${nbId}-md`);
    let flatlist = [];
    transformDocToList(flatlist, nbDocs, nbName, nbId, 1);
    if (flatlist.length === 0) {
      await pushMsg(
        "Nothing is transform, double check if the notebook is empty. If not, please open a ticket to developer on github",
      );
    }
    //console.log("init db list", flatlist);
    const vectors = await embedDocList(model, flatlist);
    //console.log("init db vectors", vectors);
    const vectordb = await createVectorDb(256, 16, nbId);
    await saveVector(vectordb, vectors);
    vectordb.db.close();

    const mdTextDb = await createMDTextDb(`${nbId}-md`);
    await saveMDTextDb(mdTextDb, flatlist);
    await closeMDTextDbInstance(mdTextDb);
  } catch (err) {
    console.error(err);
    await pushErrMsg(err);
  }
}

export type Metric = "Cosine" | "Euclidean";

export async function createMemVectorDb(
  numOfNeighbors: number,
  efConstruction: number,
  dimension: number,
  metric: Metric,
) {
  return new HNSW(numOfNeighbors, efConstruction, dimension, metric);
}

// close to 1, very similar
// close to 0, unlikely similar
// close to -1, not similar
export function queryMemVector(
  instance: HNSW,
  vector: number[] | Float32Array,
  resultLimit: number = 10,
) {
  return instance.searchKNN(vector, resultLimit);
}

export async function queryMdChunk(notebookId: string, queryText: string) {
  const model = await createModel();
  const embedding = await createEmbedding(model, queryText);
  const vectordb = await getMemVectorDb(notebookId);
  const embeddingResult = queryMemVector(vectordb, embedding, 25);
  console.log("embedding result", embeddingResult);
  const closestResult = embeddingResult
    .filter((embd) => embd.score > 0.25)
    .map((embd) => embd.id);
  const mdTextDb = await getMDTextDbInstance(`${notebookId}-md`);
  const chunkResult = await queryMDTextDb(mdTextDb, closestResult);
  return chunkResult;
}

export async function getAllDocsByNotebook(
  notebookId: string,
  path = "/",
): Promise<any[]> {
  let docs = [];
  const notebook = await listDocsByPath(notebookId, path);
  // console.log("notebook: ", notebookId, notebook)
  if (notebook == null) return docs;
  for (let nb of notebook.files ?? []) {
    if (nb.subFileCount > 0) {
      let subDocs = await getAllDocsByNotebook(notebookId, nb.path);
      // console.log("sub docs", subDocs)
      for (let doc of subDocs) {
        // console.log(doc)
        const markdown = await exportMdContent(doc.id);
        const mdSplitter = new MarkdownTextSplitter({
          chunkSize: 384,
          chunkOverlap: 0,
          keepSeparator: false,
        });
        const blocks = await mdSplitter.createDocuments([markdown.content]);
        doc["blocks"] = blocks;
      }
      docs.push({ id: nb.id, name: nb.name, docs: subDocs });
    } else {
      const markdown = await exportMdContent(nb.id);
      const mdSplitter = new MarkdownTextSplitter({
        chunkSize: 384,
        chunkOverlap: 0,
        keepSeparator: false,
      });
      const blocks = await mdSplitter.createDocuments([markdown.content]);
      nb["blocks"] = blocks;
      docs.push(nb);
    }
  }
  return docs;
}

export async function embedDoc(model: any, docs: any[], startId: number) {
  // console.log("embedding doc", docs);
  let vectors = [];
  let id = startId;
  for (let doc of docs) {
    // console.log("doc length", doc);
    if (doc.hasOwnProperty("blocks")) {
      for (let ddblock of doc.blocks) {
        const embedding = await createEmbedding(model, ddblock.pageContent);
        ddblock["embedding"] = embedding;
        id = id + 1;
        ddblock["id"] = id;
        vectors.push({ id, vector: embedding });
      }
    } else {
      embedDoc(model, doc.docs, id);
    }
  }
  return vectors;
}

export async function embedDocList(model: any, docList: any[]) {
  let vectors = [];
  for (const doc of docList) {
    const embedding = await createEmbedding(model, doc.content);
    vectors.push({ id: doc.id, vector: embedding });
  }
  return vectors;
}

export function transformDocToList(
  list: any[],
  docs: any[],
  nbName: string,
  nbId: string,
  startId: number,
) {
  let id = startId;
  //let list = [];
  for (const doc of docs) {
    if (doc.hasOwnProperty("blocks")) {
      for (const block of doc.blocks) {
        list.push({
          id: id,
          notebookId: nbId,
          notebookName: nbName,
          blockId: doc.id,
          hiddenBlock: doc.hidden,
          blockMemo: doc.memo,
          blockName: doc.name,
          blockName1: doc.name1,
          blockPath: doc.path,
          content: block.pageContent,
        });
        id = id + 1;
        // console.log("has list", id);
      }
      if (doc.hasOwnProperty("docs")) {
        transformDocToList(list, doc.docs, nbName, nbId, id);
      }
    } else {
      // console.log("has doc");
      transformDocToList(list, doc.docs, nbName, nbId, id);
    }
  }
  // console.log("list return", list);
  return list;
}
