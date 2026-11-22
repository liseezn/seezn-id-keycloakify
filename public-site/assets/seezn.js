(function () {
    "use strict";

    var body = document.body;
    var STORAGE_KEY = "seezn-lang";
    var lang;
    var params;

    try {
        params = new URLSearchParams(window.location.search);
        lang = params.get("lang") || window.localStorage.getItem(STORAGE_KEY);
    } catch {
        lang = null;
    }

    if (lang !== "zh" && lang !== "en") {
        lang = /^zh/i.test(navigator.language || "") ? "zh" : "en";
    }

    function applyLanguage(value, persist) {
        body.dataset.lang = value;
        document.documentElement.lang = value === "zh" ? "zh-CN" : "en";

        var titles = document.documentElement.dataset;
        if (titles[value]) {
            document.title = titles[value];
        }

        document.querySelectorAll(".sz-lang button").forEach(function (button) {
            button.setAttribute("aria-pressed", String(button.dataset.l === value));
        });

        if (persist) {
            try {
                window.localStorage.setItem(STORAGE_KEY, value);
                if (window.history && window.history.replaceState && params) {
                    params.set("lang", value);
                    window.history.replaceState(
                        null,
                        "",
                        window.location.pathname + "?" + params.toString() + window.location.hash
                    );
                }
            } catch {
                /* storage/history unavailable: keep the in-page switch only */
            }
        }
    }

    document.querySelectorAll(".sz-lang button").forEach(function (button) {
        button.addEventListener("click", function () {
            applyLanguage(button.dataset.l, true);
        });
    });

    applyLanguage(lang, false);

    // Icons are rendered by lucide from <i data-lucide> placeholders.
    window.addEventListener("DOMContentLoaded", function () {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    });
})();
