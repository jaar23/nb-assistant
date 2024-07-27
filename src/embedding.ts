import { HNSW, HNSWWithDB } from "hnsw";
import {
  listDocsByPath,
  exportMdContent,
  pushMsg,
  pushErrMsg,
  getChildBlocksContents,
  putFile,
  getFile,
} from "@/api";
import { MarkdownTextSplitter } from "@langchain/textsplitters";
import { createEmbedding, createModel } from "@/model";
import { openDB, deleteDB } from "idb";
import {
  strToFile,
  sleep,
  blockSplitter,
  textSplitter,
  nlpPipe,
  checkIfDbExist,
} from "@/utils";

export const dataPath = "temp/nb-assistant";

export class PriorityQueue<T> {
  private items: T[] = [];

  constructor(private compare: (a: T, b: T) => number) { }

  push(item: T) {
    let i = 0;
    while (i < this.items.length && this.compare(item, this.items[i]) > 0) {
      i++;
    }
    this.items.splice(i, 0, item);
  }

  pop(): T | undefined {
    return this.items.shift();
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }
}

export const promptPersistPermission = async () => {
  if (window.navigator.storage && window.navigator.storage.persist) {
    window.navigator.storage.persist().then(function(persistent) {
      if (persistent) {
        pushMsg("Storage will be persisted");
        console.log(
          "Storage will not be cleared except by explicit user action",
        );
      } else {
        pushMsg(
          "Storage is not persisted, embedding will lost after application exit",
        );
        console.log("Storage may be cleared by the UA under storage pressure.");
      }
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
  const dbExists = await checkIfDbExist(`${dbName}-md`);
  let db;
  if (!dbExists) {
    const mdTextFile = await getFile(`${dataPath}/${dbName}.json`);
    db = await createMDTextDb(`${dbName}`);
    await saveMDTextTempDb(db, mdTextFile);
  } else {
    db = await openDB(dbName);
  }
  return db;
}

export async function saveMDTextTempDb(dbInstance: any, mdSplitted: any[]) {
  await dbInstance.put("md-splitted", mdSplitted, "md-texts");
}

export async function getMDTextDb(dbInstance: any): Promise<any[]> {
  const mdJson = await dbInstance.get("md-splitted", "md-texts");
  return mdJson;
}

export async function queryMDTextDb(dbInstance: any, ids: number[]) {
  const mdJson = await getMDTextDb(dbInstance);
  let result = [];
  let idss = [];
  for (const id of ids) {
    idss.push(id);
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
  const dbExists = await checkIfDbExist(dbName);
  //let hnswdb: any;
  let hnswJson: any;
  if (!dbExists) {
    const hnswFile = await getFile(`${dataPath}/${dbName}.json`);
    const tempdb = await openDB(dbName, 1, {
      upgrade(db) {
        db.createObjectStore("hnsw-index");
      },
    });
    await tempdb.put("hnsw-index", hnswFile, "hnsw");
    // console.log("hnswfile", hnswFile);
    // hnswdb = await createVectorDb(
    //   hnswFile.M,
    //   hnswFile.efConstruction,
    //   dbName,
    // );
    // await saveVector(hnswdb, hnswFile.embedding);
    hnswJson = hnswFile;
    tempdb.close();
  } else {
    const tempdb = await openDB(dbName);
    hnswJson = await tempdb.get("hnsw-index", "hnsw");
  }
  // console.log("hnsw json", hnswJson);
  const db = HNSW.fromJSON(hnswJson);
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
  plugin: any
) {
  try {
    await deleteVectorDb(nbId);
    await deleteMDTextDb(`${nbId}-md`);
    let flatlist = [];
    // transformDocToList(flatlist, nbDocs, nbName, nbId, 1);
    transformBlocksToList(flatlist, nbDocs, nbName, nbId, 1);
    if (flatlist.length === 0) {
      await pushMsg(
        plugin.i18n.nothingToEmbed,
      );
      return;
    }
    console.log("transformed list size:", flatlist.length);
    console.log("start embeeding at ", new Date());
    await pushMsg(
      `${plugin.i18n.processTakeX} ${Math.round((flatlist.length * 3) / 60)} ${plugin.i18n.minutes}`,
    );
    // console.log("init db list", flatlist);
    const vectors = await embedDocList(model, flatlist, plugin);
    console.log("end embedding at ", new Date());
    //console.log("init db vectors", vectors);
    //const vectordb = await createVectorDb(100, 16, nbId);
    const vectordb = await createMemVectorDb(100, 16, 384, "cosine");
    //await saveVector(vectordb, vectors);
    await saveMemVectorDb(vectordb, vectors, nbId, plugin);
    // vectordb.db.close();

    // const mdTextDb = await createMDTextDb(`${nbId}-md`);
    await saveMDTextDb(flatlist, nbId, plugin);
    // await closeMDTextDbInstance(mdTextDb);
  } catch (err) {
    console.error(err);
    await pushErrMsg(err.stack);
  }
}

export type Metric = "cosine" | "euclidean";

export async function createMemVectorDb(
  numOfNeighbors: number,
  efConstruction: number,
  dimension: number,
  metric: Metric,
) {
  return new HNSW(numOfNeighbors, efConstruction, dimension, metric);
}

export async function saveMemVectorDb(
  instance: HNSW,
  data: { id: number; vector: Float32Array | number[] }[],
  dbName: string,
  plugin: any
) {
  await instance.buildIndex(data);
  const jsonVec = instance.toJSON();
  //const jsonVec = { embedding: data, M: instance.M, efConstruction: instance.efConstruction };
  const jsonStr = JSON.stringify(jsonVec);
  const file = strToFile(jsonStr, dbName, "application/json");
  try {
    await putFile(`${dataPath}/${dbName}.json`, false, file);
  } catch (err) {
    console.error(err.stack);
    await pushErrMsg(plugin.i18n.saveVDBFail);
    await sleep(5000);
    await putFile(`${dataPath}/${dbName}.json`, false, file);
  }
}

export async function saveMDTextDb(data: any, dbName: string, plugin: any) {
  const file = strToFile(JSON.stringify(data), dbName, "application/json");
  try {
    await putFile(`${dataPath}/${dbName}-md.json`, false, file);
  } catch (err) {
    console.error(err.stack);
    await pushErrMsg(plugin.i18n.saveVDBFail);
    await sleep(5000);
    await putFile(`${dataPath}/${dbName}-md.json`, false, file);
  }
}

function searchKNNWithScore(
  hnsw: HNSW,
  query: Float32Array | number[],
  k: number,
  score: number,
): { id: number; score: number }[] {
  const result: { id: number; score: number }[] = [];
  const visited: Set<number> = new Set<number>();

  const candidates = new PriorityQueue<number>((a, b) => {
    const aNode = hnsw.nodes.get(a)!;
    const bNode = hnsw.nodes.get(b)!;
    return (
      hnsw.similarityFunction(query, bNode.vector) -
      hnsw.similarityFunction(query, aNode.vector)
    );
  });

  candidates.push(hnsw.entryPointId);
  let level = hnsw.levelMax;

  while (!candidates.isEmpty() && result.length < k) {
    const currentId = candidates.pop()!;
    if (visited.has(currentId)) continue;

    visited.add(currentId);

    const currentNode = hnsw.nodes.get(currentId)!;
    const similarity = hnsw.similarityFunction(currentNode.vector, query);

    if (similarity > 0 && similarity >= score) {
      result.push({ id: currentId, score: similarity });
    }

    if (currentNode.level === 0) {
      continue;
    }

    level = Math.min(level, currentNode.level - 1);

    for (let i = level; i >= 0; i--) {
      const neighbors = currentNode.neighbors[i];
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          candidates.push(neighborId);
        }
      }
    }
  }

  return result.slice(0, k);
}

// close to 1, very similar
// close to 0, unlikely similar
// close to -1, not similar
export function queryMemVector(
  instance: HNSW,
  vector: number[] | Float32Array,
  resultLimit: number = 10,
  minScore: number = 0.25,
) {
  return searchKNNWithScore(instance, vector, resultLimit, minScore);
}

export async function queryMdChunk(
  notebookId: string,
  queryText: string,
  minScore = 0.25,
  resultLimit = 50,
) {
  const model = await createModel();
  const embedding = await createEmbedding(model, queryText);
  const vectordb = await getMemVectorDb(notebookId);
  // console.log(vectordb.toJSON());
  const embeddingResult = queryMemVector(vectordb, embedding, resultLimit);
  console.log("embedding result", embeddingResult);
  const closestResult = embeddingResult
    .filter((embd) => embd.score > minScore)
    .map((embd) => embd.id);
  const mdTextDb = await getMDTextDbInstance(`${notebookId}-md`);
  let chunkResult = await queryMDTextDb(mdTextDb, closestResult);
  //chunkResult.sort((a, b) => (a.score > b.score ? a : b));
  for (let chunk of chunkResult) {
    // always return one since id is unique index
    const embd = embeddingResult.filter((e) => e.id == chunk.id);
    // console.log("embd", embd);
    if (embd.length > 0) {
      chunk["score"] = embd[0].score;
    } else {
      chunk["score"] = 0;
    }
  }
  return chunkResult;
}

// export async function getAllDocsByNotebook(
//   notebookId: string,
//   path = "/",
//   chunkSize = 256,
// ): Promise<any[]> {
//   let docs = [];
//   const notebook = await listDocsByPath(notebookId, path);
//   // console.log("notebook: ", notebookId, notebook)
//   if (notebook == null) return docs;
//   for (let nb of notebook.files ?? []) {
//     if (nb.subFileCount > 0) {
//       let subDocs = await getAllDocsByNotebook(notebookId, nb.path);
//       // console.log("sub docs", subDocs)
//       for (let doc of subDocs) {
//         // console.log(doc)
//         const markdown = await exportMdContent(doc.id);
//         // const textChunks = textSplitter(doc.id, markdown.content, chunkSize);
//         // doc["blocks"] = textChunks;
//         const mdSplitter = new MarkdownTextSplitter({
//           chunkSize: chunkSize,
//           chunkOverlap: 32,
//           keepSeparator: false,
//         });
//         const blocks = await mdSplitter.createDocuments([markdown.content]);
//         await sleep(100);
//         doc["blocks"] = blocks;
//       }
//       docs.push({ id: nb.id, name: nb.name, docs: subDocs });
//     } else {
//        const markdown = await exportMdContent(nb.id);
//       // const textChunks = textSplitter(nb.id, markdown.content, chunkSize);
//       // nb["blocks"] = textChunks;
//       const mdSplitter = new MarkdownTextSplitter({
//         chunkSize: chunkSize,
//         chunkOverlap: 32,
//         keepSeparator: false,
//       });
//       const blocks = await mdSplitter.createDocuments([markdown.content]);
//       await sleep(100);
//       nb["blocks"] = blocks;
//       docs.push(nb);
//     }
//   }
//   return docs;
// }

export async function getAllBlocksByNotebook(
  notebookId: string,
  path = "/",
  chunkSize = 128,
): Promise<any[]> {
  let docs = [];
  const notebook = await listDocsByPath(notebookId, path);
  // console.log("notebook: ", notebookId, notebook)
  if (notebook == null) return docs;
  for (let nb of notebook.files ?? []) {
    if (nb.subFileCount > 0) {
      let subDocs = await getAllBlocksByNotebook(notebookId, nb.path);
      // console.log("sub docs", subDocs)
      for (let doc of subDocs) {
        // console.log(doc)
        const blockContents = await getChildBlocksContents(doc.id);
        const blockChunks = blockSplitter(blockContents, chunkSize, nb.name, doc.name);
        // await sleep(100);
        doc["blocks"] = blockChunks;
      }
      docs.push({ id: nb.id, name: nb.name, docs: subDocs });
    } else {
      const blockContents = await getChildBlocksContents(nb.id);
      const blockChunks = blockSplitter(blockContents, chunkSize, nb.name, "");

      // await sleep(100);
      nb["blocks"] = blockChunks;
      docs.push(nb);
    }
  }
  // console.log("all blocks", docs);
  return docs;
}

//// deprecated
export async function embedDoc(model: any, docs: any[], startId: number) {
  // console.log("embedding doc", docs);
  let vectors = [];
  let id = startId;
  let enableSleep = false;
  if (docs.length > 500) {
    enableSleep = true;
  }
  for (let doc of docs) {
    // console.log("doc length", doc);
    if (doc.hasOwnProperty("blocks")) {
      for (let ddblock of doc.blocks) {
        const embedding = await createEmbedding(model, ddblock.pageContent);
        if (embedding == null) {
          continue;
        }
        ddblock["embedding"] = embedding;
        id = id + 1;
        ddblock["id"] = id;
        vectors.push({ id, vector: embedding });
        if (enableSleep) {
          await sleep(100);
        } else {
          await sleep(100);
        }
      }
    } else {
      await embedDoc(model, doc.docs, id);
    }
  }
  return vectors;
}

export async function embedDocList(model: any, docList: any[], plugin: any) {
  let vectors = [];
  let enableSleep = false;
  if (docList.length > 500) {
    enableSleep = true;
    await pushMsg(`${plugin.i18n.remainingXToProcess.replace("[x]", docList.length)}`);
  }
  let count = 0;
  for (const doc of docList) {
    // console.log(doc);
    if (doc.content == null) {
      continue;
    }
    const words = nlpPipe(doc.content);
    const embedding = await createEmbedding(model, words);
    if (embedding == null) {
      continue;
    }
    vectors.push({ id: doc.id, vector: embedding });
    if (enableSleep) {
      await sleep(300);
    } else {
      await sleep(300);
    }
    count = count + 1;
    if (count % 100 === 0) {
      const left = docList.length - count;
      const message = plugin.i18n.processedXAndYLeft.replace("[x]", count).replace("[y]", left);
      await pushMsg(message);
    }
  }
  return vectors;
}

// export function transformDocToList(
//   list: any[],
//   docs: any[],
//   nbName: string,
//   nbId: string,
//   startId: number,
// ) {
//   let id = startId;
//   //let list = [];
//   for (const doc of docs) {
//     if (doc.hasOwnProperty("blocks")) {
//       for (const block of doc.blocks) {
//         list.push({
//           id: id,
//           notebookId: nbId,
//           notebookName: nbName,
//           blockId: doc.id,
//           hiddenBlock: doc.hidden,
//           blockMemo: doc.memo,
//           blockName: doc.name,
//           blockName1: doc.name1,
//           blockPath: doc.path,
//           content: block.pageContent,
//         });
//         id = id + 1;
//         // console.log("has list", id);
//       }
//       if (doc.hasOwnProperty("docs")) {
//         transformDocToList(list, doc.docs, nbName, nbId, id);
//       }
//     } else {
//       // console.log("has doc");
//       transformDocToList(list, doc.docs, nbName, nbId, id);
//     }
//   }
//   // console.log("list return", list);
//   return list;
// }

export function transformBlocksToList(
  list: any[],
  blocks: any[],
  nbName: string,
  nbId: string,
  startId: number,
) {
  let id = startId;
  //let list = [];
  for (const block of blocks) {
    if (block.hasOwnProperty("blocks")) {
      for (const b of block.blocks) {
        if (b.chunk.trim().length === 0) {
          continue;
        }
        list.push({
          id: id,
          notebookId: nbId,
          notebookName: nbName,
          blockIds: b.ids,
          content: b.chunk,
        });
        id = id + 1;
        // console.log("has list", id);
      }
      if (block.hasOwnProperty("docs")) {
        transformBlocksToList(list, block.docs, nbName, nbId, id);
      }
    } else {
      // console.log("has doc");
      transformBlocksToList(list, block.docs, nbName, nbId, id);
    }
  }
  //console.log("list return", list);
  return list;
}
