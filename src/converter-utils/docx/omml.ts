/**
 * Office Math Markup Language (OMML) to LaTeX converter.
 * Ported from Python markitdown omml.py (adapted from dwml)
 */

import {
  CHARS,
  CHR,
  CHR_BO,
  CHR_DEFAULT,
  POS,
  POS_DEFAULT,
  SUB,
  SUP,
  F,
  F_DEFAULT,
  T,
  FUNC,
  D,
  D_DEFAULT,
  RAD,
  RAD_DEFAULT,
  ARR,
  LIM_FUNC,
  LIM_TO,
  LIM_UPP,
  M,
  BRK,
  BLANK,
  BACKSLASH,
  ALN,
  FUNC_PLACE,
} from "./latex-dict.js";

export const OMML_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math";
const OMML_NS_BRACE = `{${OMML_NS}}`;

/**
 * Python-style template substitution.
 * Templates use Python format syntax: {var} for variables, {{ and }} for literal braces.
 * e.g. "\\frac{{{num}}}{{{den}}}" with {num:"a", den:"b"} → "\\frac{a}{b}"
 */
function tpl(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  // Collapse Python-style escaped braces: {{ → {, }} → }
  result = result.replace(/\{\{/g, "{").replace(/\}\}/g, "}");
  return result;
}

/** Replace {0} placeholder in template, then collapse escaped braces */
function tpl0(template: string, value: string): string {
  let result = template.replace(/\{0\}/g, value);
  result = result.replace(/\{\{/g, "{").replace(/\}\}/g, "}");
  return result;
}

function escapeLatex(strs: string): string {
  let last: string | null = null;
  const newChr: string[] = [];
  strs = strs.replace(/\\\\/g, "\\");
  for (const c of strs) {
    if (CHARS.has(c) && last !== BACKSLASH) {
      newChr.push(BACKSLASH + c);
    } else {
      newChr.push(c);
    }
    last = c;
  }
  return newChr.join(BLANK);
}

function getVal(
  key: string | null | undefined,
  defaultVal?: string,
  store?: Record<string, string>,
): string {
  if (key != null) {
    return !store ? key : (store[key] ?? key);
  }
  return defaultVal ?? "";
}

type Element = {
  tag: string;
  attrib: Record<string, string>;
  text: string | null;
  children: Element[];
};

function parseXml(xmlStr: string): Element {
  // Use fast-xml-parser to parse XML to a tree, then convert to our Element structure
  // For simplicity, we'll use a lightweight DOM approach
  // Since we're in a Node/Bun environment, we can use a simple regex-based approach
  // or we can reuse the DOMParser-like approach

  // Actually, let's parse using the approach that matches ElementTree semantics
  // We need tag names with namespaces, attributes with namespace prefixes, children, text
  throw new Error("Use parseXmlDom instead");
}

/** Parse XML string to Element tree using fast-xml-parser */
function parseXmlToElements(xmlString: string): Element {
  // We need namespace-aware XML parsing that preserves the {ns}tag format
  // Let's use a simple SAX-like approach with regex for this specific XML

  // Instead, let's use the DOMParser from linkedom or just parse manually
  // Since we're already using fast-xml-parser in the project, let's use it

  const { XMLParser } = require("fast-xml-parser");
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    preserveOrder: true,
    // We need to handle namespaces ourselves
  });

  // This is getting complicated. Let's use a different approach.
  // We'll parse the XML directly using a recursive descent parser for OMML.
  throw new Error("Not implemented - use processOmmlElement directly");
}

// Since we need ElementTree-like API but in JS, let's work with the XML as DOM nodes
// We'll use fast-xml-parser in a specific way

interface XmlNode {
  tag: string; // includes namespace brace prefix like {ns}localName
  attrib: Record<string, string>;
  text: string | null;
  children: XmlNode[];
}

/**
 * Parse XML string into XmlNode tree with ElementTree-style {namespace}tag format.
 * This is a minimal parser specifically for OMML math XML.
 */
function parseOmmlXml(xmlStr: string): XmlNode {
  // Collect namespace declarations from root element
  const nsMap: Record<string, string> = {};

  // Match xmlns declarations
  const xmlnsRe = /xmlns(?::(\w+))?="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = xmlnsRe.exec(xmlStr)) !== null) {
    const prefix = m[1] || ""; // default namespace has empty prefix
    nsMap[prefix] = m[2];
  }

  // Now parse using fast-xml-parser with namespace handling
  const { XMLParser } = require("fast-xml-parser");
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    preserveOrder: true,
    processEntities: false,
    trimValues: true,
  });

  const parsed = parser.parse(xmlStr);

  function resolveNs(tagName: string): string {
    const parts = tagName.split(":");
    if (parts.length === 2) {
      const ns = nsMap[parts[0]];
      if (ns) return `{${ns}}${parts[1]}`;
    } else if (nsMap[""]) {
      return `{${nsMap[""]}}${tagName}`;
    }
    return tagName;
  }

  function convertNode(node: any): XmlNode | null {
    // fast-xml-parser with preserveOrder returns array of objects
    // Each object has one key (the tag name) and optional :@attr for attributes
    if (!node || typeof node !== "object") return null;

    const keys = Object.keys(node).filter(k => k !== ":@");
    if (keys.length === 0) return null;

    const tagName = keys[0];
    const resolvedTag = resolveNs(tagName);

    const attrib: Record<string, string> = {};
    if (node[":@"]) {
      for (const [k, v] of Object.entries(node[":@"])) {
        attrib[resolveNs(k)] = String(v);
      }
    }

    let text: string | null = null;
    const children: XmlNode[] = [];

    const content = node[tagName];
    if (Array.isArray(content)) {
      for (const child of content) {
        if (child && typeof child === "object") {
          const childKeys = Object.keys(child).filter(k => k !== ":@");
          if (childKeys.length > 0) {
            if (childKeys[0] === "#text") {
              text = String(child["#text"]);
            } else {
              const childNode = convertNode(child);
              if (childNode) children.push(childNode);
            }
          }
        }
      }
    } else if (typeof content === "string") {
      text = content;
    }

    return { tag: resolvedTag, attrib, text, children };
  }

  // parsed is an array with preserveOrder
  if (Array.isArray(parsed) && parsed.length > 0) {
    const root = convertNode(parsed[0]);
    if (root) return root;
  }

  throw new Error("Failed to parse OMML XML");
}

/** Find child elements matching a tag */
function findAll(node: XmlNode, tag: string): XmlNode[] {
  const results: XmlNode[] = [];
  for (const child of node.children) {
    if (child.tag === tag) results.push(child);
  }
  return results;
}

/** Find first child element matching tag, returns null if not found */
function find(node: XmlNode, tag: string): XmlNode | null {
  for (const child of node.children) {
    if (child.tag === tag) return child;
  }
  return null;
}

/** Find text of first matching descendant (like ElementTree findtext) */
function findtext(node: XmlNode, path: string): string | null {
  // path like "./{ns}t" — find direct child with that tag and return its text
  const tag = path.replace("./", "");
  const child = find(node, tag);
  return child ? (child.text ?? "") : null;
}

function stripNs(tag: string): string {
  return tag.replace(OMML_NS_BRACE, "");
}

// --- Pr class (property elements) ---

const PR_VAL_TAGS = new Set(["chr", "pos", "begChr", "endChr", "type"]);

interface PrResult {
  text: string;
  chr?: string | null;
  pos?: string | null;
  begChr?: string | null;
  endChr?: string | null;
  type?: string | null;
  brk?: string | null;
}

function processPr(elm: XmlNode): PrResult {
  const result: PrResult = { text: "" };
  const parts: string[] = [];

  for (const child of elm.children) {
    if (!child.tag.includes(OMML_NS)) continue;
    const stag = stripNs(child.tag);

    if (stag === "brk") {
      result.brk = BRK;
      parts.push(BRK);
    } else if (PR_VAL_TAGS.has(stag)) {
      const val = child.attrib[`${OMML_NS_BRACE}val`] ?? null;
      (result as any)[stag] = val;
    }
  }

  result.text = parts.join(BLANK);
  return result;
}

// --- oMath2Latex ---

const DIRECT_TAGS = new Set(["box", "sSub", "sSup", "sSubSup", "num", "den", "deg", "e"]);

type ProcessedChild = [string, string, XmlNode];

function* processChildrenList(
  elm: XmlNode,
  include?: Set<string>,
): Generator<ProcessedChild> {
  for (const child of elm.children) {
    if (!child.tag.includes(OMML_NS)) continue;
    const stag = stripNs(child.tag);
    if (include && !include.has(stag)) continue;

    let t = callMethod(child, stag);
    if (t === null) {
      t = processUnknown(child, stag);
      if (t === null) continue;
    }
    yield [stag, t, child];
  }
}

function processChildrenDict(
  elm: XmlNode,
  include?: Set<string>,
): Record<string, any> {
  const dict: Record<string, any> = {};
  for (const [stag, t] of processChildrenList(elm, include)) {
    dict[stag] = t;
  }
  return dict;
}

function processChildren(elm: XmlNode, include?: Set<string>): string {
  const parts: string[] = [];
  for (const [, t] of processChildrenList(elm, include)) {
    if (typeof t === "string") {
      parts.push(t);
    } else if (t && typeof t === "object" && "text" in t) {
      // PrResult — use its text property (matches Python's Pr.__str__)
      parts.push((t as PrResult).text);
    } else {
      parts.push(String(t));
    }
  }
  return parts.join(BLANK);
}

function processUnknown(elm: XmlNode, stag: string): string | null {
  if (DIRECT_TAGS.has(stag)) {
    return processChildren(elm);
  } else if (stag.endsWith("Pr")) {
    // Return the Pr result as a special marker - we'll handle it in processChildrenDict
    return processPr(elm) as any;
  }
  return null;
}

function callMethod(elm: XmlNode, stag?: string): string | null {
  if (!stag) stag = stripNs(elm.tag);
  const method = TAG2METH[stag];
  if (method) return method(elm);
  return null;
}

// --- Tag handler methods ---

function doAcc(elm: XmlNode): string {
  const cDict = processChildrenDict(elm);
  const pr = cDict["accPr"] as PrResult;
  const latexS = getVal(pr.chr, CHR_DEFAULT["ACC_VAL"], CHR);
  return tpl0(latexS, cDict["e"]);
}

function doBar(elm: XmlNode): string {
  const cDict = processChildrenDict(elm);
  const pr = cDict["barPr"] as PrResult;
  const latexS = getVal(pr.pos, POS_DEFAULT["BAR_VAL"], POS);
  return pr.text + tpl0(latexS, cDict["e"]);
}

function doD(elm: XmlNode): string {
  const cDict = processChildrenDict(elm);
  const pr = cDict["dPr"] as PrResult;
  const nullVal = D_DEFAULT["null"];
  const sVal = getVal(pr.begChr, D_DEFAULT["left"], T);
  const eVal = getVal(pr.endChr, D_DEFAULT["right"], T);
  return (
    pr.text +
    tpl(D, {
      left: !sVal ? nullVal : escapeLatex(sVal),
      text: cDict["e"],
      right: !eVal ? nullVal : escapeLatex(eVal),
    })
  );
}

function doSub(elm: XmlNode): string {
  return tpl0(SUB, processChildren(elm));
}

function doSup(elm: XmlNode): string {
  return tpl0(SUP, processChildren(elm));
}

function doF(elm: XmlNode): string {
  const cDict = processChildrenDict(elm);
  const pr = cDict["fPr"] as PrResult;
  const latexS = getVal(pr.type, F_DEFAULT, F);
  return pr.text + tpl(latexS, { num: cDict["num"] ?? "", den: cDict["den"] ?? "" });
}

function doFunc(elm: XmlNode): string {
  const cDict = processChildrenDict(elm);
  const funcName: string = cDict["fName"] ?? "";
  return funcName.replace(FUNC_PLACE, cDict["e"] ?? "");
}

function doFname(elm: XmlNode): string {
  const latexChars: string[] = [];
  for (const [stag, t] of processChildrenList(elm)) {
    if (stag === "r") {
      if (FUNC[t]) {
        latexChars.push(FUNC[t]);
      } else {
        throw new Error(`Not supported func ${t}`);
      }
    } else {
      latexChars.push(t);
    }
  }
  const result = latexChars.join(BLANK);
  return result.includes(FUNC_PLACE) ? result : result + FUNC_PLACE;
}

function doGroupchr(elm: XmlNode): string {
  const cDict = processChildrenDict(elm);
  const pr = cDict["groupChrPr"] as PrResult;
  const latexS = getVal(pr.chr);
  return pr.text + tpl0(latexS, cDict["e"]);
}

function doRad(elm: XmlNode): string {
  const cDict = processChildrenDict(elm);
  const text = cDict["e"] ?? "";
  const degText = cDict["deg"] ?? "";
  if (degText) {
    return tpl(RAD, { deg: degText, text });
  }
  return tpl(RAD_DEFAULT, { text });
}

function doEqarr(elm: XmlNode): string {
  const parts: string[] = [];
  for (const [, t] of processChildrenList(elm, new Set(["e"]))) {
    parts.push(t);
  }
  return tpl(ARR, { text: parts.join(BRK) });
}

function doLimlow(elm: XmlNode): string {
  const tDict = processChildrenDict(elm, new Set(["e", "lim"]));
  const latexS = LIM_FUNC[tDict["e"]];
  if (!latexS) {
    throw new Error(`Not supported lim ${tDict["e"]}`);
  }
  return tpl(latexS, { lim: tDict["lim"] ?? "" });
}

function doLimupp(elm: XmlNode): string {
  const tDict = processChildrenDict(elm, new Set(["e", "lim"]));
  return tpl(LIM_UPP, { lim: tDict["lim"] ?? "", text: tDict["e"] ?? "" });
}

function doLim(elm: XmlNode): string {
  return processChildren(elm).replace(LIM_TO[0], LIM_TO[1]);
}

function doM(elm: XmlNode): string {
  const rows: string[] = [];
  for (const [stag, t] of processChildrenList(elm)) {
    if (stag === "mPr") {
      // skip
    } else if (stag === "mr") {
      rows.push(t);
    }
  }
  return tpl(M, { text: rows.join(BRK) });
}

function doMr(elm: XmlNode): string {
  const parts: string[] = [];
  for (const [, t] of processChildrenList(elm, new Set(["e"]))) {
    parts.push(t);
  }
  return parts.join(ALN);
}

function doNary(elm: XmlNode): string {
  const res: string[] = [];
  let bo = "";
  for (const [stag, t] of processChildrenList(elm)) {
    if (stag === "naryPr") {
      const pr = t as unknown as PrResult;
      bo = getVal(pr.chr, undefined, CHR_BO);
    } else {
      res.push(t);
    }
  }
  return bo + res.join(BLANK);
}

function doR(elm: XmlNode): string {
  const tTag = find(elm, `${OMML_NS_BRACE}t`);
  if (!tTag) return "";
  const text = tTag.text ?? "";
  const chars: string[] = [];
  for (const s of text) {
    chars.push(T[s] ?? s);
  }
  return escapeLatex(chars.join(BLANK));
}

const TAG2METH: Record<string, (elm: XmlNode) => string> = {
  acc: doAcc,
  r: doR,
  bar: doBar,
  sub: doSub,
  sup: doSup,
  f: doF,
  func: doFunc,
  fName: doFname,
  groupChr: doGroupchr,
  d: doD,
  rad: doRad,
  eqArr: doEqarr,
  limLow: doLimlow,
  limUpp: doLimupp,
  lim: doLim,
  m: doM,
  mr: doMr,
  nary: doNary,
};

/** Convert an oMath XmlNode element to LaTeX string */
export function oMathToLatex(element: XmlNode): string {
  return processChildren(element);
}

/** Parse XML string, find all oMath elements, yield LaTeX for each */
export function* loadString(xmlString: string): Generator<string> {
  const root = parseOmmlXml(xmlString);
  const oMathNodes = findAll(root, `${OMML_NS_BRACE}oMath`);
  for (const node of oMathNodes) {
    yield oMathToLatex(node);
  }
}

export { parseOmmlXml, findAll, find, XmlNode };
