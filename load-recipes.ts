import { ensureFile, walk } from "jsr:@std/fs";
import { marked } from "npm:marked";
import * as path from "jsr:@std/path";
import { type ParsedPath } from "jsr:@std/path/parse";
import { type WalkEntry } from "jsr:@std/fs";
import { toKebabCase } from "jsr:@std/text/to-kebab-case";

const TEMPLATE = await Deno.readTextFile("template.html");
const HTML_DIR = "content/pages";
const MD_DIR = "content/recipe-content";

type FileEntry = {
    relativeParsePath: ParsedPath;
} & WalkEntry;
function isFileEntry(obj: any): obj is FileEntry {
    return typeof obj === 'object' && obj !== null &&
         'relativeParsePathd' in obj
}

type FileTree = {
    [name: string]: FileTree | FileEntry;
};
const tocTree: FileTree = {};

function getTOCObjectFromPath(filePath: string) {
    let curObj = tocTree;
    const dirList = path.normalize(filePath).split(path.SEPARATOR).slice(0, -1);
    for (const d of dirList) {
        if (isFileEntry(curObj[d])) break;
        curObj = curObj[d];
    }
    return curObj;
}

function handleEntry(dirEntry: WalkEntry) {
    if (dirEntry.path == MD_DIR) return;
    const relativePath = path.relative(MD_DIR, dirEntry.path);

    const fileEntry: FileEntry = {
        relativeParsePath: path.parse(relativePath),
        ...dirEntry,
    };

    const tocLevel = getTOCObjectFromPath(relativePath); // only directories to entry

    if (dirEntry.isFile) {
        tocLevel[fileEntry.relativeParsePath.name] = fileEntry;
    } else if (fileEntry.isDirectory) {
        tocLevel[fileEntry.name] = {};
    }
}

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

async function writeHTML(): Promise<[[FileEntry, string][], string]> {
    const files: [FileEntry, string][] = [];
    const dirHTML = (
        dirName: string,
        subContent: string,
        firstLevel: boolean,
    ) => {
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
    };

    const fileHTML = async (fileEntry: FileEntry) => {
        const htmlFilePath = await createHTMLFile(fileEntry);
        files.push([fileEntry, htmlFilePath]);
        return `
        <li><a href="${htmlFilePath}">${fileEntry.relativeParsePath.name}</a></li>
    `.trim();
    };

    // TODO: fix infinite walk
    function walkTree(curLevel: FileTree | FileEntry, firstLevel = false): string {
        const nextLevelEntries = Object.entries(curLevel);
        if (nextLevelEntries.length === 0) return "";

        return nextLevelEntries.map(
            async ([name, nextLevel]) => {
                if (isFileEntry(nextLevel)) {
                    return await fileHTML(nextLevel);
                }
                return dirHTML(
                    name,
                    walkTree(nextLevel),
                    firstLevel,
                );
            },
        ).join("\n");
    }

    const tocHTML = `
    <div class=table-of-contents>
        ${walkTree(tocTree, true)}
    </div>`;

    await Deno.writeTextFile(
        "content/pages/index.html",
        TEMPLATE
            .replace("{{left page}}", tocHTML)
            .replace("{{right page}}", "<h1>Recipe Book</h1>"),
    );
    return [files, tocHTML]
}

async function processMDFile(fileEntry: FileEntry, htmlPath: string, tocHTML: string) {
    // const htmlFilePath = await createHTMLFile(fileEntry);
    // fileEntry.relativeParsePath.dir
    // const htmlPath = path.join(
    //     HTML_DIR,
    //     htmlPath
    // );
    const md = await marked.parse(await Deno.readTextFile(fileEntry.path));
    const html = TEMPLATE.replace("{{right page}}", md);
    await Deno.writeTextFile(htmlPath, html);
    // return htmlPath;
}

for await (const dirEntry of walk(MD_DIR)) handleEntry(dirEntry);
console.log(tocTree)
const [files, tocHTML] = (await writeHTML())
files.forEach(([fileEntry, htmlPath]) => processMDFile(fileEntry, htmlPath, tocHTML));