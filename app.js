/* Museification machine — client-side demo, no backend.
   The uploaded photo only picks the palette; the creature itself is drawn from
   scratch by character.js, so every run hatches a different little Muse. */
(function () {
  "use strict";

  var doc = typeof document !== "undefined" ? document : null;
  var win = typeof window !== "undefined" ? window : {};
  var Muse = win.MuseCharacter;

  function byId(id) {
    return doc ? doc.getElementById(id) : null;
  }
  function show(el, on) {
    if (el && el.classList) el.classList.toggle("hidden", !on);
  }
  function delay() {
    return typeof win.__MOCK_DELAY === "number" ? win.__MOCK_DELAY : 1800;
  }

  var els = {};
  var uploaded = null; // HTMLImageElement once loaded
  var lastPalette = null;

  function grab() {
    els.card = byId("machineCard");
    els.file = byId("fileInput");
    els.drop = byId("dropzone");
    els.preview = byId("previewImg");
    els.dzEmpty = doc.querySelector(".dz-empty");
    els.change = byId("changeBtn");
    els.outputEmpty = doc.querySelector(".output-empty");
    els.outputWorking = doc.querySelector(".output-working");
    els.output = byId("outputImg");
    els.run = byId("museifyBtn");
    els.reroll = byId("rerollBtn");
    els.save = byId("saveBtn");
    els.error = byId("machineError");
    els.canvas = byId("workCanvas");
  }

  function fail(msg) {
    if (els.error) {
      els.error.textContent = msg;
      show(els.error, true);
    }
  }
  function clearFail() {
    if (els.error) {
      els.error.textContent = "";
      show(els.error, false);
    }
  }

  /* empty | ready | working | done */
  function setState(state) {
    if (!els.card) return state;
    els.card.dataset.state = state;
    show(els.outputEmpty, state === "empty" || state === "ready");
    show(els.outputWorking, state === "working");
    show(els.output, state === "working" || state === "done");
    show(els.save, state === "done");
    show(els.reroll, state === "done");
    show(els.preview, state !== "empty");
    show(els.dzEmpty, state === "empty");
    show(els.change, state !== "empty");
    if (els.output && state !== "done") els.output.classList.remove("sharp");
    if (els.run) {
      els.run.textContent = state === "empty" ? "✦ Choose a photo" : "✦ Museify this photo";
      els.run.disabled = state === "working";
    }
    return state;
  }

  /* ---------- palette sampling ---------- */

  function avgRect(d, x0, y0, w, h) {
    var r = 0;
    var g = 0;
    var b = 0;
    var n = 0;
    for (var y = y0; y < y0 + h; y++) {
      for (var x = x0; x < x0 + w; x++) {
        var i = (y * 16 + x) * 4;
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
        n++;
      }
    }
    return n ? [r / n, g / n, b / n] : [140, 170, 220];
  }

  /* Squash the photo to 16x16 and read its overall colour. Nothing from the
     picture is kept — only this one tint feeds the character. */
  function samplePhoto(img) {
    var fallback = [150, 185, 235];
    try {
      if (!doc || !doc.createElement) return fallback;
      var iw = img.naturalWidth || img.width || 16;
      var ih = img.naturalHeight || img.height || 16;
      var c = doc.createElement("canvas");
      c.width = 16;
      c.height = 16;
      var x = c.getContext("2d");
      if (!x || !x.getImageData) return fallback;
      var s = Math.max(16 / iw, 16 / ih);
      x.drawImage(img, (16 - iw * s) / 2, (16 - ih * s) / 2, iw * s, ih * s);
      var d = x.getImageData(0, 0, 16, 16).data;
      var mid = avgRect(d, 3, 3, 10, 10); // centre weighs most: usually the subject
      var all = avgRect(d, 0, 0, 16, 16);
      return [mid[0] * 0.65 + all[0] * 0.35, mid[1] * 0.65 + all[1] * 0.35, mid[2] * 0.65 + all[2] * 0.35];
    } catch (e) {
      return fallback;
    }
  }

  /* ---------- render ---------- */

  function paintSvg(svgMarkup, done, oops) {
    var canvas = els.canvas;
    var img = new win.Image();
    img.onload = function () {
      try {
        var ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        done(canvas.toDataURL("image/png"));
      } catch (e) {
        oops(e);
      }
    };
    img.onerror = oops;
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgMarkup);
  }

  function hatch(reusePalette) {
    if (!Muse) {
      fail("Character engine failed to load. Refresh and try again.");
      setState("ready");
      return;
    }
    if (!reusePalette || !lastPalette) lastPalette = Muse.paletteFromRgb(samplePhoto(uploaded));
    var traits = Muse.traits({ palette: lastPalette }); // fresh seed = fresh Muse
    paintSvg(
      Muse.svg(traits, { size: 512, radius: 0 }),
      function (url) {
        els.output.src = url;
        els.save.href = url;
        setState("done");
        // let the blurred frame paint once, then sharpen
        win.requestAnimationFrame(function () {
          win.setTimeout(function () {
            els.output.classList.add("sharp");
          }, 60);
        });
      },
      function () {
        fail("Museification hit a cloud. Please try again.");
        setState("ready");
      }
    );
  }

  function museify(reusePalette) {
    clearFail();
    if (!uploaded) {
      if (els.file) els.file.click();
      return "pick";
    }
    if (els.card && els.card.dataset.state === "working") return "busy";
    setState("working");
    win.setTimeout(function () {
      hatch(reusePalette === true);
    }, delay());
    return "working";
  }

  function handleFile(file) {
    clearFail();
    if (!file) return "empty";
    if (!/^image\/(jpeg|png|webp)$/.test(file.type || "")) {
      fail("JPG, PNG or WEBP please.");
      return "rejected";
    }
    var reader = new win.FileReader();
    reader.onload = function () {
      var img = new win.Image();
      img.onload = function () {
        uploaded = img;
        lastPalette = null;
        els.preview.src = reader.result;
        setState("ready");
      };
      img.onerror = function () {
        fail("Could not read that image. Try another.");
      };
      img.src = reader.result;
    };
    reader.onerror = function () {
      fail("Could not read that file. Try another.");
    };
    reader.readAsDataURL(file);
    return "loading";
  }

  function reset(pickNext) {
    uploaded = null;
    lastPalette = null;
    if (els.file) els.file.value = "";
    if (els.preview) els.preview.removeAttribute("src");
    if (els.output) els.output.removeAttribute("src");
    clearFail();
    setState("empty");
    if (pickNext && els.file) els.file.click();
  }

  function initMachine() {
    grab();
    if (!els.card) return false;
    setState("empty");
    if (els.file) {
      els.file.addEventListener("change", function () {
        handleFile(els.file.files && els.file.files[0]);
      });
    }
    if (els.run) {
      els.run.addEventListener("click", function () {
        museify(false);
      });
    }
    if (els.reroll) {
      els.reroll.addEventListener("click", function () {
        museify(true); // same photo, same palette, brand-new creature
      });
    }
    if (els.change) {
      var change = function (e) {
        if (e) e.preventDefault();
        reset(true);
      };
      els.change.addEventListener("click", change);
      els.change.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") change(e);
      });
    }
    if (els.drop && win.FileReader) {
      ["dragover", "dragenter"].forEach(function (ev) {
        els.drop.addEventListener(ev, function (e) {
          e.preventDefault();
          els.drop.classList.add("dragging");
        });
      });
      ["dragleave", "dragend", "drop"].forEach(function (ev) {
        els.drop.addEventListener(ev, function () {
          els.drop.classList.remove("dragging");
        });
      });
      els.drop.addEventListener("drop", function (e) {
        e.preventDefault();
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) handleFile(f);
      });
    }
    return true;
  }

  function initChrome() {
    if (!doc) return false;
    var whatIs = byId("whatIsBtn");
    var modal = byId("modal");
    var close = byId("modalClose");
    var cta = byId("modalCta");
    var credit = byId("creditBtn");
    function open(e) {
      if (e) e.preventDefault();
      show(modal, true);
      if (close) close.focus();
    }
    function shut() {
      show(modal, false);
      if (whatIs) whatIs.focus();
    }
    if (whatIs && modal) {
      whatIs.addEventListener("click", open);
      close.addEventListener("click", shut);
      modal.addEventListener("click", function (e) {
        if (e.target === modal) shut();
      });
      doc.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && !modal.classList.contains("hidden")) shut();
      });
      if (cta) cta.addEventListener("click", shut);
    }
    if (credit) {
      credit.addEventListener("click", function () {
        credit.classList.remove("credit-boing");
        void credit.offsetWidth;
        credit.classList.add("credit-boing");
      });
    }
    // placeholder links stay put until the real ones land
    Array.prototype.forEach.call(doc.querySelectorAll("[data-soon]"), function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
      });
    });
    return true;
  }

  var api = {
    initMachine: initMachine,
    initChrome: initChrome,
    setState: setState,
    samplePhoto: samplePhoto,
    handleFile: handleFile,
    museify: museify,
    reset: reset,
    els: els
  };

  function boot() {
    initMachine();
    initChrome();
  }

  if (doc) {
    if (doc.readyState !== "loading") boot();
    else doc.addEventListener("DOMContentLoaded", boot);
  }

  win.Museification = api;
})();
