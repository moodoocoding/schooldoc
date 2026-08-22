import { addDays } from './specialRoomWeek';

/**
 * 학교 연결과 학사일정 받기를 하나로 묶는다.
 *
 * 선생님이 학교를 고르는 이유는 학사일정 때문이다. 그런데 예전에는 고르면 학교 코드만
 * 저장되고, 관리 화면에 따로 들어가 `학사일정 받기`를 눌러야 표에 휴업일이 나왔다. 고른
 * 자리에서는 "표에 표시됩니다"라고만 적혀 있어, 누를 것이 남았다는 사실을 알 방법이
 * 없었다. 그래서 학교를 제대로 골라도 빈 표를 배부하게 됐다.
 *
 * 두 호출을 여기서 한 가지 일로 묶고, 화면은 이것만 부른다.
 *
 * NEIS는 곁들이는 기능이라 실패해도 예약은 그대로 되어야 한다. 연결에 실패하면 아무것도
 * 바뀌지 않지만, 연결에 성공하고 일정 받기만 실패하면 학교는 이미 연결된 상태다. 둘을
 * 구분해 알려야 선생님이 무엇을 다시 해야 하는지 안다.
 *
 * Supabase를 타는 경로라 데모 모드 e2e로는 덮이지 않는다. 그래서 순서와 실패 처리를
 * 여기로 꺼내 두고 단위 테스트로 확인한다.
 */

/** 이번 주부터 한 학기 남짓을 받아 둔다. 화면을 열 때마다 부르지 않기 위해서다. */
export const SCHOOL_DAYS_AHEAD = 180;

export const schoolDaysRange = (fromMonday: string) => ({
  from: fromMonday,
  to: addDays(fromMonday, SCHOOL_DAYS_AHEAD),
});

export interface SchoolDaysPorts {
  link: (boardId: string, school: LinkableSchool) => Promise<void>;
  sync: (boardId: string, from: string, to: string) => Promise<number>;
}

export interface LinkableSchool {
  name: string;
  officeCode: string;
  schoolCode: string;
}

export interface SchoolDaysOutcome {
  /** 학교가 예약판에 연결되어 있는가. 일정 받기가 실패해도 참일 수 있다. */
  linked: boolean;
  /** 받아 온 학사일정 건수. 받지 못했으면 0. */
  count: number;
  /** 화면에 그대로 띄울 안내. */
  notice: string;
  /** 무엇을 다시 해야 하는지. 성공하면 빈 문자열. */
  error: string;
}

const reason = (thrown: unknown, fallback: string) => (
  thrown instanceof Error && thrown.message ? thrown.message : fallback
);

/** 학교를 연결하고 이어서 학사일정을 받는다. */
export const linkSchoolAndSyncDays = async (
  ports: SchoolDaysPorts, boardId: string, school: LinkableSchool, fromMonday: string,
): Promise<SchoolDaysOutcome> => {
  try {
    await ports.link(boardId, school);
  } catch (thrown) {
    return { linked: false, count: 0, notice: '', error: reason(thrown, '학교를 연결하지 못했습니다.') };
  }
  const synced = await syncDaysOnly(ports, boardId, fromMonday);
  if (synced.error) {
    return {
      linked: true,
      count: 0,
      notice: `${school.name}을(를) 연결했습니다.`,
      error: `${synced.error} 학사일정 다시 받기를 눌러 주세요.`,
    };
  }
  return {
    linked: true,
    count: synced.count,
    notice: `${school.name}을(를) 연결하고 학사일정 ${synced.count}건을 받았습니다.`,
    error: '',
  };
};

/** 이미 연결된 학교의 학사일정만 다시 받는다. */
export const syncDaysOnly = async (
  ports: SchoolDaysPorts, boardId: string, fromMonday: string,
): Promise<SchoolDaysOutcome> => {
  const { from, to } = schoolDaysRange(fromMonday);
  try {
    const count = await ports.sync(boardId, from, to);
    return { linked: true, count, notice: `학사일정 ${count}건을 받았습니다.`, error: '' };
  } catch (thrown) {
    return { linked: true, count: 0, notice: '', error: reason(thrown, '학사일정을 가져오지 못했습니다.') };
  }
};

/** 연결을 지운다. 지우면 받아 둔 일정도 의미가 없다. */
export const unlinkSchool = async (
  ports: SchoolDaysPorts, boardId: string,
): Promise<SchoolDaysOutcome> => {
  try {
    await ports.link(boardId, { name: '', officeCode: '', schoolCode: '' });
    return { linked: false, count: 0, notice: '학교 연결을 지웠습니다.', error: '' };
  } catch (thrown) {
    return { linked: true, count: 0, notice: '', error: reason(thrown, '학교 연결을 지우지 못했습니다.') };
  }
};
