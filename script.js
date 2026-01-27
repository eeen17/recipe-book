import { ensureFile, walk } from "jsr:@std/fs";
import { marked } from "npm:marked";
import * as path from "jsr:@std/path";

const HTML_DIR = "content/pages";
const MD_DIR = "content/recipe-content";

async function createHTMLFile(mdFile) {
    const htmlFile = path.join(
        HTML_DIR,
        path.relative(MD_DIR, mdFile),
    );
    await ensureFile(htmlFile);
    return htmlFile;
}

async function processMDFile(mdFile) {
    // console.log(mdFile);
    console.log(mdFile);
    const htmlFile = await createHTMLFile(mdFile);
    const md = await Deno.readTextFile(mdFile);
    await Deno.writeTextFile(htmlFile, marked.parse(md));
}

// Ensure the script has permission to read the directory (deno run --allow-read)

for await (const dirEntry of walk(MD_DIR)) {
    if (dirEntry.isFile) processMDFile(dirEntry.path);
}

/**
 * Workflow:
 *
 * 1. Fetch markdown files/directories from recipes repo (but don't save md files? eh it's not super big anyways...)
 * 2. Copy same directory structure, but parsed to html
 * 3. generate table of contents from directories
 */
