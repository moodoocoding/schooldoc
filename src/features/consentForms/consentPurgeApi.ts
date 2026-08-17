import { invokeConsentAdmin } from './consentAdminApi';

/**
 * 파기는 서버에서 수행한다.
 * 서명 파일과 원본 PDF를 지우고 행을 지우는 여러 단계 중간에 브라우저가 닫히면 파일이 남는데,
 * 삭제 정책이 수합 행을 참조하므로 행이 먼저 사라지면 남은 파일을 두 번 다시 지울 수 없다.
 */
export interface ConsentPurgeResult {
  purged: Array<{ id: string; title: string; responseCount: number; signatureCount: number }>;
  failed: Array<{ id: string; error: string }>;
}

export const purgeConsentForms = async (formIds: string[]) => (
  invokeConsentAdmin<ConsentPurgeResult>({ action: 'purge', formIds })
);
