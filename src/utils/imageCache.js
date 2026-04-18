import { storage } from "../firebase/config";
import { ref, getDownloadURL } from "firebase/storage";

const cache = new Map();
const TTL = 3600000;

export async function getCachedImageUrl(storagePath) {
  const entry = cache.get(storagePath);
  if (entry && Date.now() - entry.cachedAt < TTL) return entry.url;
  const url = await getDownloadURL(ref(storage, storagePath));
  cache.set(storagePath, { url, cachedAt: Date.now() });
  return url;
}
