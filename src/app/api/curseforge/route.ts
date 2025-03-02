import { type NextRequest, NextResponse } from "next/server";

const CURSEFORGE_API_URL = "https://api.curse.tools/v1/cf";

const loaders = ["Forge", "Fabric", "NeoForge"]
const loaderValue = [1, 4, 6]

interface ModResponse {
    data: Mod[];
};

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
    logo: {
        url: string;
    },
    links: {
        websiteUrl: string;
    }
}

interface FileResponse {
    data: {
        id: number;
        fileName: string;
        downloadUrl: string;
        gameVersions: string[];
        dependencies: {
            modId: number;
            relationType: number;
        }[];
    }[];
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        let mcVersion = searchParams.get("mcVersion")
        let loader = searchParams.get("loader")

        const finalMods: Mod[] = []

        if ((!mcVersion && !loader) || (mcVersion === "null" || loader === "null") || (mcVersion === "" || loader === "")) {
            // Get a random page number (CurseForge API uses pagination)
            const randomPage = Math.floor(Math.random() * 400) + 1;

            // Get Minecraft Forge mods
            const response = await fetch(`${CURSEFORGE_API_URL}/mods/search?gameId=432&classId=6&pageSize=50&index=${randomPage}`, {
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!response.ok) {
                throw new Error(`CurseForge API error: ${response.status}`);
            }

            const data: ModResponse = await response.json();

            // Select a random mod from the results
            const randomIndex = Math.floor(Math.random() * data.data.length);
            const selectedMod = data.data[randomIndex];

            // Get the Minecraft version from the selected mod
            mcVersion = selectedMod?.latestFiles[0]?.gameVersions.find(v => v.startsWith("1."))!;
            loader = selectedMod?.latestFiles[0]?.gameVersions.find(v => loaders.includes(v))!;

            console.log(`Selected Random Mod ${selectedMod?.name} - ${mcVersion} - ${loader}/${loaderValue[loaders.indexOf(loader)]}`)

            if (!mcVersion) {
                throw new Error("No valid Minecraft version found");
            }

            finalMods.push(...await resolveDependencies(selectedMod!))
        }

        // Get 4 more mods with the same Minecraft version
        for (let i = 0; i < 10; i++) {
            const randomPage = Math.floor(Math.random() * 500) + 1;
            console.log(`Getting mods on page ${randomPage} for ${mcVersion} - ${loader}/${loaderValue[loaders.indexOf(loader!)]}`)
            const compatibleMods = await fetch(
                `${CURSEFORGE_API_URL}/mods/search?gameId=432&classId=6&gameVersion=${mcVersion}&pageSize=20&index=${randomPage}&modLoaderType=${loaderValue[loaders.indexOf(loader!)]}`,
                {
                    headers: {
                        "Accept": "application/json"
                    }
                }
            );

            if (!compatibleMods.ok) {
                throw new Error(`CurseForge API error: ${compatibleMods.status}`);
            }

            const compatibleModsData: ModResponse = await compatibleMods.json();

            for(const mod of compatibleModsData.data) {
                const files = await fetch(`${CURSEFORGE_API_URL}/mods/${mod.id}/files?gameVersion=${mcVersion}&modLoaderType=${loaderValue[loaders.indexOf(loader!)]}&pageSize=1`, {
                    headers: {
                        "Accept": "application/json"
                    }
                });

                if (!files.ok) {
                    throw new Error(`CurseForge API error: ${files.status}`);
                }

                const filesData: FileResponse = await files.json();
                mod.latestFiles = filesData.data
            }

            // Shuffle the compatible mods and select 4
            let shuffled = compatibleModsData.data
                .filter(mod => finalMods.findIndex(m => m?.id === mod.id) === -1)
                .sort(() => Math.random() - 0.5)
               .slice(0, 10);

            shuffled = await resolveAllDependencies(shuffled)
            shuffled.filter(mod => finalMods.findIndex(m => m?.id === mod.id) === -1).forEach(mod => {
                finalMods.push(mod)
            })

            await new Promise(resolve => setTimeout(resolve, 250));
        }

        return NextResponse.json({
            mods: finalMods,
            minecraftVersion: mcVersion,
            loader: loader
        });
    } catch (error) {
        console.error("Error fetching mods:", error);
        return NextResponse.json(
            { error: "Failed to fetch mods" },
            { status: 500 }
        );
    }
}

async function resolveAllDependencies(mods: Mod[]): Promise<Mod[]> {
    const dependencies: Mod[] = []
    for(const mod of mods) {
        dependencies.push(...await resolveDependencies(mod))
    }
    return dependencies
}

async function resolveDependencies(mod: Mod): Promise<Mod[]> {
    if(!mod.latestFiles[0]?.dependencies.some(d => d.relationType === 3)) {
        return [mod]
    }
    
    return new Promise(async (resolve, reject) => {
        const dependencies: Mod[] = [mod]
        const dependencyInfo = mod.latestFiles[0]?.dependencies.filter(d => d.relationType === 3)
        for(const d of dependencyInfo!) {
            const dependant = await fetch(`${CURSEFORGE_API_URL}/mods/${d.modId}`, {
                headers: {
                    "Accept": "application/json"
                }
            })
    
            if (!dependant.ok) {
                reject(new Error(`CurseForge API error: ${dependant.status}`))
            }
    
            const modData: Mod = (await dependant.json()).data

            const files = await fetch(`${CURSEFORGE_API_URL}/mods/${modData.id}/files?gameVersion=${mod.latestFiles[0]?.gameVersions.find(v => v.startsWith("1."))}&modLoaderType=${loaderValue[loaders.indexOf(mod.latestFiles[0]?.gameVersions.find(v => loaders.includes(v))!)]}&pageSize=1`, {
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!files.ok) {
                reject(new Error(`CurseForge API error: ${files.status}`))
            }

            const filesData: FileResponse = await files.json();
            modData.latestFiles = filesData.data

            dependencies.push(...await resolveDependencies(modData))
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        resolve(dependencies)
    })
}