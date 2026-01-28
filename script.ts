import { ensureFile, walk } from "jsr:@std/fs";
import { marked } from "npm:marked";
import * as path from "jsr:@std/path";
import { type ParsedPath } from "jsr:@std/path/parse";
import { type WalkEntry } from "jsr:@std/fs";
import { toKebabCase } from "jsr:@std/text/to-kebab-case";

const HTML_DIR = "content/pages";
const MD_DIR = "content/recipe-content";

path.parse
type FileEntry = {
    relativeParsePath: ParsedPath
} & WalkEntry

type FileTree = {
    [name: string]: FileTree | string;
}
const tocTree: FileTree = {};

async function createHTMLFile(fileEntry: FileEntry) {
    const dirsTo = fileEntry.relativeParsePath.dir;
    const fileName = `${toKebabCase(fileEntry.relativeParsePath.name)}.html`;

    const htmlFilePath = path.join(
        HTML_DIR,
        dirsTo,
        fileName,
    );
    await ensureFile(htmlFilePath);
    return htmlFilePath;
}

async function processMDFile(fileEntry: FileEntry) {
    const htmlFilePath = await createHTMLFile(fileEntry);
    const md = await Deno.readTextFile(fileEntry.path);
    await Deno.writeTextFile(htmlFilePath, await marked.parse(md));
    return htmlFilePath;
}

function getTOCObjectFromPath(filePath: string) {
    let curObj = tocTree;
    const dirList = path.normalize(filePath).split(path.SEPARATOR).slice(0, -1)
    for (const d of dirList) {
        if (typeof (curObj[d]) === "string") break;
        curObj = curObj[d]
    }
    return curObj;
}

async function handleEntry(dirEntry: WalkEntry) {
    if (dirEntry.path == MD_DIR) return;
    const relativePath = path.relative(MD_DIR, dirEntry.path)

    const fileEntry: FileEntry = {
        relativeParsePath: path.parse(relativePath),
        ...dirEntry
    };

    const tocLevel = getTOCObjectFromPath(relativePath);  // only directories to entry

    if (dirEntry.isFile) {
        const htmlFilePath = await processMDFile(fileEntry);
        tocLevel[fileEntry.relativeParsePath.name] = htmlFilePath;

    } else if (fileEntry.isDirectory)
        tocLevel[fileEntry.name] = {}
}

for await (const dirEntry of walk(MD_DIR)) handleEntry(dirEntry);

console.log(tocTree)
