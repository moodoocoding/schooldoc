import { supabase } from '../../utils/supabaseClient';
import { activeWorkSnapshotFromSummary, type ActiveWorkSummaryRow } from './activeWorkSummary';

export const loadRemoteActiveWorkSnapshot = async (now: Date) => {
  if (!supabase) throw new Error('Supabase 연결 정보가 없습니다.');
  const { data, error } = await supabase.rpc('get_active_work_summary');
  if (error) throw new Error(`진행 업무 요약을 불러오지 못했습니다: ${error.message}`);
  return activeWorkSnapshotFromSummary((data ?? []) as ActiveWorkSummaryRow[], now);
};
