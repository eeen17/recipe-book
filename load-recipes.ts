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
    return typeof obj === "object" && obj !== null &&
        "relativeParsePath" in obj;
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

function getHTMLFilePath(fileEntry: FileEntry, websiteAbsolute = false) {
    const dirsTo = fileEntry.relativeParsePath.dir;
    const fileName = `${toKebabCase(fileEntry.relativeParsePath.name)}.html`;

    return path.join(
        (websiteAbsolute ? path.SEPARATOR : "") + HTML_DIR,
        dirsTo,
        fileName,
    );
}

async function writeHTML(): Promise<[FileEntry[], string]> {
    const files: FileEntry[] = [];
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

    const fileHTML = (fileEntry: FileEntry) => {
        files.push(fileEntry);
        return `
        <li>
            <a href="${getHTMLFilePath(fileEntry, true)}">
                ${fileEntry.relativeParsePath.name}
            </a>
        </li>`.trim();
    };

    // TODO: fix infinite walk
    function walkTree(
        curLevel: FileTree,
        firstLevel = false,
    ): string {
        // async function foo(
        //     count: number,
        //     cl: FileTree,
        //     fl = false,
        // ): string {
        //     if (count == 5) return;

        //     const nextLevelEntries = Object.entries(cl);
        //     if (nextLevelEntries.length === 0) return "";

        //     console.log("================")
        //     console.log(count)

        //     return (await Promise.all(nextLevelEntries.map(
        //         async ([name, nextLevel]) => {
        //             if (isFileEntry(nextLevel)) {
        //                 console.log("file entry! leaving.")
        //                 return await fileHTML(nextLevel);
        //             }
        //             console.log("not file entry!")
        //             console.log(Object.keys(nextLevel))
        //             console.log()
        //             return dirHTML(
        //                 name,
        //                 foo(count + 1, nextLevel),
        //                 // walkTree(nextLevel),
        //                 fl,
        //             );
        //         },
        //     ))).join("\n");
        // }
        // foo(0, curLevel, firstLevel);

        const nextLevelEntries = Object.entries(curLevel);
        if (nextLevelEntries.length === 0) return "";

        return (nextLevelEntries.map(
            ([name, nextLevel]) => {
                if (isFileEntry(nextLevel)) {
                    return fileHTML(nextLevel);
                }
                return dirHTML(
                    name,
                    walkTree(nextLevel),
                    firstLevel,
                );
            },
        )).join("\n");
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
    return [files, tocHTML];
}

async function processMDFile(
    fileEntry: FileEntry,
    tocHTML: string,
) {
    const htmlPath = getHTMLFilePath(fileEntry);
    await ensureFile(htmlPath); // create file
    const md = await marked.parse(await Deno.readTextFile(fileEntry.path));
    const html = TEMPLATE
        .replace("{{right page}}", md)
        .replace("{{left page}}", tocHTML);
    await Deno.writeTextFile(htmlPath, html);
}

for await (const dirEntry of walk(MD_DIR)) handleEntry(dirEntry);
const [files, tocHTML] = await writeHTML();
files.forEach((fileEntry) => processMDFile(fileEntry, tocHTML));
