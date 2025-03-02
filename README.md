# Minecraft Mod Randomizer

Uses the CurseForge API to create random lists of "compatible" mods and allows you to create modpack zips.

Can be access on [Minecraft Mod Randomizer](https://curseforge-randomizer.vercel.app)

## Why?
I thought it might be fun to create a modpack full of entirely random mods and then kind of got way too involved in making this tool instead lol.

## Usage
You can use the tool on the website or you can run it locally.

While using the tool you can choose to select a specific Minecraft Version and modloader or leave it up to chance. Be aware that Curseforge only returns the first 10,000 results so results will be pretty heavily biased to newer creations.

The tool will fetch 100 mods by default, but it also resolves mod dependencies so the actual amount will probably be higher. Also, while the tool tries to resolves dependencies, many mods do not properly link  dependencies so the tool will not always be able to resolve all dependencies.

One final note, mods can disable file access from the Curseforge API. The tool will still be able to fetch and display these mods, but it will not be able to include them in the modpack download so you will have to manually download them.