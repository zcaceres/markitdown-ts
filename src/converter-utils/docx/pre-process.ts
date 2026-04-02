/**
 * DOCX pre-processing: converts OMML math equations to LaTeX before mammoth.
 * Ported from Python markitdown pre_process.py
 */

import JSZip from "jszip";
import { findAll, OMML_NS, oMathToLatex, parseOmmlXml } from "./omml.js";

const OMML_NS_BRACE = `{${OMML_NS}}`;

const MATH_ROOT_TEMPLATE_PARTS = [
  "<w:document ",
  'xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" ',
  'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" ',
  'xmlns:o="urn:schemas-microsoft-com:office:office" ',
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ',
  'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" ',
  'xmlns:v="urn:schemas-microsoft-com:vml" ',
  'xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" ',
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ',
  'xmlns:w10="urn:schemas-microsoft-com:office:word" ',
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ',
  'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" ',
  'xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" ',
  'xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" ',
  'xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" ',
  'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" ',
  'mc:Ignorable="w14 wp14">',
];

function mathRootTemplate(content: string): string {
  return `${MATH_ROOT_TEMPLATE_PARTS.join("") + content}</w:document>`;
}

/**
 * Convert an OMML fragment string to LaTeX.
 */
function convertOmathToLatex(omathXml: string): string {
  const wrappedXml = mathRootTemplate(omathXml);
  const root = parseOmmlXml(wrappedXml);
  const oMathNode = findAll(root, `${OMML_NS_BRACE}oMath`)[0];
  if (!oMathNode) return "";
  return oMathToLatex(oMathNode);
}

/**
 * Pre-process math content in a DOCX XML file.
 * Replaces OMML elements with LaTeX equivalents using regex-based approach.
 */
function preProcessMath(content: string): string {
  // Replace oMathPara (block equations) first, then oMath (inline)
  // We use regex to find the OMML elements and replace them

  // Handle block equations: <m:oMathPara>...</m:oMathPara>
  content = content.replace(/<m:oMathPara\b[^>]*>([\s\S]*?)<\/m:oMathPara>/g, (_match, inner: string) => {
    // Find all <m:oMath>...</m:oMath> inside and convert each as block
    const oMathRegex = /<m:oMath\b[^>]*>[\s\S]*?<\/m:oMath>/g;
    const parts: string[] = [];
    let oMathMatch: RegExpExecArray | null;
    while ((oMathMatch = oMathRegex.exec(inner)) !== null) {
      try {
        const latex = convertOmathToLatex(oMathMatch[0]);
        parts.push(`<w:r><w:t>$$${latex}$$</w:t></w:r>`);
      } catch {
        // On error, keep original
        return _match;
      }
    }
    if (parts.length === 0) return _match;
    return `<w:p>${parts.join("")}</w:p>`;
  });

  // Handle inline equations: <m:oMath>...</m:oMath>
  content = content.replace(/<m:oMath\b[^>]*>([\s\S]*?)<\/m:oMath>/g, (match) => {
    try {
      const latex = convertOmathToLatex(match);
      return `<w:r><w:t>$${latex}$</w:t></w:r>`;
    } catch {
      return match;
    }
  });

  return content;
}

/** Files within DOCX that may contain math to pre-process */
const PRE_PROCESS_FILES = ["word/document.xml", "word/footnotes.xml", "word/endnotes.xml"];

/**
 * Pre-process a DOCX buffer to convert OMML math equations to LaTeX.
 * Returns a new buffer with equations replaced.
 */
export async function preProcessDocx(inputBuffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(inputBuffer);
  const outputZip = new JSZip();

  // Copy all files, pre-processing math in specific XML files
  for (const [path, file] of Object.entries(zip.files)) {
    if (file.dir) {
      outputZip.folder(path);
      continue;
    }

    if (PRE_PROCESS_FILES.includes(path)) {
      try {
        const content = await file.async("string");
        const processed = preProcessMath(content);
        outputZip.file(path, processed);
      } catch {
        // On error, copy original
        const content = await file.async("uint8array");
        outputZip.file(path, content);
      }
    } else {
      const content = await file.async("uint8array");
      outputZip.file(path, content);
    }
  }

  const result = await outputZip.generateAsync({ type: "nodebuffer" });
  return result;
}
