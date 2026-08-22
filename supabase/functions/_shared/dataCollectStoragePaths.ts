/** 교사가 올린 배포 파일은 소유자/수합 ID 아래에 둔다. */
export const dataCollectTemplatePrefix = (ownerId: string, collectionId: string) => `${ownerId}/${collectionId}`;

/** 공개 제출 파일은 수합 ID를 최상위 폴더로 사용한다. */
export const dataCollectSubmissionPrefix = (collectionId: string) => collectionId;

export const dataCollectSubmissionTargetPrefix = (collectionId: string, targetId: string) => (
  `${dataCollectSubmissionPrefix(collectionId)}/${targetId}`
);
