declare module "turndown-plugin-gfm" {
  import type Turndown from "turndown";
  export function gfm(service: Turndown): void;
  export function tables(service: Turndown): void;
  export function strikethrough(service: Turndown): void;
}

declare module "pdfplumber-wasm/pdfplumber_wasm_bg.js" {
  export const WasmPdf: any;
  export function __wbg_set_wasm(wasm: any): void;
  export const __wbindgen_start: (() => void) | undefined;
  const _default: any;
  export default _default;
}
