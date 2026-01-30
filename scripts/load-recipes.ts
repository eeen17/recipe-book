import { ensureFile, walk } from "jsr:@std/fs";
import { marked } from "npm:marked";
import * as path from "jsr:@std/path";
import { type ParsedPath } from "jsr:@std/path/parse";
import { type WalkEntry } from "jsr:@std/fs";
import { toKebabCase } from "jsr:@std/text/to-kebab-case";
import { dirname } from "node:path";

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

async function writeTOCHTML() {
    console.log("walking tree...")


    const dirHTML = (dirName: string, subContent: string, firstLevel: boolean) => {
        return `
        ${firstLevel ? "" : "<li>"}
        <details open>
            <summary>${dirName}</summary>
            <ul>
                ${subContent}
            </ul>
        </details>
        ${firstLevel ? "" : "</li>"}
    `.trim();
    }

    const fileHTML = (name: string, path: string) => {
        return `
        <li>${name}: ${path}</li>
    `.trim();
    }

    function walkTree(curLevel: FileTree | string, firstLevel = false): string {
        const nextLevelEntries = Object.entries(curLevel);
        if (nextLevelEntries.length === 0) return "";

        return nextLevelEntries.map(
            ([name, nextLevel]) => {
                if (typeof (nextLevel) === "string")
                    return fileHTML(name, nextLevel);
                return dirHTML(
                    name,
                    walkTree(nextLevel),
                    firstLevel
                )
            }
        ).join("\n")
    }

    const tocHTML = walkTree(tocTree, true);
    await Deno.writeTextFile("content/toc.html", tocHTML);
}

for await (const dirEntry of walk(MD_DIR)) handleEntry(dirEntry);
await writeTOCHTML();