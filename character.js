/* Museification character engine.
   One source of truth for the fuzzy little Muse creatures: the gallery art is
   pre-rendered from here at build time, and the machine builds a brand-new one
   per upload from the same traits. Everything is plain SVG so it works as an
   <img> src and can be painted into a canvas for the PNG download. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MuseCharacter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* "plain" is weighted by being the fallback: most Muses wear nothing. */
  var ACCESSORIES = ["plain", "tufts", "ears", "horn", "antenna", "leaf", "bow"];
  var EYES = ["dot", "sparkle", "happy"];

  /* Soft, creamy coats — the face is only a shade lighter than the body, the
     way a knitted hood sits against skin. */
  var PALETTES = [
    { name: "cream", body: "#e8dbc2", shade: "#cdba99", face: "#f8efdc", accent: "#e8a9ac", bg: ["#f3f8ff", "#dcebfb"] },
    { name: "mist", body: "#c2d8f2", shade: "#9cb8d9", face: "#ecf3fc", accent: "#c79aa8", bg: ["#eff6ff", "#d0e3fa"] },
    { name: "sage", body: "#c3dcc4", shade: "#9dbf9f", face: "#edf6ec", accent: "#dba8a2", bg: ["#eff8f0", "#d2e9d6"] },
    { name: "lavender", body: "#d5cbec", shade: "#b1a4d3", face: "#f3effb", accent: "#cf9db4", bg: ["#f4f1fd", "#ded4f6"] },
    { name: "butter", body: "#f0deac", shade: "#d7c084", face: "#fbf3dc", accent: "#e5a98f", bg: ["#fdf8e9", "#f8e6bb"] },
    { name: "rose", body: "#f0cfd2", shade: "#d7a8ad", face: "#fbeceb", accent: "#dd96a4", bg: ["#fdf1f3", "#fad9e1"] }
  ];

  var INK = "#1d1c22";

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  /* Deterministic tiny PRNG so a given seed always rebuilds the same creature. */
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s ^= s << 13;
      s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5;
      s >>>= 0;
      return s / 4294967296;
    };
  }

  function pick(list, r) {
    return list[Math.floor(r() * list.length) % list.length];
  }

  function hexToRgb(hex) {
    var h = String(hex).replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbToHex(c) {
    return (
      "#" +
      c
        .map(function (v) {
          var s = Math.round(clamp(v, 0, 255)).toString(16);
          return s.length < 2 ? "0" + s : s;
        })
        .join("")
    );
  }

  function mix(a, b, t) {
    var x = typeof a === "string" ? hexToRgb(a) : a;
    var y = typeof b === "string" ? hexToRgb(b) : b;
    return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
  }

  /* Pull a colour most of the way to grey so coats stay soft, never neon. */
  function calm(hex, amount) {
    var c = hexToRgb(hex);
    var g = c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;
    return mix(hex, rgbToHex([g, g, g]), amount);
  }

  /* An uploaded photo only steers the palette — the creature itself is drawn
     from scratch, never traced from the person in the picture. */
  function paletteFromRgb(rgb) {
    var soft = calm(mix(rgb, "#fff6e8", 0.52), 0.3);
    return {
      name: "custom",
      body: soft,
      shade: mix(soft, "#6b5b45", 0.26),
      face: mix(soft, "#fff8ec", 0.62),
      accent: mix(calm(rgb, 0.3), "#e2909f", 0.55),
      bg: [mix(soft, "#ffffff", 0.72), mix(soft, "#cfe4fb", 0.6)]
    };
  }

  function traits(opts) {
    opts = opts || {};
    var seed = typeof opts.seed === "number" ? opts.seed : Math.floor(Math.random() * 1e9);
    var r = rng(seed);
    var pal = opts.palette || PALETTES[Math.floor(r() * PALETTES.length) % PALETTES.length];
    return {
      seed: seed,
      palette: pal,
      accessory: opts.accessory || pick(ACCESSORIES, r),
      eyes: opts.eyes || pick(EYES, r),
      /* small build differences so no two look stamped from one mould */
      chub: 0.94 + r() * 0.14,
      tilt: (r() - 0.5) * 5,
      background: opts.background !== false
    };
  }

  /* ---------- drawing helpers (all in a 200x200 viewBox) ---------- */

  function accessoryTop(t) {
    var p = t.palette;
    var a = p.accent;
    switch (t.accessory) {
      case "ears":
        return (
          '<ellipse cx="62" cy="36" rx="15" ry="16" fill="' + p.body + '"/>' +
          '<ellipse cx="138" cy="36" rx="15" ry="16" fill="' + p.body + '"/>' +
          '<ellipse cx="62" cy="38" rx="7" ry="7.5" fill="' + a + '" opacity=".4"/>' +
          '<ellipse cx="138" cy="38" rx="7" ry="7.5" fill="' + a + '" opacity=".4"/>'
        );
      case "horn":
        return (
          '<path d="M100 8c6 9 9 16 9 21H91c0-5 3-12 9-21z" fill="' + mix(a, "#fff3e6", 0.4) + '"/>' +
          '<path d="M100 14c3 6 5 10 5 14h-4c0-4-1-8-1-14z" fill="#fff" opacity=".5"/>'
        );
      case "antenna":
        return (
          '<path d="M100 32c0-11 1-16 3-21" stroke="' + p.shade + '" stroke-width="3.4" stroke-linecap="round" fill="none"/>' +
          '<circle cx="103" cy="8" r="7" fill="' + mix(a, "#ffffff", 0.3) + '"/>' +
          '<circle cx="101" cy="6" r="2.4" fill="#fff" opacity=".7"/>'
        );
      case "leaf":
        return (
          '<path d="M100 30c0-9 1-14 3-19" stroke="#a9c8a4" stroke-width="3.4" stroke-linecap="round" fill="none"/>' +
          '<path d="M103 12c8-6 16-5 19-2-2 4-8 10-16 9-2 0-3-3-3-7z" fill="#b6d6ad"/>' +
          '<path d="M103 12c-7-5-14-5-17-2 2 4 7 9 14 9 2 0 3-3 3-7z" fill="#c8e3bf"/>'
        );
      case "bow":
        return (
          '<path d="M58 30c-9-7-17-7-19-2s3 12 12 13z" fill="' + a + '" opacity=".9"/>' +
          '<path d="M58 30c-5-9-3-17 2-19s10 5 9 14z" fill="' + a + '" opacity=".75"/>' +
          '<circle cx="61" cy="33" r="5" fill="' + mix(a, "#ffffff", 0.45) + '"/>'
        );
      case "tufts":
        return (
          '<path d="M70 26c-4-10-2-18 2-21 4 7 7 12 10 15z" fill="' + p.body + '"/>' +
          '<path d="M130 26c4-10 2-18-2-21-4 7-7 12-10 15z" fill="' + p.body + '"/>'
        );
      default:
        return ""; /* plain: just fur */
    }
  }

  function eyesMarkup(t) {
    var lx = 88;
    var rx = 112;
    var y = 82;
    if (t.eyes === "happy") {
      return (
        '<path d="M82 84q6-8 12 0" stroke="' + INK + '" stroke-width="4" stroke-linecap="round" fill="none"/>' +
        '<path d="M106 84q6-8 12 0" stroke="' + INK + '" stroke-width="4" stroke-linecap="round" fill="none"/>'
      );
    }
    var base =
      '<circle cx="' + lx + '" cy="' + y + '" r="5.6" fill="' + INK + '"/>' +
      '<circle cx="' + rx + '" cy="' + y + '" r="5.6" fill="' + INK + '"/>';
    if (t.eyes === "sparkle") {
      base +=
        '<circle cx="' + (lx + 2) + '" cy="' + (y - 2.2) + '" r="1.8" fill="#fff"/>' +
        '<circle cx="' + (rx + 2) + '" cy="' + (y - 2.2) + '" r="1.8" fill="#fff"/>';
    }
    return base;
  }

  /* hooded head flowing into a wide, heavy belly */
  var BODY_PATH =
    "M100 20c-31 0-51 21-51 49 0 12 3 21 8 28-15 9-25 27-25 44 0 25 30 41 68 41s68-16 68-41c0-17-10-35-25-44 5-7 8-16 8-28 0-28-20-49-51-49z";

  function svg(t, opts) {
    t = t && t.palette ? t : traits(t);
    opts = opts || {};
    var size = opts.size || 200;
    var uid = "m" + (t.seed >>> 0).toString(36);
    var p = t.palette;
    var furEdge = mix(p.shade, "#5a4a36", 0.12);
    var s = t.chub;
    var bg = t.background
      ? '<rect width="200" height="200" rx="' + (opts.radius != null ? opts.radius : 44) + '" fill="url(#bg' + uid + ')"/>' +
        '<circle cx="32" cy="36" r="11" fill="#fff" opacity=".45"/>' +
        '<circle cx="170" cy="28" r="7" fill="#fff" opacity=".38"/>'
      : "";

    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="' + size + '" height="' + size + '" role="img">' +
      "<defs>" +
      '<radialGradient id="bg' + uid + '" cx="50%" cy="16%" r="94%">' +
      '<stop offset="0" stop-color="' + p.bg[0] + '"/><stop offset="1" stop-color="' + p.bg[1] + '"/>' +
      "</radialGradient>" +
      /* light falling from the upper left across the coat */
      '<linearGradient id="coat' + uid + '" x1="22%" y1="4%" x2="80%" y2="100%">' +
      '<stop offset="0" stop-color="' + mix(p.body, "#fffaf0", 0.42) + '"/>' +
      '<stop offset=".5" stop-color="' + p.body + '"/>' +
      '<stop offset="1" stop-color="' + mix(p.shade, "#8a7355", 0.15) + '"/>' +
      "</linearGradient>" +
      /* the face is barely lighter than the coat, warm rather than white */
      '<radialGradient id="face' + uid + '" cx="42%" cy="30%" r="82%">' +
      '<stop offset="0" stop-color="' + mix(p.face, "#ffffff", 0.35) + '"/>' +
      '<stop offset="1" stop-color="' + mix(p.face, p.shade, 0.22) + '"/>' +
      "</radialGradient>" +
      /* hood shadow falling onto the top of the face */
      '<linearGradient id="hood' + uid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + p.shade + '" stop-opacity=".5"/>' +
      '<stop offset=".45" stop-color="' + p.shade + '" stop-opacity="0"/>' +
      "</linearGradient>" +
      /* weight in the lower half of the body */
      '<linearGradient id="belly' + uid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset=".45" stop-color="' + furEdge + '" stop-opacity="0"/>' +
      '<stop offset="1" stop-color="' + furEdge + '" stop-opacity=".45"/>' +
      "</linearGradient>" +
      /* ragged silhouette: noise pushed through a displacement map */
      '<filter id="fur' + uid + '" x="-14%" y="-14%" width="128%" height="128%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.78" numOctaves="4" seed="' + (t.seed % 500) + '" result="n"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="4.2" xChannelSelector="R" yChannelSelector="G"/>' +
      "</filter>" +
      /* fine grain brushed over the coat so the fur reads as fur, not plastic */
      '<filter id="grain' + uid + '" x="0" y="0" width="100%" height="100%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="4" seed="' + ((t.seed + 91) % 500) + '"/>' +
      '<feColorMatrix type="matrix" values="0 0 0 0 .36  0 0 0 0 .29  0 0 0 0 .22  0 0 0 .3 0"/>' +
      "</filter>" +
      '<clipPath id="bodyClip' + uid + '"><path d="' + BODY_PATH + '"/></clipPath>' +
      "</defs>" +
      bg +
      '<g transform="translate(100 108) rotate(' + t.tilt.toFixed(2) + ') scale(' + s.toFixed(3) + ') translate(-100 -108)">' +
      '<ellipse cx="100" cy="188" rx="54" ry="7" fill="' + p.shade + '" opacity=".3"/>' +
      '<g filter="url(#fur' + uid + ')">' +
      accessoryTop(t) +
      /* stubby legs with a notch between them */
      '<rect x="72" y="168" width="24" height="22" rx="11" fill="' + mix(p.shade, "#6b5b45", 0.08) + '"/>' +
      '<rect x="104" y="168" width="24" height="22" rx="11" fill="' + mix(p.shade, "#6b5b45", 0.08) + '"/>' +
      /* arms hanging at the sides */
      '<ellipse cx="32" cy="146" rx="14" ry="26" fill="' + p.shade + '" transform="rotate(12 32 146)"/>' +
      '<ellipse cx="168" cy="146" rx="14" ry="26" fill="' + p.shade + '" transform="rotate(-12 168 146)"/>' +
      '<path d="' + BODY_PATH + '" fill="url(#coat' + uid + ')"/>' +
      /* everything below is clipped to the body so the fuzz stays on the body */
      '<g clip-path="url(#bodyClip' + uid + ')">' +
      '<rect x="0" y="0" width="200" height="200" filter="url(#grain' + uid + ')" opacity=".24"/>' +
      '<rect x="0" y="0" width="200" height="200" fill="url(#belly' + uid + ')"/>' +
      "</g>" +
      "</g>" +
      /* face opening: small, warm, framed by the hood of fur */
      '<ellipse cx="100" cy="80" rx="31" ry="30" fill="url(#face' + uid + ')"/>' +
      '<ellipse cx="100" cy="80" rx="31" ry="30" fill="url(#hood' + uid + ')"/>' +
      '<ellipse cx="77" cy="90" rx="8.5" ry="5" fill="' + p.accent + '" opacity=".42"/>' +
      '<ellipse cx="123" cy="90" rx="8.5" ry="5" fill="' + p.accent + '" opacity=".42"/>' +
      eyesMarkup(t) +
      '<path d="M94 93q6 6 12 0" stroke="' + INK + '" stroke-width="2.8" stroke-linecap="round" fill="none"/>' +
      "</g>" +
      "</svg>"
    );
  }

  function dataUrl(t, opts) {
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg(t, opts));
  }

  return {
    PALETTES: PALETTES,
    ACCESSORIES: ACCESSORIES,
    EYES: EYES,
    traits: traits,
    svg: svg,
    dataUrl: dataUrl,
    paletteFromRgb: paletteFromRgb,
    mix: mix,
    calm: calm,
    rgbToHex: rgbToHex
  };
});
