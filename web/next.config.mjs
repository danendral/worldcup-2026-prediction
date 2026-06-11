/** @type {import('next').NextConfig} */

// When deploying to GitHub Pages at danendral.github.io/worldcup-2026-prediction
// the app is served from a sub-path, so assets need a basePath. Locally
// (`next dev`) we want it served from "/". The GitHub Action sets
// GITHUB_PAGES=true at build time; dev leaves it unset.
// NOTE: `repo` MUST equal the GitHub repository name (it is the URL path).
const isGithubPages = process.env.GITHUB_PAGES === "true";
const repo = "worldcup-2026-prediction";

const nextConfig = {
  reactStrictMode: true,
  // Produce a fully static site in `out/` (no Node server needed).
  output: "export",
  // GitHub Pages serves each route as a folder/index.html.
  trailingSlash: true,
  // Next's <Image> optimizer needs a server; we use plain <img>, so disable it.
  images: { unoptimized: true },
  ...(isGithubPages
    ? { basePath: `/${repo}`, assetPrefix: `/${repo}/` }
    : {}),
};

export default nextConfig;
