const STORAGE_KEY = "md-lector:doc";

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const pasteToggle = document.getElementById("pasteToggle");
const pasteBox = document.getElementById("pasteBox");
const pasteArea = document.getElementById("pasteArea");
const pasteRender = document.getElementById("pasteRender");
const meta = document.getElementById("meta");
const metaName = document.getElementById("metaName");
const metaStats = document.getElementById("metaStats");
const clearBtn = document.getElementById("clearBtn");
const toc = document.getElementById("toc");
const tocList = document.getElementById("tocList");
const emptyState = document.getElementById("emptyState");
const content = document.getElementById("content");
const progress = document.getElementById("progress");

marked.setOptions({ gfm: true, breaks: false });

dropzone.addEventListener("click", () => fileInput.click());

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("drag");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("drag");
});

dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("drag");
  const file = e.dataTransfer.files[0];
  if (file) loadFile(file);
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file) loadFile(file);
});

pasteToggle.addEventListener("click", () => {
  pasteBox.hidden = !pasteBox.hidden;
});

pasteRender.addEventListener("click", () => {
  const text = pasteArea.value.trim();
  if (!text) return;
  render(text, "texto pegado");
});

clearBtn.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  showEmpty();
});

function loadFile(file) {
  const name = file.name.toLowerCase();
  if (!name.endsWith(".md") && !name.endsWith(".markdown") && !name.endsWith(".txt")) {
    console.log("X archivo no parece markdown:", file.name);
  }
  const reader = new FileReader();
  reader.onload = () => render(reader.result, file.name);
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
  content.hidden = false;
  emptyState.hidden = true;

  assignHeadingIds();
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
  content.hidden = true;
  content.innerHTML = "";
  emptyState.hidden = false;
  meta.hidden = true;
  toc.hidden = true;
  tocList.innerHTML = "";
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
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
  headings.forEach((h) => {
    const li = document.createElement("li");
    li.dataset.level = h.tagName.replace("H", "");
    const a = document.createElement("a");
    a.href = `#${h.id}`;
    a.textContent = h.textContent;
    li.appendChild(a);
    tocList.appendChild(li);
  });
  toc.hidden = false;
  observeHeadings(headings);
}

let currentObserver = null;

function observeHeadings(headings) {
  if (currentObserver) currentObserver.disconnect();
  currentObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        tocList.querySelectorAll("a").forEach((a) => a.classList.remove("active"));
        const link = tocList.querySelector(`a[href="#${CSS.escape(entry.target.id)}"]`);
        if (link) link.classList.add("active");
      });
    },
    { rootMargin: "-10% 0px -70% 0px" }
  );
  headings.forEach((h) => currentObserver.observe(h));
}

function updateMeta(text, name) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  metaName.textContent = name;
  metaStats.textContent = `${words} palabras · ${minutes} min de lectura`;
  meta.hidden = false;
}

window.addEventListener("scroll", () => {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const pct = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
  progress.style.width = `${pct}%`;
});

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
