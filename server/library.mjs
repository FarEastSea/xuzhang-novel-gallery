// Only fields consumed by the reading experience may cross the upstream boundary.
const pick = (value, keys) => Object.fromEntries(keys.split(' ').filter(key => value && Object.hasOwn(value, key)).map(key => [key, value[key]]));
const chapter = value => pick(value, 'id title order chapterStatus generationState chapterSummary targetWordCount wordCount content');
const novelKeys = 'id title description status projectStatus createdAt updatedAt bookSellingPoint first30ChapterPromise targetAudience writingMode narrativeForm narrativePov pacePreference emotionIntensity estimatedChapterCount defaultChapterLength';
function novel(value) {
  return { ...pick(value, novelKeys),
    genre: pick(value?.genre, 'id name description'),
    _count: pick(value?._count, 'chapters characters plotBeats'),
    bookProgress: pick(value?.bookProgress, 'writtenChapters targetChapters'),
    world: pick(value?.world, 'name worldType description overviewSummary geography politics conflicts axioms structureJson'),
    bookContract: pick(value?.bookContract, 'readingPromise protagonistFantasy coreSellingPoint chapter3Payoff chapter10Payoff chapter30Payoff escalationLadder'),
    characters: Array.isArray(value?.characters) ? value.characters.map(v => pick(v, 'id name role castRole identityLabel personality background currentGoal powerLevel firstImpression relationToProtagonist stanceLabel')) : [],
    volumes: Array.isArray(value?.volumes) ? value.volumes.map(v => pick(v, 'id sortOrder title summary openingHook mainPromise climax payoffType status')) : [],
    ...(Array.isArray(value?.chapters) ? { chapters: value.chapters.map(chapter) } : {}),
  };
}
export function projectReadingData(value, route) {
  if (route.endsWith('/chapters')) { if (!Array.isArray(value)) throw Object.assign(new Error('章节格式错误'), { status: 502 }); return value.map(chapter); }
  if (route === '/api/novels') { if (!Array.isArray(value?.items)) throw Object.assign(new Error('作品列表格式错误'), { status: 502 }); return { items: value.items.map(novel) }; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Object.assign(new Error('作品格式错误'), { status: 502 });
  return novel(value);
}
export function projectSnapshot(value) {
  if (!Array.isArray(value?.works)) throw new Error('Invalid snapshot');
  return { generatedAt: value.generatedAt || '', source: 'snapshot', works: value.works.map(v => ({
    ...pick(v, novelKeys + ' coverKey counts progress stats genre world bookContract characters volumes chapters'), workspaceSourceRoute: null,
  })) };
}
