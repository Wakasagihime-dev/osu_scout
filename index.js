document.addEventListener("DOMContentLoaded", () => {
  // DEFINE ELEMENTS
  const searchBox = document.getElementById("search-box");
  searchBox.value = `aim=80-95 star_rating=4 bpm=140-190 ranked=2026-01-01`;
  const infoHideBtn = document.getElementById("hide-me");
  const info = document.querySelector("div.info");
  const pgNrSpan = document.getElementById("page-nr");
  const prev = document.getElementById("prev");
  const next = document.getElementById("next");
  const sortSelect = document.getElementById("sort");
  const sortDescAsc = document.querySelector("div.sort label");
  // Hide and show info
  infoHideBtn.addEventListener("click", (ev) => {
    if (infoHideBtn.textContent.trim() === "hide me") {
      info.style.display = "none";
      infoHideBtn.textContent = "show me";
    } else if (infoHideBtn.textContent.trim() === "show me") {
      info.style.display = "block";
      infoHideBtn.textContent = "hide me";
    }
  });
  // Pages in memory
  let pages = []; // array of arrays each inner array has objects
  const pageSize = 6; // a single array would have 6 objects
  let pageNumber = 1; // page number
  pgNrSpan.innerText = pageNumber;
  // initial data fetch
  fetchDB().then((data) => {
    const descAscVal = sortDescAsc.getAttribute("data-desc");
    sortMaps(sortSelect, data, descAscVal);
    pages = parseUserSearch(
      searchBox.value.trim().toLowerCase(),
      data,
      createPagesArray(data, pageSize),
      pageSize,
    );
    renderPage(pages, pageNumber);
  });
  // going back a page CLICK EVENT
  prev.addEventListener("click", (ev) => {
    if (pages.length <= 1 || pageNumber === 1) {
      ev.preventDefault();
      return;
    }
    renderPage(pages, pageNumber - 1);
    pageNumber -= 1;
  });
  // going to the next page CLICK EVENT
  next.addEventListener("click", (ev) => {
    if (pages.length <= 1 || pageNumber === pages.length) {
      ev.preventDefault();
      return;
    }
    renderPage(pages, pageNumber + 1);
    pageNumber += 1;
  });
  // search keyup "ENTER" event
  searchBox.addEventListener("keyup", (ev) => {
    if (ev.key == "Enter") {
      const descAscVal = sortDescAsc.getAttribute("data-desc");
      fetchDB().then((data) => {
        if (!ev.target.value.trim()) {
          sortMaps(sortSelect, data, descAscVal);
          pages = createPagesArray(data, pageSize);
          pageNumber = 1;
          renderPage(pages, pageNumber);
          return;
        }
        sortMaps(sortSelect, data, descAscVal);
        pages = parseUserSearch(
          ev.target.value.trim().toLowerCase(),
          data,
          pages[pageNumber - 1],
          pageSize,
        );
        if (pages.length) {
          pageNumber = 1;
          renderPage(pages, pageNumber);
        } else {
          document.querySelector(".beatmap-container").innerHTML =
            "Wow such empty...";
          document.getElementById("page-nr").innerHTML = "? of ?";
        }
      });
    }
  });
  // SORT SELECT val on change
  sortSelect.addEventListener("change", () => {
    const descAscVal = sortDescAsc.getAttribute("data-desc");
    const data = pages.flat();
    sortMaps(sortSelect, data, descAscVal);
    pages = createPagesArray(data, pageSize);
    pageNumber = 1;
    renderPage(pages, pageNumber);
  });
  // Click event on SORT ASC/DESC label
  sortDescAsc.addEventListener("click", (ev) => {
    const descText = "(Desc.)";
    const ascText = "(Asc.)";
    const currVal = ev.target.innerHTML.trim();
    // read and update label for desc/asc
    if (currVal === descText) {
      sortDescAsc.innerHTML = ascText;
      sortDescAsc.setAttribute("data-desc", "asc");
    } else if (currVal === ascText) {
      sortDescAsc.innerHTML = descText;
      sortDescAsc.setAttribute("data-desc", "desc");
    }
    // update the data
    const data = pages.flat();
    sortMaps(sortSelect, data, sortDescAsc.getAttribute("data-desc"));
    pages = createPagesArray(data, pageSize);
    pageNumber = 1;
    renderPage(pages, pageNumber);
  });
});

// UTILITY FUNCTIONS

// fetch
async function fetchDB() {
  const files = await fetch("./db/info-2026-01-31.json").then((r) => r.json());
  const data = await Promise.all(
    files.map((f) => fetch(f).then((r) => r.json())),
  );
  return data.flat();
}
// sort
function sortMaps(sortSelect, data, descAsc) {
  const multiplier = descAsc === "desc" ? 1 : -1;
  if (sortSelect.value === "date_ranked") {
    data.sort(
      (a, b) =>
        multiplier *
        ((new Date(b.date_ranked).getTime() || -Infinity) -
          (new Date(a.date_ranked).getTime() || -Infinity)),
    );
  } else if (sortSelect.value === "aim") {
    data.sort((a, b) => multiplier * (b.aim - a.aim));
  } else if (sortSelect.value === "bpm") {
    data.sort((a, b) => multiplier * (b.bpm - a.bpm));
  } else if (sortSelect.value === "star_rating") {
    data.sort((a, b) => multiplier * (b.star_rating - a.star_rating));
  }
}
// user search
function parseUserSearch(q, data, currPages, pageSize) {
  if (!q || typeof q !== "string") {
    return currPages;
  }
  let filteredData = data;
  // this section has text filters
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
  // this section has date filtering
  if (q.includes("ranked=")) {
    const qtime = new Date(q.split("ranked=")[1].split(" ")[0]).getTime();
    filteredData = filteredData.filter((b) => {
      return new Date(b.date_ranked).getTime() > qtime;
    });
  }
  // exclude text filters since they are done
  const filters = q
    .split(" ")
    .filter(
      (a) =>
        a.includes("=") &&
        !a.includes("title=") &&
        !a.includes("tags=") &&
        !a.includes("creator=") &&
        !a.includes("artist=") &&
        !a.includes("ranked="),
    );
  // this section has numerical filtering
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
// filter/search results for text based properties like song title, map creator, artist, etc
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
