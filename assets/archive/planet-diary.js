(function () {
  const archive = window.ZEYU_REN_PLANET_DIARY;
  const list = document.querySelector("[data-planet-diary-list]");
  if (!archive || !list) return;

  const count = document.querySelector("[data-planet-diary-count]");
  const resultCount = document.querySelector("[data-planet-result-count]");
  const yearSelect = document.querySelector("[data-planet-year]");
  const searchInput = document.querySelector("[data-planet-search]");
  const loadMore = document.querySelector("[data-planet-load-more]");
  const pageSize = 24;
  let visibleCount = pageSize;
  let searchTimer;

  const escapeHtml = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

  const normalizedSearch = (value) => String(value || "").trim().toLocaleLowerCase();

  function displayDate(value) {
    if (!value) return "Undated";
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC"
    }).format(new Date(`${value}T12:00:00Z`));
  }

  function filteredEntries() {
    const selectedYear = yearSelect?.value || "all";
    const query = normalizedSearch(searchInput?.value);

    return archive.entries.filter((entry) => {
      if (selectedYear !== "all" && entry.year !== selectedYear) return false;
      if (!query) return true;
      const haystack = [entry.title, entry.story, ...(entry.tags || [])].join(" ").toLocaleLowerCase();
      return haystack.includes(query);
    });
  }

  function imageMarkup(entry) {
    if (!entry.images?.length) return "";

    return `
      <figure class="planet-entry-media${entry.images.length > 1 ? " planet-entry-media-multiple" : ""}">
        ${entry.images.map((image, index) => `
          <a href="${escapeHtml(image.file)}" target="_blank" rel="noopener" aria-label="Open ${escapeHtml(entry.title)} illustration${entry.images.length > 1 ? ` ${index + 1}` : ""}">
            <img
              src="${escapeHtml(image.file)}"
              alt="${escapeHtml(entry.title)} illustration${entry.images.length > 1 ? ` ${index + 1}` : ""}"
              ${image.width && image.height ? `width="${image.width}" height="${image.height}"` : ""}
              loading="lazy"
              decoding="async"
            >
          </a>
        `).join("")}
      </figure>
    `;
  }

  function entryMarkup(entry) {
    const hasTitle = Boolean(entry.title);
    const heading = hasTitle ? entry.title : displayDate(entry.date);
    return `
      <article class="planet-entry" id="planet-${escapeHtml(entry.id)}">
        <header class="planet-entry-meta">
          <h2>${escapeHtml(heading)}</h2>
          ${hasTitle ? `<time datetime="${escapeHtml(entry.date)}">${escapeHtml(displayDate(entry.date))}</time>` : ""}
        </header>
        ${imageMarkup(entry)}
        <div class="planet-entry-story">
          <p>${escapeHtml(entry.story || "")}</p>
          <a href="${escapeHtml(entry.sourceUrl)}" target="_blank" rel="noopener noreferrer">LOFTER&nbsp;↗</a>
        </div>
      </article>
    `;
  }

  function updateStatus(entries, visibleEntries) {
    if (count) count.textContent = `(${archive.postCount})`;
    if (resultCount) resultCount.textContent = `${visibleEntries.length} / ${entries.length}`;
    if (loadMore) {
      loadMore.hidden = visibleEntries.length >= entries.length;
      loadMore.textContent = `More (${Math.min(pageSize, entries.length - visibleEntries.length)})`;
    }
  }

  function render({ appendFrom = null } = {}) {
    const entries = filteredEntries();
    const visibleEntries = entries.slice(0, visibleCount);
    if (appendFrom === null) {
      list.innerHTML = visibleEntries.length
        ? visibleEntries.map(entryMarkup).join("")
        : '<p class="planet-diary-empty">No matching entries.</p>';
    } else {
      const newEntries = visibleEntries.slice(appendFrom);
      list.insertAdjacentHTML("beforeend", newEntries.map(entryMarkup).join(""));
    }

    updateStatus(entries, visibleEntries);
    document.dispatchEvent(new CustomEvent("zeyu:media-added", { detail: { root: list } }));
  }

  function resetAndRender() {
    visibleCount = pageSize;
    render();
  }

  function populateYears() {
    if (!yearSelect) return;
    const years = [...new Set(archive.entries.map((entry) => entry.year).filter(Boolean))]
      .sort((a, b) => b.localeCompare(a));
    yearSelect.innerHTML = '<option value="all">All years</option>' + years
      .map((year) => `<option value="${escapeHtml(year)}">${escapeHtml(year)}</option>`)
      .join("");
  }

  populateYears();
  yearSelect?.addEventListener("change", resetAndRender);
  searchInput?.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(resetAndRender, 120);
  });
  loadMore?.addEventListener("click", () => {
    const previousVisibleCount = visibleCount;
    visibleCount += pageSize;
    render({ appendFrom: previousVisibleCount });
  });

  render();
})();
