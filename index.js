document.addEventListener("DOMContentLoaded", () => {
  const searchBox = document.getElementById("search-box");
  searchBox.value = `tags="japanese" aim=75-95 star_rating=4.5-6 bpm=140-175`;
  const infoHideBtn = document.getElementById("hide-me");
  const info = document.querySelector("div.info");
  infoHideBtn.addEventListener("click", (ev) => {
    if (infoHideBtn.textContent.trim() === "hide me") {
      info.style.display = "none";
      infoHideBtn.textContent = "show me";
    } else if (infoHideBtn.textContent.trim() === "show me") {
      info.style.display = "block";
      infoHideBtn.textContent = "hide me";
    }
  });
  let pages = [];
  const pageSize = 6;
  const pgNrSpan = document.getElementById("page-nr");
  let pageNumber = 1;
  pgNrSpan.innerText = pageNumber;
  fetchDB().then((data) => {
    data.sort((a, b) => b.aim - a.aim);
    pages = parseUserSearch(
      `tags="japanese" aim=75-95 star_rating=4.5-6 bpm=140-175`,
      data,
      createPagesArray(data, pageSize),
      pageSize,
    );
    renderPage(pages, pageNumber);
  });
  const prev = document.getElementById("prev");
  const next = document.getElementById("next");
  prev.addEventListener("click", (ev) => {
    if (pages.length <= 1 || pageNumber === 1) {
      ev.preventDefault();
      return;
    }
    renderPage(pages, pageNumber - 1);
    pageNumber -= 1;
  });
  next.addEventListener("click", (ev) => {
    if (pages.length <= 1 || pageNumber === pages.length) {
      ev.preventDefault();
      return;
    }
    renderPage(pages, pageNumber + 1);
    pageNumber += 1;
  });
  searchBox.addEventListener("keyup", (ev) => {
    if (ev.key == "Enter") {
      fetchDB().then((data) => {
        if (!ev.target.value.trim()) {
          data.sort((a, b) => b.aim - a.aim);
          pages = createPagesArray(data, pageSize);
          renderPage(pages, 1);
          return;
        }
        data.sort((a, b) => b.aim - a.aim);
        pages = parseUserSearch(
          ev.target.value.trim().toLowerCase(),
          data,
          pages[pageNumber - 1],
          pageSize,
        );
        if (pages.length) {
          renderPage(pages, 1);
        } else {
          document.querySelector(".beatmap-container").innerHTML =
            "Wow such empty...";
          document.getElementById("page-nr").innerHTML = "? of ?";
        }
      });
    }
  });
});

// UTILITY FUNCTIONS
async function fetchDB() {
  const files = await fetch("./db/info.json").then((r) => r.json());
  const data = await Promise.all(
    files.map((f) => fetch(f).then((r) => r.json())),
  );
  return data.flat();
}
function parseUserSearch(q, data, currPages, pageSize) {
  if (!q || typeof q !== "string") {
    return currPages;
  }
  let filteredData = data;
  if (q.includes("title=")) {
    filteredData = filterByText(q, filteredData, "title");
  }
  if (q.includes("tags=")) {
    filteredData = filterByText(q, filteredData, "tags");
  }
  if (q.includes("creator=")) {
    filteredData = filterByText(q, filteredData, "creator");
  }
  if (q.includes("artist=")) {
    filteredData = filterByText(q, filteredData, "artist");
  }
  const filters = q
    .split(" ")
    .filter(
      (a) => a.includes("=") && !a.includes("title=") && !a.includes("tags="),
    );
  for (let i = 0; i < filters.length; i++) {
    const filter = filters[i];
    const key = filter.split("=")[0];
    const vals = filter
      .split("=")[1]
      .split("-")
      .map((v) => parseFloat(v));
    if (Object.keys(data[0]).indexOf(key) == -1) {
      continue;
    }
    if (vals.some(Number.isNaN) || vals.length > 2 || vals.length == 0) {
      continue;
    }
    filteredData = filteredData.filter((b) => {
      if (vals.length == 1) {
        if (b[key] >= vals[0]) {
          return b;
        }
      } else {
        if (b[key] >= vals[0] && b[key] <= vals[1]) {
          return b;
        }
      }
    });
  }
  return createPagesArray(filteredData, pageSize);
}
function filterByText(query, data, key) {
  let regexp;
  if (key === "title") {
    regexp = /title="([^"]*)"/;
  } else if (key === "tags") {
    regexp = /tags="([^"]*)"/;
  } else if (key === "creator") {
    regexp = /creator="([^"]*)"/;
  } else if (key === "artist") {
    regexp = /artist="([^"]*)"/;
  }
  const match = query.match(regexp);
  let filteredData = data;
  if (match) {
    const words = match[1].split(" ");
    filteredData = filteredData.filter((m) => {
      const str = m[key]
        .trim()
        .toLowerCase()
        .split(" ")
        .map((_) => _.trim());
      const cond = words.some((word) => str.includes(word.trim()));
      return cond;
    });
  }
  return filteredData;
}
function renderPage(pages, pageNumber) {
  const bmContainer = document.querySelector(".beatmap-container");
  bmContainer.innerHTML = "";
  const pgNrSpan = document.getElementById("page-nr");
  for (let i = 0; i < pages[pageNumber - 1].length; i++) {
    const bm = pages[pageNumber - 1][i];
    const bmDiv = document.createElement("div");
    bmDiv.classList.add("beatmap-card");
    bmDiv.innerHTML = bmInnerHTMLTemplate(bm);
    bmContainer.appendChild(bmDiv);
  }
  pgNrSpan.innerHTML = `${pageNumber} of ${pages.length ? pages.length : 1}`;
}
function createPagesArray(data, pageSize) {
  const pages = [];
  for (let i = 0; i < data.length; i += pageSize) {
    pages.push(data.slice(i, i + pageSize));
  }
  return pages;
}
function bmInnerHTMLTemplate(bmData) {
  return `
        <div class="image-wrap">
          <img
            src="${bmData.bg_url}"
            alt="background image of the beatmapset"
          />
        </div>
        <div class="stats">
          <div><span>Aim:</span><span>${Number(bmData.aim).toFixed(2)}</span></div>
          <div><span>BPM</span><span>${Number(bmData.bpm).toFixed(2)}</span></div>
          <div><span>stream density</span><span>${Number(bmData["stream-density"]).toFixed(2)}</span></div>
          <div><span>stream spacing</span><span>${Number(bmData["stream-spacing"]).toFixed(2)}</span></div>
          <div><span>AR</span><span>${Number(bmData.ar).toFixed(2)}</span></div>
          <div><span>star rating</span><span>${Number(bmData.star_rating).toFixed(2)}</span></div>
          <div><span>100% PP</span><span>${Number(bmData.pp_100).toFixed(2)}</span></div>
          <div><span>95% PP</span><span>${Number(bmData.pp_95).toFixed(2)}</span></div>
          <div><span>Max combo</span><span>${bmData.max_combo}</span></div>
        </div>
        <div class="map-link">
          <a href="${bmData.url}"
          target="_blank"
            >${bmData.title}</a
          >
        </div>`.trim();
}
