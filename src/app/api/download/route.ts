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

        // Create zip archive in memory
        const archive = archiver("zip", { zlib: { level: 9 } });
        const chunks: Buffer[] = [];

        archive.on("data", (chunk) => chunks.push(Buffer.from(chunk)));

        // Download all mod files and add them directly to the archive
        for (const mod of mods) {
            try {
                const response = await fetch(mod.latestFiles[0]!.downloadUrl);
                if (!response.ok) throw new Error(`Failed to download ${mod.name}`);
                const buffer = await response.arrayBuffer();
                
                // Add file directly to the archive in the correct path
                archive.append(Buffer.from(buffer), { 
                    name: `overrides/mods/${mod.latestFiles[0]!.fileName}` 
                });
            } catch(e) {
                console.error(`Error with mod ${mod.name}: ${e}`);
                failedMods.push(mod.name);
            }
        }

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

        // Add manifest to archive
        archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

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

        // Add modlist to archive
        archive.append(modlistHtml, { name: 'modlist.html' });

        // Finalize the archive
        await new Promise((resolve, reject) => {
            archive.on("end", resolve);
            archive.on("error", reject);
            archive.finalize();
        });

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
            { error: "Failed to create modpack", details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}