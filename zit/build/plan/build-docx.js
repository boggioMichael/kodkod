#!/usr/bin/env node
// Convert an ordered folder of Markdown files into one right-to-left aware .docx.
// Every path, font, size, color and glyph comes from the JSON config passed as argv[2].
"use strict";

const fs = require("fs");
const path = require("path");
const { marked } = require("marked");
const {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, HeadingLevel, ImageRun,
  LevelFormat, LineRuleType, Packer, Paragraph, ShadingType, Table, TableCell, TableLayoutType,
  TableRow, TextRun, UnderlineType, WidthType,
} = require("docx");

const HALF_POINTS_PER_POINT = 2;   // docx font sizes are in half-points
const POINTS_PER_INCH = 72;
const PNG_WIDTH_OFFSET = 16;   // IHDR width, big-endian uint32
const PNG_HEIGHT_OFFSET = 20;  // IHDR height, big-endian uint32
const DXA_PER_INCH = 1440;
const TWIPS_PER_HALF_POINT = 10;
const SINGLE_LINE = 240;       // "auto" line rule: 240 = single spacing
const HEADING_LEVELS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4];
const HEADING_STYLE_KEYS = ["heading1", "heading2", "heading3", "heading4"];
const KEEP_WITH_NEXT_BLOCKS = ["list", "code", "table"];
const BULLET_REFERENCE = "bullet-list";
const ORDERED_REFERENCE = "ordered-list";

// Reads the config, and resolves its paths against the config file's own folder.
function loadConfig(file) {
  if (!file) throw new Error("usage: build-docx.js <config.json>");
  const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
  const base = path.dirname(path.resolve(file));
  cfg.sources.dir = path.resolve(base, cfg.sources.dir);
  cfg.output = path.resolve(base, cfg.output);
  return cfg;
}

function listSources(cfg) {
  const pattern = new RegExp(cfg.sources.pattern);
  return fs.readdirSync(cfg.sources.dir)
    .filter((name) => pattern.test(name))
    .sort()
    .map((name) => path.join(cfg.sources.dir, name));
}

function pngSize(buffer) {
  return { width: buffer.readUInt32BE(PNG_WIDTH_OFFSET), height: buffer.readUInt32BE(PNG_HEIGHT_OFFSET) };
}

// Split text into runs of one strong direction; neutral characters join the run before them.
function makeDirectionSplitter(cfg) {
  const rtl = new RegExp(`[${cfg.scripts.rtlCharClass}]`);
  const ltr = new RegExp(`[${cfg.scripts.ltrCharClass}]`);
  const splitter = (text, defaultRtl) => {
    const chunks = [];
    let current = null;
    let leading = "";
    for (const ch of text) {
      const dir = rtl.test(ch) ? true : ltr.test(ch) ? false : null;
      if (dir === null) {
        if (current) current.text += ch; else leading += ch;
      } else if (!current) {
        current = { text: leading + ch, rtl: dir };
        leading = "";
      } else if (current.rtl === dir) {
        current.text += ch;
      } else {
        chunks.push(current);
        current = { text: ch, rtl: dir };
      }
    }
    if (current) chunks.push(current);
    else if (leading) chunks.push({ text: leading, rtl: defaultRtl });
    return chunks;
  };
  splitter.hasLtr = (text) => ltr.test(text);
  return splitter;
}

function plainText(tokens) {
  return (tokens || []).map((t) => (t.tokens ? plainText(t.tokens) : t.text || "")).join("");
}

class DocxBuilder {
  constructor(cfg) {
    this.cfg = cfg;
    this.split = makeDirectionSplitter(cfg);
    this.contentWidth = cfg.page.widthDxa - 2 * cfg.page.marginDxa;
    this.orderedInstance = 0;
    this.titleUsed = false;
    this.stats = { headings: 0, paragraphs: 0, tables: 0, codeBlocks: 0, images: 0, links: 0, listItems: 0 };
    this.warnings = [];
  }

  warn(message) {
    this.warnings.push(message);
  }

  // ---- inline content -------------------------------------------------
  // Inline code inside right-to-left text is fenced with LTR marks, so punctuation at its edges
  // (the parentheses of "sub()", the dot of ".env") stays attached to the code.
  fenceInlineCode(text, style, ctx) {
    const isolate = style.code && !ctx.code && ctx.rtl && this.split.hasLtr(text);
    const mark = this.cfg.scripts.ltrMark;
    return isolate ? `${mark}${text}${mark}` : text;
  }

  textRuns(text, style, ctx) {
    const { fonts, sizes, colors } = this.cfg;
    return this.split(this.fenceInlineCode(text, style, ctx), ctx.rtl).map((chunk) => new TextRun({
      text: chunk.text,
      bold: style.bold || undefined,
      italics: style.italics || undefined,
      strike: style.strike || undefined,
      rightToLeft: chunk.rtl || undefined,
      font: style.code || ctx.code ? fonts.code : undefined,
      size: style.code && !ctx.code ? ctx.size - sizes.inlineCodeDelta : ctx.size,
      color: style.color,
      style: style.link ? "Hyperlink" : undefined,
      shading: style.code && !ctx.code
        ? { type: ShadingType.CLEAR, fill: colors.inlineCodeFill, color: "auto" }
        : undefined,
    }));
  }

  inline(tokens, ctx, style = {}) {
    const out = [];
    for (const token of tokens || []) {
      switch (token.type) {
        case "text":
        case "escape":
          if (token.tokens) out.push(...this.inline(token.tokens, ctx, style));
          else out.push(...this.textRuns(token.text, style, ctx));
          break;
        case "strong":
          out.push(...this.inline(token.tokens, ctx, { ...style, bold: true }));
          break;
        case "em":
          out.push(...this.inline(token.tokens, ctx, { ...style, italics: true }));
          break;
        case "del":
          out.push(...this.inline(token.tokens, ctx, { ...style, strike: true }));
          break;
        case "codespan":
          out.push(...this.textRuns(token.text, { ...style, code: true }, ctx));
          break;
        case "link":
          this.stats.links += 1;
          out.push(new ExternalHyperlink({
            link: token.href,
            children: this.inline(token.tokens, ctx, { ...style, link: true }),
          }));
          break;
        case "br":
          out.push(new TextRun({ break: 1 }));
          break;
        case "image":
          out.push(...this.imageRun(token));
          break;
        default:
          this.warn(`inline token '${token.type}' rendered as text`);
          out.push(...this.textRuns(token.text || token.raw || "", style, ctx));
      }
    }
    return out;
  }

  // ---- blocks -----------------------------------------------------------
  bodyContext() {
    return { rtl: true, size: this.cfg.sizes.body };
  }

  spacer() {
    return new Paragraph({
      bidirectional: true,
      spacing: { before: 0, after: this.cfg.spacing.blockGapAfter, line: this.cfg.sizes.spacer * TWIPS_PER_HALF_POINT, lineRule: LineRuleType.EXACT },
      children: [new TextRun({ text: "", size: this.cfg.sizes.spacer })],
    });
  }

  heading(token) {
    const { headings } = this.cfg;
    this.stats.headings += 1;
    const asTitle = token.depth === 1 && headings.firstLevelOneAsTitle && !this.titleUsed;
    if (asTitle) this.titleUsed = true;
    const level = asTitle ? HeadingLevel.TITLE : HEADING_LEVELS[Math.min(token.depth, HEADING_LEVELS.length) - 1];
    const sizeKey = asTitle ? "title" : HEADING_STYLE_KEYS[Math.min(token.depth, HEADING_STYLE_KEYS.length) - 1];
    return new Paragraph({
      heading: level,
      bidirectional: true,
      pageBreakBefore: !asTitle && token.depth === 1 && headings.pageBreakBeforeLevelOne,
      children: this.inline(token.tokens, { rtl: true, size: this.cfg.sizes[sizeKey] }),
    });
  }

  paragraph(tokens, extra = {}) {
    const images = tokens.filter((t) => t.type === "image");
    const rest = tokens.filter((t) => t.type !== "image" && plainText([t]).trim() !== "");
    if (images.length && !rest.length) return images.flatMap((img) => this.imageBlock(img));
    this.stats.paragraphs += 1;
    return [new Paragraph({
      bidirectional: true,
      spacing: { after: this.cfg.spacing.paragraphAfter },
      children: this.inline(tokens, this.bodyContext()),
      ...extra,
    })];
  }

  // Images are linked the way GitHub shows them: a path relative to the markdown file.
  resolveImage(href) {
    const file = path.resolve(this.sourceDir, decodeURI(href));
    if (!fs.existsSync(file)) throw new Error(`image not found for '${href}'`);
    return file;
  }

  imageRun(token) {
    const { pixelsPerInch, maxWidthFraction } = this.cfg.images;
    const data = fs.readFileSync(this.resolveImage(token.href));
    const size = pngSize(data);
    const maxWidth = (this.contentWidth / DXA_PER_INCH) * pixelsPerInch * maxWidthFraction;
    const width = Math.min(size.width, maxWidth);
    const height = Math.round((width * size.height) / size.width);
    this.stats.images += 1;
    return [new ImageRun({
      type: "png",
      data,
      transformation: { width: Math.round(width), height },
      altText: { title: token.text, description: token.text, name: token.text },
    })];
  }

  imageBlock(token) {
    const { sizes, colors, spacing } = this.cfg;
    const blocks = [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: spacing.paragraphAfter, after: 0, line: SINGLE_LINE, lineRule: LineRuleType.AUTO },
      children: this.imageRun(token),
    })];
    if (token.text) {
      blocks.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        bidirectional: true,
        spacing: { after: spacing.blockGapAfter },
        children: this.textRuns(token.text, { italics: true, color: colors.caption }, { rtl: true, size: sizes.caption }),
      }));
    }
    return blocks;
  }

  codeBlock(token) {
    const { colors, spacing, sizes } = this.cfg;
    this.stats.codeBlocks += 1;
    const side = { style: BorderStyle.SINGLE, size: spacing.borderSize, color: colors.codeBorder, space: spacing.codeBorderSpace };
    const ctx = { rtl: false, code: true, size: sizes.code };
    const rows = token.text.split("\n");
    const lines = rows.map((line, i) => new Paragraph({
      bidirectional: false,
      alignment: AlignmentType.LEFT,
      shading: { type: ShadingType.CLEAR, fill: colors.codeFill, color: "auto" },
      border: { top: side, bottom: side, left: side, right: side },
      spacing: { before: 0, after: 0, line: spacing.codeLine, lineRule: LineRuleType.AUTO },
      keepLines: true,
      keepNext: i < rows.length - 1,
      children: line ? this.textRuns(line, {}, ctx) : [],
    }));
    return [...lines, this.spacer()];
  }

  columnWidths(rows) {
    const { minColumnChars, maxColumnChars, minColumnDxa, charEm } = this.cfg.tables;
    const { sizes, spacing } = this.cfg;
    const count = rows[0].length;
    const clamp = (n) => Math.max(minColumnChars, Math.min(maxColumnChars, n));
    const charDxa = (sizes.table / HALF_POINTS_PER_POINT) * (DXA_PER_INCH / POINTS_PER_INCH) * charEm;
    const weights = [];
    const floors = [];
    for (let c = 0; c < count; c += 1) {
      const texts = rows.map((row) => plainText(row[c].tokens));
      const lengths = texts.map((text) => text.length);
      const max = clamp(Math.max(...lengths));
      const avg = clamp(lengths.reduce((a, b) => a + b, 0) / lengths.length);
      weights.push((max + avg) / 2);
      // A column is never narrower than its longest unbreakable word, so a range like 102-128 stays on one line.
      const longestWord = Math.max(...texts.flatMap((text) => text.split(/\s+/).map((word) => word.length)));
      floors.push(Math.max(minColumnDxa, Math.ceil(longestWord * charDxa + 2 * spacing.cellMargin)));
    }
    const total = weights.reduce((a, b) => a + b, 0);
    let widths = weights.map((w, c) => Math.max(floors[c], Math.round((this.contentWidth * w) / total)));
    const excess = widths.reduce((a, b) => a + b, 0) - this.contentWidth;
    const room = widths.reduce((sum, w, c) => sum + (w - floors[c]), 0);
    if (excess > 0 && room > 0) {
      widths = widths.map((w, c) => Math.floor(w - (excess * (w - floors[c])) / room));
    } else if (excess < 0) {
      widths = widths.map((w) => Math.floor((w * this.contentWidth) / (this.contentWidth + excess)));
    }
    widths[widths.length - 1] += this.contentWidth - widths.reduce((a, b) => a + b, 0);
    return widths;
  }

  table(token) {
    const { colors, spacing, sizes } = this.cfg;
    this.stats.tables += 1;
    const rows = [token.header, ...token.rows];
    const widths = this.columnWidths(rows);
    const line = { style: BorderStyle.SINGLE, size: spacing.borderSize, color: colors.tableBorder };
    const margin = spacing.cellMargin;
    const ctx = { rtl: true, size: sizes.table };
    const tableRows = rows.map((row, r) => new TableRow({
      tableHeader: r === 0,
      cantSplit: true,
      children: row.map((cell, c) => new TableCell({
        width: { size: widths[c], type: WidthType.DXA },
        margins: { top: margin, bottom: margin, left: margin, right: margin },
        shading: r === 0 ? { type: ShadingType.CLEAR, fill: colors.tableHeaderFill, color: "auto" } : undefined,
        children: [new Paragraph({
          bidirectional: true,
          alignment: token.align[c] === "center" ? AlignmentType.CENTER : undefined,
          spacing: { before: 0, after: 0 },
          children: this.inline(cell.tokens, ctx, r === 0 ? { bold: true } : {}),
        })],
      })),
    }));
    return [new Table({
      rows: tableRows,
      width: { size: this.contentWidth, type: WidthType.DXA },
      columnWidths: widths,
      layout: TableLayoutType.FIXED,
      visuallyRightToLeft: true,
      borders: { top: line, bottom: line, left: line, right: line, insideHorizontal: line, insideVertical: line },
    }), this.spacer()];
  }

  list(token, depth = 0) {
    const { lists, spacing } = this.cfg;
    const blocks = [];
    const instance = token.ordered ? (this.orderedInstance += 1) : 0;
    if (token.ordered && token.start !== "" && Number(token.start) !== 1) {
      this.warn(`ordered list starting at ${token.start} restarts at 1`);
    }
    for (const item of token.items) {
      this.stats.listItems += 1;
      const lead = [];
      if (item.task) {
        const glyph = item.checked ? lists.taskGlyphs.checked : lists.taskGlyphs.unchecked;
        lead.push(new TextRun({ text: `${glyph} ` }));
      }
      const inlineTokens = item.tokens.filter((t) => t.type === "text" || t.type === "paragraph");
      const nested = item.tokens.filter((t) => !["text", "paragraph", "checkbox", "space"].includes(t.type));
      const indent = lists.indentStep * (depth + 1);
      const numbering = item.task ? undefined : {
        reference: token.ordered ? ORDERED_REFERENCE : BULLET_REFERENCE,
        level: Math.min(depth, lists.bulletGlyphs.length - 1),
        ...(token.ordered ? { instance } : {}),
      };
      inlineTokens.forEach((t, i) => {
        blocks.push(new Paragraph({
          bidirectional: true,
          numbering: i === 0 ? numbering : undefined,
          indent: i === 0 && numbering ? undefined : { left: indent },
          spacing: { after: spacing.listItemAfter },
          children: [...(i === 0 ? lead : []), ...this.inline(t.tokens || [t], this.bodyContext())],
        }));
      });
      if (nested.length) blocks.push(...this.blocks(nested, depth + 1));
    }
    blocks.push(this.spacer());
    return blocks;
  }

  // A paragraph that introduces a list, code block or table stays on the same page as it.
  introducesBlock(tokens, index) {
    const next = tokens.slice(index + 1).find((t) => t.type !== "space");
    return Boolean(next) && KEEP_WITH_NEXT_BLOCKS.includes(next.type);
  }

  blocks(tokens, depth = 0) {
    const out = [];
    for (const [index, token] of tokens.entries()) {
      switch (token.type) {
        case "heading": out.push(this.heading(token)); break;
        case "paragraph":
          out.push(...this.paragraph(token.tokens, { keepNext: this.introducesBlock(tokens, index) }));
          break;
        case "text": out.push(...this.paragraph(token.tokens || [token])); break;
        case "code": out.push(...this.codeBlock(token)); break;
        case "table": out.push(...this.table(token)); break;
        case "list": out.push(...this.list(token, depth)); break;
        case "blockquote": out.push(...this.blocks(token.tokens, depth)); break;
        case "hr":
          out.push(new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: this.cfg.spacing.borderSize, color: this.cfg.colors.rule, space: 1 } },
            children: [],
          }));
          break;
        case "space": break;
        default:
          this.warn(`block token '${token.type}' skipped`);
      }
    }
    return out;
  }

  // ---- document ---------------------------------------------------------
  numberingConfig() {
    const { lists, fonts } = this.cfg;
    const levelIndent = (level) => ({ indent: { left: lists.indentStep * (level + 1), hanging: lists.hanging } });
    return [
      {
        reference: BULLET_REFERENCE,
        levels: lists.bulletGlyphs.map((glyph, level) => ({
          level,
          format: LevelFormat.BULLET,
          text: glyph,
          alignment: AlignmentType.LEFT,
          style: { paragraph: levelIndent(level), run: { font: fonts.body } },
        })),
      },
      {
        reference: ORDERED_REFERENCE,
        levels: lists.bulletGlyphs.map((_, level) => ({
          level,
          format: LevelFormat.DECIMAL,
          text: lists.orderedText.split(lists.levelToken).join(`%${level + 1}`),
          alignment: AlignmentType.LEFT,
          style: { paragraph: levelIndent(level), run: { font: fonts.body } },
        })),
      },
    ];
  }

  styles() {
    const { fonts, sizes, colors, spacing, metadata } = this.cfg;
    const headingStyle = (key, color) => ({
      run: { font: fonts.body, size: sizes[key], bold: true, color },
      paragraph: { spacing: { before: spacing.headings[key].before, after: spacing.headings[key].after }, keepNext: true, keepLines: true },
    });
    return {
      default: {
        document: {
          run: { font: fonts.body, size: sizes.body, color: colors.text, language: { value: metadata.language, bidirectional: metadata.language } },
          paragraph: { spacing: { line: spacing.line, lineRule: LineRuleType.AUTO, after: spacing.paragraphAfter } },
        },
        title: headingStyle("title", colors.title),
        heading1: headingStyle("heading1", colors.heading),
        heading2: headingStyle("heading2", colors.heading),
        heading3: headingStyle("heading3", colors.subheading),
        heading4: headingStyle("heading4", colors.subheading),
        hyperlink: { run: { color: colors.link, underline: { type: UnderlineType.SINGLE, color: colors.link } } },
      },
    };
  }

  build(files) {
    const children = files.flatMap((file) => {
      this.sourceDir = path.dirname(file);
      return this.blocks(marked.lexer(fs.readFileSync(file, "utf8")));
    });
    const { page, metadata } = this.cfg;
    return new Document({
      creator: metadata.creator,
      title: metadata.title,
      description: metadata.description,
      styles: this.styles(),
      numbering: { config: this.numberingConfig() },
      sections: [{
        properties: {
          page: {
            size: { width: page.widthDxa, height: page.heightDxa },
            margin: { top: page.marginDxa, bottom: page.marginDxa, left: page.marginDxa, right: page.marginDxa },
          },
        },
        children,
      }],
    });
  }
}

async function main() {
  const cfg = loadConfig(process.argv[2]);
  const files = listSources(cfg);
  if (!files.length) throw new Error(`no sources matching ${cfg.sources.pattern} in ${cfg.sources.dir}`);
  const builder = new DocxBuilder(cfg);
  const doc = builder.build(files);
  fs.mkdirSync(path.dirname(cfg.output), { recursive: true });
  fs.writeFileSync(cfg.output, await Packer.toBuffer(doc));
  console.log(JSON.stringify({ output: cfg.output, sources: files.length, ...builder.stats }, null, 1));
  builder.warnings.forEach((w) => console.warn(`warning: ${w}`));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
