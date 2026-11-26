/*
 * Sourcework website widget: one line on any website adds a chat that answers from one Sourcework document (each file has its own key).
 *
 *   <script src="https://YOUR-SOURCEWORK/widget.js" data-key="pk_…"></script>
 *
 * Optional, on the same tag:
 *   data-color="#e11d48"     bubble colour (the chat's colour is set in Sourcework's Embed panel)
 *   data-position="left"     bubble on the left instead of the right
 *   data-launcher="none"     no bubble: open it from your own button with  <button data-sourcework-open>
 *
 * The page can control it:  Sourcework.open()  .close()  .toggle()  .hide()  .show()
 *
 * The chat runs in an iframe from Sourcework, so this page's CSS can't affect it and it can't affect this page.
 * No AI keys or documents ever reach this page.
 */
(function () {
  var script = document.currentScript;
  if (!script || window.Sourcework) return;
  var key = script.getAttribute("data-key");
  var app = new URL(script.src).origin; // where Sourcework runs
  var STATE = "sourcework-open:" + key; // remembers open/closed while the visitor browses this site

  if (!key) return console.warn("[Sourcework] add data-key to the widget's <script> tag.");

  fetch(app + "/api/widget/" + key + "/config")
    .then(function (response) {
      if (!response.ok) throw new Error();
      return response.json();
    })
    .then(start)
    .catch(function () {
      console.warn("[Sourcework] the widget is off, the key is wrong, or this site isn't in its allowed websites.");
    });

  function start(config) {
    var color = script.getAttribute("data-color") || config.color || "#0f766e";
    var side = (script.getAttribute("data-position") || config.position) === "left" ? "left" : "right";
    var noLauncher = script.getAttribute("data-launcher") === "none";
    var frame = null;
    var isOpen = false;

    // The chat window: a fixed panel; full screen on small phones.
    var panel = document.createElement("div");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", config.title);
    panel.style.cssText =
      "position:fixed;bottom:88px;" + side + ":20px;width:380px;height:600px;max-height:calc(100vh - 110px);" +
      "z-index:2147483646;border-radius:16px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.35);display:none;";
    var small = window.matchMedia("(max-width: 480px)");
    function fit() {
      if (small.matches) Object.assign(panel.style, { bottom: "0", left: "0", right: "0", width: "100%", height: "100%", maxHeight: "100%", borderRadius: "0" });
    }
    fit();

    // The launcher: a round button with a small robot face.
    var bubble = document.createElement("button");
    bubble.type = "button";
    bubble.setAttribute("aria-label", "Open chat: " + config.title);
    bubble.style.cssText =
      "position:fixed;bottom:20px;" + side + ":20px;width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;" +
      "z-index:2147483647;background:" + color + ";box-shadow:0 8px 24px rgba(0,0,0,.3);display:grid;place-items:center;";
    bubble.innerHTML =
      '<svg viewBox="0 0 64 64" width="34" height="34" aria-hidden="true" fill="none" stroke="#fff" stroke-width="3">' +
      '<line x1="32" y1="6" x2="32" y2="14"/><circle cx="32" cy="5" r="3" fill="#fff"/>' +
      '<rect x="10" y="14" width="44" height="32" rx="11"/><rect x="21" y="25" width="6" height="7" rx="2" fill="#fff"/>' +
      '<rect x="37" y="25" width="6" height="7" rx="2" fill="#fff"/><path d="M24 54h16"/></svg>';
    bubble.addEventListener("click", toggle);

    // The handshake: the chat says "ready", this answers "hello" so the chat knows (from the browser) which site it's on.
    window.addEventListener("message", function (event) {
      if (!frame || event.source !== frame.contentWindow || event.origin !== app) return;
      if (event.data && event.data.type === "sourcework:ready") frame.contentWindow.postMessage({ type: "sourcework:hello" }, app);
      if (event.data && event.data.type === "sourcework:close") close();
    });

    function open() {
      if (!frame) {
        frame = document.createElement("iframe"); // created on first open, so pages load fast
        frame.src = app + "/embed/" + key;
        frame.title = config.title;
        frame.style.cssText = "width:100%;height:100%;border:0;display:block;";
        panel.appendChild(frame);
      }
      panel.style.display = "block";
      if (small.matches) bubble.style.visibility = "hidden"; // full screen on phones: the chat's × closes it
      bubble.setAttribute("aria-expanded", "true");
      isOpen = true;
      remember(true);
    }
    function close() {
      panel.style.display = "none";
      bubble.style.visibility = "";
      bubble.setAttribute("aria-expanded", "false");
      isOpen = false;
      remember(false);
    }
    function toggle() {
      isOpen ? close() : open();
    }
    function remember(value) {
      try {
        sessionStorage.setItem(STATE, value ? "1" : "");
      } catch (error) {
        // storage blocked: it just won't be remembered
      }
    }

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && isOpen) close();
    });
    document.addEventListener("click", function (event) {
      var opener = event.target.closest && event.target.closest("[data-sourcework-open]");
      if (opener) {
        event.preventDefault();
        open();
      }
    });

    document.body.appendChild(panel);
    if (!noLauncher) document.body.appendChild(bubble);
    try {
      if (sessionStorage.getItem(STATE) === "1") open();
    } catch (error) {
      // storage blocked
    }

    window.Sourcework = {
      open: open,
      close: close,
      toggle: toggle,
      hide: function () {
        close();
        bubble.style.display = "none";
      },
      show: function () {
        if (!noLauncher) bubble.style.display = "grid";
      },
    };
  }
})();
