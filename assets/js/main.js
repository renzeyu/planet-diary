(function () {
  const entries = window.ZEYU_REN_ENTRIES || [];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function withRoot(root, path) {
    if (!path) return "";
    if (/^(https?:|mailto:)/.test(path)) return path;
    return `${root || ""}${path}`;
  }

  function toList(value) {
    return (value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function entryDate(entry) {
    return entry.date || `${entry.year || "0000"}-01-01`;
  }

  function sortEntries(items) {
    return [...items].sort((a, b) => entryDate(b).localeCompare(entryDate(a)));
  }

  function matchesScope(entry, list) {
    const types = toList(list.dataset.types);
    const sections = toList(list.dataset.sections);
    const years = toList(list.dataset.years);
    const tags = toList(list.dataset.tags);

    if (types.length && !types.includes(entry.type)) return false;
    if (sections.length && !sections.includes(entry.section)) return false;
    if (years.length && !years.includes(String(entry.year))) return false;
    if (tags.length && !tags.some((tag) => (entry.tags || []).includes(tag))) return false;
    return true;
  }

  function getScopedEntries(list) {
    const limit = Number.parseInt(list.dataset.limit || "", 10);
    const scoped = sortEntries(entries.filter((entry) => matchesScope(entry, list)));
    return Number.isFinite(limit) ? scoped.slice(0, limit) : scoped;
  }

  function renderEntries() {
    document.querySelectorAll("[data-atlas-list]").forEach((list) => {
      const root = list.dataset.root || "";
      const items = getScopedEntries(list);
      list.innerHTML = items.length
        ? items.map((entry) => renderEntry(entry, root)).join("")
        : `<p class="empty-note">No entries currently published.</p>`;

      const filterTarget = list.id ? document.querySelector(`[data-filter-for="${list.id}"]`) : null;
      if (!items.length && filterTarget) {
        filterTarget.innerHTML = "";
        return;
      }
      if (filterTarget) setupFilters(filterTarget, list);
    });
  }

  function renderProjectDetails() {
    document.querySelectorAll("[data-project-detail-list]").forEach((list) => {
      const root = list.dataset.root || "";
      const tags = toList(list.dataset.tags);
      const scoped = sortEntries(entries.filter((entry) => (
        entry.section === "works" &&
        (!tags.length || tags.some((tag) => (entry.tags || []).includes(tag)))
      )));

      list.innerHTML = scoped.length
        ? scoped.map((entry) => renderProjectRecord(entry, root)).join("")
        : `<p class="empty-note">No entries currently published.</p>`;
    });
  }

  function renderWorkIndexes() {
    document.querySelectorAll("[data-work-index]").forEach((list) => {
      const root = list.dataset.root || "";
      const items = sortEntries(entries.filter((entry) => entry.section === "works"));

      list.innerHTML = items.length
        ? items.map((entry) => renderWorkIndexRow(entry, root)).join("")
        : `<p class="empty-note">No entries currently published.</p>`;
    });
  }

  function renderPlanetDiaryStorageSummary() {
    const summary = window.ZEYU_REN_PLANET_DIARY_SUMMARY;
    const card = document.querySelector("[data-planet-diary-storage]");
    if (!summary || !card) return;

    const range = card.querySelector("[data-planet-diary-range]");
    const total = card.querySelector("[data-planet-diary-total]");
    const cover = card.querySelector("[data-planet-diary-cover]");
    if (range) range.textContent = summary.firstYear === summary.lastYear
      ? summary.firstYear
      : `${summary.firstYear} - ${summary.lastYear}`;
    if (total) total.textContent = String(summary.postCount);
    if (cover && summary.cover) {
      cover.src = `./Planets Diary/${summary.cover}`;
      cover.alt = summary.coverAlt || "Planet Diary illustration";
    }
  }

  function renderWorkIndexRow(entry, root) {
    const url = withRoot(root, entry.url);
    const image = entry.image
      ? `<figure><a href="${url}"><img src="${withRoot(root, entry.image)}" alt="${escapeHtml(entry.title)} image" loading="lazy"></a></figure>`
      : `<figure aria-hidden="true"></figure>`;

    return `
      <article class="work-index-row" id="${escapeHtml(entry.id)}">
        <div class="work-index-row-title">
          <h2><a href="${url}">${escapeHtml(entry.title)}</a></h2>
          <p class="work-index-year">${escapeHtml(entry.year || "undated")}</p>
        </div>
        ${image}
        <div class="work-index-copy">
          <p>${escapeHtml(entry.description || "")}</p>
          <a href="${url}">View project</a>
        </div>
      </article>
    `;
  }

  function renderProcessGalleries() {
    document.querySelectorAll("[data-process-gallery]").forEach((container) => {
      const root = container.dataset.root || "";
      const items = (window.ZEYU_REN_PROCESS_ENTRIES || [])
        .filter((entry) => entry && !entry.hidden && entry.file)
        .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

      if (!items.length) {
        container.innerHTML = `<p class="empty-note">No process images currently published.</p>`;
        return;
      }

      const groups = new Map();
      items.forEach((entry) => {
        const year = processYear(entry);
        if (!groups.has(year)) groups.set(year, []);
        groups.get(year).push(entry);
      });

      container.innerHTML = [...groups.entries()].map(([year, entriesForYear]) => `
        <section class="process-year" aria-labelledby="process-${escapeHtml(year)}">
          <h1 id="process-${escapeHtml(year)}">${escapeHtml(year)}</h1>
          <div class="process-gallery">
            ${entriesForYear.map((entry) => renderProcessFigure(entry, root)).join("")}
          </div>
        </section>
      `).join("");
    });
  }

  function renderProcessFigure(entry, root) {
    const url = processAssetUrl(root, entry.file);
    const alt = entry.alt || entry.title || "Process image";
    const caption = entry.caption || formatProcessDate(entry.date);

    return `
      <figure>
        <a href="${escapeHtml(url)}">
          <img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy">
        </a>
        ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ""}
      </figure>
    `;
  }

  function processYear(entry) {
    const date = String(entry.date || "");
    const match = date.match(/^(\d{4})/);
    return match ? match[1].slice(2) : "??";
  }

  function formatProcessDate(value) {
    const date = String(value || "");
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : date;
  }

  function processAssetUrl(root, file) {
    const value = String(file || "");
    if (/^https?:/.test(value)) return value;
    const encoded = value.split("/").map((part) => encodeURIComponent(part)).join("/");
    return withRoot(root, encoded);
  }

  function renderHomepageLifePhotos() {
    const photos = window.ZEYU_REN_LIFE_PHOTOS || [];
    if (!photos.length) return;

    const slots = [...document.querySelectorAll([
      ".home-page main .home-ref-figure",
      ".home-page main .home-figure",
      ".home-page main .home-wide-figure",
      ".home-page main .home-small-figure",
      ".home-page main .home-chapter .chapter-figure",
      ".home-page main .home-project-highlights .highlight-figure"
    ].join(", "))];
    let sequentialSlot = 0;
    photos.forEach((photo) => {
      const requestedSlot = Number.parseInt(photo.slot || "", 10);
      const slotIndex = Number.isFinite(requestedSlot) && requestedSlot > 0
        ? requestedSlot - 1
        : sequentialSlot;
      sequentialSlot = Math.max(sequentialSlot, slotIndex + 1);

      const slot = slots[slotIndex];
      if (!slot || !photo || !photo.file) return;

      const image = slot.querySelector("img");
      const caption = slot.querySelector("figcaption");
      const label = photo.caption || lifePhotoCaption(photo.file, slotIndex + 1);
      const src = processAssetUrl("", `assets/images/life-photos/${photo.file}`);

      if (image) {
        image.src = src;
        image.alt = photo.alt || label.replace(/^Fig\s*\d+:\s*/i, "");
        image.loading = slotIndex === 0 ? "eager" : "lazy";
      }
      if (caption) caption.textContent = label;
      slot.dataset.lifePhoto = "true";
    });
  }

  function lifePhotoCaption(file, number) {
    const name = String(file || "")
      .replace(/\.[^.]+$/, "")
      .replace(/^Fig\s*0*\d+\s*/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return `Fig ${number}: ${name || "Life photo"}`;
  }

  function syncHomepageFigureCrops() {
    const cropPairs = [
      {
        target: document.querySelector(".home-chapter-two .chapter-two-wide img"),
        reference: document.querySelector(".home-chapter-two .chapter-two-single img"),
        size: "width"
      },
      {
        target: document.querySelector(".home-chapter-three .chapter-extra-wide img"),
        reference: document.querySelector(".home-chapter-three .chapter-three-companies-panel img"),
        size: "height"
      }
    ];

    if (!window.matchMedia("(min-width: 981px)").matches) {
      cropPairs.forEach(({ target }) => {
        if (target) target.style.height = "";
      });
      return;
    }

    cropPairs.forEach(({ target, reference, size }) => {
      if (!target || !reference) return;
      const rect = reference.getBoundingClientRect();
      const targetHeight = size === "width" ? rect.width : rect.height;
      if (targetHeight > 0) target.style.height = `${targetHeight}px`;
    });
  }

  function setupHomepageFigureCrops() {
    syncHomepageFigureCrops();
    let resizeFrame = 0;
    window.addEventListener("resize", () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(syncHomepageFigureCrops);
    });
  }

  function renderFeedIndexes() {
    document.querySelectorAll("[data-feed-index]").forEach((index) => {
      const root = index.dataset.root || "";
      let itemNumber = 0;
      const groups = [
        {
          numeral: "I",
          title: "Game Systems",
          ids: [
            "work-great-firewall-2015",
            "work-birds-on-attack-2015",
            "work-covert-jammer-2015",
            "work-tonde-iko-2015",
            "work-box-a-puzzle-game-2014",
            "work-a-mech-2014"
          ]
        },
        {
          numeral: "II",
          title: "Typography / Books",
          ids: [
            "work-25-words-25-works-2015",
            "work-typography-design-for-little-red-cap-2015",
            "work-book-of-little-red-cap-2015",
            "work-little-red-cap-2015"
          ]
        },
        {
          numeral: "III",
          title: "Moving Image",
          ids: [
            "work-la-morgen-2015",
            "work-game-over-2015",
            "work-paperback-2015"
          ]
        }
      ];

      index.innerHTML = groups.map((group) => {
        const items = group.ids
          .map((id) => entries.find((entry) => entry.id === id))
          .filter(Boolean)
          .map((entry) => renderFeedIndexItem(entry, root, ++itemNumber))
          .join("");

        return `
          <section class="feed-group">
            <header class="feed-group-heading">
              <p>${escapeHtml(group.numeral)}</p>
              <h2>${escapeHtml(group.title)}</h2>
            </header>
            <div class="feed-group-list">${items}</div>
          </section>
        `;
      }).join("");
    });
  }

  function renderFeedIndexItem(entry, root, number) {
    const meta = entry.meta || {};
    return `
      <article class="feed-index-item">
        <a href="${withRoot(root, entry.url)}">
          <span class="feed-number">${escapeHtml(number)}</span>
          <span class="feed-title">${escapeHtml(entry.title)}</span>
          <span class="feed-year">${escapeHtml(meta.term || entry.year || "undated")}</span>
        </a>
      </article>
    `;
  }

  function renderHomeShelves() {
    document.querySelectorAll("[data-home-shelves]").forEach((container) => {
      const root = container.dataset.root || "";
      const shelves = [
        {
          title: "Obsession with\nGame Systems",
          caption: "Rules, boards, puzzles, and playable systems.",
          ids: [
            "work-great-firewall-2015",
            "work-birds-on-attack-2015",
            "work-covert-jammer-2015",
            "work-tonde-iko-2015",
            "work-box-a-puzzle-game-2014"
          ]
        },
        {
          title: "Obsession with\nStory and Type",
          caption: "Typography, books, paper, fairy tales, and sequence.",
          ids: [
            "work-25-words-25-works-2015",
            "work-typography-design-for-little-red-cap-2015",
            "work-book-of-little-red-cap-2015",
            "work-little-red-cap-2015"
          ]
        },
        {
          title: "Obsession with\nMoving Image",
          caption: "Animation, video, timing, and short motion studies.",
          ids: [
            "work-la-morgen-2015",
            "work-game-over-2015",
            "work-paperback-2015"
          ]
        }
      ];

      container.innerHTML = shelves.map((shelf) => {
        const items = shelf.ids
          .map((id) => entries.find((entry) => entry.id === id))
          .filter(Boolean)
          .map((entry) => renderHomeShelfItem(entry, root))
          .join("");

        return `
          <section class="home-shelf">
            <div class="home-shelf-heading">
              <h2>${escapeHtml(shelf.title).replace(/\n/g, "<br>")}</h2>
              <p>${escapeHtml(shelf.caption)}</p>
            </div>
            <div class="home-shelf-items">${items}</div>
          </section>
        `;
      }).join("");
    });
  }

  function renderHomeShelfItem(entry, root) {
    return `
      <article class="home-shelf-item">
        <a href="${withRoot(root, entry.url)}">
          ${entry.image ? `<img src="${withRoot(root, entry.image)}" alt="${escapeHtml(entry.title)} image" loading="lazy">` : ""}
          <span class="home-shelf-title">${escapeHtml(entry.title)}</span>
          <span class="home-shelf-caption">${escapeHtml(entry.description || "")}</span>
        </a>
      </article>
    `;
  }

  function renderEntry(entry, root) {
    const tags = (entry.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
    const image = entry.image
      ? `<figure class="entry-image"><img src="${withRoot(root, entry.image)}" alt="${escapeHtml(entry.title)} image" loading="lazy"></figure>`
      : `<div class="entry-text-mark" aria-hidden="true">${escapeHtml(typeMark(entry.type))}</div>`;
    const publication = entry.publication
      ? `<p class="entry-publication">${escapeHtml(entry.publication.venue)}</p>`
      : "";

    return `
      <article class="entry-card" data-type="${escapeHtml(entry.type)}" data-year="${escapeHtml(String(entry.year || ""))}" data-tags="${escapeHtml((entry.tags || []).join("|"))}">
        <a href="${withRoot(root, entry.url)}">
          ${image}
          <div class="entry-meta">
            <span>${escapeHtml(entry.type)}</span>
            <span>${escapeHtml(entry.date || entry.year || "undated")}</span>
          </div>
          <h3>${escapeHtml(entry.title)}</h3>
          <p>${escapeHtml(entry.description || "")}</p>
          ${publication}
          <div class="tag-row" aria-label="Tags">${tags}</div>
        </a>
      </article>
    `;
  }

  function renderProjectRecord(entry, root) {
    const meta = entry.meta || {};
    const factRows = [
      ["Year", meta.term || entry.year],
      ["Course", meta.course],
      ["Medium", meta.medium],
      ["Size", meta.size],
      ["Software", meta.software]
    ].filter(([, value]) => value);
    const facts = factRows.map(([label, value]) => (
      `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
    )).join("");
    const tags = (entry.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
    const source = entry.sourceUrl
      ? `<a class="source-link" href="${escapeHtml(entry.sourceUrl)}" target="_blank" rel="noreferrer">Original project page</a>`
      : "";
    const related = (entry.related || [])
      .map((id) => entries.find((item) => item.id === id))
      .filter(Boolean)
      .map((item) => `<a href="#${escapeHtml(item.id)}">${escapeHtml(item.title)}</a>`)
      .join("");

    return `
      <article class="project-record" id="${escapeHtml(entry.id)}">
        <div class="project-record-media">
          ${entry.image ? `<img src="${withRoot(root, entry.image)}" alt="${escapeHtml(entry.title)} image" loading="lazy">` : ""}
        </div>
        <div class="project-record-body">
          <div class="entry-meta">
            <span>${escapeHtml(entry.type)}</span>
            <span>${escapeHtml(meta.term || entry.year || "undated")}</span>
          </div>
          <h2>${escapeHtml(entry.title)}</h2>
          <p>${escapeHtml(entry.description || "")}</p>
          <dl class="project-facts">${facts}</dl>
          <div class="tag-row" aria-label="Tags">${tags}</div>
          <div class="project-links">
            ${source}
            ${related ? `<p>Related: ${related}</p>` : ""}
          </div>
        </div>
      </article>
    `;
  }

  function enhanceNavigation() {
    const captions = {
      Work: "Projects index",
      Publications: "Writing archive",
      "Planet Diary": "943 illustrated worlds",
      Photography: "Moving around",
      Storage: "Folders & files",
      Credits: "Awards & Press",
      Contact: "Get in touch"
    };

    document.querySelectorAll(".site-title").forEach((title) => {
      title.innerHTML = "Rofix";
    });

    document.querySelectorAll(".site-nav").forEach((navigation) => {
      const links = [...navigation.querySelectorAll("a")];
      if (links.some((link) => link.textContent.trim() === "Planet Diary")) return;
      const publications = links.find((link) => link.textContent.trim() === "Publications");
      if (!publications) return;
      const planetDiary = document.createElement("a");
      planetDiary.href = publications.getAttribute("href").replace(/publications\/?(?:index\.html)?$/, "planet-diary/");
      planetDiary.textContent = "Planet Diary";
      planetDiary.dataset.caption = captions["Planet Diary"];
      publications.insertAdjacentElement("afterend", planetDiary);
    });

    document.querySelectorAll(".site-nav a").forEach((link) => {
      const label = link.textContent.trim();
      if (captions[label]) link.dataset.caption = captions[label];
    });
  }

  function injectFooter() {
    if (document.querySelector(".site-footer")) return;
    const footer = document.createElement("footer");
    footer.className = "site-footer";
    footer.innerHTML = `
      <p>Rofix<br>© 2026<br><span data-footer-clock title="Current time in New York">--:--:--</span></p>
      <p><a href="https://www.instagram.com/renzeyu/">Instagram</a><br><a href="https://vimeo.com/renzeyu">Vimeo</a><br><a href="https://www.linkedin.com/in/zeyuren">LinkedIn</a></p>
      <p>Design | Media Arts<br>UCLA<br>New York</p>
    `;
    document.body.appendChild(footer);
    setupFooterClock(footer);
  }

  function setupFooterClock(footer) {
    const clock = footer.querySelector("[data-footer-clock]");
    if (!clock) return;

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });

    function updateClock() {
      clock.textContent = formatter.format(new Date());
    }

    updateClock();
    window.setInterval(updateClock, 1000);
  }

  function setupFilters(filterTarget, list) {
    const items = [...list.querySelectorAll(".entry-card")];
    const types = unique(items.map((item) => item.dataset.type));
    const years = unique(items.map((item) => item.dataset.year)).sort().reverse();
    const tags = unique(items.flatMap((item) => (item.dataset.tags || "").split("|").filter(Boolean))).slice(0, 10);
    const filters = [
      { label: "All", value: "all" },
      ...types.map((value) => ({ label: value, value: `type:${value}` })),
      ...years.map((value) => ({ label: value, value: `year:${value}` })),
      ...tags.map((value) => ({ label: value, value: `tag:${value}` }))
    ];

    filterTarget.innerHTML = filters.map((filter, index) => (
      `<button type="button" data-local-filter="${escapeHtml(filter.value)}" aria-pressed="${index === 0 ? "true" : "false"}">${escapeHtml(filter.label)}</button>`
    )).join("");

    filterTarget.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        const filter = button.dataset.localFilter;
        filterTarget.querySelectorAll("button").forEach((item) => {
          item.setAttribute("aria-pressed", String(item === button));
        });
        items.forEach((item) => {
          item.hidden = filter !== "all" && !matchesFilter(item, filter);
        });
      });
    });
  }

  function matchesFilter(item, filter) {
    const [kind, value] = filter.split(":");
    if (kind === "type") return item.dataset.type === value;
    if (kind === "year") return item.dataset.year === value;
    if (kind === "tag") return (item.dataset.tags || "").split("|").includes(value);
    return true;
  }

  function unique(items) {
    return [...new Set(items.filter(Boolean))];
  }

  function typeMark(type) {
    const marks = {
      home: "HM",
      note: "NT",
      object: "OB",
      painting: "PT",
      place: "PL",
      planet: "PN",
      room: "RM",
      wardrobe: "WD",
      work: "WK",
      writing: "WR"
    };
    return marks[type] || String(type || "??").slice(0, 2).toUpperCase();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    }[char]));
  }

  function respectReducedMotion() {
    if (!reduceMotion) return;
    document.querySelectorAll("video[autoplay]").forEach((video) => {
      video.removeAttribute("autoplay");
      video.pause();
    });
  }

  function setupReelVideoToggle() {
    document.querySelectorAll("[data-reel-video]").forEach((video) => {
      const setLabel = () => {
        video.setAttribute("aria-label", `${video.paused ? "Play" : "Pause"} Reel, 2025`);
      };

      const togglePlayback = () => {
        if (video.paused) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
        setLabel();
      };

      video.tabIndex = 0;
      video.setAttribute("role", "button");
      video.addEventListener("click", togglePlayback);
      video.addEventListener("play", setLabel);
      video.addEventListener("pause", setLabel);
      video.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        togglePlayback();
      });
      setLabel();
    });
  }

  function setupScrollMediaReveal() {
    if (reduceMotion) return;

    const observedMedia = new WeakSet();
    const eligibleMedia = (root = document) => [...root.querySelectorAll("main img, main video, img, video")].filter((media) => (
      media.closest("main") &&
      !media.closest("button") &&
      !media.closest(".photo-lightbox") &&
      !media.closest(".storage-writing-icon") &&
      !media.closest(".storage-writing-actions") &&
      !media.closest(".work-index-icon")
    ));

    if (!("IntersectionObserver" in window)) {
      const reveal = (root) => eligibleMedia(root).forEach((media) => {
        media.classList.add("scroll-reveal-media", "is-visible");
      });
      reveal(document);
      document.addEventListener("zeyu:media-added", (event) => reveal(event.detail?.root || document));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("is-visible", entry.isIntersecting);
      });
    }, {
      rootMargin: "0px 0px -8% 0px",
      threshold: 0
    });

    const observe = (root = document) => {
      eligibleMedia(root).forEach((media) => {
        if (observedMedia.has(media)) return;
        observedMedia.add(media);
        media.classList.add("scroll-reveal-media");
        observer.observe(media);
      });
    };

    observe(document);
    document.addEventListener("zeyu:media-added", (event) => observe(event.detail?.root || document));
  }

  function setupWritingToggles() {
    document.querySelectorAll("[data-writing-toggle]").forEach((button) => {
      const panelId = button.getAttribute("aria-controls");
      const panel = panelId ? document.getElementById(panelId) : null;
      const record = button.closest(".storage-writing-record");
      if (!panel || !record) return;

      const collapsedLabel = button.dataset.collapsedLabel || "Expand";
      const expandedLabel = button.dataset.expandedLabel || "Collapse";
      const isIconToggle = Boolean(button.querySelector("img"));

      function setExpanded(expanded) {
        const actionLabel = expanded ? expandedLabel : collapsedLabel;
        record.classList.toggle("is-collapsed", !expanded);
        button.setAttribute("aria-expanded", String(expanded));
        button.setAttribute("aria-label", actionLabel);
        button.title = actionLabel;
        if (!isIconToggle) {
          button.textContent = actionLabel;
        }
      }

      record.classList.add("is-collapsible");
      setExpanded(false);

      button.addEventListener("click", () => {
        const expanded = button.getAttribute("aria-expanded") === "true";
        setExpanded(!expanded);
        if (expanded && record.getBoundingClientRect().top < 0) {
          record.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
        }
      });

      panel.addEventListener("click", (event) => {
        if (button.getAttribute("aria-expanded") === "true") return;
        if (event.target.closest("a, button, input, select, textarea, summary")) return;

        const rect = panel.getBoundingClientRect();
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        const fadeHeight = Math.min(rect.height, rem * 12);
        if (event.clientY >= rect.bottom - fadeHeight) {
          setExpanded(true);
        }
      });
    });
  }

  function setupWritingLanguageToggles() {
    document.querySelectorAll("[data-language-toggle]").forEach((toggle) => {
      const record = toggle.closest(".storage-writing-record");
      const buttons = [...toggle.querySelectorAll("[data-language-option]")];
      const cycleButton = toggle.querySelector("[data-language-cycle]");
      const languageTitle = record ? record.querySelector("[data-language-title]") : null;
      const panels = record ? [...record.querySelectorAll("[data-language-panel]")] : [];
      const metadata = record ? [...record.querySelectorAll("[data-meta-en][data-meta-zh]")] : [];
      const languages = panels.map((panel) => panel.dataset.languagePanel).filter(Boolean);
      if (!record || (!buttons.length && !cycleButton) || !panels.length || !languages.length) return;

      const languageLabels = {
        en: "English",
        zh: "Chinese",
      };

      function getNextLanguage(language) {
        const currentIndex = languages.indexOf(language);
        return languages[(currentIndex + 1) % languages.length] || languages[0];
      }

      function getTitle(language) {
        const titleKey = `title${language[0].toUpperCase()}${language.slice(1)}`;
        return languageTitle?.dataset[titleKey] || languageTitle?.dataset.titleEn || languageTitle?.textContent || "";
      }

      function renderTitle(target, title) {
        target.replaceChildren();
        title.split("|").forEach((part, index) => {
          if (index > 0) {
            target.appendChild(document.createElement("wbr"));
          }
          target.appendChild(document.createTextNode(part));
        });
      }

      function getMeta(item, language) {
        const metaKey = `meta${language[0].toUpperCase()}${language.slice(1)}`;
        return item.dataset[metaKey] || item.dataset.metaEn || item.innerHTML || "";
      }

      function syncTitleHeight() {
        if (!languageTitle) return;

        const titleWidth = languageTitle.getBoundingClientRect().width;
        if (!titleWidth) return;

        const clone = languageTitle.cloneNode(false);
        clone.removeAttribute("id");
        clone.style.position = "absolute";
        clone.style.visibility = "hidden";
        clone.style.pointerEvents = "none";
        clone.style.left = "-9999px";
        clone.style.top = "0";
        clone.style.width = `${titleWidth}px`;
        clone.style.minHeight = "0";
        clone.style.height = "auto";

        languageTitle.parentNode.appendChild(clone);
        const maxHeight = Math.max(...languages.map((language) => {
          renderTitle(clone, getTitle(language));
          return clone.getBoundingClientRect().height;
        }));
        clone.remove();

        languageTitle.style.minHeight = maxHeight ? `${Math.ceil(maxHeight)}px` : "";
      }

      function syncMetadataHeight() {
        metadata.forEach((item) => {
          const metaWidth = item.getBoundingClientRect().width;
          if (!metaWidth) return;

          const clone = item.cloneNode(false);
          clone.style.position = "absolute";
          clone.style.visibility = "hidden";
          clone.style.pointerEvents = "none";
          clone.style.left = "-9999px";
          clone.style.top = "0";
          clone.style.width = `${metaWidth}px`;
          clone.style.minHeight = "0";
          clone.style.height = "auto";

          item.parentNode.appendChild(clone);
          const maxHeight = Math.max(...languages.map((language) => {
            clone.innerHTML = getMeta(item, language);
            return clone.getBoundingClientRect().height;
          }));
          clone.remove();

          item.style.minHeight = maxHeight ? `${Math.ceil(maxHeight)}px` : "";
        });
      }

      function syncLanguageHeaderHeight() {
        syncTitleHeight();
        syncMetadataHeight();
      }

      function setLanguage(language) {
        const activeLanguage = languages.includes(language) ? language : languages[0];
        const nextLanguage = getNextLanguage(activeLanguage);
        toggle.dataset.currentLanguage = activeLanguage;

        buttons.forEach((button) => {
          const active = button.dataset.languageOption === activeLanguage;
          button.setAttribute("aria-pressed", String(active));
        });

        if (cycleButton) {
          const nextLabel = languageLabels[nextLanguage] || nextLanguage;
          cycleButton.setAttribute("aria-label", `Switch to ${nextLabel}`);
          cycleButton.title = `Switch to ${nextLabel}`;
          cycleButton.setAttribute("aria-pressed", String(activeLanguage !== languages[0]));
        }

        panels.forEach((panel) => {
          panel.hidden = panel.dataset.languagePanel !== activeLanguage;
        });

        if (languageTitle) {
          renderTitle(languageTitle, getTitle(activeLanguage));
        }

        metadata.forEach((item) => {
          item.innerHTML = getMeta(item, activeLanguage);
        });
      }

      const defaultLanguage = toggle.dataset.defaultLanguage || buttons[0]?.dataset.languageOption || languages[0];
      setLanguage(defaultLanguage);
      syncLanguageHeaderHeight();

      let titleResizeFrame = null;
      window.addEventListener("resize", () => {
        if (titleResizeFrame) {
          window.cancelAnimationFrame(titleResizeFrame);
        }
        titleResizeFrame = window.requestAnimationFrame(syncLanguageHeaderHeight);
      });

      buttons.forEach((button) => {
        button.addEventListener("click", () => {
          setLanguage(button.dataset.languageOption);
        });
      });

      if (cycleButton) {
        cycleButton.addEventListener("click", () => {
          setLanguage(getNextLanguage(toggle.dataset.currentLanguage || defaultLanguage));
        });
      }
    });
  }

  function setupImageLightbox({
    selector,
    viewerLabel,
    itemLabel = "image",
    bodyClass = "is-photo-lightbox-open",
    pressedClass = "is-photo-pressed",
    captionFor,
    sourceFor,
    dynamic = false
  }) {
    let lightboxImages = [...document.querySelectorAll(selector)];
    if (!lightboxImages.length && !dynamic) return;
    let activeTrigger = null;
    let currentIndex = 0;
    let activeAnimations = [];
    const enhancedImages = new WeakSet();
    const lightbox = document.createElement("div");
    lightbox.className = "photo-lightbox";
    lightbox.hidden = true;
    lightbox.setAttribute("role", "dialog");
    lightbox.setAttribute("aria-modal", "true");
    lightbox.setAttribute("aria-label", viewerLabel);
    lightbox.innerHTML = `
      <div class="photo-lightbox-backdrop" aria-hidden="true"></div>
      <button class="photo-lightbox-button photo-lightbox-close" type="button" aria-label="Close photo viewer"></button>
      <button class="photo-lightbox-button photo-lightbox-prev" type="button" aria-label="Previous photo"></button>
      <button class="photo-lightbox-button photo-lightbox-next" type="button" aria-label="Next photo"></button>
      <figure>
        <img alt="">
        <figcaption></figcaption>
      </figure>
    `;

    const closeButton = lightbox.querySelector(".photo-lightbox-close");
    const prevButton = lightbox.querySelector(".photo-lightbox-prev");
    const nextButton = lightbox.querySelector(".photo-lightbox-next");
    const lightboxImage = lightbox.querySelector("img");
    const lightboxCaption = lightbox.querySelector("figcaption");
    const lightboxBackdrop = lightbox.querySelector(".photo-lightbox-backdrop");

    function imageCaption(image) {
      if (captionFor) return captionFor(image);
      const caption = image.closest("figure")?.querySelector("figcaption");
      return caption ? caption.textContent.trim() : "";
    }

    function imageSource(image) {
      return sourceFor ? sourceFor(image) : image.currentSrc || image.src;
    }

    function loopIndex(index) {
      return (index + lightboxImages.length) % lightboxImages.length;
    }

    function viewportMargins() {
      if (window.innerWidth < 700) return { x: 16, y: 72 };
      return {
        x: Math.max(112, window.innerWidth * 0.11),
        y: 50
      };
    }

    function targetRectFor(image) {
      const margins = viewportMargins();
      const naturalWidth = lightboxImage.naturalWidth || image.naturalWidth || 1600;
      const naturalHeight = lightboxImage.naturalHeight || image.naturalHeight || 1000;
      const ratio = naturalWidth && naturalHeight ? naturalWidth / naturalHeight : 1;
      const maxWidth = Math.max(1, window.innerWidth - margins.x * 2);
      const maxHeight = Math.max(1, window.innerHeight - margins.y * 2);
      let width = Math.min(maxWidth, maxHeight * ratio);
      let height = width / ratio;

      if (height > maxHeight) {
        height = maxHeight;
        width = height * ratio;
      }

      return {
        left: (window.innerWidth - width) / 2,
        top: (window.innerHeight - height) / 2,
        width,
        height
      };
    }

    function setImageRect(rect) {
      lightboxImage.style.left = `${rect.left}px`;
      lightboxImage.style.top = `${rect.top}px`;
      lightboxImage.style.width = `${rect.width}px`;
      lightboxImage.style.height = `${rect.height}px`;
    }

    function animationRect(rect) {
      return {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`
      };
    }

    function visibleRect(rect) {
      return (
        rect &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.left < window.innerWidth &&
        rect.top < window.innerHeight
      );
    }

    function applyAnimationStyles(element, styles) {
      Object.entries(styles).forEach(([property, value]) => {
        element.style[property] = String(value);
      });
    }

    function clearAnimations() {
      activeAnimations.forEach((animation) => animation.cancel());
      activeAnimations = [];
    }

    function runAnimation(element, keyframes, options) {
      const finalStyles = keyframes[keyframes.length - 1];

      if (reduceMotion || !element.animate) {
        applyAnimationStyles(element, finalStyles);
        return Promise.resolve();
      }

      const animation = element.animate(keyframes, {
        ...options,
        fill: "both"
      });
      activeAnimations.push(animation);

      return animation.finished
        .then(() => {
          applyAnimationStyles(element, finalStyles);
        })
        .catch(() => {})
        .finally(() => {
          animation.cancel();
          activeAnimations = activeAnimations.filter((item) => item !== animation);
        });
    }

    function animateImage(fromRect, toRect, duration) {
      if (!toRect) return Promise.resolve();
      setImageRect(toRect);
      if (reduceMotion || !lightboxImage.animate || !visibleRect(fromRect)) {
        return Promise.resolve();
      }

      return runAnimation(
        lightboxImage,
        [animationRect(fromRect), animationRect(toRect)],
        {
          duration,
          easing: "cubic-bezier(0.19, 1, 0.22, 1)"
        }
      );
    }

    function animateBackdrop(fromOpacity, toOpacity, duration) {
      lightboxBackdrop.style.opacity = String(toOpacity);
      return runAnimation(
        lightboxBackdrop,
        [{ opacity: fromOpacity }, { opacity: toOpacity }],
        {
          duration,
          easing: "cubic-bezier(0.19, 1, 0.22, 1)"
        }
      );
    }

    function waitForImage() {
      if (lightboxImage.complete && lightboxImage.naturalWidth) return Promise.resolve();
      if (!lightboxImage.decode) return Promise.resolve();
      return lightboxImage.decode().catch(() => {});
    }

    function updateControls() {
      const hasGallery = lightboxImages.length > 1;
      prevButton.hidden = !hasGallery;
      nextButton.hidden = !hasGallery;
    }

    function setPhoto(index, options = {}) {
      currentIndex = loopIndex(index);
      activeTrigger = lightboxImages[currentIndex];
      const caption = imageCaption(activeTrigger);
      lightbox.dataset.index = String(currentIndex + 1);
      lightboxImage.src = imageSource(activeTrigger);
      lightboxImage.alt = activeTrigger.alt || caption || `Selected ${itemLabel}`;
      lightboxCaption.textContent = caption;
      updateControls();

      return waitForImage().then(() => {
        const targetRect = targetRectFor(activeTrigger);

        if (options.fromImage) {
          const duration = 420;
          return Promise.all([
            animateImage(options.fromImage.getBoundingClientRect(), targetRect, duration),
            animateBackdrop(0, 1, duration)
          ]).then(() => {});
        }

        setImageRect(targetRect);
        if (!reduceMotion && options.switching && lightboxImage.animate) {
          return runAnimation(
            lightboxImage,
            [{ opacity: 0 }, { opacity: 1 }],
            { duration: 180, easing: "ease-out" }
          );
        }

        return Promise.resolve();
      });
    }

    function openLightbox(image) {
      refreshLightboxImages();
      const imageIndex = lightboxImages.indexOf(image);
      if (imageIndex < 0) return;
      clearAnimations();
      image.classList.remove(pressedClass);
      lightbox.hidden = false;
      lightboxBackdrop.style.opacity = "0";
      lightbox.classList.remove("is-closing");
      lightbox.classList.add("is-open", "is-animating");
      document.body.classList.add(bodyClass);
      setPhoto(imageIndex, { fromImage: image }).then(() => {
        lightbox.classList.remove("is-animating");
        closeButton.focus();
      });
    }

    function closeLightbox() {
      if (lightbox.hidden) return;
      clearAnimations();
      lightbox.classList.add("is-closing", "is-animating");
      const targetImage = activeTrigger;
      const startRect = lightboxImage.getBoundingClientRect();
      const endRect = targetImage ? targetImage.getBoundingClientRect() : null;
      const duration = 320;

      Promise.all([
        animateImage(startRect, endRect, duration),
        animateBackdrop(1, 0, duration)
      ]).then(() => {
        lightbox.classList.remove("is-open", "is-closing", "is-animating");
        document.body.classList.remove(bodyClass);
        lightbox.hidden = true;
        lightboxImage.removeAttribute("src");
        lightboxImage.removeAttribute("style");
        lightboxBackdrop.removeAttribute("style");
        if (targetImage) targetImage.focus();
        activeTrigger = null;
      });
    }

    function showAdjacent(direction) {
      if (lightbox.hidden || lightbox.classList.contains("is-closing")) return;
      clearAnimations();
      setPhoto(currentIndex + direction, { switching: true });
    }

    function syncLightboxLayout() {
      if (lightbox.hidden || !activeTrigger || lightbox.classList.contains("is-closing")) return;
      setImageRect(targetRectFor(activeTrigger));
    }

    function enhanceImage(image) {
      if (enhancedImages.has(image)) return;
      enhancedImages.add(image);
      const caption = imageCaption(image);
      image.tabIndex = 0;
      image.setAttribute("role", "button");
      image.setAttribute("aria-label", `Open ${caption || image.alt || itemLabel} larger`);
      image.addEventListener("pointerdown", () => {
        image.classList.add(pressedClass);
      });
      image.addEventListener("pointerup", () => {
        image.classList.remove(pressedClass);
      });
      image.addEventListener("pointercancel", () => {
        image.classList.remove(pressedClass);
      });
      image.addEventListener("pointerleave", () => {
        image.classList.remove(pressedClass);
      });
      image.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openLightbox(image);
      });
      image.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        openLightbox(image);
      });
    }

    function refreshLightboxImages() {
      lightboxImages = [...document.querySelectorAll(selector)];
      lightboxImages.forEach(enhanceImage);
    }

    closeButton.addEventListener("click", closeLightbox);
    prevButton.addEventListener("click", () => showAdjacent(-1));
    nextButton.addEventListener("click", () => showAdjacent(1));
    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox || event.target === lightboxBackdrop) closeLightbox();
    });
    document.addEventListener("keydown", (event) => {
      if (lightbox.hidden) return;
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowLeft") showAdjacent(-1);
      if (event.key === "ArrowRight") showAdjacent(1);
    });
    window.addEventListener("resize", syncLightboxLayout);
    document.addEventListener("zeyu:media-added", refreshLightboxImages);
    refreshLightboxImages();
    document.body.appendChild(lightbox);
  }

  function setupPhotographyLightbox() {
    setupImageLightbox({
      selector: ".photography-page .photo-card img",
      viewerLabel: "Photo viewer",
      itemLabel: "photograph"
    });
  }

  function setupPublicationCoverLightbox() {
    setupImageLightbox({
      selector: ".publication-cover img",
      viewerLabel: "Publication cover viewer",
      itemLabel: "publication cover",
      captionFor: (image) => image.alt || image.closest(".publication-cover")?.getAttribute("aria-label") || "",
      sourceFor: (image) => image.closest(".publication-cover")?.href || image.currentSrc || image.src
    });
  }

  function setupPlanetDiaryLightbox() {
    if (!document.body.classList.contains("planet-diary-template")) return;
    setupImageLightbox({
      selector: ".planet-diary-template [data-planet-panel]:not([hidden]) .planet-detail-media img, .planet-diary-template [data-planet-panel]:not([hidden]) .planet-record-plate img, .planet-diary-template [data-planet-panel]:not([hidden]) .planet-gallery-media img, .planet-diary-template [data-planet-panel]:not([hidden]) .planet-map-selection img",
      viewerLabel: "Planet illustration viewer",
      itemLabel: "planet illustration",
      captionFor: (image) => image.alt || "Planet illustration",
      dynamic: true
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    enhanceNavigation();
    injectFooter();
    renderHomepageLifePhotos();
    setupHomepageFigureCrops();
    renderFeedIndexes();
    renderHomeShelves();
    renderProcessGalleries();
    renderPlanetDiaryStorageSummary();
    renderWorkIndexes();
    renderEntries();
    renderProjectDetails();
    if (window.renderWritingArchiveEntries) {
      window.renderWritingArchiveEntries();
    }
    setupWritingToggles();
    setupWritingLanguageToggles();
    setupPhotographyLightbox();
    setupPublicationCoverLightbox();
    setupPlanetDiaryLightbox();
    setupReelVideoToggle();
    setupScrollMediaReveal();
    respectReducedMotion();
  });
})();
