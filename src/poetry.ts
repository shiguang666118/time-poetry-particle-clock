export const TIME_POETRY_LINES = [
  '一寸光阴一寸金',
  '寸金难买寸光阴',
  '黑发不知勤学早',
  '白首方悔读书迟',
  '少年易老学难成',
  '一寸光阴不可轻',
  '少壮不努力',
  '老大徒伤悲',
  '盛年不重来',
  '一日难再晨',
  '及时当勉励',
  '岁月不待人',
  '莫等闲白了少年头空悲切',
  '读书不觉已春深',
  '一寸光阴一寸金',
  '三更灯火五更鸡',
  '正是男儿读书时',
  '劝君莫惜金缕衣',
  '劝君惜取少年时',
  '明日复明日',
  '明日何其多',
  '我生待明日',
  '万事成蹉跎',
  '花有重开日',
  '人无再少年',
  '逝者如斯夫',
  '不舍昼夜',
  '青春须早为',
  '岂能长少年',
  '及时宜自勉',
  '学而时习之',
  '不亦说乎',
  '温故而知新',
  '可以为师矣',
  '敏而好学',
  '不耻下问',
  '学如不及',
  '犹恐失之',
  '玉不琢不成器',
  '人不学不知道',
  '读书破万卷',
  '下笔如有神',
  '书山有路勤为径',
  '学海无涯苦作舟',
  '少年辛苦终身事',
  '莫向光阴惰寸功',
  '纸上得来终觉浅',
  '绝知此事要躬行',
  '古人学问无遗力',
  '少壮工夫老始成',
  '问渠那得清如许',
  '为有源头活水来',
  '旧书不厌百回读',
  '熟读深思子自知',
  '业精于勤荒于嬉',
  '行成于思毁于随',
  '吾生也有涯',
  '而知也无涯',
  '路漫漫其修远兮',
  '吾将上下而求索',
  '博学之审问之',
  '慎思之明辨之',
  '笃行之',
  '不积跬步无以至千里',
  '不积小流无以成江海',
  '骐骥一跃不能十步',
  '驽马十驾功在不舍',
  '锲而舍之朽木不折',
  '锲而不舍金石可镂',
  '学然后知不足',
  '教然后知困'
] as const;

const POETRY_STRIP_PATTERN = /[，。、“”‘’：；！？,.!?;:\s]/g;

export const TIME_POETRY_CLEAN_LINES = TIME_POETRY_LINES
  .map((line) => line.replace(POETRY_STRIP_PATTERN, ''))
  .filter((line) => line.length > 0);

export const TIME_POETRY_GLYPHS = Array.from(new Set(TIME_POETRY_CLEAN_LINES.join('')));

const TIME_POETRY_GLYPH_INDEX = new Map(
  TIME_POETRY_GLYPHS.map((glyph, index) => [glyph, index] as const)
);

export function getTimePoetryGlyphIndex(lineIndex: number, charOffset: number): number {
  const line = TIME_POETRY_CLEAN_LINES[Math.abs(Math.floor(lineIndex)) % TIME_POETRY_CLEAN_LINES.length];
  const char = line[Math.abs(Math.floor(charOffset)) % line.length];
  return TIME_POETRY_GLYPH_INDEX.get(char) ?? 0;
}

export function getPoetryLineWindow(
  interactionIndex: number,
  pool: readonly number[],
  maxVisible = 2
): number[] {
  const validPool = pool.filter((index) => index >= 0 && index < TIME_POETRY_CLEAN_LINES.length);
  if (validPool.length === 0) return [];

  const visibleCount = Math.max(1, Math.min(Math.floor(maxVisible), validPool.length));
  const windowIndex = Math.floor(Math.max(0, interactionIndex)) % validPool.length;
  return Array.from({ length: visibleCount }, (_, offset) => validPool[(windowIndex + offset) % validPool.length]);
}

export function getClockHourSector(x: number, y: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x * x + y * y < 0.0001) {
    return 12;
  }

  const fullTurn = Math.PI * 2;
  const clockwiseFromTop = (Math.atan2(x, y) + fullTurn) % fullTurn;
  const sector = Math.round((clockwiseFromTop / fullTurn) * 12) % 12;
  return sector === 0 ? 12 : sector;
}

export function getPoetryLineWindowForHourSector(
  hourSector: number,
  pool: readonly number[],
  maxVisible = 2
): number[] {
  const normalizedSector = Math.round(hourSector);
  const windowIndex = normalizedSector === 12 ? 0 : Math.max(0, normalizedSector);
  return getPoetryLineWindow(windowIndex, pool, maxVisible);
}
