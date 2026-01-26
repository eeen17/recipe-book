import { marked } from "npm:marked";

const md = await Deno.readTextFile("test.md")

await Deno.writeTextFile("test.html", marked.parse(md));


/**
 * Workflow:
 * 
 * 1. Fetch markdown files/directories from recipes repo (but don't save md files? eh it's not super big anyways...)
 * 2. Copy same directory structure, but parsed to html
 * 3. generate table of contents from directories
 */