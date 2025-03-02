import { NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { mkdir, rmdir, writeFile } from "fs/promises";
import archiver from "archiver";
import { Readable } from "stream";

interface Mod {
    id: number;
    name: string;
    summary: string;
    downloadCount: number;
    latestFiles: {
        id: number;
        fileName: string;
        downloadUrl: string;
        gameVersions: string[];
        dependencies: {
            modId: number;
            relationType: number;
        }[];
    }[];
    authors: { name: string }[];
    logo?: {
        url: string;
    };
    links: {
        websiteUrl: string;
    }
}

interface ModpackRequest {
    mods: Mod[];
    minecraftVersion: string;
    loader: string;
}

export async function POST(request: NextRequest) {
    try {
        const data: ModpackRequest = await request.json();
        const { mods, minecraftVersion, loader } = data;
        const failedMods: string[] = [];

        // Create temporary directory structure
        const tempDir = join(process.cwd(), "temp");
        const modsDir = join(tempDir, "overrides", "mods");
        await mkdir(modsDir, { recursive: true });

        // Download all mod files
        const downloadPromises = mods.map(async (mod) => {
            try {
                const response = await fetch(mod.latestFiles[0]!.downloadUrl);
                if (!response.ok) throw new Error(`Failed to download ${mod.name}`);
                const buffer = await response.arrayBuffer();
                await writeFile(join(modsDir, mod.latestFiles[0]!.fileName), Buffer.from(buffer));
            } catch(e) {
                console.error(`Error with mod ${mod.name}: ${e}`)
                failedMods.push(mod.name);
            }
        });

        await Promise.all(downloadPromises);

        // Create manifest.json
        const manifest = {
            minecraft: {
                version: minecraftVersion,
                modLoaders: [{
                    id: `${loader.toLowerCase()}-${loader === "Forge" ? "1.0.0" : "0.14.21"}`,
                    primary: true
                }]
            },
            manifestType: "minecraftModpack",
            manifestVersion: 1,
            name: "Minecraft Mod Randomizer Pack",
            version: "1.0.0",
            author: "Minecraft Mod Randomizer",
            files: mods.filter(mod => !failedMods.includes(mod.name)).map(mod => ({
                projectID: mod.id,
                fileID: mod.latestFiles[0]?.id,
                required: true
            })),
            overrides: "overrides"
        };

        await writeFile(join(tempDir, "manifest.json"), JSON.stringify(manifest, null, 2));

        // Create modlist.html
        const modlistHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Modlist</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .mod { margin-bottom: 20px; }
                    .mod-name { font-weight: bold; }
                    .mod-authors { color: #666; }
                    .mod-summary { margin-top: 5px; }
                </style>
            </head>
            <body>
                <h1>Modpack Contents</h1>
                ${mods.map(mod => `
                    <div class="mod">
                        <div class="mod-name">${mod.name}</div>
                        <div class="mod-authors">by ${mod.authors.map(a => a.name).join(", ")}</div>
                        <div class="mod-summary">${mod.summary}</div>
                    </div>
                `).join("")}
            </body>
            </html>
        `;

        await writeFile(join(tempDir, "modlist.html"), modlistHtml);

        // Create zip archive
        const archive = archiver("zip", { zlib: { level: 9 } });
        const chunks: Buffer[] = [];

        archive.directory(tempDir, false);

        archive.on("data", (chunk) => chunks.push(Buffer.from(chunk)));

        await new Promise((resolve, reject) => {
            archive.on("end", resolve);
            archive.on("error", reject);
            archive.finalize();
        });

        rmdir(tempDir, { recursive: true });

        const zipBuffer = Buffer.concat(chunks);

        return new NextResponse(zipBuffer, {
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename="modpack-${minecraftVersion}-${loader}.zip"`,
                "Failed-Mods": failedMods.join(",")
            }
        });

    } catch (error) {
        console.error("Error creating modpack:", error);
        return NextResponse.json(
            { error: "Failed to create modpack" },
            { status: 500 }
        );
    }
}