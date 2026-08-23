
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

/**
 * 학사일정은 학년도 통째로 받는다.
 *
 * 예전에는 `이번 주 월요일부터 180일`이었다. 과거 방향으로 여유가 전혀 없어서, 만든
 * 날이 속한 주보다 앞선 날의 휴업일은 처음부터 받아 오지 못했다. 실제로 8/23(일)에
 * 만든 예약판이 8/24부터 받는 바람에, 바로 전 주 월요일인 8/17 대체공휴일이 표에
 * 나오지 않았다. 뒤로도 180일에서 끊겨 그 너머 주는 다시 빈 표가 됐다.
 *
 * 우리나라 학년도는 3월에 시작해 이듬해 2월에 끝난다. 그 한 해를 한 번에 받아 두면
 * 양쪽 다 해결되고, 화면을 넘길 때마다 NEIS를 부르지 않아도 된다.
 */
const ACADEMIC_YEAR_START_MONTH = 3;

/** 그 날짜가 속한 학년도의 시작 연도. 1~2월은 전해 3월에 시작한 학년도에 속한다. */
export const academicYearOf = (dateKey: string) => {
  const [year, month] = dateKey.split('-').map(Number);
  return month < ACADEMIC_YEAR_START_MONTH ? year - 1 : year;
};

/** 그 날짜가 속한 학년도 전체. 3월 1일부터 이듬해 2월 말일까지. */
export const schoolDaysRange = (dateKey: string) => {
  const start = academicYearOf(dateKey);
  const lastDayOfFebruary = new Date(start + 1, 2, 0).getDate();
  return {
    from: `${start}-03-01`,
    to: `${start + 1}-02-${String(lastDayOfFebruary).padStart(2, '0')}`,
  };
};

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
  ports: SchoolDaysPorts, boardId: string, school: LinkableSchool, reference: string,
): Promise<SchoolDaysOutcome> => {
  try {
    await ports.link(boardId, school);
  } catch (thrown) {
    return { linked: false, count: 0, notice: '', error: reason(thrown, '학교를 연결하지 못했습니다.') };
  }
  const synced = await syncDaysOnly(ports, boardId, reference);
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

/** 이미 연결된 학교의 학사일정만 다시 받는다. `reference`는 어느 학년도인지 고르는 데만 쓴다. */
export const syncDaysOnly = async (
  ports: SchoolDaysPorts, boardId: string, reference: string,
): Promise<SchoolDaysOutcome> => {
  const { from, to } = schoolDaysRange(reference);
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
