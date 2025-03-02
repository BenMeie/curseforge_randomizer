"use client";

import { useState } from "react";
import styles from "./index.module.css";
import Link from "next/link";
import { versions } from "./api/minecraftVersions";
import { GitHub, Info } from "react-feather";

interface Mod {
  id: number;
  name: string;
  summary: string;
  downloadCount: number;
  latestFiles: {
    downloadUrl: string;
  }[];
  authors: { name: string }[];
  logo?: {
    url: string;
  };
  links: {
    websiteUrl: string;
  }
}

interface ModsResponse {
  mods: Mod[];
  minecraftVersion: string;
  loader: string
}

export default function Home() {
  const [mods, setMods] = useState<Mod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mcVersion, setMcVersion] = useState<string | null>(null);
  const [loader, setLoader] = useState<string | null>(null);

  const fetchRandomMods = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/curseforge?mcVersion=${mcVersion}&loader=${loader}`);
      if (!response.ok) {
        throw new Error("Failed to fetch mods");
      }
      const data: ModsResponse = await response.json();
      setMods(data.mods);
      setMcVersion(data.minecraftVersion);
      setLoader(data.loader);
    } catch (err) {
      setError("Error fetching mods. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchMoreMods = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/curseforge?mcVersion=${mcVersion}&loader=${loader}`);
      if (!response.ok) {
        throw new Error("Failed to fetch mods");
      }
      const data: ModsResponse = await response.json();
      data.mods = data.mods.filter(mod => !mods.find(m => m.id === mod.id));
      setMods([...mods, ...data.mods]);
      setMcVersion(data.minecraftVersion);
      setLoader(data.loader);
    } catch (err) {
      setError("Error fetching mods. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const downloadModpack = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mods,
          minecraftVersion: mcVersion,
          loader
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create modpack');
      }
      
      // Create a blob from the response
      const blob = await response.blob();
      const failedMods = response.headers.get('Failed-Mods');
      if (failedMods) {
        setError(`Failed to download some mods: ${failedMods}`);
      }
      
      // Create a download link and trigger it
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `modpack-${mcVersion}-${loader}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Error creating modpack. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>
          Minecraft Mod Randomizer
        </h1>
        <div className={styles.selectContainer}>
          <div className={styles.selectGroup}>
            <label htmlFor="mcVersion" className={styles.label}>Minecraft Version:</label>
            <select
              id="mcVersion"
              value={mcVersion ?? ""}
              onChange={(e) => setMcVersion(e.target.value)}
              className={styles.select}
            >
              <option value="">Random</option>
              {versions.versions.filter((version) => version.type === "release").map((version) => (
                <option key={version.id} value={version.id}>
                  {version.id}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.selectGroup}>
            <label htmlFor="loader" className={styles.label}>Mod Loader:</label>
            <select
              id="loader"
              value={loader ?? ""}
              onChange={(e) => setLoader(e.target.value)}
              className={styles.select}
            >
              <option value="">Random</option>
              <option value="Forge">Forge</option>
              <option value="Fabric">Fabric</option>
              <option value="NeoForge">NeoForge</option>
            </select>
          </div>
          <button
            onClick={fetchRandomMods}
            disabled={loading}
            className={styles.button}
          >
            {loading ? "Loading..." : "Get Random Mods"}
          </button>
        </div>
        {error && (
          <div className={styles.error}>{error}</div>
        )}

        <p className={styles.info}><Info/> The randomizer attempts to resolve dependencies for all mods, however many mods do not properly list their dependencies using the Curseforge depencency system so you may be required to download several additional mods.</p>
        <p className={styles.info}><Info/> Several mods have Curseforge API access disabled. These mods will still appear in this list, however they will not be downloadable from this site and will not be added to the modpack should you choose to download it.</p>

        <div className={styles.modGrid}>
          {mods.map((mod) => (
              <div key={mod.id} className={styles.modCard}>
                {mod.logo && (
                  <Link href={mod.links.websiteUrl} target="_blank">
                    <div className={styles.modLogoContainer}>
                      <img 
                        src={mod.logo.url} 
                        alt={`${mod.name} logo`} 
                        className={styles.modLogo}
                      />
                    </div>
                  </Link>
                )}
                <Link href={mod.links.websiteUrl} target="_blank"><h3 className={styles.modTitle}>{mod.name}</h3></Link>
                <p className={styles.modSummary}>{mod.summary}</p>
                <div className={styles.modMeta}>
                  <p>Downloads: {mod.downloadCount.toLocaleString()}</p>
                  <p>Authors: {mod.authors.map(a => a.name).join(", ")}</p>
                </div>
                <Link href={mod.latestFiles[0] ? mod.latestFiles[0]?.downloadUrl : mod.links.websiteUrl} target="_blank" className={styles.downloadContainer}>
                  <button className={styles.button}>Download</button>
                </Link>
              </div>
          ))}
        </div>
        <div className={styles.buttonContainer}>
          <button
            onClick={fetchMoreMods}
            disabled={loading}
            className={styles.button}
          >
            {loading? "Loading..." : "Get More Mods"}
          </button>
          
          {mods.length > 0 && (
            <button
              onClick={downloadModpack}
              disabled={loading}
              className={styles.button}
            >
              {loading ? "Creating..." : "Download Modpack"}
            </button>
          )}
        </div>
      </div>
      <Link href="https://github.com/BenMeie/curseforge_randomizer" className={styles.githubButton}><GitHub /></Link>
    </main>
  );
}
