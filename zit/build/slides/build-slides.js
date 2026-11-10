#!/usr/bin/env node
// Build plain instructor cue decks, one per lesson, from JSON lesson specs.
// Every time segment becomes one slide: a huge topic title for the class, and underneath the
// instructor's points (what to say, what to demonstrate, what to ask). Answers go to the notes.
// The timing of every part is validated before anything is drawn.
// Usage: node build-cues.js <config.json>
"use strict";

const fs = require("fs");
const path = require("path");
const PptxGenJS = require("pptxgenjs");
const JSZip = require(require.resolve("jszip", { paths: [require.resolve("pptxgenjs")] }));

const PT_PER_INCH = 72;
const THEME_PART = "ppt/theme/theme1.xml";
const SLIDE_PARTS = /^ppt\/(slides|slideLayouts|slideMasters)\/[^/]+\.xml$/;
const NOTES_PARTS = /^ppt\/notesSlides\/[^/]+\.xml$/;
const SLIDE_FILES = /^ppt\/slides\/slide\d+\.xml$/;
// The color slots of an OOXML theme, in the order the schema requires.
const SCHEME_SLOTS = ["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"];
const HEX_COLOR = /^[0-9A-Fa-f]{6}$/;
const MASTERS = { title: "TITLE", content: "CONTENT" };

const fill = (template, values) => template.replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match));
const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null));
const asItem = (item, key) => (typeof item === "string" ? { [key]: item } : item);
const sum = (values) => values.reduce((a, b) => a + b, 0);

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// Reads the config, and resolves every path in it against the config file's own folder.
function loadConfig(file) {
  if (!file) throw new Error("usage: build-slides.js <config.json>");
  const cfg = loadJson(file);
  const base = path.dirname(path.resolve(file));
  for (const key of cfg.pathKeys) cfg.paths[key] = path.resolve(base, cfg.paths[key]);
  return cfg;
}

function xmlAttribute(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------- timing
class Timing {
  constructor(cfg) {
    this.cfg = cfg;
  }

  sayMinutes(item) { return asItem(item, "text").min ?? this.cfg.estimate.say; }

  demoMinutes(item) {
    const it = asItem(item, "cmd");
    return it.min ?? (it.step !== undefined ? this.cfg.estimate.step : this.cfg.estimate.cmd);
  }

  askMinutes(item) { return item.min ?? this.cfg.estimate.ask; }

  estimate(segment) {
    if (segment.break) return segment.to - segment.from;
    return sum((segment.say || []).map((i) => this.sayMinutes(i)))
      + sum((segment.demo || []).map((i) => this.demoMinutes(i)))
      + sum((segment.ask || []).map((i) => this.askMinutes(i)))
      + sum((segment.tasks || []).map((t) => t.min ?? 0));
  }

  check(lesson) {
    const parts = lesson.parts.map((part) => {
      const problems = [];
      let cursor = 0;
      const segments = part.segments.map((seg) => {
        if (seg.from !== cursor) problems.push(`${seg.title}: starts at ${seg.from}, expected ${cursor}`);
        if (seg.to <= seg.from) problems.push(`${seg.title}: ends before it starts`);
        (seg.tasks || []).filter((t) => t.min === undefined).forEach((t) => problems.push(`${seg.title}: task without minutes: ${t.text}`));
        cursor = seg.to;
        const minutes = seg.to - seg.from;
        const estimate = this.estimate(seg);
        if (estimate > minutes) problems.push(`${seg.title}: needs ${estimate} min, has ${minutes}`);
        return { from: seg.from, to: seg.to, title: seg.title, minutes, estimate, slack: +(minutes - estimate).toFixed(2) };
      });
      if (cursor !== part.minutes) problems.push(`${part.name}: segments end at ${cursor}, part has ${part.minutes}`);
      return {
        name: part.name, minutes: part.minutes,
        estimate: +sum(segments.map((s) => s.estimate)).toFixed(2), segments, problems,
      };
    });
    return { number: lesson.number, title: lesson.title, parts };
  }
}

// ---------------------------------------------------------------- bidirectional text
// Escapes characters that are special inside a regular-expression character class.
function escapeClass(chars) { return chars.replace(/[\\\]^-]/g, "\\$&"); }

class Bidi {
  constructor(cfg) {
    this.b = cfg.bidi;
    // The direction marks count as letters of their direction, so a flow marker fenced with RTL marks
    // separates the Latin stretches around it.
    this.rtlRe = new RegExp(`[${this.b.rtlCharClass}${escapeClass(this.b.rlm)}]`, "u");
    this.ltrRe = new RegExp(`[${this.b.ltrCharClass}${escapeClass(this.b.lrm)}]`, "u");
    // A dash between two numbers becomes a separator the bidi algorithm keeps inside the number,
    // so a range reads left to right ("10-20") instead of flipping around the dash.
    this.rangeRe = new RegExp(`(\\d)\\s*[${escapeClass(this.b.numericRangeDashes)}]\\s*(?=\\d)`, "gu");
    this.openers = new Map(this.b.bracketPairs.map(([open, close]) => [open, close]));
    this.closers = new Map(this.b.bracketPairs.map(([open, close]) => [close, open]));
  }

  dir(ch) {
    if (this.rtlRe.test(ch)) return true;
    return this.ltrRe.test(ch) ? false : null;
  }

  hasRtl(text) { return [...text].some((ch) => this.dir(ch) === true); }

  hasLtr(text) { return [...text].some((ch) => this.dir(ch) === false); }

  // Runs of one strong direction; neutral characters join the run before them.
  split(text, fallback) {
    const chunks = [];
    let current = null;
    let leading = "";
    for (const ch of text) {
      const dir = this.dir(ch);
      if (dir === null) {
        if (current) current.text += ch; else leading += ch;
      } else if (!current) {
        current = { text: leading + ch, rtl: dir };
        leading = "";
      } else if (current.rtl === dir) current.text += ch;
      else {
        chunks.push(current);
        current = { text: ch, rtl: dir };
      }
    }
    if (current) chunks.push(current);
    else if (leading) chunks.push({ text: leading, rtl: fallback });
    return chunks;
  }

  // Text of a right-to-left paragraph. Flow markers stay right-to-left, and every Latin stretch is
  // fenced with LTR marks, so punctuation glued to it (".env", "add()", "-x") stays with it while
  // sentence punctuation, separators and unpaired brackets around it stay with the sentence.
  rtlText(text) {
    const { lrm, rlm, flowMarker, numericRangeSeparator } = this.b;
    const normalized = text.replace(this.rangeRe, `$1${numericRangeSeparator}`);
    const chunks = this.split(normalized.split(flowMarker).join(`${rlm}${flowMarker}${rlm}`), true);
    for (let i = 1; i < chunks.length; i += 1) {
      if (chunks[i].rtl !== false) continue;
      const prev = chunks[i - 1];
      const tail = this.gluedPrefix(prev.text);
      if (tail) {
        prev.text = prev.text.slice(0, -tail.length);
        chunks[i].text = tail + chunks[i].text;
      }
    }
    return chunks.map((chunk, i) => {
      if (chunk.rtl !== false) return chunk.text;
      const lead = /^\s*/.exec(chunk.text)[0];
      const rest = chunk.text.slice(lead.length);
      const trail = /\s*$/.exec(rest)[0];
      const sides = {
        before: chunks.slice(0, i).some((c) => c.rtl === true),
        after: chunks.slice(i + 1).some((c) => c.rtl === true),
      };
      const { head, core, tail } = this.trimStretch(rest.slice(0, rest.length - trail.length), sides);
      return core ? `${lead}${head}${lrm}${core}${lrm}${tail}${trail}` : chunk.text;
    }).join("");
  }

  isNeutral(text) { return [...text].every((ch) => this.dir(ch) === null); }

  // The neutral characters at the end of right-to-left text that belong to the Latin word after it:
  // a word of its own (" ./"), or what follows a prefix joiner ("ב-.git" → ".git").
  gluedPrefix(text) {
    const word = /\s(\S+)$/.exec(text);
    if (word && this.isNeutral(word[1])) return word[1];
    const run = /\S*$/.exec(text)[0];
    let start = run.length;
    while (start > 0 && this.dir(run[start - 1]) === null) start -= 1;
    const neutral = run.slice(start);
    const joined = start > 0 && this.dir(run[start - 1]) === true && this.b.prefixJoiners.includes(neutral[0]);
    return joined ? neutral.slice(1) : "";
  }

  // How many of a bracket pair's openers are left unclosed in the text (negative: unopened closers).
  bracketBalance(text, open, close) {
    return [...text].reduce((n, ch) => n + (ch === open) - (ch === close), 0);
  }

  // Splits off the edges of a Latin stretch that belong to the surrounding sentence: brackets opened
  // or closed outside it, and, where right-to-left text lies on that side, neutral words standing
  // apart from it (" · ") and the sentence's closing punctuation. A paragraph with no right-to-left
  // text keeps all of its characters inside the fence.
  trimStretch(text, sides) {
    const { sentencePunctuation } = this.b;
    const sentence = sides.before || sides.after;
    let head = "";
    let core = text;
    let tail = "";
    for (let changed = true; changed && core;) {
      changed = false;
      const apart = /^(\S+)(\s+)/.exec(core);
      const first = core[0];
      if (sides.before && apart && this.isNeutral(apart[1])) {
        head += apart[0];
        core = core.slice(apart[0].length);
        changed = true;
      } else if (this.openers.has(first) && this.bracketBalance(core, first, this.openers.get(first)) > 0) {
        head += first;
        core = core.slice(1);
        changed = true;
      }
      if (!core) break;
      const apartEnd = /(\s+)(\S+)$/.exec(core);
      const last = core[core.length - 1];
      if (sides.after && apartEnd && this.isNeutral(apartEnd[2])) {
        tail = apartEnd[0] + tail;
        core = core.slice(0, -apartEnd[0].length);
        changed = true;
      } else if ((sentence && sentencePunctuation.includes(last))
        || (this.closers.has(last) && this.bracketBalance(core, this.closers.get(last), last) < 0)) {
        tail = last + tail;
        core = core.slice(0, -1);
        changed = true;
      }
    }
    return { head, core, tail };
  }

  // A command line: flow markers point right, and a Hebrew comment is embedded right-to-left.
  ltrLine(line) {
    const { flowMarker, ltrFlowMarker, commentMark, rtlEmbed, embedEnd } = this.b;
    const at = this.commentStart(line);
    const code = line.slice(0, at).split(flowMarker).join(ltrFlowMarker);
    let comment = line.slice(at);
    if (comment && this.hasRtl(comment)) {
      const body = comment.slice(commentMark.length);
      const lead = body.length - body.trimStart().length;
      comment = `${comment.slice(0, commentMark.length + lead)}${rtlEmbed}${this.rtlText(body.trimStart())}${embedEnd}`;
    }
    return { code, comment };
  }

  // Index where a shell comment starts: the comment mark outside quotes, at the start or after a space.
  commentStart(line) {
    const mark = this.b.commentMark;
    let quote = null;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (quote) { if (ch === quote) quote = null; continue; }
      if (ch === "\"" || ch === "'") quote = ch;
      else if (line.startsWith(mark, i) && (i === 0 || /\s/.test(line[i - 1]))) return i;
    }
    return line.length;
  }
}

// ---------------------------------------------------------------- measuring
class Measure {
  constructor(cfg) {
    this.cfg = cfg;
    const L = cfg.layout;
    this.contentW = L.width - 2 * L.marginX;
  }

  widthIn(text, pt, code, bold) {
    const { bodyCharEm, codeCharEm, boldScale } = this.cfg.metrics;
    return (text.length * (code ? codeCharEm : bodyCharEm) * pt * (bold ? boldScale : 1)) / PT_PER_INCH;
  }

  lines(text, boxW, pt, code, bold) {
    return Math.max(1, Math.ceil((this.widthIn(text, pt, code, bold) * this.cfg.metrics.wrapSlack) / boxW));
  }

  lineHeight(pt) { return (pt * this.cfg.metrics.lineSpacing) / PT_PER_INCH; }

  // Largest size that keeps the text on one line; failing that, the largest that fits the box.
  fitSingle(text, boxW, boxH, maxPt, minPt, bold) {
    for (let pt = maxPt; pt >= minPt; pt -= 1) {
      if (this.lines(text, boxW, pt, false, bold) === 1 && this.lineHeight(pt) <= boxH) return pt;
    }
    for (let pt = maxPt; pt >= minPt; pt -= 1) {
      if (this.lines(text, boxW, pt, false, bold) * this.lineHeight(pt) <= boxH) return pt;
    }
    return minPt;
  }
}

// ---------------------------------------------------------------- deck
class CueDeck {
  constructor(cfg, lesson) {
    this.cfg = cfg;
    this.lesson = lesson;
    this.bidi = new Bidi(cfg);
    this.m = new Measure(cfg);
    this.timing = new Timing(cfg);
    this.pres = new PptxGenJS();
    this.C = this.pres.SchemeColor;
    this.count = 0;
    this.warnings = [];
  }

  name(kind) {
    this.count += 1;
    return `${kind}-${this.count}`;
  }

  words(extra = {}) {
    return { ...this.cfg.labels, number: this.lesson.number, title: this.lesson.title, ...extra };
  }

  // ---- text objects -------------------------------------------------------
  rtlParagraph(text, options) {
    const { meta } = this.cfg;
    return this.bidi.split(this.bidi.rtlText(text), true).map((part, i, all) => ({
      text: part.text,
      options: clean({
        ...options, align: "right", rtlMode: true,
        lang: part.rtl ? meta.language : meta.ltrLanguage,
        breakLine: i === all.length - 1 ? true : undefined,
      }),
    }));
  }

  codeParagraph(line, options) {
    const { meta, fonts } = this.cfg;
    const { code, comment } = this.bidi.ltrLine(line);
    const segments = [
      { text: code, color: options.color },
      { text: comment, color: options.commentColor },
    ].filter((s) => s.text);
    if (!segments.length) segments.push({ text: " ", color: options.color });
    const out = [];
    segments.forEach((s) => this.bidi.split(s.text, false).forEach((part) => out.push({
      text: part.text,
      options: clean({
        fontFace: fonts.code, fontSize: options.fontSize, color: s.color, align: "left", rtlMode: false,
        paraSpaceBefore: out.length ? undefined : options.paraSpaceBefore,
        lang: part.rtl ? meta.language : meta.ltrLanguage,
      }),
    })));
    out[out.length - 1].options.breakLine = true;
    return out;
  }

  addText(slide, objects, box, kind, valign = "top") {
    if (!objects.length) return;
    delete objects[objects.length - 1].options.breakLine;
    slide.addText(objects, { ...box, isTextBox: true, margin: 0, valign, objectName: this.name(kind) });
  }

  // ---- layouts --------------------------------------------------------------
  defineLayouts() {
    const { layout: L, sizes: S, format } = this.cfg;
    const C = this.C;
    const footer = fill(format.footer, this.words());
    const footerObjects = [
      { text: { text: footer, options: { x: L.marginX + 1, y: L.footerY, w: this.m.contentW - 1, h: L.footerH, fontSize: S.footer, color: C.accent3, align: "right", rtlMode: true, margin: 0, lang: this.cfg.meta.language } } },
    ];
    const slideNumber = { x: L.marginX, y: L.footerY, w: 0.8, h: L.footerH, fontSize: S.footer, color: C.accent3, align: "left" };
    this.pres.defineSlideMaster({
      title: MASTERS.content,
      background: { color: C.background1 },
      objects: [
        ...footerObjects,
        { placeholder: { options: { name: "title", type: "title", x: L.marginX, y: L.titleY, w: this.m.contentW, h: L.titleH, bold: true, color: C.text1, align: "right", valign: "middle", margin: 0, rtlMode: true }, text: "" } },
      ],
      slideNumber,
    });
    this.pres.defineSlideMaster({
      title: MASTERS.title,
      background: { color: C.background1 },
      objects: [
        { placeholder: { options: { name: "title", type: "title", x: L.marginX, y: 2.45, w: this.m.contentW, h: 1.2, bold: true, color: C.text1, align: "right", valign: "top", margin: 0, rtlMode: true }, text: "" } },
      ],
    });
  }

  fillTitle(slide, text, box, max, min) {
    const pt = this.m.fitSingle(text, box.w, box.h, max, min, true);
    slide.addText(this.rtlParagraph(text, { fontSize: pt, bold: true, color: this.C.text1 }).map((o, i, all) => {
      if (i === all.length - 1) delete o.options.breakLine;
      return o;
    }), { placeholder: "title" });
  }

  slide(master, section) {
    return this.pres.addSlide({ masterName: master, sectionTitle: section });
  }

  notes(slide, paragraphs) {
    const text = paragraphs.filter(Boolean).join("\n\n");
    if (text) slide.addNotes(text);
  }

  // ---- slides -----------------------------------------------------------------
  titleSlide(section) {
    const { layout: L, sizes: S, format } = this.cfg;
    const C = this.C;
    const slide = this.slide(MASTERS.title, section);
    const kicker = fill(format.deckKicker, this.words());
    this.addText(slide, this.rtlParagraph(kicker, { fontSize: S.deckKicker, bold: true, color: C.text1 }),
      { x: L.marginX, y: 1.1, w: this.m.contentW, h: 1.25 }, "kicker", "bottom");
    this.fillTitle(slide, this.lesson.title, { w: this.m.contentW, h: 1.2 }, S.deckTitle, S.deckTitleMin);
    const parts = this.lesson.parts
      .map((p) => fill(format.partLine, this.words({ name: p.name, minutes: p.minutes })))
      .join(format.partsJoin);
    this.addText(slide, this.rtlParagraph(parts, { fontSize: S.deckParts, color: C.accent1 }),
      { x: L.marginX, y: 3.8, w: this.m.contentW, h: 0.5 }, "parts");
  }

  agendaSlide(part) {
    const { layout: L, sizes: S, format, labels } = this.cfg;
    const C = this.C;
    const slide = this.slide(MASTERS.content, part.name);
    const title = fill(format.agendaTitle, this.words({ name: part.name, minutes: part.minutes }));
    this.fillTitle(slide, title, { w: this.m.contentW, h: L.titleH }, S.title - 10, S.titleMin);
    const rows = [
      [labels.time, labels.topic, labels.minutes],
      ...part.segments.map((s) => [fill(format.range, s), s.title, String(s.to - s.from)]),
    ];
    const box = { x: L.marginX, y: L.bodyY, w: this.m.contentW, h: L.bodyBottom - L.bodyY };
    this.table(slide, rows, box, {
      codeColumns: [], widths: [0.18, 0.64, 0.18],
      mutedRow: (row, r) => r > 0 && part.segments[r - 1].break,
    });
  }

  // The slide's points as groups, each a label and its lines, in the order they are taught.
  segmentGroups(seg) {
    const { labels, format } = this.cfg;
    const groups = [
      { label: labels.say, items: (seg.say || []).map((i) => ({ kind: "say", text: asItem(i, "text").text })) },
      {
        label: labels.demo,
        items: (seg.demo || []).map((i) => {
          const it = asItem(i, "cmd");
          return it.step !== undefined ? { kind: "step", text: it.step } : { kind: "cmd", text: it.cmd };
        }),
      },
      // Who does what: role cards for an activity, shown last so they stay on screen while people work.
      // They take no time of their own.
      { label: labels.cards, items: (seg.cards || []).map((text) => ({ kind: "card", text })) },
      { label: labels.ask, items: (seg.ask || []).map((q, i) => ({ kind: "ask", text: fill(format.question, { n: i + 1, text: q.q }) })) },
      { label: labels.tasks, items: (seg.tasks || []).map((t) => ({ kind: "task", text: fill(format.task, this.words({ min: t.min, text: t.text })) })) },
      { label: labels.check, items: seg.check ? [{ kind: "check", text: seg.check }] : [] },
    ];
    return groups.filter((g) => g.items.length);
  }

  linesHeight(lines, width, pt) {
    const { sizes: S, metrics } = this.cfg;
    const indent = (this.cfg.layout.bulletIndent * 1.6) / PT_PER_INCH;
    const codePt = this.codeSize(lines, width, pt);
    return sum(lines.map((line, i) => {
      const gap = i ? (pt * metrics.paragraphGap) / PT_PER_INCH : 0;
      if (line.kind === "label") return gap + this.m.lineHeight(S.label) + (i ? (pt * 0.4) / PT_PER_INCH : 0);
      if (line.kind === "cmd") return gap + this.m.lines(line.text, width, codePt, true) * this.m.lineHeight(codePt);
      return gap + this.m.lines(line.text, width - indent, pt) * this.m.lineHeight(pt);
    }));
  }

  codeSize(lines, width, pt) {
    const { sizes: S, metrics } = this.cfg;
    const longest = Math.max(0, ...lines.filter((l) => l.kind === "cmd").map((l) => l.text.length));
    const byWidth = longest ? Math.floor((width * PT_PER_INCH) / (longest * metrics.codeCharEm * metrics.wrapSlack)) : S.codeMax;
    return Math.max(S.codeMin, Math.min(S.codeMax, pt - 2, byWidth));
  }

  // Pages that hold their points at a readable size: whole groups when they fit, and a group
  // that is taller than a page continues on the next one under its label.
  paginate(groups, box) {
    const target = this.cfg.sizes.bodyTarget;
    const fits = (lines) => this.linesHeight(lines, box.w, target) <= box.h;
    const pages = [];
    let page = [];
    for (const group of groups) {
      const label = { kind: "label", text: group.label };
      const block = [label, ...group.items];
      if (fits([...page, ...block])) {
        page.push(...block);
        continue;
      }
      if (page.length) pages.push(page);
      page = [label];
      for (const item of group.items) {
        if (page.length > 1 && !fits([...page, item])) {
          pages.push(page);
          page = [label];
        }
        page.push(item);
      }
    }
    if (page.length) pages.push(page);
    return pages;
  }

  segmentSlides(part, seg) {
    const { layout: L, sizes: S, format, labels } = this.cfg;
    const C = this.C;
    const meta = fill(format.meta, this.words({ part: part.name, range: fill(format.range, seg), minutes: seg.to - seg.from }));
    const box = { x: L.marginX, y: L.bodyY, w: this.m.contentW, h: L.bodyBottom - L.bodyY };
    const pages = seg.break ? [[]] : this.paginate(this.segmentGroups(seg), box);
    const answers = (seg.ask || []).map((q, i) => (q.a ? fill(format.answer, { n: i + 1, text: q.a }) : null)).filter(Boolean);
    pages.forEach((lines) => {
      const slide = this.slide(MASTERS.content, part.name);
      this.addText(slide, this.rtlParagraph(meta, { fontSize: S.meta, color: C.accent1 }),
        { x: L.marginX, y: L.metaY, w: this.m.contentW, h: L.metaH }, "meta", "middle");
      this.fillTitle(slide, seg.title, { w: this.m.contentW, h: L.titleH }, S.title, S.titleMin);
      if (lines.length) {
        let pt = S.bodyMax;
        while (pt > S.bodyMin && this.linesHeight(lines, box.w, pt) > box.h) pt -= 1;
        if (this.linesHeight(lines, box.w, pt) > box.h) this.warnings.push(`${seg.title}: body may overflow`);
        this.addText(slide, this.bodyObjects(lines, box.w, pt), box, "points");
      }
      // Presenter view shows the notes of the slide on screen, so every slide of a segment carries the
      // segment's notes, and the answers ride with the slide that asks the questions.
      const asks = lines.some((line) => line.kind === "ask");
      this.notes(slide, [asks && answers.length ? `${labels.answers}:\n${answers.join("\n")}` : null, ...(seg.notes || [])]);
    });
  }

  bodyObjects(lines, width, pt) {
    const { sizes: S, metrics, layout: L } = this.cfg;
    const C = this.C;
    const codePt = this.codeSize(lines, width, pt);
    const gap = Math.round(pt * metrics.paragraphGap);
    const out = [];
    lines.forEach((line, i) => {
      const spaceBefore = i ? gap : undefined;
      if (line.kind === "label") {
        out.push(...this.rtlParagraph(line.text, { fontSize: S.label, bold: true, color: C.accent1, paraSpaceBefore: i ? Math.round(gap + pt * 0.4) : undefined }));
      } else if (line.kind === "cmd") {
        out.push(...this.codeParagraph(line.text, { fontSize: codePt, color: C.text1, commentColor: C.accent1, paraSpaceBefore: spaceBefore }));
      } else {
        const bullet = ["say", "card", "step", "task"].includes(line.kind) ? { indent: L.bulletIndent } : undefined;
        out.push(...this.rtlParagraph(line.text, { fontSize: pt, color: C.text1, bullet, paraSpaceBefore: spaceBefore }));
      }
    });
    return out;
  }

  cheatsheetSlides() {
    const { layout: L, sizes: S, format, labels } = this.cfg;
    const entries = this.lesson.cheatsheet || [];
    if (!entries.length) return;
    const section = fill(format.cheatTitle, this.words());
    const box = { x: L.marginX, y: L.bodyY, w: this.m.contentW, h: L.bodyBottom - L.bodyY };
    const header = [labels.command, labels.meaning];
    const widths = [0.55, 0.45];
    const fitting = this.rowsPerSlide([header, ...entries], box, widths, S.cheatTarget);
    const pages = Math.ceil(entries.length / fitting);
    const perSlide = Math.ceil(entries.length / pages);
    for (let i = 0; i < entries.length; i += perSlide) {
      const slide = this.slide(MASTERS.content, section);
      this.fillTitle(slide, section, { w: this.m.contentW, h: L.titleH }, S.title - 10, S.titleMin);
      this.table(slide, [header, ...entries.slice(i, i + perSlide)], box, { codeColumns: [0], widths });
    }
  }

  // How many body rows fit under the header at a given size.
  rowsPerSlide(rows, box, widths, pt) {
    const header = rows[0];
    let n = rows.length - 1;
    while (n > 1 && this.tableHeight([header, ...rows.slice(1, n + 1)], box.w, widths, pt) > box.h) n -= 1;
    return n;
  }

  tableHeight(rows, width, widths, pt) {
    const { table: T, metrics } = this.cfg;
    return sum(rows.map((row) => Math.max(...row.map((cell, c) => this.m.lines(cell, width * widths[c] - T.cellPadX, pt, false)))
      * (pt * metrics.lineSpacing) / PT_PER_INCH + T.rowPad));
  }

  // A right-to-left table: the first column sits at the right. Code columns read left-to-right.
  table(slide, rows, box, options) {
    const { sizes: S, table: T } = this.cfg;
    const C = this.C;
    let pt = S.tableMax;
    while (pt > S.tableMin && this.tableHeight(rows, box.w, options.widths, pt) > box.h) pt -= 1;
    const tableRows = rows.map((row, r) => row.map((cell, c) => {
      const muted = options.mutedRow && options.mutedRow(row, r);
      const style = { fontSize: pt, bold: r === 0 || undefined, color: muted ? C.accent3 : C.text1 };
      // A code column holds commands; a cell there written only in the right-to-left script is prose.
      const prose = this.bidi.hasRtl(cell) && !this.bidi.hasLtr(cell);
      const text = options.codeColumns.includes(c) && r > 0 && !prose
        ? this.codeParagraph(cell, { ...style, commentColor: C.accent1 })
        : this.rtlParagraph(cell, style);
      delete text[text.length - 1].options.breakLine;
      return { text, options: clean({ fill: r === 0 ? { color: C.background2 } : undefined, valign: "middle", margin: [0.04, T.cellPadX / 2, 0.04, T.cellPadX / 2] }) };
    }).reverse());
    slide.addTable(tableRows, {
      x: box.x, y: box.y, w: box.w, colW: options.widths.map((w) => w * box.w).reverse(), autoPage: false,
      border: { type: "solid", pt: 0.75, color: C.accent4 }, objectName: this.name("table"),
    });
  }

  render() {
    const { theme, meta, format } = this.cfg;
    this.pres.layout = "LAYOUT_16x9";
    this.pres.rtlMode = true;
    this.pres.theme = { headFontFace: theme.headFontFace, bodyFontFace: theme.bodyFontFace };
    this.pres.author = meta.author;
    this.pres.company = meta.company;
    this.pres.title = fill(format.fileTitle, this.words());
    this.defineLayouts();
    const first = this.lesson.parts[0].name;
    this.pres.addSection({ title: first });
    this.titleSlide(first);
    this.lesson.parts.forEach((part, i) => {
      if (i > 0) this.pres.addSection({ title: part.name });
      this.agendaSlide(part);
      part.segments.forEach((seg) => this.segmentSlides(part, seg));
    });
    if ((this.lesson.cheatsheet || []).length) {
      this.pres.addSection({ title: fill(format.cheatTitle, this.words()) });
      this.cheatsheetSlides();
    }
    return this.pres;
  }
}

// ---------------------------------------------------------------- package finishing
// One <a:pPr> per paragraph (pptxgenjs writes one per run; the schema allows one, first).
function singleParagraphProperties(xml) {
  return xml.replace(/<a:p>([\s\S]*?)<\/a:p>/g, (paragraph, inner) => {
    let seen = false;
    const cleaned = inner.replace(/<a:pPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:pPr>)/g, (pPr, offset) => {
      if (!seen && offset === 0) { seen = true; return pPr; }
      return "";
    });
    return `<a:p>${cleaned}</a:p>`;
  });
}

// Speaker notes are Hebrew: their paragraphs read right-to-left.
function rtlNotes(xml) {
  return xml.replace(/<a:p>(?!<a:pPr)/g, "<a:p><a:pPr rtl=\"1\" algn=\"r\"/>");
}

// pptxgenjs writes Office's palette into the theme; scheme colors on the slides resolve through it.
function themeColors(xml, theme) {
  const bad = SCHEME_SLOTS.filter((slot) => !HEX_COLOR.test(String(theme.colors[slot])));
  if (bad.length) throw new Error(`theme colors must be six hex digits: ${bad.join(", ")}`);
  const name = xmlAttribute(theme.name);
  const scheme = `<a:clrScheme name="${name}">`
    + SCHEME_SLOTS.map((slot) => `<a:${slot}><a:srgbClr val="${theme.colors[slot].toUpperCase()}"/></a:${slot}>`).join("")
    + "</a:clrScheme>";
  return xml
    .replace(/<a:clrScheme\b[\s\S]*?<\/a:clrScheme>/, () => scheme)
    .replace(/(<a:(?:theme|fontScheme)\b[^>]*?\bname=")[^"]*"/g, (_, head) => `${head}${name}"`);
}

async function finishPackage(file, theme) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const out = new JSZip();
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    let data = await entry.async("nodebuffer");
    if (name === THEME_PART) {
      let xml = themeColors(data.toString("utf8"), theme)
        .replace(/<a:cs typeface="[^"]*"\/>/g, `<a:cs typeface="${theme.complexScriptFont}"/>`);
      for (const script of theme.complexScripts) {
        xml = xml.replace(new RegExp(`<a:font script="${script}" typeface="[^"]*"/>`, "g"), `<a:font script="${script}" typeface="${theme.complexScriptFont}"/>`);
      }
      data = Buffer.from(xml, "utf8");
    } else if (SLIDE_PARTS.test(name)) {
      data = Buffer.from(singleParagraphProperties(data.toString("utf8")), "utf8");
    } else if (NOTES_PARTS.test(name)) {
      data = Buffer.from(rtlNotes(singleParagraphProperties(data.toString("utf8"))), "utf8");
    }
    out.file(name, data, { createFolders: false });
  }
  fs.writeFileSync(file, await out.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  return Object.keys(out.files).filter((n) => SLIDE_FILES.test(n)).length;
}

// ---------------------------------------------------------------- main
async function main() {
  const cfg = loadConfig(process.argv[2]);
  const pattern = new RegExp(cfg.paths.lessonPattern);
  const lessons = fs.readdirSync(cfg.paths.lessons).filter((f) => pattern.test(f)).sort()
    .map((f) => loadJson(path.join(cfg.paths.lessons, f)));
  const timing = new Timing(cfg);
  const report = lessons.map((lesson) => timing.check(lesson));
  for (const dir of [cfg.paths.outputDir, path.dirname(cfg.paths.report), path.dirname(cfg.paths.manifest)]) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(cfg.paths.report, JSON.stringify(report, null, 2));
  const problems = report.flatMap((r) => r.parts.flatMap((p) => p.problems.map((x) => `${cfg.labels.lesson} ${r.number}: ${x}`)));
  report.forEach((r) => r.parts.forEach((p) => console.log(`${cfg.labels.lesson} ${r.number} ${p.name}: ${p.minutes} min, estimate ${p.estimate}`)));
  if (problems.length) {
    problems.forEach((p) => console.error(`timing: ${p}`));
    if (cfg.estimate.failOnOverrun) process.exit(2);
  }
  const manifest = [];
  for (const lesson of lessons) {
    const deck = new CueDeck(cfg, lesson);
    const pres = deck.render();
    const file = path.join(cfg.paths.outputDir, `${String(lesson.number).padStart(2, "0")}-lesson${lesson.number}.pptx`);
    await pres.writeFile({ fileName: file });
    const slides = await finishPackage(file, cfg.theme);
    manifest.push({ file, title: fill(cfg.format.fileTitle, deck.words()), slides });
    deck.warnings.forEach((w) => console.warn(`warning: ${lesson.number}: ${w}`));
  }
  fs.writeFileSync(cfg.paths.manifest, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest.map((m) => [path.basename(m.file), m.slides])));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.stack || err.message);
    process.exit(1);
  });
}

module.exports = { Bidi, Timing };
