(function () {
  var MIN_FS = 5;         // never render text below this size
  var WIDTH_FILL = 0.98;  // a line may use at most 98% of the block width
  var WRAP_FILL = 1.05;   // minimum line-height / font-size when text has to wrap

  function decodeEntities(s) {
    var t = document.createElement("textarea");
    t.innerHTML = s;
    return t.value;
  }

  var measurer = document.createElement("span");
  measurer.style.position = "absolute";
  measurer.style.visibility = "hidden";
  measurer.style.whiteSpace = "nowrap";
  measurer.style.wordSpacing = "0px";
  measurer.style.letterSpacing = "0px";
  measurer.style.left = "-9999px";
  measurer.style.top = "-9999px";

  function measureWidth(text, ref, fontSize) {
    var cs = getComputedStyle(ref);
    measurer.style.fontFamily = cs.fontFamily;
    measurer.style.fontSize = fontSize + "px";
    measurer.style.fontWeight = cs.fontWeight;
    measurer.style.fontStyle = cs.fontStyle;
    measurer.textContent = text;
    return measurer.offsetWidth;
  }

  function widestLine(parts, div, fontSize) {
    var widest = 0;
    for (var i = 0; i < parts.length; i++) {
      var txt = decodeEntities(parts[i]).replace(/\s+$/, "");
      if (!txt) {
        continue;
      }
      var w = measureWidth(txt, div, fontSize);
      if (w > widest) {
        widest = w;
      }
    }
    return widest;
  }

  // Text that cannot fit by shrinking (e.g. a whole column of OCR in one
  // block): let it wrap, and pick the largest size that still fits the box.
  function fitByWrapping(div, fs, pitch, boxW, boxH) {
    div.style.whiteSpace = "normal";
    div.style.overflowWrap = "break-word";

    var size = pitch > 0 ? Math.min(fs, pitch) : fs;
    for (var i = 0; i < 40 && size > MIN_FS; i++) {
      div.style.fontSize = size + "px";
      div.style.lineHeight = (WRAP_FILL * size) + "px";
      var lines = Math.max(1, Math.round(div.scrollHeight / (WRAP_FILL * size)));
      if (lines * WRAP_FILL * size <= boxH + 1) {
        div.style.lineHeight = (boxH / lines) + "px";
        div.style.wordSpacing = "0px";
        return size;
      }
      size *= 0.93;
    }

    div.style.fontSize = MIN_FS + "px";
    div.style.wordSpacing = "0px";
    console.warn("html.js: block " + (div.dataset.block || "?") +
      " still overflows at " + MIN_FS + "px (wrapped)");
    return MIN_FS;
  }

  function fitBlocks() {
    if (!measurer.parentNode) {
      document.body.appendChild(measurer);
    }

    var blocks = document.querySelectorAll(".block");
    blocks.forEach(function (div) {
      var parts = div.innerHTML.split(/<br\s*\/?>/i);
      var lines = parts.length;
      var cs = getComputedStyle(div);

      // Remember the authored size once: fitBlocks runs twice (DOM ready and
      // fonts ready) and must not shrink the text twice.
      if (!div.dataset.origFontSize) {
        var authored = parseFloat(div.style.fontSize) || parseFloat(cs.fontSize) || 0;
        if (authored > 0) {
          div.dataset.origFontSize = String(authored);
        }
      }
      var fs = parseFloat(div.dataset.origFontSize) || 0;
      if (!fs) {
        return;
      }

      // drop any wrapping applied by a previous run, start from the page CSS
      div.style.whiteSpace = "";

      var boxW = div.clientWidth;
      var boxH = div.offsetHeight;
      var pitch = boxH > 0 && lines > 0 ? boxH / lines : 0;

      // vertical fit: a glyph is never taller than its own line box
      var size = pitch > 0 ? Math.min(fs, pitch) : fs;

      if (boxW > 0 && widestLine(parts, div, size) > WIDTH_FILL * boxW) {
        // horizontal fit: shrink (never grow) until every line fits
        var lo = MIN_FS;
        var hi = size;
        for (var i = 0; i < 12; i++) {
          var mid = (lo + hi) / 2;
          if (widestLine(parts, div, mid) <= WIDTH_FILL * boxW) {
            lo = mid;
          } else {
            hi = mid;
          }
        }
        size = lo;

        // If the text only fits at an unreadable size and the block already
        // holds several lines, wrap it instead of stretching one long line.
        var tooSmall = lines >= 2 && size < fs * 0.6;
        if (tooSmall || widestLine(parts, div, size) > WIDTH_FILL * boxW) {
          fitByWrapping(div, fs, pitch, boxW, boxH);
          return;
        }
      }

      div.style.fontSize = size + "px";
      if (pitch > 0) {
        div.style.lineHeight = pitch + "px";
      }
      div.style.wordSpacing = "0px";
    });
  }

  // Fit once, after the real fonts are in place: fitting earlier would use
  // fallback metrics and reflow the text again when the font swaps in.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(fitBlocks, fitBlocks);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fitBlocks);
  } else {
    fitBlocks();
  }
})();
