const STORAGE_KEY = "md-lector:doc";

const main = document.getElementById("main");
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const changeBtn = document.getElementById("changeBtn");
const pasteToggle = document.getElementById("pasteToggle");
const pasteToggleDoc = document.getElementById("pasteToggleDoc");
const pasteBox = document.getElementById("pasteBox");
const pasteArea = document.getElementById("pasteArea");
const pasteRender = document.getElementById("pasteRender");
const meta = document.getElementById("meta");
const metaName = document.getElementById("metaName");
const metaStats = document.getElementById("metaStats");
const clearBtn = document.getElementById("clearBtn");
const clearBtnGhost = document.getElementById("clearBtnGhost");
const toc = document.getElementById("toc");
const tocToggle = document.getElementById("tocToggle");
const tocPanel = document.getElementById("tocPanel");
const tocChevron = document.getElementById("tocChevron");
const tocList = document.getElementById("tocList");
const tocCount = document.getElementById("tocCount");
const emptyState = document.getElementById("emptyState");
const docWrap = document.getElementById("docWrap");
const docTitle = document.getElementById("docTitle");
const content = document.getElementById("content");
const progress = document.getElementById("progress");
const scrollTopBtn = document.getElementById("scrollTopBtn");
const toTopBtn = document.getElementById("toTopBtn");

marked.setOptions({ gfm: true, breaks: false });

function openPicker() {
  fileInput.click();
}

dropzone.addEventListener("click", openPicker);
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    openPicker();
  }
});
changeBtn.addEventListener("click", openPicker);

["dragover", "dragenter"].forEach((evt) =>
  main.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("drag");
  })
);
dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("drag");
});
main.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("drag");
  const file = e.dataTransfer && e.dataTransfer.files[0];
  if (file) loadFile(file);
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file) loadFile(file);
  fileInput.value = "";
});

function togglePaste() {
  pasteBox.hidden = !pasteBox.hidden;
  if (!pasteBox.hidden) pasteArea.focus();
}

pasteToggle.addEventListener("click", togglePaste);
pasteToggleDoc.addEventListener("click", togglePaste);

pasteRender.addEventListener("click", () => {
  const text = pasteArea.value.trim();
  if (!text) return;
  render(text, "texto pegado");
});

function clearDoc() {
  localStorage.removeItem(STORAGE_KEY);
  showEmpty();
}

clearBtn.addEventListener("click", clearDoc);
clearBtnGhost.addEventListener("click", clearDoc);

tocToggle.addEventListener("click", () => {
  const willOpen = tocPanel.hidden;
  tocPanel.hidden = !willOpen;
  tocToggle.setAttribute("aria-expanded", String(willOpen));
  tocChevron.style.transform = willOpen ? "rotate(180deg)" : "";
});

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

toTopBtn.addEventListener("click", scrollToTop);
scrollTopBtn.addEventListener("click", scrollToTop);

function loadFile(file) {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".md") && !name.endsWith(".markdown") && !name.endsWith(".txt")) {
    console.log("X archivo no parece markdown:", file.name);
  }
  const reader = new FileReader();
  reader.onload = () => render(String(reader.result), file.name);
  reader.onerror = () => console.log("X no se pudo leer el archivo:", reader.error);
  reader.readAsText(file);
}

function render(rawText, name) {
  let html;
  try {
    html = marked.parse(rawText);
  } catch (err) {
    console.log("X error al parsear markdown:", err);
    return;
  }
  const clean = DOMPurify.sanitize(html);
  content.innerHTML = clean;
  docWrap.hidden = false;
  emptyState.hidden = true;
  pasteBox.hidden = true;

  assignHeadingIds();
  enhanceCodeBlocks();
  wrapTables();
  buildToc();
  updateMeta(rawText, name);
  window.scrollTo({ top: 0 });

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, text: rawText }));
  } catch (err) {
    console.log("X no se pudo guardar en localStorage:", err);
  }
}

function showEmpty() {
  docWrap.hidden = true;
  emptyState.hidden = false;
  content.innerHTML = "";
  pasteBox.hidden = true;
  meta.hidden = false;
  toc.hidden = true;
  tocList.innerHTML = "";
  tocPanel.hidden = true;
  tocToggle.setAttribute("aria-expanded", "false");
  tocChevron.style.transform = "";
  progress.style.width = "0%";
}

// Conserva tildes, eñes y cualquier letra unicode: solo quita
// puntuación y convierte espacios en guiones.
function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-");
}

function assignHeadingIds() {
  const used = new Set();
  content.querySelectorAll("h1, h2, h3").forEach((h) => {
    let slug = slugify(h.textContent) || "seccion";
    let final = slug;
    let i = 2;
    while (used.has(final)) {
      final = `${slug}-${i}`;
      i++;
    }
    used.add(final);
    h.id = final;
  });
}

function buildToc() {
  const headings = content.querySelectorAll("h1, h2, h3");
  tocList.innerHTML = "";
  if (headings.length === 0) {
    toc.hidden = true;
    return;
  }
  tocCount.textContent = `(${headings.length})`;
  headings.forEach((h) => {
    const level = Number(h.tagName.replace("H", ""));
    const li = document.createElement("li");
    li.style.paddingLeft = `${(level - 1) * 16}px`;
    const a = document.createElement("a");
    // El id conserva tildes tal cual; el href va codificado
    // para que el enlace sea copiable y navegable sin romperse.
    a.href = `#${encodeURIComponent(h.id)}`;
    a.dataset.target = h.id;
    a.className = "toc-link";
    const dot = document.createElement("span");
    dot.className = "toc-dot";
    dot.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = h.textContent;
    a.appendChild(dot);
    a.appendChild(label);
    li.appendChild(a);
    tocList.appendChild(li);
  });
  toc.hidden = false;
  tocPanel.hidden = true;
  tocToggle.setAttribute("aria-expanded", "false");
  tocChevron.style.transform = "";
  observeHeadings(headings);
}

let currentObserver = null;

function observeHeadings(headings) {
  if (currentObserver) currentObserver.disconnect();
  currentObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        tocList.querySelectorAll(".toc-link").forEach((a) => a.classList.remove("active"));
        const link = Array.from(tocList.querySelectorAll(".toc-link")).find(
          (a) => a.dataset.target === entry.target.id
        );
        if (link) link.classList.add("active");
      });
    },
    { rootMargin: "-80px 0px -80% 0px", threshold: 0 }
  );
  headings.forEach((h) => currentObserver.observe(h));
}

function enhanceCodeBlocks() {
  content.querySelectorAll("pre").forEach((pre) => {
    if (pre.parentElement && pre.parentElement.classList.contains("codeblock")) return;
    const code = pre.querySelector("code");
    const className = code ? code.className : "";
    const match = /language-([\w+-]+)/.exec(className);
    const language = match ? match[1] : "text";

    const wrap = document.createElement("div");
    wrap.className = "codeblock";

    const header = document.createElement("div");
    header.className = "codeblock-header";

    const lang = document.createElement("span");
    lang.className = "codeblock-lang";
    lang.textContent = language;

    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "codeblock-copy";
    copy.textContent = "copiar";
    copy.addEventListener("click", async () => {
      const text = code ? code.innerText : pre.innerText;
      try {
        await navigator.clipboard.writeText(text);
      } catch (err) {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-999999px";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
        } catch (copyErr) {
          console.log("X no se pudo copiar:", copyErr);
        }
        document.body.removeChild(ta);
      }
      copy.textContent = "copiado";
      setTimeout(() => {
        copy.textContent = "copiar";
      }, 1500);
    });

    header.appendChild(lang);
    header.appendChild(copy);
    pre.replaceWith(wrap);
    wrap.appendChild(header);
    wrap.appendChild(pre);
  });
}

function wrapTables() {
  content.querySelectorAll("table").forEach((table) => {
    if (table.parentElement && table.parentElement.classList.contains("table-wrap")) return;
    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    table.replaceWith(wrap);
    wrap.appendChild(table);
  });
}

function updateMeta(text, name) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  const firstH1 = content.querySelector("h1");
  docTitle.textContent = firstH1 ? firstH1.textContent : name;
  metaName.textContent = name;
  metaStats.textContent = `${words} palabras · ${minutes} min de lectura`;
  meta.hidden = false;
}

window.addEventListener(
  "scroll",
  () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const pct = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
    progress.style.width = `${pct}%`;
    if (window.scrollY > 300) {
      scrollTopBtn.classList.add("visible");
    } else {
      scrollTopBtn.classList.remove("visible");
    }
  },
  { passive: true }
);

function restore() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const { name, text } = JSON.parse(saved);
    render(text, name);
  } catch (err) {
    console.log("X no se pudo restaurar el último documento:", err);
  }
}

restore();
