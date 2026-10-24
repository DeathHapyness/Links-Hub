(() => {
  const STORAGE_KEY = "links:appearance";
  const DEFAULTS = { theme: "system", bg: "default", custom: "#334155" };

  const BACKGROUNDS = [
    { id: "default", name: "Padrão" },
    { id: "mist", name: "Névoa", value: "#e6ebf2", tone: "light" },
    { id: "sand", name: "Areia", value: "#f3ece2", tone: "light" },
    { id: "mint", name: "Menta", value: "#e1f0e7", tone: "light" },
    { id: "aurora", name: "Aurora", value: "linear-gradient(135deg, #fdfbfb, #e2d1f9 50%, #c2e9fb)", tone: "light" },
    { id: "peach", name: "Pêssego", value: "linear-gradient(135deg, #ffecd2, #fcb69f)", tone: "light" },
    { id: "graphite", name: "Grafite", value: "#1c1f24", tone: "dark" },
    { id: "ocean", name: "Oceano", value: "linear-gradient(135deg, #0f2027, #203a43, #2c5364)", tone: "dark" },
    { id: "night", name: "Noite", value: "linear-gradient(160deg, #141e30, #3a2d5c)", tone: "dark" },
  ];

  const root = document.documentElement;

  function load() {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function save(prefs) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
    }
  }

  function luminance(hex) {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function apply(prefs) {
    let background = null;
    let tone = prefs.theme === "system" ? null : prefs.theme;

    if (prefs.bg === "custom" && /^#[0-9a-f]{6}$/i.test(prefs.custom)) {
      background = prefs.custom;
      tone = luminance(prefs.custom) > 0.18 ? "light" : "dark";
    } else {
      const preset = BACKGROUNDS.find((b) => b.id === prefs.bg);
      if (preset?.value) {
        background = preset.value;
        tone = preset.tone;
      }
    }

    if (tone) root.dataset.theme = tone;
    else delete root.dataset.theme;

    if (background) root.style.setProperty("--page-bg", background);
    else root.style.removeProperty("--page-bg");
  }

  function initPanel() {
    const button = document.getElementById("open-settings");
    const panel = document.getElementById("settings");
    const swatches = document.getElementById("bg-swatches");
    const customInput = document.getElementById("bg-custom");
    const customSwatch = customInput.closest(".swatch");
    const themeOptions = document.getElementById("theme-options");
    const themeHint = document.getElementById("theme-hint");
    let prefs = load();

    for (const preset of BACKGROUNDS) {
      const label = document.createElement("label");
      label.className = "swatch";
      label.title = preset.name;
      if (preset.value) label.style.background = preset.value;
      else label.classList.add("swatch-default");

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "bg";
      input.value = preset.id;
      input.className = "visually-hidden";
      input.setAttribute("aria-label", preset.name);

      label.append(input);
      swatches.insertBefore(label, customSwatch);
    }

    function render() {
      for (const input of panel.querySelectorAll('input[name="theme"]')) {
        input.checked = input.value === prefs.theme;
      }
      for (const input of panel.querySelectorAll('input[name="bg"]')) {
        input.checked = input.value === prefs.bg;
      }
      const isCustom = prefs.bg === "custom";
      customInput.value = prefs.custom;
      customSwatch.classList.toggle("is-selected", isCustom);
      customSwatch.style.background = isCustom ? prefs.custom : "";

      const hasBackground = prefs.bg !== "default";
      themeOptions.disabled = hasBackground;
      themeHint.hidden = !hasBackground;
    }

    function update(patch) {
      prefs = { ...prefs, ...patch };
      save(prefs);
      apply(prefs);
      render();
    }

    panel.addEventListener("change", (event) => {
      const { name, value } = event.target;
      if (name === "theme") update({ theme: value });
      if (name === "bg") update({ bg: value });
    });

    customInput.addEventListener("input", () => {
      update({ bg: "custom", custom: customInput.value });
    });

    document.getElementById("settings-reset").addEventListener("click", () => {
      update({ ...DEFAULTS });
    });

    function place() {
      const r = button.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const width = Math.min(300, vw - 32); // mesma conta do CSS
      const right = Math.min(vw - r.right, vw - width - 16);
      panel.style.top = `${r.bottom + window.scrollY + 8}px`;
      panel.style.right = `${Math.max(16, right)}px`;
    }

    if (HTMLElement.prototype.hasOwnProperty("popover")) {
      panel.addEventListener("beforetoggle", (event) => {
        if (event.newState === "open") place();
      });
    } else {
      panel.hidden = true;
      button.addEventListener("click", () => {
        place();
        panel.hidden = !panel.hidden;
      });
    }

    render();
  }

  apply(load());
  document.addEventListener("DOMContentLoaded", initPanel);
})();
