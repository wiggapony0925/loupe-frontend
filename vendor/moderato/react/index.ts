// Subpath shim: lets `import … from "moderato/react"` resolve under Metro
// without package-exports support (legacy directory/index resolution).
// NOT overwritten by `npm run sync:moderato` — only src/ is synced.
export * from "../src/react/index";
