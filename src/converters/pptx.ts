import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";
import { anyOf, byExt, byMime, converter } from "../converter.js";
import { htmlToMarkdown } from "../transforms/html-to-markdown.js";

const ACCEPTED_EXTENSIONS = [".pptx"];
const ACCEPTED_MIME_PREFIXES = ["application/vnd.openxmlformats-officedocument.presentationml"];

const _RELS_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const _A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";

function escapeMarkdown(text: string): string {
  return text
    .replace(/[\r\n[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectText(node: any): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node || typeof node !== "object") return "";

  const results: string[] = [];

  // Check for text in a:t elements (or just #text)
  if (node["#text"] !== undefined) {
    results.push(String(node["#text"]));
  }
  if (node["a:t"] !== undefined) {
    const t = node["a:t"];
    if (typeof t === "string" || typeof t === "number") {
      results.push(String(t));
    } else if (Array.isArray(t)) {
      for (const item of t) {
        results.push(collectText(item));
      }
    } else if (typeof t === "object" && t["#text"] !== undefined) {
      results.push(String(t["#text"]));
    }
  }

  // Recurse into arrays and objects
  for (const [key, val] of Object.entries(node)) {
    if (key === "#text" || key === "a:t") continue;
    if (key.startsWith("@_")) continue;
    if (Array.isArray(val)) {
      for (const item of val) {
        results.push(collectText(item));
      }
    } else if (typeof val === "object" && val !== null) {
      results.push(collectText(val));
    }
  }

  return results.join("");
}

function collectTextNsStripped(node: any): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node || typeof node !== "object") return "";

  const results: string[] = [];
  if (node["#text"] !== undefined) results.push(String(node["#text"]));

  // With removeNSPrefix, "a:t" becomes "t"
  if (node.t !== undefined) {
    const t = node.t;
    if (typeof t === "string" || typeof t === "number") {
      results.push(String(t));
    } else if (Array.isArray(t)) {
      for (const item of t) results.push(collectTextNsStripped(item));
    } else if (typeof t === "object" && t["#text"] !== undefined) {
      results.push(String(t["#text"]));
    }
  }

  for (const [key, val] of Object.entries(node)) {
    if (key === "#text" || key === "t") continue;
    if (key.startsWith("@_")) continue;
    if (Array.isArray(val)) {
      for (const item of val) results.push(collectTextNsStripped(item));
    } else if (typeof val === "object" && val !== null) {
      results.push(collectTextNsStripped(val));
    }
  }

  return results.join("");
}

function extractTextFromShape(sp: any): string {
  const txBody = sp["p:txBody"];
  if (!txBody) return "";

  let paragraphs = txBody["a:p"];
  if (!paragraphs) return "";
  if (!Array.isArray(paragraphs)) paragraphs = [paragraphs];

  const lines: string[] = [];
  for (const p of paragraphs) {
    const text = collectText(p);
    if (text) lines.push(text);
  }
  return lines.join("\n");
}

function isTitle(sp: any): boolean {
  const nvSpPr = sp["p:nvSpPr"];
  if (!nvSpPr) return false;
  const nvPr = nvSpPr["p:nvPr"];
  if (!nvPr) return false;
  const ph = nvPr["p:ph"];
  if (!ph) return false;
  const type = ph["@_type"];
  return type === "title" || type === "ctrTitle";
}

function extractTable(graphicFrame: any): string {
  const graphic = graphicFrame["a:graphic"];
  if (!graphic) return "";
  const graphicData = graphic["a:graphicData"];
  if (!graphicData) return "";
  const tbl = graphicData["a:tbl"];
  if (!tbl) return "";

  let rows = tbl["a:tr"];
  if (!rows) return "";
  if (!Array.isArray(rows)) rows = [rows];

  const htmlRows: string[] = [];
  let isFirst = true;
  for (const row of rows) {
    let cells = row["a:tc"];
    if (!cells) continue;
    if (!Array.isArray(cells)) cells = [cells];

    const tag = isFirst ? "th" : "td";
    const cellsHtml = cells
      .map((cell: any) => {
        const text = collectText(cell);
        const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `<${tag}>${escaped}</${tag}>`;
      })
      .join("");
    htmlRows.push(`<tr>${cellsHtml}</tr>`);
    isFirst = false;
  }

  const html = `<html><body><table>${htmlRows.join("")}</table></body></html>`;
  return `${htmlToMarkdown(html).markdown.trim()}\n`;
}

function extractChartData(chartXml: string): string {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
  });
  const chart = parser.parse(chartXml);

  try {
    const chartSpace = chart.chartSpace || chart["c:chartSpace"];
    if (!chartSpace) return "\n\n[chart]\n\n";

    const chartEl = chartSpace.chart || chartSpace["c:chart"];
    if (!chartEl) return "\n\n[chart]\n\n";

    // Try to get chart title (NS-stripped: "t" instead of "a:t")
    let title = "";
    const titleEl = chartEl.title || chartEl["c:title"];
    if (titleEl) {
      title = collectTextNsStripped(titleEl);
    }

    // Try to get plot area data
    const plotArea = chartEl.plotArea || chartEl["c:plotArea"];
    if (!plotArea) return `\n\n### Chart${title ? `: ${title}` : ""}\n\n[chart data unavailable]\n`;

    // Find the chart type (bar, line, pie, etc.)
    const chartTypes = ["barChart", "lineChart", "pieChart", "areaChart", "scatterChart"];
    let plotData: any = null;
    for (const type of chartTypes) {
      plotData = plotArea[type] || plotArea[`c:${type}`];
      if (plotData) break;
    }
    if (!plotData) return `\n\n### Chart${title ? `: ${title}` : ""}\n\n[unsupported chart]\n`;

    // Extract series
    let seriesList = plotData.ser || plotData["c:ser"];
    if (!seriesList) return `\n\n### Chart${title ? `: ${title}` : ""}\n\n`;
    if (!Array.isArray(seriesList)) seriesList = [seriesList];

    // Extract category labels from the first series
    const categories: string[] = [];
    const firstSer = seriesList[0];
    const cat = firstSer.cat || firstSer["c:cat"];
    if (cat) {
      const strRef = cat.strRef || cat["c:strRef"];
      const numRef = cat.numRef || cat["c:numRef"];
      const ref = strRef || numRef;
      if (ref) {
        const cache = ref.strCache || ref["c:strCache"] || ref.numCache || ref["c:numCache"];
        if (cache) {
          let pts = cache.pt || cache["c:pt"];
          if (pts) {
            if (!Array.isArray(pts)) pts = [pts];
            for (const pt of pts) {
              categories.push(String(pt.v || pt["c:v"] || ""));
            }
          }
        }
      }
    }

    // Extract series names and values
    const seriesNames: string[] = [];
    const seriesValues: number[][] = [];
    for (const ser of seriesList) {
      // Series name
      const tx = ser.tx || ser["c:tx"];
      let name = "";
      if (tx) {
        const sr = tx.strRef || tx["c:strRef"];
        if (sr) {
          const sc = sr.strCache || sr["c:strCache"];
          if (sc) {
            let pts = sc.pt || sc["c:pt"];
            if (pts) {
              if (!Array.isArray(pts)) pts = [pts];
              name = String(pts[0]?.v || pts[0]?.["c:v"] || "");
            }
          }
        }
        if (!name) {
          name = collectTextNsStripped(tx);
        }
      }
      seriesNames.push(name);

      // Series values
      const val = ser.val || ser["c:val"];
      const values: number[] = [];
      if (val) {
        const nr = val.numRef || val["c:numRef"];
        if (nr) {
          const nc = nr.numCache || nr["c:numCache"];
          if (nc) {
            let pts = nc.pt || nc["c:pt"];
            if (pts) {
              if (!Array.isArray(pts)) pts = [pts];
              for (const pt of pts) {
                values.push(Number(pt.v || pt["c:v"] || 0));
              }
            }
          }
        }
      }
      seriesValues.push(values);
    }

    // Build markdown table
    let md = `\n\n### Chart${title ? `: ${title}` : ""}\n\n`;
    const header = ["Category", ...seriesNames];
    md += `| ${header.join(" | ")} |\n`;
    md += `|${header.map(() => "---").join("|")}|\n`;

    for (let i = 0; i < categories.length; i++) {
      const row = [categories[i], ...seriesValues.map((v) => String(v[i] ?? ""))];
      md += `| ${row.join(" | ")} |\n`;
    }

    return md;
  } catch {
    return "\n\n[unsupported chart]\n\n";
  }
}

export const pptxConverter = converter(
  "PPTX",
  anyOf(byExt(...ACCEPTED_EXTENSIONS), byMime(...ACCEPTED_MIME_PREFIXES)),
  async (ctx) => {
    const zip = await JSZip.loadAsync(ctx.buffer);
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      preserveOrder: false,
      trimValues: false,
    });

    // Read relationships to find slide order
    const contentTypesXml = await zip.file("[Content_Types].xml")?.async("string");
    if (!contentTypesXml) throw new Error("Invalid PPTX: missing [Content_Types].xml");

    // Find all slides
    const slideFiles: string[] = [];
    for (const [filename] of Object.entries(zip.files)) {
      if (/^ppt\/slides\/slide\d+\.xml$/.test(filename)) {
        slideFiles.push(filename);
      }
    }
    // Sort slides by number
    slideFiles.sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] ?? "0", 10);
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] ?? "0", 10);
      return numA - numB;
    });

    let mdContent = "";
    let slideNum = 0;

    for (const slideFile of slideFiles) {
      slideNum++;
      mdContent += `\n\n<!-- Slide number: ${slideNum} -->\n`;

      const slideXml = await zip.file(slideFile)?.async("string");
      if (!slideXml) continue;

      const slideDoc = parser.parse(slideXml);
      const sld = slideDoc["p:sld"];
      if (!sld) continue;

      const cSld = sld["p:cSld"];
      if (!cSld) continue;

      const spTree = cSld["p:spTree"];
      if (!spTree) continue;

      // Process shapes
      const shapes: any[] = [];

      // Regular shapes (sp)
      if (spTree["p:sp"]) {
        const sps = Array.isArray(spTree["p:sp"]) ? spTree["p:sp"] : [spTree["p:sp"]];
        shapes.push(...sps);
      }

      // Graphic frames (tables, charts)
      if (spTree["p:graphicFrame"]) {
        const gfs = Array.isArray(spTree["p:graphicFrame"]) ? spTree["p:graphicFrame"] : [spTree["p:graphicFrame"]];
        shapes.push(...gfs);
      }

      // Pictures
      if (spTree["p:pic"]) {
        const pics = Array.isArray(spTree["p:pic"]) ? spTree["p:pic"] : [spTree["p:pic"]];
        shapes.push(...pics);
      }

      // Group shapes
      if (spTree["p:grpSp"]) {
        const grps = Array.isArray(spTree["p:grpSp"]) ? spTree["p:grpSp"] : [spTree["p:grpSp"]];
        shapes.push(...grps);
      }

      for (const shape of shapes) {
        // Text shapes (p:sp)
        if (shape["p:txBody"]) {
          const text = extractTextFromShape(shape);
          if (text.trim()) {
            if (isTitle(shape)) {
              mdContent += `# ${text.trim()}\n`;
            } else {
              mdContent += `${text}\n`;
            }
          }
        }

        // Tables (p:graphicFrame with a:tbl)
        const graphic = shape["a:graphic"];
        if (graphic) {
          const graphicData = graphic["a:graphicData"];
          if (graphicData) {
            // Table
            if (graphicData["a:tbl"]) {
              mdContent += extractTable(shape);
            }
            // Chart reference
            const chartRef = graphicData["@_uri"] === "http://schemas.openxmlformats.org/drawingml/2006/chart";
            if (chartRef || graphicData["c:chart"]) {
              // Read chart relationship
              const slideRelsFile = `${slideFile.replace("slides/", "slides/_rels/")}.rels`;
              const relsXml = await zip.file(slideRelsFile)?.async("string");
              if (relsXml) {
                const relsParsed = parser.parse(relsXml);
                const rels = relsParsed.Relationships;
                if (rels) {
                  let relList = rels.Relationship;
                  if (relList && !Array.isArray(relList)) relList = [relList];
                  if (relList) {
                    for (const rel of relList) {
                      if (rel["@_Type"]?.includes("/chart") && rel["@_Target"]) {
                        const chartPath = `ppt/${rel["@_Target"].replace("../", "")}`;
                        const chartXml = await zip.file(chartPath)?.async("string");
                        if (chartXml) {
                          mdContent += extractChartData(chartXml);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // Pictures (p:pic)
        if (shape["p:blipFill"]) {
          const blipFill = shape["p:blipFill"];
          const blip = blipFill["a:blip"];
          if (blip) {
            // Get alt text
            let altText = "";
            const nvPicPr = shape["p:nvPicPr"];
            if (nvPicPr) {
              const cNvPr = nvPicPr["p:cNvPr"];
              if (cNvPr) {
                altText = cNvPr["@_descr"] || cNvPr["@_name"] || "";
              }
            }
            altText = escapeMarkdown(altText || "image");

            if (ctx.opts.keepDataUris) {
              // Read the image and embed as data URI
              const rId = blip["@_r:embed"];
              if (rId) {
                const slideRelsFile = `${slideFile.replace("slides/", "slides/_rels/")}.rels`;
                const relsXml = await zip.file(slideRelsFile)?.async("string");
                if (relsXml) {
                  const relsParsed = parser.parse(relsXml);
                  const rels = relsParsed.Relationships;
                  if (rels) {
                    let relList = rels.Relationship;
                    if (relList && !Array.isArray(relList)) relList = [relList];
                    if (relList) {
                      for (const rel of relList) {
                        if (rel["@_Id"] === rId && rel["@_Target"]) {
                          const imgPath = `ppt/${rel["@_Target"].replace("../", "")}`;
                          const imgData = await zip.file(imgPath)?.async("base64");
                          if (imgData) {
                            const ext = imgPath.split(".").pop()?.toLowerCase();
                            const contentType =
                              ext === "png"
                                ? "image/png"
                                : ext === "gif"
                                  ? "image/gif"
                                  : ext === "svg"
                                    ? "image/svg+xml"
                                    : "image/jpeg";
                            mdContent += `\n![${altText}](data:${contentType};base64,${imgData})\n`;
                          }
                        }
                      }
                    }
                  }
                }
              }
            } else {
              // Use shape name as placeholder filename (matches Python markitdown behavior)
              const nvPicPr = shape["p:nvPicPr"];
              let filename = "image.jpg";
              if (nvPicPr?.["p:cNvPr"]?.["@_name"]) {
                filename = `${nvPicPr["p:cNvPr"]["@_name"].replace(/\W/g, "")}.jpg`;
              }
              mdContent += `\n![${altText}](${filename})\n`;
            }
          }
        }
      }

      // Notes
      const notesFile = slideFile.replace("slides/slide", "notesSlides/notesSlide");
      const notesXml = await zip.file(notesFile)?.async("string");
      if (notesXml) {
        const notesDoc = parser.parse(notesXml);
        const notes = notesDoc["p:notes"];
        if (notes) {
          const cSld = notes["p:cSld"];
          if (cSld) {
            const spTree = cSld["p:spTree"];
            if (spTree) {
              let sps = spTree["p:sp"];
              if (sps && !Array.isArray(sps)) sps = [sps];
              if (sps) {
                for (const sp of sps) {
                  // Find the notes text body (type "body")
                  const nvSpPr = sp["p:nvSpPr"];
                  if (nvSpPr?.["p:nvPr"]?.["p:ph"]?.["@_type"] === "body") {
                    const text = extractTextFromShape(sp);
                    if (text.trim()) {
                      mdContent += `\n\n### Notes:\n${text.trim()}`;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return { markdown: mdContent.trim() };
  },
);
