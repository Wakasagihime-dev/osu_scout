const SERVER_URL = "https://osu-scout-server.onrender.com/";

document.addEventListener("DOMContentLoaded", () => {
  const el = {
    presetsWrapper: document.querySelector(".presets-wrapper"),
    hideAdvOptsBtn: document.getElementById("adv-opt-hide-btn"),
    beatmapContainer: document.querySelector("div.beatmap-container"),
    prevBtn: document.querySelector(".prev-btn"),
    nextBtn: document.querySelector(".next-btn"),
    searchBtn: document.getElementById("search"),
    bmIdInp: document.getElementById("id"),
    bmsetIdInp: document.getElementById("beatmapset_id"),
    textSearchInps: document.querySelectorAll('Input[type="text"].text-search'),
    minMaxInps: document.querySelectorAll('input[type="text"].min-max'),
    aimPresetBtn: document.getElementById("aim-preset"),
    streamPresetBtn: document.getElementById("stream-preset"),
    loading: document.getElementById("loading"),
    share: document.getElementById("share"),
    clearAll: document.getElementById("clear-all"),
  };
  const presetFields = {
    arInp: document.getElementById("ar"),
    bpmInp: document.getElementById("bpm"),
    srInp: document.getElementById("star_rating"),
    avgNumJumpsInp: document.getElementById("avg_num_jumps"),
    numBurstsInp: document.getElementById("num_burst_secs"),
    avgStreamLenInp: document.getElementById("avg_stream_length"),
    overallIrrInp: document.getElementById("overall_irr_percent"),
    streamDensityInp: document.getElementById("stream-density"),
    streamSpacingInp: document.getElementById("stream-spacing"),
  };
  // [GEN QUERY ALL FIELDS]
  function parseAllFields(el) {
    const reqObj = {};
    // [Min-Max]
    el.minMaxInps.forEach((field) => {
      Object.assign(reqObj, parseMinMax(field.id, field.value));
    });
    // [/Min-Max]
    // [Text-search]
    const textQueries = { $and: [] };
    el.textSearchInps.forEach((field) => {
      const tQuery = parseText(field.id, field.value);
      tQuery ? textQueries["$and"].push(...tQuery) : null;
    });
    textQueries["$and"].length ? Object.assign(reqObj, textQueries) : null;
    // [/Text-search]
    // [Beatmap ID and beatmapset ID]
    const id = el.bmIdInp.value;
    const setId = el.bmsetIdInp.value;
    id ? Object.assign(reqObj, { id: parseInt(id) }) : null;
    setId ? Object.assign(reqObj, { beatmapset_id: parseInt(setId) }) : null;
    // [/Beatmap ID and beatmapset ID
    return reqObj;
  }
  // [/GEN QUERY ALL FIELDS]

  // [HIDE ADV OPT]
  el.hideAdvOptsBtn.addEventListener("click", (e) => {
    if (e.target.textContent.toLowerCase() === "hide") {
      document.querySelector("#advanced > div.opt > div.config").style.display =
        "none";
      el.presetsWrapper.style.display = "none";
      e.target.textContent = "Show";
    } else {
      document.querySelector("#advanced > div.opt > div.config").style.display =
        "flex";
      el.presetsWrapper.style.display = "block";
      e.target.textContent = "Hide";
    }
  });
  // [/HIDE ADV OPT]
  // [INIT PAGE LOAD DATA]
  const urlParams = new URLSearchParams(window.location.search);
  let reqObj = parseAllFields(el);
  if (urlParams.has("q")) {
    reqObj = JSON.parse(decodeURIComponent(urlParams.get("q")));
  }
  get_data(el, reqObj);
  // [/INIT PAGE LOAD DATA]
  // [NEXT PAGE]
  el.nextBtn.addEventListener("click", (e) => {
    const reqObj = parseAllFields(el);
    Object.assign(reqObj, { after: e.target.id });
    get_data(el, reqObj);
  });
  // [/NEXT PAGE]
  // [PREV PAGE]
  el.prevBtn.addEventListener("click", (e) => {
    const reqObj = parseAllFields(el);
    Object.assign(reqObj, { before: e.target.id });
    get_data(el, reqObj);
  });
  // [/PREV PAGE]
  // [Search Go!]
  el.searchBtn.addEventListener("click", (e) => {
    // [Fetch]
    const reqObj = parseAllFields(el);
    get_data(el, reqObj);
    // [/Fetch]
  });
  // [/Search Go!]
  // [AIM PRESET]
  el.aimPresetBtn.addEventListener("click", (e) => {
    document.body.querySelectorAll('input[type="text"]').forEach((item) => {
      item.value = "";
    });
    presetFields.srInp.value = "4.2-4.9";
    presetFields.arInp.value = "8.5-9.2";
    presetFields.bpmInp.value = "140-180";
    presetFields.avgNumJumpsInp.value = "15";
    presetFields.numBurstsInp.value = "0";
    presetFields.avgStreamLenInp.value = "0-0";
    presetFields.overallIrrInp.value = "0-7.27";
  });
  // [/AIM PRESET]
  // [STREAM PRESET]
  el.streamPresetBtn.addEventListener("click", (e) => {
    document.body.querySelectorAll('input[type="text"]').forEach((item) => {
      item.value = "";
    });
    presetFields.srInp.value = "4.5";
    presetFields.arInp.value = "9";
    presetFields.bpmInp.value = "170";
    presetFields.avgNumJumpsInp.value = "5";
    presetFields.avgStreamLenInp.value = "9";
    presetFields.overallIrrInp.value = "0-25";
    presetFields.streamDensityInp = "0.25";
    presetFields.streamSpacingInp = "0-1";
  });
  // [/STREAM PRESET]
  // [SHARE]
  el.share.addEventListener("click", (e) => {
    navigator.clipboard.writeText(window.location.href);
    e.target.textContent = "copied!";
    e.target.classList.remove("share-bg-color");
    e.target.classList.add("copied-bg-color");
    setTimeout(() => {
      e.target.textContent = "Share 🔗";
      e.target.classList.add("share-bg-color");
      e.target.classList.remove("copied-bg-color");
    }, 1000);
  });
  // [/SHARE]
  // [CLEAR ALL FIELDS]
  el.clearAll.addEventListener("click", (e) => {
    document.querySelectorAll('input[type="text"]').forEach((inp) => {
      inp.value = "";
    });
  });
  // [/CLEAR ALL FIELDS]
});

/***  [UTILS]  ***/
// // // [FETCH DATA]
function get_data(el, reqObj) {
  // [URL STATE]
  window.history.replaceState({}, "", window.location.pathname);
  // [/URL STATE]
  // [LOADING]
  el.beatmapContainer.innerHTML = "";
  el.loading.style.display = "block";
  // [/LOADING]
  // [DISABLE ALL BUTTONS]
  el.searchBtn.disabled = true;
  el.prevBtn.disabled = true;
  el.nextBtn.disabled = true;
  el.share.disabled = true;
  // [/DISABLE ALL BUTTONS]
  // [If triggered by prev/next click]
  if (reqObj.after || reqObj.before) {
    el.prevBtn.disabled = true;
    el.nextBtn.disabled = true;
  }
  // [/If triggered by prev/next click]

  fetch(SERVER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(reqObj),
  }).then((res) => {
    res.text().then((html) => {
      el.beatmapContainer.innerHTML = html;
      if (el.beatmapContainer.querySelector("#not-found")) {
        // [Search Go! button]
        el.searchBtn.disabled = false;
        // [/Search Go! button]
        // [END Loading]
        el.loading.style.display = "none";
        // [/END loading]
        // [ALLOW SHARE]
        el.share.disabled = false;
        // [/ALLOW SHARE]
        return;
      }
      // [SHOW MORE OPT STATS]
      showMoreOptStats();
      // [/SHOW MORE OPT STATS]
      // [Next & Prev Btns]
      const prevEl = document.getElementById("prev");
      const prevBtn = document.querySelector(".prev-btn");
      prevBtn.id = prevEl.value;

      const nextEl = document.getElementById("next");
      const nextBtn = document.querySelector(".next-btn");
      nextBtn.id = nextEl.value;

      el.prevBtn.disabled = false;
      el.nextBtn.disabled = false;
      // [/Next & Prev Btns]
      // [Search Go! button]
      el.searchBtn.disabled = false;
      // [/Search Go! button]
      // [SHARE BUTTON]
      el.share.disabled = false;
      // [/SHARE BUTTON]
      // [URL PARAMS]
      const params = new URLSearchParams();
      params.set("q", encodeURIComponent(JSON.stringify(reqObj)));
      window.history.pushState({}, "", `?${params.toString()}`);
      // [/URL PARAMS]
      // [END Loading]
      el.loading.style.display = "none";
      // [/END loading]
    });
  });
}
// // // [/FETCH DATA]
// // // [MIN-MAX PARSING]
function parseMinMax(key, val) {
  /* *
   * Query generator
   * returns search object to be used by pymongo in the backend
   */
  if (val.includes("-")) {
    if (val.split("-").length !== 2) {
      return {};
    }
    const range = val.split("-");
    const min = Number.isNaN(parseFloat(range[0])) ? 0 : parseFloat(range[0]);
    const max = Number.isNaN(parseFloat(range[1])) ? 0 : parseFloat(range[1]);
    if (range[0] == "" && Number.isNaN(parseFloat(range[1]))) {
      return { [`${key}`]: { $gte: 0, $lte: max } };
    } else if (range[1] == "" && Number.isNaN(parseFloat(range[0]))) {
      return { [`${key}`]: { $gte: min, $lte: 10000 } };
    }
    return { [`${key}`]: { $gte: min, $lte: max } };
  } else {
    const min = Number.isNaN(parseFloat(val)) ? 0 : parseFloat(val);
    return { [`${key}`]: { $gte: min } };
  }
}
// // // [/MIN-MAX PARSING]
// // // [Text-Search PARSING]
function parseText(key, val) {
  /* *
   * Query generator
   * returns search object to be used by pymongo in the backend
   */
  if (!val) {
    return null;
  }
  const tokens = escapeRegExp(val).split(" ");
  return tokens.map((t) => {
    return {
      [`${key}`]: { $regex: t, $options: "i" },
    };
  });
}
// // // [/Text-Search PARSING]
// // // [SHOW MORE OPT STATS]
function showMoreOptStats() {
  document.querySelectorAll(".more-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const optStatsEl = e.target.nextElementSibling;
      const display = getComputedStyle(optStatsEl).display;
      if (display === "none") {
        optStatsEl.style.display = "flex";
        e.target.textContent = "less...";
      } else {
        optStatsEl.style.display = "none";
        e.target.textContent = "more...";
      }
    });
  });
}
// // // [Escape RegExp]
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}
// // // [/Escape RegExp]
// // // [/SHOW MORE OPT STATS]
/***   [/UTILS]   ***/
