import { ConfirmDialog, type ConfirmDialogProps } from '../../components/ui/ConfirmDialog';

// 확인 창은 공용 UI 부품으로 옮겼다. 기존 호출부를 위해 이름과 props를 유지한다.
export function RegistryConfirmDialog(props: ConfirmDialogProps) {
  return <ConfirmDialog {...props} />;
}
