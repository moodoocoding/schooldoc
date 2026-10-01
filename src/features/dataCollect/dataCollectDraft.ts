export const dataCollectDraftKey = (owner: string) =>
  "schooldoc_data_collect_create_v3:" + owner;
export const readDataCollectDraft = <
  T extends { version: number; ownerId: string },
>(
  owner: string,
  storage: Pick<Storage, "getItem"> = window.localStorage,
): T | null => {
  if (!owner) return null;
  try {
    const value = JSON.parse(
      storage.getItem(dataCollectDraftKey(owner)) ?? "null",
    ) as T | null;
    return value?.version === 3 && value.ownerId === owner ? value : null;
  } catch {
    return null;
  }
};
