export type PdfPage = { number: number; text: string };

export type SearchResult = {
  answer: string;
  page: number;
  excerpt: string;
  terms: string[];
};

export type ChatMessage = SearchResult & {
  id: number;
  question: string;
};

export type StoredDocument = {
  id: string;
  name: string;
  size: number;
  savedAt: number;
  pages: PdfPage[];
  messages: ChatMessage[];
};

export type StoredDocumentSummary = Pick<StoredDocument, "id" | "name" | "size" | "savedAt"> & {
  pageCount: number;
};

const databaseName = "belge-ai-library";
const databaseVersion = 1;
const storeName = "documents";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Yerel belge kütüphanesi açılamadı."));
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Yerel veriye erişilemedi."));
  });
}

export async function listStoredDocuments(): Promise<StoredDocumentSummary[]> {
  const database = await openDatabase();
  try {
    const documents = await requestResult(
      database.transaction(storeName, "readonly").objectStore(storeName).getAll() as IDBRequest<StoredDocument[]>,
    );
    return documents
      .sort((a, b) => b.savedAt - a.savedAt)
      .map(({ id, name, size, savedAt, pages }) => ({ id, name, size, savedAt, pageCount: pages.length }));
  } finally {
    database.close();
  }
}

export async function getStoredDocument(id: string): Promise<StoredDocument | undefined> {
  const database = await openDatabase();
  try {
    return await requestResult(
      database.transaction(storeName, "readonly").objectStore(storeName).get(id) as IDBRequest<StoredDocument | undefined>,
    );
  } finally {
    database.close();
  }
}

export async function saveStoredDocument(document: StoredDocument) {
  const database = await openDatabase();
  try {
    await requestResult(database.transaction(storeName, "readwrite").objectStore(storeName).put(document));
  } finally {
    database.close();
  }
}

export async function saveDocumentMessages(id: string, messages: ChatMessage[]) {
  const document = await getStoredDocument(id);
  if (!document) return;
  await saveStoredDocument({ ...document, messages, savedAt: Date.now() });
}

export async function deleteStoredDocument(id: string) {
  const database = await openDatabase();
  try {
    await requestResult(database.transaction(storeName, "readwrite").objectStore(storeName).delete(id));
  } finally {
    database.close();
  }
}
