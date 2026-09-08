import type PdfParse from 'pdf-parse';

// pdf-parse's package entrypoint (index.js) runs a debug-mode file read when
// `module.parent` is falsy, which happens under Next.js's bundling and crashes
// the route. Requiring the inner lib file directly skips that entrypoint.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse/lib/pdf-parse.js') as typeof PdfParse;

export default pdfParse;
