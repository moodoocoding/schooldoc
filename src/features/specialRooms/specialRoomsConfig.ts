export const isSpecialRoomsDemoMode = (
  import.meta.env.DEV
  && import.meta.env.VITE_SPECIAL_ROOMS_DEMO_MODE === 'true'
);

// 가정통신문·학생 결과와 같은 규칙을 쓴다. 구현은 utils/publicAppOrigin.ts에 있다.
export { getPublicAppOrigin as getSpecialRoomsPublicOrigin } from '../../utils/publicAppOrigin';
