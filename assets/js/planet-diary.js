(function () {
  const archive = window.ZEYU_REN_PLANET_DIARY;
  const catalog = window.ZEYU_REN_PLANET_DIARY_CURATION;
  const translations = window.ZEYU_REN_PLANET_DIARY_TRANSLATIONS;
  const root = document.querySelector(".planet-catalog");
  if (!archive || !catalog || !root) return;

  const definitions = catalog.definitions;
  const translationsById = translations?.entries || {};
  const baseById = new Map(archive.entries.map((entry) => [entry.id, entry]));
  const entriesById = new Map();
  const entries = Object.values(catalog.entries)
    .map((entry) => {
      const base = baseById.get(entry.id) || {};
      const merged = {
        ...base,
        ...entry,
        ...translationsById[entry.id],
        storyZh: translationsById[entry.id]?.storyZh || base.story || "",
        storyEn: translationsById[entry.id]?.storyEn || base.story || "",
        taglineZh: translationsById[entry.id]?.taglineZh || entry.tagline || "",
        taglineEn: translationsById[entry.id]?.taglineEn || entry.tagline || "",
        searchText: ""
      };
      merged.searchText = buildSearchText(merged);
      entriesById.set(merged.id, merged);
      return merged;
    })
    .sort((left, right) => right.number - left.number);
  const armColors = {
    archive: "#8fa7ff",
    verdant: "#75d39a",
    forge: "#ff846f",
    pelagic: "#58c9e8",
    civic: "#f2c85b",
    frontier: "#c79bf2"
  };
  const validViews = new Set(["today", "detail", "gallery", "list", "map", "about"]);
  const validSortFields = new Set(["number", "name", "date", "arm", "system", "world", "habitability", "synopsis"]);
  const url = new URL(window.location.href);
  const storedLanguage = (() => {
    try {
      return window.localStorage.getItem("planetDiaryLanguage");
    } catch (_) {
      return null;
    }
  })();
  const storedMapTheme = (() => {
    try {
      return window.localStorage.getItem("planetDiaryMapTheme");
    } catch (_) {
      return null;
    }
  })();
  const likedPlanetIds = (() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem("planetDiaryLikedPlanets") || "[]");
      return new Set(Array.isArray(stored) ? stored.map(String) : []);
    } catch (_) {
      return new Set();
    }
  })();
  const migratedPublicLikeIds = (() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem("planetDiaryMigratedPublicLikes") || "[]");
      return new Set(Array.isArray(stored) ? stored.map(String) : []);
    } catch (_) {
      return new Set();
    }
  })();
  const likesApiBase = String(
    window.PLANET_DIARY_LIKES_API || "https://planet-diary-likes.bitsai-zeyu.workers.dev/v1/likes"
  ).replace(/\/$/, "");
  const publicLikeCounts = new Map();
  const likeLoadRequests = new Map();
  const likeMutationVersions = new Map();
  const anonymousVisitorToken = getOrCreateAnonymousVisitorToken();
  const requestedLanguage = url.searchParams.get("lang");
  const initialLanguage = ["en", "zh"].includes(requestedLanguage)
    ? requestedLanguage
    : ["en", "zh"].includes(storedLanguage) ? storedLanguage : "en";
  const initialMapTheme = ["day", "night"].includes(storedMapTheme) ? storedMapTheme : "day";
  const initialView = validViews.has(url.searchParams.get("view")) ? url.searchParams.get("view") : "today";
  const initialSortBy = validSortFields.has(url.searchParams.get("order")) ? url.searchParams.get("order") : "number";
  const requestedSortDirection = url.searchParams.get("sort");
  const initialHashId = window.location.hash.replace(/^#planet-/, "");
  const requestedPlanetId = url.searchParams.get("planet") || initialHashId;
  const initialFocusedId = entriesById.has(requestedPlanetId) ? requestedPlanetId : null;
  const state = {
    view: initialView,
    query: url.searchParams.get("q") || "",
    year: url.searchParams.get("year") || "all",
    arm: url.searchParams.get("arm") || "all",
    system: url.searchParams.get("system") || "all",
    habitability: url.searchParams.get("hab") || "all",
    sortBy: initialSortBy,
    sort: ["asc", "desc"].includes(requestedSortDirection) ? requestedSortDirection : defaultSortDirection(initialSortBy),
    language: initialLanguage,
    mapTheme: initialMapTheme,
    filtersOpen: false,
    visible: { detail: 12, gallery: 48, list: 120 },
    focusedId: initialFocusedId,
    selectedId: null
  };

  const nodes = {
    total: root.querySelector("[data-planet-total]"),
    result: root.querySelector("[data-planet-result-count]"),
    filterForm: root.querySelector("[data-planet-filters]"),
    filterToggle: root.querySelector("[data-planet-filter-toggle]"),
    filterCount: root.querySelector("[data-planet-filter-count]"),
    search: root.querySelector("[data-planet-search]"),
    home: root.querySelector("[data-planet-home]"),
    year: root.querySelector("[data-planet-year]"),
    arm: root.querySelector("[data-planet-arm]"),
    system: root.querySelector("[data-planet-system]"),
    habitability: root.querySelector("[data-planet-habitability]"),
    sortBy: root.querySelector("[data-planet-sort-by]"),
    sort: root.querySelector("[data-planet-sort]"),
    reset: root.querySelector("[data-planet-reset]"),
    focusNav: root.querySelector("[data-planet-focus-nav]"),
    focusBack: root.querySelector("[data-planet-focus-back]"),
    focusLabel: root.querySelector("[data-planet-focus-label]"),
    backToTop: root.querySelector("[data-planet-back-to-top]"),
    today: root.querySelector("[data-planet-today]"),
    detail: root.querySelector("[data-planet-detail-list]"),
    gallery: root.querySelector("[data-planet-gallery]"),
    list: root.querySelector("[data-planet-list]"),
    map: root.querySelector("[data-planet-map]"),
    mapViewport: root.querySelector("[data-map-viewport]"),
    mapStage: root.querySelector("[data-planet-map-stage]"),
    mapFrame: root.querySelector("[data-map-frame]"),
    mapLegend: root.querySelector("[data-map-legend]"),
    mapTooltip: root.querySelector("[data-map-tooltip]"),
    mapSelection: root.querySelector("[data-map-selection]"),
    mapFullscreen: root.querySelector("[data-map-fullscreen]"),
    mapTheme: root.querySelector("[data-map-theme]")
  };

  const copy = {
    en: {
      catalogTitle: "Planet Diary",
      catalogTagline: "A new illustrated sci-fi world every day",
      worlds: "worlds",
      catalogControls: "Planet Diary controls",
      viewAs: "View Planet Diary as",
      today: "Today",
      cards: "Cards",
      todayFeature: "On This Day",
      nearestFeature: "Nearest Archive Date",
      otherOnThisDay: "Also on this day",
      relatedPlanets: "Related planets",
      gallery: "Gallery",
      list: "List",
      starMap: "Star Map",
      about: "About",
      aboutKicker: "Archive note",
      aboutTitle: "About Planet Diary",
      aboutParagraphOne: "Planet Diary is an ongoing illustrated science-fiction project by Rofix. Each entry pairs a painted world with a short story about its geography, biology, technology, folklore, or everyday life. Begun in 2016, the archive contains 943 worlds.",
      author: "Author",
      begun: "Begun",
      catalogSize: "Catalog",
      originalLanguage: "Original language",
      chinese: "Chinese",
      authorKicker: "Author",
      authorParagraph: "Rofix studied Design | Media Arts at UCLA and later earned a master's degree in Digital + Media from RISD. Published fiction includes work in Clarkesworld and the Chinese magazine Science Fiction World, where Rofix is also a columnist.",
      paperback: "Paperback",
      bookDescription: "In 2018, Planet Diary was published as a paperback collection of 120 illustrated worlds.",
      bookLink: "View the book on WeRead ↗",
      contact: "Contact",
      contactNote: "For publishing, exhibitions, translation, and other inquiries.",
      supportProject: "♥ Support Planet Diary ↗",
      filters: "Search and filters",
      search: "Search",
      searchAria: "Search names, stories, and properties",
      year: "Year",
      allYears: "All years",
      spiralArm: "Spiral arm",
      allArms: "All arms",
      system: "System",
      allSystems: "All systems",
      habitability: "Habitability",
      allClasses: "All classes",
      catalogNumber: "Catalog no.",
      sortOrder: "Order",
      sortBy: "Sort by",
      descending: "Descending",
      ascending: "Ascending",
      clear: "Clear",
      result: "result",
      results: "results",
      more: "More",
      detailNavigation: "Planet detail navigation",
      backToCatalog: "← All planets",
      planetaryRecord: "Planetary record",
      tableCatalog: "Planet Diary catalog",
      armLegend: "Spiral arm legend",
      mapControls: "Map controls",
      mapTitle: "Planet Diary star map",
      mapDescription: "A navigable map of 943 planets grouped into six spiral arms and twenty-four systems.",
      mapIndex: "Star Map",
      mapWorldCount: "worlds",
      mapSystemCount: "systems",
      mapArmCount: "spiral arms",
      mapSystemRoute: "System route",
      mapRelatedRoute: "Related world",
      enterFullscreen: "Enter fullscreen",
      exitFullscreen: "Exit fullscreen",
      closePanel: "Close planet panel",
      zoomIn: "Zoom in",
      zoomOut: "Zoom out",
      resetMap: "Reset map",
      switchToDay: "Switch to day mode",
      switchToNight: "Switch to night mode",
      backToTop: "Back to top",
      catalog: "Catalog",
      created: "Created",
      mapPosition: "Map position",
      spectrum: "Spectrum",
      world: "World",
      composition: "Composition",
      atmosphere: "Atmosphere",
      gravity: "Gravity",
      biosphere: "Biosphere",
      civilization: "Civilization",
      climate: "Climate",
      themes: "Themes",
      synopsis: "Synopsis",
      undated: "Undated",
      originalIllustration: "Original illustration",
      originalIllustrations: "original illustrations",
      plate: "Plate",
      story: "Story",
      planetActions: "Planet actions",
      like: "Like",
      liked: "Liked",
      likePlanet: "Like planet",
      unlikePlanet: "Remove like from planet",
      likeUnavailable: "Could not update like. Try again.",
      share: "Share",
      sharePlanet: "Share planet",
      linkCopied: "Copied",
      worldProfile: "World profile",
      relatedWorlds: "Related worlds",
      englishName: "Name",
      noMatches: "No matching planets.",
      notFound: "Planet not found.",
      openDetail: "Open detail",
      openPlanet: "Open",
      hab: "Hab."
    },
    zh: {
      catalogTitle: "星球日记",
      catalogTagline: "每天一个原创星球故事",
      worlds: "个世界",
      catalogControls: "星球日记浏览工具",
      viewAs: "星球日记视图",
      today: "今日",
      cards: "卡片",
      todayFeature: "今日星球",
      nearestFeature: "最近存档日期",
      otherOnThisDay: "同日其他星球",
      relatedPlanets: "相关星球",
      gallery: "图库",
      list: "列表",
      starMap: "星图",
      about: "关于",
      aboutKicker: "档案说明",
      aboutTitle: "关于《星球日记》",
      aboutParagraphOne: "《星球日记》是 Rofix 持续创作的图文科幻项目。每篇作品由一幅星球绘画和一则短篇故事组成，描绘地球之外某处的地理、生物、技术、民俗或日常生活。项目始于 2016 年，目前共收录 943 个世界。",
      author: "作者",
      begun: "始于",
      catalogSize: "收录",
      originalLanguage: "原始语言",
      chinese: "中文",
      authorKicker: "作者",
      authorParagraph: "Rofix 就读于 UCLA Design | Media Arts，后于 RISD Digital + Media 获得硕士学位。其科幻小说发表于英文科幻杂志 Clarkesworld 与中国《科幻世界》，同时也是《科幻世界》的专栏作者。",
      paperback: "纸质书",
      bookDescription: "2018 年，《星球日记》结集出版纸质书，收录 120 个图文星球故事。",
      bookLink: "在微信读书查看《星球日记》↗",
      contact: "联系",
      contactNote: "出版、展览、翻译及其他合作事宜。",
      supportProject: "♥ 支持《星球日记》↗",
      filters: "搜索与筛选",
      search: "搜索",
      searchAria: "搜索名称、故事与属性",
      year: "年份",
      allYears: "全部年份",
      spiralArm: "旋臂",
      allArms: "全部旋臂",
      system: "星系",
      allSystems: "全部星系",
      habitability: "适居等级",
      allClasses: "全部等级",
      catalogNumber: "编号排序",
      sortOrder: "顺序",
      sortBy: "排序属性",
      descending: "降序",
      ascending: "升序",
      clear: "清除",
      result: "条结果",
      results: "条结果",
      more: "更多",
      detailNavigation: "行星详情导航",
      backToCatalog: "← 全部星球",
      planetaryRecord: "行星档案",
      tableCatalog: "星球日记目录",
      armLegend: "旋臂图例",
      mapControls: "星图控制",
      mapTitle: "星球日记星图",
      mapDescription: "可浏览的943颗行星星图，分布于六条旋臂与二十四个星系。",
      mapIndex: "星图",
      mapWorldCount: "颗星球",
      mapSystemCount: "个星系",
      mapArmCount: "条旋臂",
      mapSystemRoute: "星系航路",
      mapRelatedRoute: "关联星球",
      enterFullscreen: "进入全屏",
      exitFullscreen: "退出全屏",
      closePanel: "关闭星球面板",
      zoomIn: "放大",
      zoomOut: "缩小",
      resetMap: "重置星图",
      switchToDay: "切换至日间模式",
      switchToNight: "切换至夜间模式",
      backToTop: "返回顶部",
      catalog: "编号",
      created: "创作日期",
      mapPosition: "星图坐标",
      spectrum: "光谱",
      world: "类型",
      composition: "成分",
      atmosphere: "大气",
      gravity: "重力",
      biosphere: "生物圈",
      civilization: "文明",
      climate: "气候",
      themes: "主题",
      synopsis: "简介",
      undated: "日期不详",
      originalIllustration: "原作插画",
      originalIllustrations: "幅原作插画",
      plate: "图版",
      story: "故事",
      planetActions: "星球操作",
      like: "喜欢",
      liked: "已喜欢",
      likePlanet: "喜欢这颗星球",
      unlikePlanet: "取消喜欢这颗星球",
      likeUnavailable: "暂时无法更新，请重试。",
      share: "分享",
      sharePlanet: "分享这颗星球",
      linkCopied: "已复制",
      worldProfile: "行星档案",
      relatedWorlds: "相关星球",
      englishName: "名称",
      noMatches: "没有符合条件的星球。",
      notFound: "未找到这颗星球。",
      openDetail: "查看详情",
      openPlanet: "打开",
      hab: "适居"
    }
  };

  const initialMapScale = window.matchMedia("(max-width: 640px)").matches ? 1.25 : 1;
  const mapState = {
    built: false,
    scale: initialMapScale,
    x: 800 * (1 - initialMapScale),
    y: 450 * (1 - initialMapScale),
    targetScale: initialMapScale,
    targetX: 800 * (1 - initialMapScale),
    targetY: 450 * (1 - initialMapScale),
    animationFrame: null,
    drag: null,
    pointers: new Map(),
    pinch: null,
    suppressCanvasClick: false
  };
  let searchTimer;
  let backToTopFrame;
  let mapPointCache;

  function t(key) {
    return copy[state.language]?.[key] || copy.en[key] || key;
  }

  function createAnonymousVisitorToken() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function getOrCreateAnonymousVisitorToken() {
    const storageKey = "planetDiaryAnonymousVisitor";
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (/^[A-Za-z0-9_-]{20,96}$/.test(stored || "")) return stored;
      const token = createAnonymousVisitorToken();
      window.localStorage.setItem(storageKey, token);
      return token;
    } catch (_) {
      return createAnonymousVisitorToken();
    }
  }

  function formatLikeCount(count) {
    return new Intl.NumberFormat(state.language === "zh" ? "zh-CN" : "en-US", {
      notation: "compact",
      maximumFractionDigits: 1
    }).format(count);
  }

  function likeCountLabel(count) {
    if (!Number.isFinite(count)) return "";
    return state.language === "zh" ? `${count} 个喜欢` : `${count} ${count === 1 ? "like" : "likes"}`;
  }

  function likeButtonLabel(entry, liked, count) {
    const action = t(liked ? "unlikePlanet" : "likePlanet");
    const countLabel = likeCountLabel(count);
    return `${action} ${entryName(entry)}${countLabel ? `. ${countLabel}` : ""}`;
  }

  function entryName(entry) {
    return state.language === "zh" ? entry.chineseName : entry.englishName;
  }

  function entryStory(entry) {
    return state.language === "zh" ? entry.storyZh : entry.storyEn;
  }

  function entryTagline(entry) {
    return state.language === "zh" ? entry.taglineZh : entry.taglineEn;
  }

  function languageAttribute() {
    return state.language === "zh" ? "zh-Hans" : "en";
  }

  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function calendarDayIndex(value) {
    const match = String(value || "").match(/-(\d{2})-(\d{2})$/);
    if (!match) return Number.NaN;
    return Math.round((Date.UTC(2024, Number(match[1]) - 1, Number(match[2])) - Date.UTC(2024, 0, 1)) / 86400000);
  }

  function calendarDayDistance(left, right) {
    const distance = Math.abs(left - right);
    return Math.min(distance, 366 - distance);
  }

  function todayFeature(date = new Date()) {
    const todayKey = localDateKey(date);
    const monthDay = todayKey.slice(5);
    const exactMatches = entries.filter((entry) => String(entry.date || "").slice(5) === monthDay);
    let candidates = exactMatches;

    if (!candidates.length) {
      const targetDay = calendarDayIndex(todayKey);
      const ranked = entries
        .map((entry) => ({ entry, distance: calendarDayDistance(targetDay, calendarDayIndex(entry.date)) }))
        .filter((item) => Number.isFinite(item.distance));
      const nearestDistance = Math.min(...ranked.map((item) => item.distance));
      candidates = ranked.filter((item) => item.distance === nearestDistance).map((item) => item.entry);
    }

    candidates.sort((left, right) => String(right.date).localeCompare(String(left.date)) || left.number - right.number);
    if (!candidates.length) return null;
    const rotationIndex = ((date.getFullYear() - 2016) % candidates.length + candidates.length) % candidates.length;
    return {
      entry: candidates[rotationIndex],
      exact: Boolean(exactMatches.length),
      todayKey
    };
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    })[character]);
  }

  function buildSearchText(entry) {
    const labels = ["arms", "systems", "planetClasses", "compositions", "civilizations", "climates"]
      .flatMap((group) => [definitionLabel(group, entry[`${group === "planetClasses" ? "planetClass" : group.slice(0, -1)}Id`], "en"), definitionLabel(group, entry[`${group === "planetClasses" ? "planetClass" : group.slice(0, -1)}Id`], "zh")]);
    const themeLabels = (entry.themeIds || []).flatMap((id) => [definitionLabel("themes", id, "en"), definitionLabel("themes", id, "zh")]);
    return [
      entry.englishName,
      entry.chineseName,
      entry.storyZh,
      entry.storyEn,
      entry.taglineZh,
      entry.taglineEn,
      entry.date,
      entry.year,
      entry.number,
      entry.spectralClass,
      ...(entry.tags || []),
      ...labels,
      ...themeLabels
    ].join(" ").toLocaleLowerCase();
  }

  function definitionItem(group, id) {
    return definitions[group]?.[id] || null;
  }

  function definitionLabel(group, id, language = "en") {
    const item = definitionItem(group, id);
    if (!item) return id || "—";
    if (language === "zh") return item.nameZh || item.labelZh || item.name || item.label || item.code || id;
    return item.name || item.label || item.code || id;
  }

  function bilingualLabel(group, id) {
    return escapeHtml(definitionLabel(group, id, state.language));
  }

  function imageUrl(image) {
    return `./assets/archive/${String(image.file || "").split("/").map(encodeURIComponent).join("/")}`;
  }

  function displayDate(value) {
    if (!value) return t("undated");
    return new Intl.DateTimeFormat(state.language === "zh" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC"
    }).format(new Date(`${value}T12:00:00Z`));
  }

  function normalizedQuery(value) {
    return String(value || "").trim().toLocaleLowerCase();
  }

  function planetHref(id) {
    const parameters = new URLSearchParams({ planet: id });
    if (state.language === "zh") parameters.set("lang", "zh");
    return `./?${parameters.toString()}`;
  }

  function defaultSortDirection() {
    return "asc";
  }

  function sortFieldLabel(field) {
    const keys = {
      number: "catalog",
      name: "englishName",
      date: "created",
      arm: "spiralArm",
      system: "system",
      world: "world",
      habitability: "hab",
      synopsis: "synopsis"
    };
    return t(keys[field] || "catalog");
  }

  function sortValue(entry, field) {
    if (field === "number") return entry.number;
    if (field === "name") return entryName(entry);
    if (field === "date") return entry.date || "";
    if (field === "arm") return definitionLabel("arms", entry.armId, state.language);
    if (field === "system") return definitionLabel("systems", entry.systemId, state.language);
    if (field === "world") return definitionLabel("planetClasses", entry.planetClassId, state.language);
    if (field === "habitability") return entry.habitability || "";
    if (field === "synopsis") return entryTagline(entry);
    return entry.number;
  }

  function filteredEntries() {
    const query = normalizedQuery(state.query);
    const filtered = entries.filter((entry) => {
      if (state.year !== "all" && entry.year !== state.year) return false;
      if (state.arm !== "all" && entry.armId !== state.arm) return false;
      if (state.system !== "all" && entry.systemId !== state.system) return false;
      if (state.habitability !== "all" && entry.habitability !== state.habitability) return false;
      return !query || entry.searchText.includes(query);
    });
    const collator = new Intl.Collator(state.language === "zh" ? "zh-CN" : "en", {
      numeric: true,
      sensitivity: "base"
    });
    const direction = state.sort === "asc" ? 1 : -1;
    return filtered.sort((left, right) => {
      const leftValue = sortValue(left, state.sortBy);
      const rightValue = sortValue(right, state.sortBy);
      const comparison = typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : collator.compare(String(leftValue), String(rightValue));
      return comparison ? comparison * direction : (right.number - left.number);
    });
  }

  function populateSelect(select, values, formatter) {
    const first = select.querySelector("option")?.outerHTML || "";
    select.innerHTML = first + values.map((value) => (
      `<option value="${escapeHtml(value)}">${escapeHtml(formatter(value))}</option>`
    )).join("");
  }

  function setBaseOption(select, label) {
    const option = select.querySelector('option[value="all"]');
    if (option) option.textContent = label;
  }

  function populateControls() {
    setBaseOption(nodes.year, t("allYears"));
    setBaseOption(nodes.arm, t("allArms"));
    setBaseOption(nodes.habitability, t("allClasses"));
    populateSelect(nodes.year, [...new Set(entries.map((entry) => entry.year))].sort().reverse(), (year) => year);
    populateSelect(nodes.arm, Object.keys(definitions.arms), (id) => definitionLabel("arms", id, state.language));
    populateSelect(nodes.habitability, Object.keys(definitions.habitability), (id) => {
      const item = definitions.habitability[id];
      return `${item.code} · ${state.language === "zh" ? item.labelZh : item.label}`;
    });
    nodes.search.value = state.query;
    nodes.year.value = optionValue(nodes.year, state.year);
    nodes.arm.value = optionValue(nodes.arm, state.arm);
    nodes.habitability.value = optionValue(nodes.habitability, state.habitability);
    nodes.sortBy.value = state.sortBy;
    nodes.sort.value = state.sort;
    populateSystemSelect();
  }

  function optionValue(select, value) {
    return [...select.options].some((option) => option.value === value) ? value : "all";
  }

  function populateSystemSelect() {
    const systems = Object.keys(definitions.systems).filter((id) => (
      state.arm === "all" || definitions.systems[id].armId === state.arm
    ));
    nodes.system.innerHTML = `<option value="all">${escapeHtml(t("allSystems"))}</option>` + systems.map((id) => (
      `<option value="${escapeHtml(id)}">${escapeHtml(definitionLabel("systems", id, state.language))}</option>`
    )).join("");
    state.system = optionValue(nodes.system, state.system);
    nodes.system.value = state.system;
  }

  function updateUrl() {
    const next = new URL(window.location.href);
    if (state.focusedId) {
      next.search = "";
      next.searchParams.set("planet", state.focusedId);
      if (state.language === "zh") next.searchParams.set("lang", "zh");
      next.hash = "";
      window.history.replaceState({}, "", next);
      return;
    }

    next.searchParams.delete("planet");
    const values = {
      view: state.view === "today" ? "" : state.view,
      q: state.query,
      year: state.year === "all" ? "" : state.year,
      arm: state.arm === "all" ? "" : state.arm,
      system: state.system === "all" ? "" : state.system,
      hab: state.habitability === "all" ? "" : state.habitability,
      order: state.sortBy === "number" ? "" : state.sortBy,
      sort: state.sort === defaultSortDirection(state.sortBy) ? "" : state.sort,
      lang: state.language === "zh" ? "zh" : ""
    };
    Object.entries(values).forEach(([key, value]) => {
      if (value) next.searchParams.set(key, value);
      else next.searchParams.delete(key);
    });
    next.hash = "";
    window.history.replaceState({}, "", next);
  }

  function activeFilterCount() {
    return [
      Boolean(state.query),
      state.year !== "all",
      state.arm !== "all",
      state.system !== "all",
      state.habitability !== "all"
    ].filter(Boolean).length;
  }

  function syncFilterControls() {
    const count = activeFilterCount();
    const customSort = state.sortBy !== "number" || state.sort !== "asc";
    const label = t("filters");
    nodes.filterForm.hidden = !state.filtersOpen;
    nodes.filterToggle.setAttribute("aria-expanded", String(state.filtersOpen));
    nodes.filterToggle.setAttribute("aria-label", count ? `${label} (${count})` : label);
    nodes.filterToggle.title = label;
    nodes.filterToggle.classList.toggle("is-active", count > 0 || customSort);
    nodes.filterCount.hidden = count === 0;
    nodes.filterCount.textContent = String(count);
  }

  function setFiltersOpen(open, { restoreFocus = false } = {}) {
    state.filtersOpen = Boolean(open);
    syncFilterControls();
    if (restoreFocus) nodes.filterToggle.focus();
  }

  function syncStatus(filtered) {
    if (nodes.total) nodes.total.textContent = entries.length;
    if (nodes.result) nodes.result.textContent = state.language === "zh"
      ? `${filtered.length} ${t("results")}`
      : `${filtered.length} ${t(filtered.length === 1 ? "result" : "results")}`;
    syncFilterControls();
  }

  function applyStaticTranslations() {
    document.documentElement.lang = languageAttribute();
    root.classList.toggle("is-chinese", state.language === "zh");
    root.querySelectorAll("[data-i18n]").forEach((node) => {
      node.textContent = t(node.dataset.i18n);
    });
    root.querySelectorAll("[data-i18n-aria]").forEach((node) => {
      node.setAttribute("aria-label", t(node.dataset.i18nAria));
    });
    root.querySelectorAll("[data-planet-language]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.planetLanguage === state.language));
    });
    root.querySelectorAll("[data-planet-language-switch]").forEach((switcher) => {
      switcher.setAttribute("aria-label", state.language === "zh" ? "语言" : "Language");
    });

    nodes.year.setAttribute("aria-label", state.language === "zh" ? "按年份筛选" : "Filter by year");
    nodes.arm.setAttribute("aria-label", state.language === "zh" ? "按旋臂筛选" : "Filter by spiral arm");
    nodes.system.setAttribute("aria-label", state.language === "zh" ? "按星系筛选" : "Filter by system");
    nodes.habitability.setAttribute("aria-label", state.language === "zh" ? "按适居等级筛选" : "Filter by habitability");
    nodes.search.placeholder = t("search");
    nodes.sortBy.setAttribute("aria-label", state.language === "zh" ? "选择排序属性" : "Sort by property");
    const activeSortLabel = sortFieldLabel(state.sortBy);
    nodes.sort.setAttribute("aria-label", state.language === "zh"
      ? `${activeSortLabel}排序方向`
      : `${activeSortLabel} sort direction`);
    const mapButtonKeys = { in: "zoomIn", out: "zoomOut", reset: "resetMap" };
    root.querySelectorAll("[data-map-zoom]").forEach((button) => {
      const label = t(mapButtonKeys[button.dataset.mapZoom]);
      button.title = label;
      button.setAttribute("aria-label", label);
    });
    syncMapTheme();
    syncFullscreenButton();
    nodes.backToTop.title = t("backToTop");
    nodes.backToTop.setAttribute("aria-label", t("backToTop"));

    if (nodes.home) {
      nodes.home.href = state.language === "zh" ? "./?lang=zh" : "./";
    }
    if (nodes.focusBack) {
      nodes.focusBack.textContent = t("backToCatalog");
      nodes.focusBack.href = state.language === "zh" ? "./?view=detail&lang=zh" : "./?view=detail";
    }
    if (state.focusedId) {
      const entry = entriesById.get(state.focusedId);
      nodes.focusLabel.textContent = `#${entry.number} · ${entryName(entry)}`;
    }
    syncFilterControls();
    syncDocumentTitle();
  }

  function syncDocumentTitle() {
    if (state.focusedId) {
      const entry = entriesById.get(state.focusedId);
      document.title = state.language === "zh"
        ? `${entry.chineseName} — 星球日记 — Rofix`
        : `${entry.englishName} — Planet Diary — Rofix`;
      return;
    }
    if (state.view === "about") {
      document.title = state.language === "zh" ? "关于《星球日记》— Rofix" : "About Planet Diary — Rofix";
      return;
    }
    document.title = state.language === "zh" ? "星球日记 — Rofix" : "Planet Diary — Rofix";
  }

  function setLanguage(language, { update = true } = {}) {
    if (!["en", "zh"].includes(language) || state.language === language) return;
    state.language = language;
    try {
      window.localStorage.setItem("planetDiaryLanguage", language);
    } catch (_) {
      // URL state still preserves the choice when storage is unavailable.
    }
    applyStaticTranslations();
    populateControls();
    mapState.built = false;
    nodes.mapViewport.innerHTML = "";
    renderCurrentView();
    if (update) updateUrl();
  }

  function leaveFocusedRecord() {
    if (!state.focusedId) return false;
    state.focusedId = null;
    root.classList.remove("is-planet-focused");
    document.body.classList.remove("is-planet-record");
    nodes.focusNav.hidden = true;
    return true;
  }

  function navigateToView(view) {
    const leftRecord = leaveFocusedRecord();
    if (["today", "about"].includes(view) && state.query) {
      state.query = "";
      nodes.search.value = "";
      resetVisibleCounts();
    }
    setView(view);
    if (leftRecord) window.scrollTo({ top: 0, behavior: "auto" });
  }

  function prepareCatalogControls() {
    const shouldMoveToCards = state.focusedId || ["today", "about"].includes(state.view);
    if (!shouldMoveToCards) return false;
    leaveFocusedRecord();
    setView("detail", { update: false, render: false });
    return true;
  }

  function setView(view, { update = true, render = true } = {}) {
    if (state.focusedId) view = "detail";
    if (!validViews.has(view)) return;
    state.view = view;
    if (view === "about" || view === "today") setFiltersOpen(false);
    root.classList.toggle("is-about-view", view === "about");
    root.classList.toggle("is-today-view", view === "today");
    root.querySelectorAll("[data-planet-view]").forEach((button) => {
      const selected = button.dataset.planetView === view;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    root.querySelectorAll("[data-planet-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.planetPanel !== view;
    });
    syncDocumentTitle();
    if (render) renderCurrentView();
    if (update) updateUrl();
  }

  function propertyEntries(entry, { includeSynopsis = true } = {}) {
    const habitability = definitionItem("habitability", entry.habitability);
    const themes = (entry.themeIds || []).map((id) => bilingualLabel("themes", id)).join(" · ");
    const mapPosition = entry.map
      ? escapeHtml(`X ${Number(entry.map.x).toFixed(3)} · Y ${Number(entry.map.y).toFixed(3)}`)
      : "—";
    const properties = [
      [t("catalog"), `#${entry.number}`],
      [t("created"), displayDate(entry.date)],
      [t("spiralArm"), bilingualLabel("arms", entry.armId)],
      [t("system"), bilingualLabel("systems", entry.systemId)],
      [t("mapPosition"), mapPosition],
      [t("habitability"), escapeHtml(`${entry.habitability} · ${state.language === "zh" ? habitability?.labelZh || "—" : habitability?.label || "—"}`)],
      [t("spectrum"), escapeHtml(entry.spectralClass)],
      [t("world"), bilingualLabel("planetClasses", entry.planetClassId)],
      [t("composition"), bilingualLabel("compositions", entry.compositionId)],
      [t("atmosphere"), bilingualLabel("atmospheres", entry.atmosphereId)],
      [t("gravity"), bilingualLabel("gravities", entry.gravityId)],
      [t("biosphere"), bilingualLabel("biospheres", entry.biosphereId)],
      [t("civilization"), bilingualLabel("civilizations", entry.civilizationId)],
      [t("climate"), bilingualLabel("climates", entry.climateId)],
      [t("themes"), themes]
    ];
    if (includeSynopsis) properties.push([t("synopsis"), escapeHtml(entryTagline(entry) || "—")]);
    return properties;
  }

  function propertyList(entry, options) {
    return propertyEntries(entry, options).map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${value}</dd>`).join("");
  }

  function detailImages(entry) {
    if (!entry.images?.length) return '<figure class="planet-detail-media"></figure>';
    return `
      <figure class="planet-detail-media">
        ${entry.images.map((image, index) => `
          <img
            src="${escapeHtml(imageUrl(image))}"
            alt="${escapeHtml(`${entryName(entry)}${entry.images.length > 1 ? ` ${index + 1}` : ""}`)}"
            ${image.width && image.height ? `width="${image.width}" height="${image.height}"` : ""}
            loading="lazy"
            decoding="async"
          >
        `).join("")}
      </figure>
    `;
  }

  function focusedImages(entry) {
    const images = entry.images || [];
    return `
      <figure class="planet-record-plate">
        <div class="planet-record-plate-images${images.length > 1 ? " is-multiple" : ""}">
          ${images.map((image, index) => `
            <img
              src="${escapeHtml(imageUrl(image))}"
              alt="${escapeHtml(`${entryName(entry)}${images.length > 1 ? ` ${index + 1}` : ""}`)}"
              ${image.width && image.height ? `width="${image.width}" height="${image.height}"` : ""}
              ${index === 0 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'}
              decoding="async"
            >
          `).join("")}
        </div>
        <figcaption>
          <span>${t("plate")} #${entry.number}</span>
          <span>${images.length === 1 ? t("originalIllustration") : `${images.length} ${t("originalIllustrations")}`} · ${escapeHtml(displayDate(entry.date))}</span>
        </figcaption>
      </figure>
    `;
  }

  function planetActionsMarkup(entry) {
    const id = String(entry.id);
    const liked = likedPlanetIds.has(id);
    const count = publicLikeCounts.get(id);
    const name = entryName(entry);
    return `
      <div class="planet-record-actions" role="group" aria-label="${escapeHtml(t("planetActions"))}">
        <button
          class="planet-record-action planet-record-like${liked ? " is-liked" : ""}"
          type="button"
          data-planet-like="${escapeHtml(entry.id)}"
          aria-pressed="${liked}"
          aria-busy="${!Number.isFinite(count)}"
          aria-label="${escapeHtml(likeButtonLabel(entry, liked, count))}"
          title="${escapeHtml(likeButtonLabel(entry, liked, count))}"
        >
          <span class="planet-record-action-icon is-heart" aria-hidden="true"></span>
          <span class="planet-record-like-count" data-planet-like-count>${Number.isFinite(count) ? escapeHtml(formatLikeCount(count)) : "—"}</span>
        </button>
        <button
          class="planet-record-action planet-record-share"
          type="button"
          data-planet-share="${escapeHtml(entry.id)}"
          aria-label="${escapeHtml(`${t("sharePlanet")} ${name}`)}"
          title="${escapeHtml(`${t("sharePlanet")} ${name}`)}"
        >
          <span class="planet-record-action-icon is-share" aria-hidden="true"></span>
          <span class="visually-hidden" data-planet-share-status aria-live="polite"></span>
        </button>
      </div>
    `;
  }

  function detailMarkup(entry) {
    const related = (entry.relatedIds || []).map((id) => entriesById.get(id)).filter(Boolean);
    const name = state.focusedId === entry.id
      ? escapeHtml(entryName(entry))
      : `<a href="${escapeHtml(planetHref(entry.id))}">${escapeHtml(entryName(entry))}</a>`;
    return `
      <article class="planet-detail-card" id="planet-${escapeHtml(entry.id)}" data-planet-id="${escapeHtml(entry.id)}">
        <header class="planet-detail-meta">
          <h2 lang="${languageAttribute()}"><span>#${entry.number}</span>${name}</h2>
          <dl class="planet-property-list">${propertyList(entry, { includeSynopsis: false })}</dl>
        </header>
        ${detailImages(entry)}
        <div class="planet-detail-copy" lang="${languageAttribute()}">
          <p class="planet-detail-story">${escapeHtml(entryStory(entry) || "")}</p>
          ${related.length ? `
            <div class="planet-detail-links">
              ${related.map((item) => `<a href="${escapeHtml(planetHref(item.id))}">${escapeHtml(entryName(item))}</a>`).join("")}
            </div>
          ` : ""}
        </div>
      </article>
    `;
  }

  function todayMarkup(feature) {
    const { entry, exact, todayKey } = feature;
    const images = entry.images || [];
    const companions = todayCompanions(feature);
    return `
      <article class="planet-record planet-today-record" style="${armStyle(entry.armId)}" aria-labelledby="planet-today-feature-${escapeHtml(entry.id)}">
        <section class="planet-record-hero">
          <div class="planet-record-copy">
            <header class="planet-record-heading">
              <p class="planet-record-kicker planet-today-record-kicker">
                <span aria-hidden="true"></span>
                ${t(exact ? "todayFeature" : "nearestFeature")}
                <time datetime="${todayKey}">${escapeHtml(displayDate(todayKey))}</time>
              </p>
              <h1 id="planet-today-feature-${escapeHtml(entry.id)}" class="${entryName(entry).length > 18 ? "is-long-name" : ""}" lang="${languageAttribute()}">
                <a href="${escapeHtml(planetHref(entry.id))}">${escapeHtml(entryName(entry))}</a>
              </h1>
            </header>

            <div class="planet-record-hero-story">
              <p class="planet-record-label">${t("story")}</p>
              <p class="planet-record-hero-story-text" lang="${languageAttribute()}">${escapeHtml(entryStory(entry) || entryTagline(entry) || "")}</p>
              <div class="planet-record-hero-story-meta">
                <span class="planet-today-catalog-number">#${entry.number}</span>
                <span>${escapeHtml(displayDate(entry.date))}</span>
                <a href="${escapeHtml(planetHref(entry.id))}">${t("openDetail")} →</a>
              </div>
            </div>
          </div>

          <figure class="planet-record-plate planet-today-record-plate">
            <div class="planet-record-plate-images${images.length > 1 ? " is-multiple" : ""}">
              ${images.map((image, index) => `
                <img
                  src="${escapeHtml(imageUrl(image))}"
                  alt="${escapeHtml(`${entryName(entry)}${images.length > 1 ? ` ${index + 1}` : ""}`)}"
                  ${image.width && image.height ? `width="${image.width}" height="${image.height}"` : ""}
                  ${index === 0 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'}
                  decoding="async"
                >
              `).join("")}
            </div>
            <figcaption>
              <span>${images.length === 1 ? t("originalIllustration") : `${images.length} ${t("originalIllustrations")}`}</span>
              <span>${escapeHtml(displayDate(entry.date))}</span>
            </figcaption>
          </figure>
        </section>
      </article>
      ${companions.items.length ? `
        <section class="planet-today-companions" aria-labelledby="planet-today-companions-${escapeHtml(entry.id)}">
          <header class="planet-today-companions-header">
            <h2 id="planet-today-companions-${escapeHtml(entry.id)}">${t(companions.labelKey)}</h2>
            <span>(${companions.items.length})</span>
          </header>
          <div class="planet-gallery planet-today-gallery">
            ${companions.items.map(galleryMarkup).join("")}
          </div>
        </section>
      ` : ""}
    `;
  }

  function todayCompanions(feature) {
    const monthDay = feature.todayKey.slice(5);
    const sameDay = entries
      .filter((entry) => entry.id !== feature.entry.id && String(entry.date || "").slice(5) === monthDay)
      .sort((left, right) => String(right.date).localeCompare(String(left.date)) || left.number - right.number);
    if (sameDay.length) return { items: sameDay, labelKey: "otherOnThisDay" };

    const related = (feature.entry.relatedIds || [])
      .map((id) => entriesById.get(id))
      .filter(Boolean);
    if (related.length) return { items: related, labelKey: "relatedPlanets" };

    const sameSystem = entries
      .filter((entry) => entry.id !== feature.entry.id && entry.systemId === feature.entry.systemId)
      .slice(0, 4);
    return { items: sameSystem, labelKey: "relatedPlanets" };
  }

  function focusedDetailMarkup(entry) {
    const related = (entry.relatedIds || []).map((id) => entriesById.get(id)).filter(Boolean);
    const habitability = definitionItem("habitability", entry.habitability);
    const recordProperties = propertyEntries(entry).map(([label, value]) => `
      <div class="planet-record-property">
        <dt>${escapeHtml(label)}</dt>
        <dd>${value}</dd>
      </div>
    `).join("");
    const relatedMarkup = related.length ? `
      <section class="planet-record-section planet-record-related">
        <header class="planet-record-section-header">
          <span>02</span>
          <h2>${t("relatedWorlds")}</h2>
        </header>
        <div class="planet-gallery planet-record-related-gallery">
          ${related.map(galleryMarkup).join("")}
        </div>
      </section>
    ` : "";

    return `
      <article
        class="planet-record"
        id="planet-${escapeHtml(entry.id)}"
        data-planet-id="${escapeHtml(entry.id)}"
        style="${armStyle(entry.armId)}"
      >
        <section class="planet-record-hero">
          <div class="planet-record-copy">
            <header class="planet-record-heading">
              <p class="planet-record-kicker"><span aria-hidden="true"></span>${t("catalogTitle")} · ${t("planetaryRecord")}</p>
              <h1 class="${entryName(entry).length > 18 ? "is-long-name" : ""}" lang="${languageAttribute()}">${escapeHtml(entryName(entry))}</h1>
            </header>

            <div class="planet-record-hero-story">
              <p class="planet-record-label">${t("story")}</p>
              <p class="planet-record-hero-story-text" lang="${languageAttribute()}">${escapeHtml(entryStory(entry) || entryTagline(entry) || "")}</p>
              <div class="planet-record-hero-story-meta">
                <span>${escapeHtml(displayDate(entry.date))}</span>
              </div>
              ${planetActionsMarkup(entry)}
            </div>

            <dl class="planet-record-key-facts">
              <div><dt>${t("catalog")}</dt><dd>#${entry.number}</dd></div>
              <div><dt>${t("system")}</dt><dd>${bilingualLabel("systems", entry.systemId)}</dd></div>
              <div><dt>${t("habitability")}</dt><dd>${escapeHtml(entry.habitability)} · ${escapeHtml(state.language === "zh" ? habitability?.labelZh || "—" : habitability?.label || "—")}</dd></div>
              <div><dt>${t("spectrum")}</dt><dd>${escapeHtml(entry.spectralClass || "—")}</dd></div>
            </dl>
          </div>

          ${focusedImages(entry)}
        </section>

        <section class="planet-record-section planet-record-profile">
          <header class="planet-record-section-header">
            <span>01</span>
            <h2>${t("worldProfile")}</h2>
          </header>
          <dl class="planet-record-properties">${recordProperties}</dl>
        </section>

        ${relatedMarkup}
      </article>
    `;
  }

  function galleryMarkup(entry) {
    const image = entry.images?.[0];
    return `
      <article class="planet-gallery-card">
        <a href="${escapeHtml(planetHref(entry.id))}" aria-label="${t("openPlanet")} #${entry.number} ${escapeHtml(entryName(entry))}">
          <figure class="planet-gallery-media">
            ${image ? `<img src="${escapeHtml(imageUrl(image))}" alt="${escapeHtml(entryName(entry))}" ${image.width && image.height ? `width="${image.width}" height="${image.height}"` : ""} loading="lazy" decoding="async">` : ""}
          </figure>
          <div class="planet-gallery-caption" lang="${languageAttribute()}"><span>${escapeHtml(entryName(entry))}</span><small>#${entry.number}</small></div>
          <p class="planet-gallery-subtitle">${escapeHtml(displayDate(entry.date))}</p>
        </a>
      </article>
    `;
  }

  function listHeaderMarkup() {
    const header = (field, className, label) => {
      const active = state.sortBy === field;
      const ariaSort = active ? (state.sort === "asc" ? "ascending" : "descending") : "none";
      const indicator = active ? (state.sort === "asc" ? "↑" : "↓") : "";
      const ariaLabel = state.language === "zh" ? `按${label}排序` : `${t("sortBy")} ${label}`;
      return `
        <span class="${className}" role="columnheader" aria-sort="${ariaSort}">
          <button type="button" class="planet-table-sort" data-planet-sort-field="${field}" aria-label="${escapeHtml(ariaLabel)}">
            <span>${escapeHtml(label)}</span><span class="planet-table-sort-indicator" aria-hidden="true">${indicator}</span>
          </button>
        </span>
      `;
    };
    return `
      <div class="planet-table-row planet-table-head" role="row">
        ${header("number", "planet-table-number", t("catalog"))}
        ${header("name", "planet-table-name", t("englishName"))}
        ${header("date", "planet-table-date", t("created"))}
        ${header("arm", "planet-table-arm", t("spiralArm"))}
        ${header("system", "planet-table-system", t("system"))}
        ${header("world", "planet-table-class", t("world"))}
        ${header("synopsis", "planet-table-synopsis", t("synopsis"))}
      </div>
    `;
  }

  function listRowMarkup(entry) {
    return `
      <a class="planet-table-row" href="${escapeHtml(planetHref(entry.id))}" role="row" aria-label="${t("openPlanet")} #${entry.number} ${escapeHtml(entryName(entry))}">
        <span class="planet-table-number" role="cell">#${entry.number}</span>
        <span class="planet-table-name" role="cell" lang="${languageAttribute()}">${escapeHtml(entryName(entry))}</span>
        <span class="planet-table-date" role="cell">${escapeHtml(displayDate(entry.date))}</span>
        <span class="planet-table-arm" role="cell">${escapeHtml(definitionLabel("arms", entry.armId, state.language))}</span>
        <span class="planet-table-system" role="cell">${escapeHtml(definitionLabel("systems", entry.systemId, state.language))}</span>
        <span class="planet-table-class" role="cell">${escapeHtml(definitionLabel("planetClasses", entry.planetClassId, state.language))}</span>
        <span class="planet-table-synopsis" role="cell" lang="${languageAttribute()}">${escapeHtml(entryTagline(entry) || "—")}</span>
      </a>
    `;
  }

  function renderCurrentView() {
    if (state.focusedId) {
      const focused = entriesById.get(state.focusedId);
      const focusedEntries = focused ? [focused] : [];
      syncStatus(focusedEntries);
      renderFocusedDetail(focused);
      return;
    }

    const filtered = filteredEntries();
    syncStatus(filtered);
    if (state.view === "today") renderToday();
    if (state.view === "detail") renderDetail(filtered);
    if (state.view === "gallery") renderGallery(filtered);
    if (state.view === "list") renderList(filtered);
    if (state.view === "map") renderMap(filtered);
  }

  function renderToday() {
    const feature = todayFeature();
    nodes.today.innerHTML = feature ? todayMarkup(feature) : `<p class="planet-empty">${t("notFound")}</p>`;
    if (feature) dispatchMedia(nodes.today);
  }

  function renderFocusedDetail(entry) {
    nodes.detail.innerHTML = entry ? focusedDetailMarkup(entry) : `<p class="planet-empty">${t("notFound")}</p>`;
    updateMoreButton("detail", entry ? 1 : 0, entry ? 1 : 0);
    dispatchMedia(nodes.detail);
    if (entry) hydratePlanetLike(entry);
  }

  function renderDetail(filtered) {
    if (!state.focusedId && state.selectedId) {
      const selectedIndex = filtered.findIndex((entry) => entry.id === state.selectedId);
      if (selectedIndex >= state.visible.detail) {
        state.visible.detail = Math.ceil((selectedIndex + 1) / 12) * 12;
      }
    }
    const visible = state.focusedId ? filtered : filtered.slice(0, state.visible.detail);
    nodes.detail.innerHTML = visible.length ? visible.map(detailMarkup).join("") : `<p class="planet-empty">${t("noMatches")}</p>`;
    updateMoreButton("detail", visible.length, filtered.length);
    dispatchMedia(nodes.detail);
  }

  function renderGallery(filtered) {
    const visible = filtered.slice(0, state.visible.gallery);
    nodes.gallery.innerHTML = visible.length ? visible.map(galleryMarkup).join("") : `<p class="planet-empty">${t("noMatches")}</p>`;
    updateMoreButton("gallery", visible.length, filtered.length);
    dispatchMedia(nodes.gallery);
  }

  function renderList(filtered) {
    const visible = filtered.slice(0, state.visible.list);
    nodes.list.innerHTML = visible.length ? listHeaderMarkup() + visible.map(listRowMarkup).join("") : `<p class="planet-empty">${t("noMatches")}</p>`;
    updateMoreButton("list", visible.length, filtered.length);
  }

  function updateMoreButton(view, visible, total) {
    const button = root.querySelector(`[data-planet-more="${view}"]`);
    if (!button) return;
    button.hidden = visible >= total;
    button.textContent = `${t("more")} (${Math.min(view === "list" ? 120 : view === "gallery" ? 48 : 12, total - visible)})`;
  }

  function dispatchMedia(target) {
    document.dispatchEvent(new CustomEvent("zeyu:media-added", { detail: { root: target } }));
  }

  function armStyle(id) {
    return `--arm-color:${armColors[id] || "#ffffff"}`;
  }

  function rawMapPoint(entry) {
    const system = definitions.systems[entry.systemId];
    const offset = system?.mapOffset || { x: 0, y: 0 };
    const normalizedX = Math.max(0, Math.min(1, entry.map.x + offset.x));
    const normalizedY = Math.max(0, Math.min(1, entry.map.y + offset.y));
    return { x: 48 + normalizedX * 1504, y: 27 + normalizedY * 846 };
  }

  function mapPointSeed(value) {
    return [...String(value)].reduce((hash, character) => ((hash * 33) ^ character.charCodeAt(0)) >>> 0, 2166136261);
  }

  function relaxMapPoints(points, iterations, minimumDistance, anchorStrength = 0) {
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      for (let leftIndex = 0; leftIndex < points.length; leftIndex += 1) {
        const left = points[leftIndex];
        for (let rightIndex = leftIndex + 1; rightIndex < points.length; rightIndex += 1) {
          const right = points[rightIndex];
          const requiredDistance = minimumDistance + (left.spacing + right.spacing) * 0.5;
          const requiredSquared = requiredDistance ** 2;
          let deltaX = right.x - left.x;
          let deltaY = right.y - left.y;
          let distanceSquared = deltaX ** 2 + deltaY ** 2;
          if (distanceSquared >= requiredSquared) continue;
          if (distanceSquared < 0.0001) {
            const angle = ((mapPointSeed(`${left.entry.id}-${right.entry.id}`) % 360) / 180) * Math.PI;
            deltaX = Math.cos(angle) * 0.1;
            deltaY = Math.sin(angle) * 0.1;
            distanceSquared = 0.01;
          }
          const distance = Math.sqrt(distanceSquared);
          const movement = (requiredDistance - distance) * 0.46;
          const unitX = deltaX / distance;
          const unitY = deltaY / distance;
          left.x -= unitX * movement;
          left.y -= unitY * movement;
          right.x += unitX * movement;
          right.y += unitY * movement;
        }
      }
      if (anchorStrength) {
        points.forEach((point) => {
          point.x += (point.anchorX - point.x) * anchorStrength;
          point.y += (point.anchorY - point.y) * anchorStrength;
        });
      }
    }
  }

  function keepMapClusterInBounds(points) {
    if (!points.length) return;
    const bounds = points.reduce((box, point) => ({
      left: Math.min(box.left, point.x),
      right: Math.max(box.right, point.x),
      top: Math.min(box.top, point.y),
      bottom: Math.max(box.bottom, point.y)
    }), { left: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY, top: Number.POSITIVE_INFINITY, bottom: Number.NEGATIVE_INFINITY });
    let shiftX = 0;
    let shiftY = 0;
    if (bounds.left < 34) shiftX = 34 - bounds.left;
    if (bounds.right + shiftX > 1566) shiftX += 1566 - (bounds.right + shiftX);
    if (bounds.top < 25) shiftY = 25 - bounds.top;
    if (bounds.bottom + shiftY > 875) shiftY += 875 - (bounds.bottom + shiftY);
    points.forEach((point) => {
      point.x += shiftX;
      point.y += shiftY;
      point.anchorX += shiftX;
      point.anchorY += shiftY;
    });
  }

  function buildMapPointCache() {
    const grouped = new Map();
    entries.forEach((entry) => {
      const raw = rawMapPoint(entry);
      const seed = mapPointSeed(entry.id);
      const angle = ((seed % 360) / 180) * Math.PI;
      const jitter = 2 + ((seed >>> 9) % 50) / 10;
      const point = {
        entry,
        x: raw.x + Math.cos(angle) * jitter,
        y: raw.y + Math.sin(angle) * jitter,
        anchorX: raw.x,
        anchorY: raw.y,
        spacing: ((seed >>> 16) % 31) / 10
      };
      if (!grouped.has(entry.systemId)) grouped.set(entry.systemId, []);
      grouped.get(entry.systemId).push(point);
    });

    grouped.forEach((points) => {
      relaxMapPoints(points, 110, 10.8, 0.006);
      relaxMapPoints(points, 36, 10.8);
      keepMapClusterInBounds(points);
    });

    const allPoints = [...grouped.values()].flat();
    allPoints.forEach((point) => {
      point.anchorX = point.x;
      point.anchorY = point.y;
    });
    relaxMapPoints(allPoints, 18, 10.8, 0.01);
    relaxMapPoints(allPoints, 10, 10.8);
    allPoints.forEach((point) => {
      point.x = Math.max(28, Math.min(1572, point.x));
      point.y = Math.max(20, Math.min(880, point.y));
    });
    mapPointCache = new Map(allPoints.map((point) => [point.entry.id, { x: point.x, y: point.y }]));
  }

  function mapPoint(entry) {
    if (!mapPointCache) buildMapPointCache();
    return mapPointCache.get(entry.id) || rawMapPoint(entry);
  }

  function buildArmPaths() {
    return Object.keys(definitions.arms).map((armId, index) => {
      const angle = (index / 6) * Math.PI * 2 - Math.PI / 2;
      const startX = 800 + Math.cos(angle) * 80;
      const startY = 450 + Math.sin(angle) * 45;
      const controlX = 800 + Math.cos(angle + 0.58) * 430;
      const controlY = 450 + Math.sin(angle + 0.58) * 250;
      const endX = 800 + Math.cos(angle + 1.05) * 760;
      const endY = 450 + Math.sin(angle + 1.05) * 410;
      const labelProgress = 0.76;
      const remaining = 1 - labelProgress;
      const labelX = remaining ** 2 * startX + 2 * remaining * labelProgress * controlX + labelProgress ** 2 * endX;
      const labelY = remaining ** 2 * startY + 2 * remaining * labelProgress * controlY + labelProgress ** 2 * endY;
      const tangentX = 2 * remaining * (controlX - startX) + 2 * labelProgress * (endX - controlX);
      const tangentY = 2 * remaining * (controlY - startY) + 2 * labelProgress * (endY - controlY);
      let labelRotation = Math.atan2(tangentY, tangentX) * 180 / Math.PI;
      if (labelRotation > 90) labelRotation -= 180;
      if (labelRotation < -90) labelRotation += 180;
      const label = definitionLabel("arms", armId, state.language);
      return `
        <path class="planet-map-arm-path planet-map-arm-${armId}" data-map-arm-path="${armId}" d="M ${startX.toFixed(1)} ${startY.toFixed(1)} Q ${controlX.toFixed(1)} ${controlY.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}"></path>
        <text class="planet-map-arm-label" data-map-arm-path="${armId}" x="${labelX.toFixed(1)}" y="${(labelY - 10).toFixed(1)}" text-anchor="middle" transform="rotate(${labelRotation.toFixed(1)} ${labelX.toFixed(1)} ${(labelY - 10).toFixed(1)})" aria-hidden="true"><tspan class="planet-map-arm-label-index">${String(index + 1).padStart(2, "0")}</tspan><tspan dx="8">${escapeHtml(label)}</tspan></text>
      `;
    }).join("");
  }

  function mapDistance(left, right) {
    return ((left.x - right.x) ** 2) + ((left.y - right.y) ** 2);
  }

  function buildSystemEdges() {
    const systemEdges = [];
    Object.keys(definitions.systems).forEach((systemId) => {
      const points = entries
        .filter((entry) => entry.systemId === systemId)
        .map((entry) => ({ entry, ...mapPoint(entry) }));
      if (points.length < 2) return;

      const connected = new Set([0]);
      const remaining = new Set(points.slice(1).map((_, index) => index + 1));
      while (remaining.size) {
        let nearestFrom = null;
        let nearestTo = null;
        let nearestDistance = Number.POSITIVE_INFINITY;
        connected.forEach((fromIndex) => {
          remaining.forEach((toIndex) => {
            const distance = mapDistance(points[fromIndex], points[toIndex]);
            if (distance < nearestDistance) {
              nearestDistance = distance;
              nearestFrom = fromIndex;
              nearestTo = toIndex;
            }
          });
        });
        if (nearestFrom === null || nearestTo === null) break;
        const from = points[nearestFrom];
        const to = points[nearestTo];
        systemEdges.push(`<line class="planet-map-edge planet-map-system-edge" data-map-edge="${from.entry.id}|${to.entry.id}" data-map-system-edge="${systemId}" x1="${from.x.toFixed(1)}" y1="${from.y.toFixed(1)}" x2="${to.x.toFixed(1)}" y2="${to.y.toFixed(1)}"></line>`);
        connected.add(nearestTo);
        remaining.delete(nearestTo);
      }
    });
    return systemEdges;
  }

  function buildRelatedEdges() {
    const edgeKeys = new Set();
    const edgesBySystemPair = new Map();
    entries.forEach((entry) => {
      (entry.relatedIds || []).forEach((relatedId) => {
        const related = entriesById.get(relatedId);
        if (!related || related.systemId === entry.systemId) return;
        const key = [entry.id, relatedId].sort().join("-");
        if (edgeKeys.has(key)) return;
        edgeKeys.add(key);
        const from = mapPoint(entry);
        const to = mapPoint(related);
        const pair = [entry.systemId, related.systemId].sort().join("|");
        if (!edgesBySystemPair.has(pair)) edgesBySystemPair.set(pair, []);
        edgesBySystemPair.get(pair).push({ entry, related, from, to, distance: mapDistance(from, to) });
      });
    });
    return [...edgesBySystemPair.values()].flatMap((candidates) => (
      candidates
        .sort((left, right) => left.distance - right.distance)
        .slice(0, 4)
        .map(({ entry, related, from, to }) => (
          `<line class="planet-map-edge planet-map-related-edge" data-map-edge="${entry.id}|${related.id}" x1="${from.x.toFixed(1)}" y1="${from.y.toFixed(1)}" x2="${to.x.toFixed(1)}" y2="${to.y.toFixed(1)}"></line>`
        ))
    ));
  }

  function representativeMapEntries() {
    const selected = new Map();
    Object.keys(definitions.systems).forEach((systemId) => {
      const members = entries
        .filter((entry) => entry.systemId === systemId)
        .sort((left, right) => mapPoint(left).x - mapPoint(right).x || mapPoint(left).y - mapPoint(right).y);
      [members[Math.floor((members.length - 1) * 0.28)], members[Math.floor((members.length - 1) * 0.72)]]
        .filter(Boolean)
        .forEach((entry) => selected.set(entry.id, entry));
    });
    return [...selected.values()];
  }

  function approximateMapLabelWidth(label, fontSize) {
    return [...String(label)].reduce((width, character) => (
      width + (/[^\u0000-\u00ff]/.test(character) ? fontSize : fontSize * 0.57)
    ), 0);
  }

  function mapLabelBox(x, y, width, height, anchor) {
    const left = anchor === "end" ? x - width : anchor === "middle" ? x - width / 2 : x;
    return { left, right: left + width, top: y - height * 0.58, bottom: y + height * 0.42 };
  }

  function mapBoxesOverlap(left, right, padding = 5) {
    return !(
      left.right + padding < right.left ||
      right.right + padding < left.left ||
      left.bottom + padding < right.top ||
      right.bottom + padding < left.top
    );
  }

  function mapPointInBox(point, box, padding = 0) {
    return point.x >= box.left - padding && point.x <= box.right + padding && point.y >= box.top - padding && point.y <= box.bottom + padding;
  }

  function systemMapLayouts() {
    const allPoints = entries.map((entry) => ({ entry, ...mapPoint(entry) }));
    const systems = Object.keys(definitions.systems).map((systemId) => {
      const members = allPoints.filter(({ entry }) => entry.systemId === systemId);
      const center = members.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
      const centerPoint = {
        x: members.length ? center.x / members.length : 800,
        y: members.length ? center.y / members.length : 450
      };
      const label = definitionLabel("systems", systemId, state.language);
      return {
        systemId,
        members,
        center: centerPoint,
        label,
        width: Math.max(64, approximateMapLabelWidth(label.toUpperCase(), 10.5) * 1.18),
        countLabel: state.language === "zh" ? `${members.length}颗星球` : `${members.length} WORLDS`
      };
    }).sort((left, right) => right.width - left.width);

    const occupied = [{ left: 765, right: 835, top: 418, bottom: 486 }];
    systems.forEach((system) => {
      const radialLength = Math.hypot(system.center.x - 800, system.center.y - 450) || 1;
      const radial = { x: (system.center.x - 800) / radialLength, y: (system.center.y - 450) / radialLength };
      const tangent = { x: -radial.y, y: radial.x };
      const directions = [
        radial,
        { x: radial.x * 0.75 + tangent.x * 0.66, y: radial.y * 0.75 + tangent.y * 0.66 },
        { x: radial.x * 0.75 - tangent.x * 0.66, y: radial.y * 0.75 - tangent.y * 0.66 },
        tangent,
        { x: -tangent.x, y: -tangent.y },
        { x: -radial.x, y: -radial.y }
      ];
      const candidates = [];
      [34, 52, 76, 102, 132, 164].forEach((distance) => {
        directions.forEach((direction) => {
          const rawX = system.center.x + direction.x * distance;
          const rawY = system.center.y + direction.y * distance;
          const anchor = rawX >= system.center.x ? "start" : "end";
          const box = mapLabelBox(rawX, rawY, system.width, 28, anchor);
          if (box.left < 20 || box.right > 1580 || box.top < 20 || box.bottom > 880) return;
          const overlapCount = occupied.filter((placed) => mapBoxesOverlap(box, placed, 8)).length;
          const coveredNodes = allPoints.filter((point) => mapPointInBox(point, box, 9)).length;
          candidates.push({
            x: rawX,
            y: rawY,
            anchor,
            box,
            score: overlapCount * 10000 + coveredNodes * 180 + distance
          });
        });
      });
      const best = candidates.sort((left, right) => left.score - right.score)[0] || {
        x: system.center.x,
        y: system.center.y - 24,
        anchor: "middle",
        box: mapLabelBox(system.center.x, system.center.y - 24, system.width, 28, "middle")
      };
      occupied.push(best.box);
      Object.assign(system, best);
    });
    return { systems, occupied, allPoints };
  }

  function planetMapLabels(occupied, allPoints) {
    const labels = [];
    representativeMapEntries().forEach((entry) => {
      const point = mapPoint(entry);
      const label = entryName(entry);
      const width = Math.max(18, approximateMapLabelWidth(label, 7.5));
      const positions = [
        { x: point.x + 8, y: point.y - 8, anchor: "start" },
        { x: point.x + 8, y: point.y + 12, anchor: "start" },
        { x: point.x - 8, y: point.y - 8, anchor: "end" },
        { x: point.x - 8, y: point.y + 12, anchor: "end" }
      ];
      const placement = positions.find((candidate) => {
        const box = mapLabelBox(candidate.x, candidate.y, width, 11, candidate.anchor);
        if (box.left < 10 || box.right > 1590 || box.top < 10 || box.bottom > 890) return false;
        if (occupied.some((placed) => mapBoxesOverlap(box, placed, 6))) return false;
        const blocksNode = allPoints.some((other) => other.entry.id !== entry.id && mapPointInBox(other, box, 2));
        if (blocksNode) return false;
        candidate.box = box;
        return true;
      });
      if (!placement) return;
      occupied.push(placement.box);
      labels.push(`<text class="planet-map-planet-label" data-map-planet-label="${entry.id}" x="${placement.x.toFixed(1)}" y="${placement.y.toFixed(1)}" text-anchor="${placement.anchor}">${escapeHtml(label)}</text>`);
    });
    return labels.join("");
  }

  function buildMap() {
    if (mapState.built || !nodes.mapViewport) return;
    const systemEdges = buildSystemEdges();
    const relatedEdges = buildRelatedEdges();
    const labelLayout = systemMapLayouts();

    const systemLabels = labelLayout.systems.map((system) => {
      return `
        <g class="planet-map-system-label" data-map-system-label="${system.systemId}">
          <line class="planet-map-label-leader" x1="${system.center.x.toFixed(1)}" y1="${system.center.y.toFixed(1)}" x2="${system.x.toFixed(1)}" y2="${(system.y - 5).toFixed(1)}"></line>
          <g transform="translate(${system.x.toFixed(1)} ${(system.y - 9).toFixed(1)})">
            <text class="planet-map-system-name" text-anchor="${system.anchor}">${escapeHtml(system.label)}</text>
            <text class="planet-map-system-count" text-anchor="${system.anchor}" y="12">${escapeHtml(system.countLabel)}</text>
          </g>
        </g>
      `;
    }).join("");

    const markers = entries.map((entry) => {
      const point = mapPoint(entry);
      const scale = entry.habitability === "A" ? 1.05 : entry.habitability === "B" ? 0.9 : entry.habitability === "C" ? 0.72 : 0.58;
      return `
        <g class="planet-map-node" data-map-node="${entry.id}" transform="translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})" tabindex="0" role="button" aria-label="#${entry.number} ${escapeHtml(entryName(entry))}">
          <circle class="planet-map-node-hit" r="16"></circle>
          <circle class="planet-map-node-ring" r="7"></circle>
          <path class="planet-map-node-marker" transform="scale(${scale})" d="M 0 -5 L 1.12 -1.55 L 4.76 -1.55 L 1.82 0.59 L 2.94 4.05 L 0 1.91 L -2.94 4.05 L -1.82 0.59 L -4.76 -1.55 L -1.12 -1.55 Z"></path>
        </g>
      `;
    }).join("");

    const planetLabels = planetMapLabels(labelLayout.occupied, labelLayout.allPoints);

    nodes.mapViewport.innerHTML = `
      <defs>
        <pattern id="planet-map-minor-grid" width="25" height="25" patternUnits="userSpaceOnUse">
          <path d="M 25 0 L 0 0 0 25" class="planet-map-grid-minor"></path>
        </pattern>
        <pattern id="planet-map-major-grid" width="100" height="100" patternUnits="userSpaceOnUse">
          <rect width="100" height="100" fill="url(#planet-map-minor-grid)"></rect>
          <path d="M 100 0 L 0 0 0 100" class="planet-map-grid-major"></path>
        </pattern>
      </defs>
      <rect class="planet-map-paper" width="1600" height="900"></rect>
      <rect class="planet-map-grid" width="1600" height="900"></rect>
      <g class="planet-map-arm-guides">${buildArmPaths()}</g>
      <g class="planet-map-core" role="img" aria-label="${state.language === "zh" ? "空核" : "Void"}">
        <circle class="planet-map-core-orbit planet-map-core-orbit-outer" cx="800" cy="450" r="25"></circle>
        <circle class="planet-map-core-orbit" cx="800" cy="450" r="15"></circle>
        <circle class="planet-map-core-disc" cx="800" cy="450" r="6"></circle>
        <text class="planet-map-core-label" x="800" y="480" text-anchor="middle">${state.language === "zh" ? "空核" : "VOID"}</text>
      </g>
      <g class="planet-map-routes">${systemEdges.join("")}</g>
      <g class="planet-map-relations">${relatedEdges.join("")}</g>
      <g class="planet-map-nodes">${markers}</g>
      <g class="planet-map-planet-labels">${planetLabels}</g>
      <g class="planet-map-system-labels">${systemLabels}</g>
    `;
    nodes.mapLegend.innerHTML = Object.keys(definitions.arms).map((id, index) => {
      const count = entries.filter((entry) => entry.armId === id).length;
      return `<span><i>${String(index + 1).padStart(2, "0")}</i><b>${escapeHtml(definitionLabel("arms", id, state.language))}</b><small>${count}</small></span>`;
    }).join("");
    mapState.built = true;
    updateMapTransform();
  }

  function renderMap(filtered) {
    buildMap();
    const visibleIds = new Set(filtered.map((entry) => entry.id));
    const visibleSystems = new Set(filtered.map((entry) => entry.systemId));
    const visibleArms = new Set(filtered.map((entry) => entry.armId));
    const selectedEntry = entriesById.get(state.selectedId);
    if (selectedEntry) {
      visibleIds.add(selectedEntry.id);
      visibleSystems.add(selectedEntry.systemId);
      visibleArms.add(selectedEntry.armId);
    }
    nodes.mapViewport.querySelectorAll("[data-map-node]").forEach((node) => {
      node.classList.toggle("is-muted", !visibleIds.has(node.dataset.mapNode));
      node.classList.toggle("is-selected", node.dataset.mapNode === state.selectedId);
    });
    nodes.mapViewport.querySelectorAll("[data-map-edge]").forEach((edge) => {
      const [left, right] = edge.dataset.mapEdge.split("|");
      edge.classList.toggle("is-muted", !visibleIds.has(left) || !visibleIds.has(right));
    });
    nodes.mapViewport.querySelectorAll("[data-map-system-label]").forEach((label) => {
      label.classList.toggle("is-muted", !visibleSystems.has(label.dataset.mapSystemLabel));
    });
    nodes.mapViewport.querySelectorAll("[data-map-planet-label]").forEach((label) => {
      label.classList.toggle("is-muted", !visibleIds.has(label.dataset.mapPlanetLabel));
    });
    nodes.mapViewport.querySelectorAll("[data-map-arm-path]").forEach((path) => {
      path.classList.toggle("is-muted", !visibleArms.has(path.dataset.mapArmPath));
    });
    if (state.selectedId && visibleIds.has(state.selectedId)) renderMapSelection(entriesById.get(state.selectedId));
    else clearMapSelection();
  }

  function renderMapSelection(entry) {
    const image = entry.images?.[0];
    const story = entryStory(entry) || entryTagline(entry) || "—";
    const related = (entry.relatedIds || []).map((id) => entriesById.get(id)).filter(Boolean);
    const relatedMarkup = related.length ? `
      <section class="planet-map-selection-related">
        <p class="planet-map-selection-related-label">${t("relatedWorlds")}</p>
        <div class="planet-map-selection-related-list">
          ${related.map((item) => `
            <button type="button" data-map-related="${escapeHtml(item.id)}">
              <span>#${item.number}</span>
              <span>
                <strong lang="${languageAttribute()}">${escapeHtml(entryName(item))}</strong>
                <small>${escapeHtml(definitionLabel("systems", item.systemId, state.language))}</small>
              </span>
              <span aria-hidden="true">→</span>
            </button>
          `).join("")}
        </div>
      </section>
    ` : "";
    nodes.mapSelection.hidden = false;
    nodes.mapSelection.classList.toggle("has-image", Boolean(image));
    nodes.mapStage.classList.add("has-selection");
    nodes.mapSelection.innerHTML = `
      <button class="planet-map-selection-close" type="button" data-map-selection-close aria-label="${escapeHtml(t("closePanel"))}" title="${escapeHtml(t("closePanel"))}">×</button>
      ${image ? `<div class="planet-map-selection-media"><img src="${escapeHtml(imageUrl(image))}" alt="${escapeHtml(entryName(entry))}" loading="lazy" decoding="async"></div>` : ""}
      <div class="planet-map-selection-copy" lang="${languageAttribute()}">
        <p class="planet-map-selection-kicker">#${entry.number} · ${escapeHtml(definitionLabel("systems", entry.systemId, state.language))}</p>
        <h2><a href="${escapeHtml(planetHref(entry.id))}">${escapeHtml(entryName(entry))}</a></h2>
        <div class="planet-map-selection-story">
          <p class="planet-map-selection-story-label">${t("story")}</p>
          <p>${escapeHtml(story)}</p>
        </div>
        <dl class="planet-map-selection-facts">
          <div><dt>${t("created")}</dt><dd>${escapeHtml(displayDate(entry.date))}</dd></div>
        </dl>
        ${relatedMarkup}
        <a class="planet-map-detail-link" href="${escapeHtml(planetHref(entry.id))}">${t("openDetail")}</a>
      </div>
    `;
    dispatchMedia(nodes.mapSelection);
    keepMapEntryVisible(entry);
  }

  function clearMapSelection() {
    nodes.mapStage.classList.remove("has-selection");
    nodes.mapSelection.classList.remove("has-image");
    nodes.mapSelection.hidden = true;
    nodes.mapSelection.innerHTML = "";
  }

  function selectMapEntry(id, { center = false, zoom = false } = {}) {
    if (!entriesById.has(id)) return;
    state.selectedId = id;
    renderMap(filteredEntries());
    if (zoom) mapState.targetScale = Math.max(mapState.targetScale, 2.5);
    if (center) centerMapEntry(entriesById.get(id));
    updateUrl();
  }

  function updateMapTransform() {
    nodes.mapViewport?.setAttribute("transform", `translate(${mapState.x} ${mapState.y}) scale(${mapState.scale})`);
  }

  function stopMapAnimation() {
    if (mapState.animationFrame) window.cancelAnimationFrame(mapState.animationFrame);
    mapState.animationFrame = null;
    mapState.targetScale = mapState.scale;
    mapState.targetX = mapState.x;
    mapState.targetY = mapState.y;
  }

  function animateMapTransform() {
    mapState.animationFrame = null;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const easing = reducedMotion ? 1 : 0.18;
    mapState.scale += (mapState.targetScale - mapState.scale) * easing;
    mapState.x += (mapState.targetX - mapState.x) * easing;
    mapState.y += (mapState.targetY - mapState.y) * easing;
    const settled = (
      Math.abs(mapState.targetScale - mapState.scale) < 0.001 &&
      Math.abs(mapState.targetX - mapState.x) < 0.08 &&
      Math.abs(mapState.targetY - mapState.y) < 0.08
    );
    if (settled) {
      mapState.scale = mapState.targetScale;
      mapState.x = mapState.targetX;
      mapState.y = mapState.targetY;
    }
    updateMapTransform();
    if (!settled) mapState.animationFrame = window.requestAnimationFrame(animateMapTransform);
  }

  function scheduleMapAnimation() {
    if (!mapState.animationFrame) mapState.animationFrame = window.requestAnimationFrame(animateMapTransform);
  }

  function keepMapEntryVisible(entry) {
    if (window.matchMedia("(max-width: 640px)").matches) return;
    const point = mapPoint(entry);
    const screenPoint = {
      x: mapState.targetX + point.x * mapState.targetScale,
      y: mapState.targetY + point.y * mapState.targetScale
    };
    const bounds = { left: 55, right: 1010, top: 55, bottom: 845 };
    if (screenPoint.x < bounds.left) mapState.targetX += bounds.left - screenPoint.x;
    if (screenPoint.x > bounds.right) mapState.targetX += bounds.right - screenPoint.x;
    if (screenPoint.y < bounds.top) mapState.targetY += bounds.top - screenPoint.y;
    if (screenPoint.y > bounds.bottom) mapState.targetY += bounds.bottom - screenPoint.y;
    scheduleMapAnimation();
  }

  function centerMapEntry(entry) {
    const point = mapPoint(entry);
    const metrics = mapViewportMetrics();
    const panelRect = nodes.mapSelection.getBoundingClientRect();
    const anchor = { x: 800, y: 450 };

    if (window.matchMedia("(max-width: 640px)").matches) {
      const visibleHeight = Math.max(0, panelRect.top - metrics.rect.top);
      anchor.y = Math.max(80, Math.min(820, (visibleHeight / 2 - metrics.offsetY) / metrics.scale));
    } else {
      const visibleWidth = Math.max(0, panelRect.left - metrics.rect.left);
      anchor.x = Math.max(80, Math.min(1520, (visibleWidth / 2 - metrics.offsetX) / metrics.scale));
    }

    mapState.targetX = anchor.x - point.x * mapState.targetScale;
    mapState.targetY = anchor.y - point.y * mapState.targetScale;
    scheduleMapAnimation();
  }

  function mapIsMobile() {
    return window.matchMedia("(max-width: 640px)").matches;
  }

  function defaultMapTransform() {
    const scale = mapIsMobile() ? 1.25 : 1;
    return {
      scale,
      x: 800 * (1 - scale),
      y: 450 * (1 - scale)
    };
  }

  function zoomMap(multiplier, anchor = { x: 800, y: 450 }) {
    const oldScale = mapState.targetScale;
    const nextScale = Math.max(mapIsMobile() ? 1 : 0.65, Math.min(16, oldScale * multiplier));
    const ratio = nextScale / oldScale;
    mapState.targetX = anchor.x - (anchor.x - mapState.targetX) * ratio;
    mapState.targetY = anchor.y - (anchor.y - mapState.targetY) * ratio;
    mapState.targetScale = nextScale;
    scheduleMapAnimation();
  }

  function resetMap() {
    const next = defaultMapTransform();
    mapState.targetScale = next.scale;
    mapState.targetX = next.x;
    mapState.targetY = next.y;
    scheduleMapAnimation();
  }

  function syncMapTheme() {
    const isNight = state.mapTheme === "night";
    nodes.mapFrame.classList.toggle("is-night", isNight);
    nodes.mapTheme.setAttribute("aria-pressed", String(isNight));
    const label = t(isNight ? "switchToDay" : "switchToNight");
    nodes.mapTheme.title = label;
    nodes.mapTheme.setAttribute("aria-label", label);
  }

  function toggleMapTheme() {
    state.mapTheme = state.mapTheme === "night" ? "day" : "night";
    try {
      window.localStorage.setItem("planetDiaryMapTheme", state.mapTheme);
    } catch (_) {
      // The map still switches when storage is unavailable.
    }
    syncMapTheme();
  }

  function mapIsFullscreen() {
    return document.fullscreenElement === nodes.mapFrame;
  }

  function syncFullscreenButton() {
    if (!nodes.mapFullscreen) return;
    const supported = Boolean(nodes.mapFrame?.requestFullscreen && document.exitFullscreen);
    nodes.mapFullscreen.hidden = !supported;
    if (!supported) return;
    const label = t(mapIsFullscreen() ? "exitFullscreen" : "enterFullscreen");
    nodes.mapFullscreen.title = label;
    nodes.mapFullscreen.setAttribute("aria-label", label);
    nodes.mapFullscreen.setAttribute("aria-pressed", String(mapIsFullscreen()));
    nodes.mapFrame.classList.toggle("is-fullscreen", mapIsFullscreen());
  }

  async function toggleMapFullscreen() {
    if (!nodes.mapFrame?.requestFullscreen) return;
    try {
      if (mapIsFullscreen()) await document.exitFullscreen();
      else await nodes.mapFrame.requestFullscreen();
    } catch (_) {
      // Fullscreen can be denied by browser or embedding policy without affecting the map.
    }
  }

  function mapCoordinatesFromClient(clientX, clientY) {
    const metrics = mapViewportMetrics();
    return {
      x: Math.max(0, Math.min(1600, (clientX - metrics.rect.left - metrics.offsetX) / metrics.scale)),
      y: Math.max(0, Math.min(900, (clientY - metrics.rect.top - metrics.offsetY) / metrics.scale))
    };
  }

  function mapCoordinatesFromPointer(event) {
    return mapCoordinatesFromClient(event.clientX, event.clientY);
  }

  function beginMapPinch() {
    const points = [...mapState.pointers.values()].slice(0, 2);
    if (points.length < 2) return;
    const centerClient = {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2
    };
    const center = mapCoordinatesFromClient(centerClient.x, centerClient.y);
    mapState.pinch = {
      distance: Math.max(1, Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)),
      scale: mapState.scale,
      contentX: (center.x - mapState.x) / mapState.scale,
      contentY: (center.y - mapState.y) / mapState.scale
    };
    mapState.drag = null;
    mapState.suppressCanvasClick = true;
    nodes.mapStage.classList.add("is-dragging");
  }

  function updateMapPinch() {
    const points = [...mapState.pointers.values()].slice(0, 2);
    if (!mapState.pinch || points.length < 2) return;
    const centerClient = {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2
    };
    const center = mapCoordinatesFromClient(centerClient.x, centerClient.y);
    const distance = Math.max(1, Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y));
    const ratio = Math.pow(distance / mapState.pinch.distance, 1.08);
    const nextScale = Math.max(1, Math.min(16, mapState.pinch.scale * ratio));
    mapState.scale = nextScale;
    mapState.x = center.x - mapState.pinch.contentX * nextScale;
    mapState.y = center.y - mapState.pinch.contentY * nextScale;
    mapState.targetScale = mapState.scale;
    mapState.targetX = mapState.x;
    mapState.targetY = mapState.y;
    updateMapTransform();
  }

  function syncMapViewportMode() {
    const mode = window.matchMedia("(max-width: 640px)").matches
      ? "xMidYMid slice"
      : "xMidYMid meet";
    if (nodes.map.getAttribute("preserveAspectRatio") !== mode) {
      nodes.map.setAttribute("preserveAspectRatio", mode);
    }
  }

  function mapViewportMetrics() {
    const rect = nodes.map.getBoundingClientRect();
    const fillsFrame = nodes.map.getAttribute("preserveAspectRatio")?.includes("slice");
    const scale = (fillsFrame ? Math.max : Math.min)(rect.width / 1600, rect.height / 900);
    return {
      rect,
      scale,
      offsetX: (rect.width - 1600 * scale) / 2,
      offsetY: (rect.height - 900 * scale) / 2
    };
  }

  function showMapTooltip(entry, clientX, clientY) {
    const rect = nodes.mapStage.getBoundingClientRect();
    nodes.mapTooltip.hidden = false;
    nodes.mapTooltip.innerHTML = `
      <strong lang="${languageAttribute()}">#${entry.number} ${escapeHtml(entryName(entry))}</strong>
      <span>${escapeHtml(definitionLabel("systems", entry.systemId, state.language))} · ${escapeHtml(entry.habitability || "—")}</span>
    `;
    const left = Math.min(clientX - rect.left + 12, rect.width - nodes.mapTooltip.offsetWidth - 8);
    const top = Math.min(clientY - rect.top + 12, rect.height - nodes.mapTooltip.offsetHeight - 8);
    nodes.mapTooltip.style.left = `${Math.max(8, left)}px`;
    nodes.mapTooltip.style.top = `${Math.max(8, top)}px`;
  }

  function hideMapTooltip() {
    nodes.mapTooltip.hidden = true;
  }

  function clearFilters({ render = true } = {}) {
    state.query = "";
    state.year = "all";
    state.arm = "all";
    state.system = "all";
    state.habitability = "all";
    state.sortBy = "number";
    state.sort = "asc";
    nodes.search.value = "";
    nodes.year.value = "all";
    nodes.arm.value = "all";
    nodes.habitability.value = "all";
    nodes.sortBy.value = state.sortBy;
    nodes.sort.value = state.sort;
    populateSystemSelect();
    resetVisibleCounts();
    if (render) {
      renderCurrentView();
      updateUrl();
    }
  }

  function resetVisibleCounts() {
    state.visible = { detail: 12, gallery: 48, list: 120 };
  }

  function handleFilterChange() {
    prepareCatalogControls();
    state.query = nodes.search.value;
    state.year = nodes.year.value;
    state.arm = nodes.arm.value;
    state.system = nodes.system.value;
    state.habitability = nodes.habitability.value;
    state.sort = nodes.sort.value;
    state.selectedId = null;
    resetVisibleCounts();
    renderCurrentView();
    updateUrl();
  }

  function setSortField(field) {
    if (!validSortFields.has(field)) return;
    if (state.sortBy === field) {
      state.sort = state.sort === "asc" ? "desc" : "asc";
    } else {
      state.sortBy = field;
      state.sort = defaultSortDirection(field);
    }
    nodes.sortBy.value = state.sortBy;
    nodes.sort.value = state.sort;
    state.selectedId = null;
    resetVisibleCounts();
    renderCurrentView();
    updateUrl();
  }

  function syncBackToTop() {
    backToTopFrame = null;
    if (!nodes.backToTop) return;
    const visible = window.scrollY > Math.max(480, window.innerHeight * 0.8);
    nodes.backToTop.classList.toggle("is-visible", visible);
    nodes.backToTop.setAttribute("aria-hidden", String(!visible));
    nodes.backToTop.tabIndex = visible ? 0 : -1;
  }

  function scheduleBackToTopSync() {
    if (backToTopFrame) return;
    backToTopFrame = window.requestAnimationFrame(syncBackToTop);
  }

  function persistLikedPlanets() {
    try {
      window.localStorage.setItem("planetDiaryLikedPlanets", JSON.stringify([...likedPlanetIds]));
    } catch (_) {
      // The current page still reflects the choice when storage is unavailable.
    }
  }

  function persistMigratedPublicLikes() {
    try {
      window.localStorage.setItem("planetDiaryMigratedPublicLikes", JSON.stringify([...migratedPublicLikeIds]));
    } catch (_) {
      // Migration can be retried on a later visit when storage is unavailable.
    }
  }

  function syncLikeButton(button, entry) {
    const id = String(entry.id);
    const liked = likedPlanetIds.has(id);
    const count = publicLikeCounts.get(id);
    button.classList.toggle("is-liked", liked);
    button.setAttribute("aria-pressed", String(liked));
    button.setAttribute("aria-busy", "false");
    const actionLabel = likeButtonLabel(entry, liked, count);
    button.setAttribute("aria-label", actionLabel);
    button.setAttribute("title", actionLabel);
    const countNode = button.querySelector("[data-planet-like-count]");
    if (countNode) countNode.textContent = Number.isFinite(count) ? formatLikeCount(count) : "—";
  }

  function syncPlanetLikeButtons(entry) {
    const id = String(entry.id);
    root.querySelectorAll(`[data-planet-like="${CSS.escape(id)}"]`).forEach((button) => syncLikeButton(button, entry));
  }

  function applyPlanetLikeState(entry, nextState) {
    const id = String(entry.id);
    if (nextState.liked) likedPlanetIds.add(id);
    else likedPlanetIds.delete(id);
    if (Number.isFinite(nextState.count)) publicLikeCounts.set(id, Math.max(0, Number(nextState.count)));
    else publicLikeCounts.delete(id);
    persistLikedPlanets();
    syncPlanetLikeButtons(entry);
  }

  function likeEndpoint(entry, includeVisitor = false) {
    const endpoint = new URL(`${likesApiBase}/${encodeURIComponent(entry.id)}`);
    if (includeVisitor) endpoint.searchParams.set("visitor", anonymousVisitorToken);
    return endpoint.href;
  }

  async function parseLikeResponse(response) {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || t("likeUnavailable"));
      error.status = response.status;
      throw error;
    }
    const count = Number(payload.count);
    if (!Number.isFinite(count) || typeof payload.liked !== "boolean") throw new Error("Invalid likes response");
    return { count: Math.max(0, count), liked: payload.liked };
  }

  async function fetchPlanetLikeState(entry) {
    const response = await fetch(likeEndpoint(entry, true), {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      headers: { Accept: "application/json" }
    });
    return parseLikeResponse(response);
  }

  async function updatePlanetLikeState(entry, liked) {
    const response = await fetch(likeEndpoint(entry), {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ visitor: anonymousVisitorToken, liked })
    });
    return parseLikeResponse(response);
  }

  function markLikeUnavailable(entry) {
    const id = String(entry.id);
    root.querySelectorAll(`[data-planet-like="${CSS.escape(id)}"]`).forEach((button) => {
      button.disabled = false;
      button.classList.add("is-unavailable");
      button.setAttribute("aria-busy", "false");
      button.title = t("likeUnavailable");
      window.setTimeout(() => {
        button.classList.remove("is-unavailable");
        button.removeAttribute("title");
      }, 2200);
    });
  }

  function hydratePlanetLike(entry) {
    const id = String(entry.id);
    if (likeLoadRequests.has(id)) return likeLoadRequests.get(id);
    const mutationVersion = likeMutationVersions.get(id) || 0;
    const request = (async () => {
      let nextState = await fetchPlanetLikeState(entry);
      const shouldMigrate = likedPlanetIds.has(id) && !migratedPublicLikeIds.has(id) && !nextState.liked;
      if (shouldMigrate) nextState = await updatePlanetLikeState(entry, true);
      migratedPublicLikeIds.add(id);
      persistMigratedPublicLikes();
      if ((likeMutationVersions.get(id) || 0) === mutationVersion) applyPlanetLikeState(entry, nextState);
    })().catch(() => {
      if ((likeMutationVersions.get(id) || 0) === mutationVersion) markLikeUnavailable(entry);
    }).finally(() => {
      likeLoadRequests.delete(id);
    });
    likeLoadRequests.set(id, request);
    return request;
  }

  async function togglePlanetLike(button) {
    const entry = entriesById.get(button.dataset.planetLike);
    if (!entry || button.disabled) return;
    const id = String(entry.id);
    const previousState = {
      liked: likedPlanetIds.has(id),
      count: publicLikeCounts.get(id)
    };
    const nextLiked = !previousState.liked;
    const optimisticCount = Number.isFinite(previousState.count)
      ? Math.max(0, previousState.count + (nextLiked ? 1 : -1))
      : undefined;
    likeMutationVersions.set(id, (likeMutationVersions.get(id) || 0) + 1);
    applyPlanetLikeState(entry, { liked: nextLiked, count: optimisticCount });
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    try {
      const savedState = await updatePlanetLikeState(entry, nextLiked);
      migratedPublicLikeIds.add(id);
      persistMigratedPublicLikes();
      applyPlanetLikeState(entry, savedState);
    } catch (_) {
      applyPlanetLikeState(entry, previousState);
      markLikeUnavailable(entry);
    } finally {
      button.disabled = false;
      button.setAttribute("aria-busy", "false");
    }
  }

  function shareUrlFor(entry) {
    const shareUrl = new URL(window.location.href);
    shareUrl.search = "";
    shareUrl.searchParams.set("planet", entry.id);
    if (state.language === "zh") shareUrl.searchParams.set("lang", "zh");
    shareUrl.hash = "";
    return shareUrl.href;
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    if (!copied) throw new Error("Copy command was unavailable");
  }

  function showShareConfirmation(button, entry) {
    const status = button.querySelector("[data-planet-share-status]");
    window.clearTimeout(Number(button.dataset.shareTimer || 0));
    button.classList.add("is-confirmed");
    if (status) status.textContent = t("linkCopied");
    button.setAttribute("aria-label", t("linkCopied"));
    button.setAttribute("title", t("linkCopied"));
    const timer = window.setTimeout(() => {
      const actionLabel = `${t("sharePlanet")} ${entryName(entry)}`;
      button.classList.remove("is-confirmed");
      if (status) status.textContent = "";
      button.setAttribute("aria-label", actionLabel);
      button.setAttribute("title", actionLabel);
      delete button.dataset.shareTimer;
    }, 1800);
    button.dataset.shareTimer = String(timer);
  }

  async function sharePlanet(button) {
    const entry = entriesById.get(button.dataset.planetShare);
    if (!entry) return;
    const story = entryStory(entry).trim().replace(/\s+/g, " ");
    const storyPreview = state.language === "zh"
      ? `${story.slice(0, 64)}${story.length > 64 ? "…" : ""}`
      : story.split(" ").slice(0, 24).join(" ");
    const shareData = {
      title: `${entryName(entry)} — ${t("catalogTitle")}`,
      text: entryTagline(entry) || storyPreview,
      url: shareUrlFor(entry)
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    try {
      await copyText(shareData.url);
      showShareConfirmation(button, entry);
    } catch (_) {
      window.prompt(t("sharePlanet"), shareData.url);
    }
  }

  function bindEvents() {
    root.addEventListener("click", (event) => {
      const likeButton = event.target.closest("[data-planet-like]");
      if (likeButton) {
        togglePlanetLike(likeButton);
        return;
      }
      const shareButton = event.target.closest("[data-planet-share]");
      if (shareButton) sharePlanet(shareButton);
    });

    root.querySelectorAll("[data-planet-language]").forEach((button) => {
      button.addEventListener("click", () => setLanguage(button.dataset.planetLanguage));
    });

    root.querySelectorAll("[data-planet-view]").forEach((button) => {
      button.addEventListener("click", () => navigateToView(button.dataset.planetView));
      button.addEventListener("keydown", (event) => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        const tabs = [...root.querySelectorAll("[data-planet-view]")];
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const next = tabs[(tabs.indexOf(button) + direction + tabs.length) % tabs.length];
        next.focus();
        navigateToView(next.dataset.planetView);
      });
    });

    nodes.filterToggle.addEventListener("click", () => {
      setFiltersOpen(!state.filtersOpen);
    });

    nodes.focusBack?.addEventListener("click", (event) => {
      event.preventDefault();
      leaveFocusedRecord();
      setView("detail");
      window.scrollTo({ top: 0, behavior: "auto" });
    });

    nodes.search.addEventListener("input", () => {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(handleFilterChange, 120);
    });
    nodes.year.addEventListener("change", handleFilterChange);
    nodes.arm.addEventListener("change", () => {
      state.arm = nodes.arm.value;
      state.system = "all";
      populateSystemSelect();
      handleFilterChange();
    });
    nodes.system.addEventListener("change", handleFilterChange);
    nodes.habitability.addEventListener("change", handleFilterChange);
    nodes.sortBy.addEventListener("change", () => setSortField(nodes.sortBy.value));
    nodes.sort.addEventListener("change", handleFilterChange);
    nodes.list.addEventListener("click", (event) => {
      const button = event.target.closest("[data-planet-sort-field]");
      if (button) setSortField(button.dataset.planetSortField);
    });
    nodes.reset.addEventListener("click", () => clearFilters());
    nodes.backToTop?.addEventListener("click", () => {
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
      });
    });
    window.addEventListener("scroll", scheduleBackToTopSync, { passive: true });
    window.addEventListener("resize", scheduleBackToTopSync);
    window.addEventListener("resize", syncMapViewportMode);

    root.querySelectorAll("[data-planet-more]").forEach((button) => {
      button.addEventListener("click", () => {
        const view = button.dataset.planetMore;
        state.visible[view] += view === "list" ? 120 : view === "gallery" ? 48 : 12;
        renderCurrentView();
      });
    });

    nodes.mapStage.addEventListener("selectstart", (event) => event.preventDefault());
    nodes.mapStage.addEventListener("dragstart", (event) => event.preventDefault());
    nodes.mapStage.addEventListener("pointermove", (event) => {
      const mapNode = event.target.closest("[data-map-node]");
      if (mapNode && event.pointerType !== "touch") showMapTooltip(entriesById.get(mapNode.dataset.mapNode), event.clientX, event.clientY);
      else hideMapTooltip();
      if (mapState.pointers.has(event.pointerId)) {
        mapState.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }
      if (mapState.pinch && mapState.pointers.size >= 2) {
        event.preventDefault();
        updateMapPinch();
        return;
      }
      if (!mapState.drag) return;
      if (mapState.drag.pointerId !== event.pointerId) return;
      if (Math.hypot(event.clientX - mapState.drag.clientX, event.clientY - mapState.drag.clientY) > 4) {
        mapState.drag.moved = true;
      }
      const metrics = mapViewportMetrics();
      mapState.x = mapState.drag.x + (event.clientX - mapState.drag.clientX) / metrics.scale;
      mapState.y = mapState.drag.y + (event.clientY - mapState.drag.clientY) / metrics.scale;
      mapState.targetX = mapState.x;
      mapState.targetY = mapState.y;
      updateMapTransform();
    });
    nodes.mapStage.addEventListener("pointerdown", (event) => {
      if (event.target.closest("[data-map-selection]")) return;
      const mapNode = event.target.closest("[data-map-node]");
      if (!mapNode) event.preventDefault();
      stopMapAnimation();
      mapState.suppressCanvasClick = false;
      mapState.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (mapState.pointers.size >= 2) {
        event.preventDefault();
        mapState.pointers.forEach((_, pointerId) => {
          try {
            nodes.mapStage.setPointerCapture(pointerId);
          } catch (_) {
            // A pointer can end between the second contact and capture.
          }
        });
        beginMapPinch();
        return;
      }
      if (mapNode) return;
      mapState.drag = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, x: mapState.x, y: mapState.y, moved: false };
      nodes.mapStage.classList.add("is-dragging");
      nodes.mapStage.setPointerCapture(event.pointerId);
    });
    nodes.mapStage.addEventListener("pointerup", (event) => {
      const usedPinch = Boolean(mapState.pinch);
      const moved = Boolean(mapState.drag?.moved);
      mapState.pointers.delete(event.pointerId);
      mapState.suppressCanvasClick = usedPinch || moved;
      if (usedPinch && mapState.pointers.size === 1) {
        const [pointerId, point] = mapState.pointers.entries().next().value;
        mapState.pinch = null;
        mapState.drag = {
          pointerId,
          clientX: point.x,
          clientY: point.y,
          x: mapState.x,
          y: mapState.y,
          moved: true
        };
      } else if (!mapState.pointers.size) {
        mapState.pinch = null;
        mapState.drag = null;
        nodes.mapStage.classList.remove("is-dragging");
      }
      if (nodes.mapStage.hasPointerCapture(event.pointerId)) nodes.mapStage.releasePointerCapture(event.pointerId);
      window.setTimeout(() => {
        mapState.suppressCanvasClick = false;
      }, 0);
    });
    nodes.mapStage.addEventListener("pointercancel", (event) => {
      mapState.pointers.delete(event.pointerId);
      mapState.pinch = null;
      mapState.drag = null;
      mapState.suppressCanvasClick = true;
      nodes.mapStage.classList.remove("is-dragging");
      if (nodes.mapStage.hasPointerCapture(event.pointerId)) nodes.mapStage.releasePointerCapture(event.pointerId);
      window.setTimeout(() => {
        mapState.suppressCanvasClick = false;
      }, 0);
    });
    nodes.mapStage.addEventListener("pointerleave", hideMapTooltip);
    nodes.mapStage.addEventListener("wheel", (event) => {
      if (event.target.closest("[data-map-selection]")) return;
      event.preventDefault();
      const modeScale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      const pinchScale = event.ctrlKey ? 4 : 1;
      const multiplier = Math.exp(-event.deltaY * modeScale * pinchScale * 0.003);
      zoomMap(multiplier, mapCoordinatesFromPointer(event));
    }, { passive: false });
    nodes.mapStage.addEventListener("click", (event) => {
      if (mapState.suppressCanvasClick) return;
      const mapNode = event.target.closest("[data-map-node]");
      if (mapNode) {
        selectMapEntry(mapNode.dataset.mapNode);
        return;
      }
      if (event.target.closest("[data-map-selection]")) return;
      if (!state.selectedId) return;
      state.selectedId = null;
      renderMap(filteredEntries());
      updateUrl();
    });
    nodes.mapStage.addEventListener("dblclick", (event) => {
      if (event.target.closest("[data-map-selection]") || mapState.suppressCanvasClick) return;
      event.preventDefault();
      zoomMap(2, mapCoordinatesFromPointer(event));
    });
    nodes.mapStage.addEventListener("keydown", (event) => {
      const mapNode = event.target.closest("[data-map-node]");
      if (!mapNode || !["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      selectMapEntry(mapNode.dataset.mapNode);
    });
    nodes.mapSelection.addEventListener("click", (event) => {
      const relatedButton = event.target.closest("[data-map-related]");
      if (relatedButton) {
        event.stopPropagation();
        selectMapEntry(relatedButton.dataset.mapRelated, { center: true, zoom: true });
        return;
      }
      if (!event.target.closest("[data-map-selection-close]")) return;
      state.selectedId = null;
      renderMap(filteredEntries());
    });
    root.querySelectorAll("[data-map-zoom]").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.mapZoom === "in") zoomMap(mapIsMobile() ? 1.35 : 1.16);
        if (button.dataset.mapZoom === "out") zoomMap(mapIsMobile() ? 0.74 : 0.86);
        if (button.dataset.mapZoom === "reset") resetMap();
      });
    });
    nodes.mapFullscreen?.addEventListener("click", toggleMapFullscreen);
    nodes.mapTheme?.addEventListener("click", toggleMapTheme);
    document.addEventListener("fullscreenchange", () => {
      syncFullscreenButton();
      syncMapViewportMode();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (state.filtersOpen) {
        setFiltersOpen(false, { restoreFocus: true });
        return;
      }
      if (!state.selectedId || mapIsFullscreen()) return;
      state.selectedId = null;
      renderMap(filteredEntries());
    });
  }

  function initialize() {
    applyStaticTranslations();
    populateControls();
    bindEvents();
    syncMapViewportMode();
    if (state.focusedId) {
      state.view = "detail";
      root.classList.add("is-planet-focused");
      document.body.classList.add("is-planet-record");
      nodes.focusNav.hidden = false;
      applyStaticTranslations();
    }
    setView(state.view, { update: false });
    updateUrl();
    syncBackToTop();
    if (state.focusedId) window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
  }

  initialize();
})();
