import { describe, expect, it } from 'vitest';
import {
  dataCollectSubmissionPrefix,
  dataCollectSubmissionTargetPrefix,
  dataCollectTemplatePrefix,
} from '../../supabase/functions/_shared/dataCollectStoragePaths';

describe('data collect storage paths', () => {
  it('배포 파일은 소유자와 수합 ID 아래에 둔다', () => {
    expect(dataCollectTemplatePrefix('teacher-id', 'collection-id')).toBe('teacher-id/collection-id');
  });

  it('제출 파일 삭제 범위는 공개 업로드의 최상위 수합 ID와 같다', () => {
    expect(dataCollectSubmissionPrefix('collection-id')).toBe('collection-id');
    expect(dataCollectSubmissionTargetPrefix('collection-id', 'target-id')).toBe('collection-id/target-id');
    expect(dataCollectSubmissionTargetPrefix('collection-id', 'walk-in')).toBe('collection-id/walk-in');
  });
});
