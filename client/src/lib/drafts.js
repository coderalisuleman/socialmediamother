const DATABASE_NAME = 'social-media-mother-private';
const STORE_NAME = 'post-drafts';
const DATABASE_VERSION = 1;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('ownerUsername', 'ownerUsername', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Private draft storage could not be opened.'));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('The draft operation could not be completed.'));
  });
}

async function withStore(mode, operation) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, mode);
    const completed = new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error('The draft change could not be saved.'));
      transaction.onabort = () => reject(transaction.error || new Error('The draft change was cancelled.'));
    });
    const result = await operation(transaction.objectStore(STORE_NAME));
    await completed;
    return result;
  } finally {
    database.close();
  }
}

export async function savePostDraft(draft) {
  const value = {
    ...draft,
    id: draft.id || crypto.randomUUID(),
    ownerUsername: String(draft.ownerUsername || '').toLowerCase(),
    updatedAt: new Date().toISOString(),
  };
  await withStore('readwrite', (store) => requestResult(store.put(value)));
  return value;
}

export async function listPostDrafts(ownerUsername) {
  const owner = String(ownerUsername || '').toLowerCase();
  if (!owner) return [];
  const drafts = await withStore('readonly', (store) => requestResult(store.index('ownerUsername').getAll(owner)));
  return drafts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export async function deletePostDraft(id) {
  if (!id) return;
  await withStore('readwrite', (store) => requestResult(store.delete(id)));
}

export async function movePostDrafts(previousUsername, nextUsername) {
  const previous = String(previousUsername || '').toLowerCase();
  const next = String(nextUsername || '').toLowerCase();
  if (!previous || !next || previous === next) return;
  const drafts = await listPostDrafts(previous);
  await Promise.all(drafts.map((draft) => savePostDraft({ ...draft, ownerUsername: next })));
}
