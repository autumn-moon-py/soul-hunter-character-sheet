import { execSync } from "node:child_process";

function readBuildVersion() {
  try {
    const hash = execSync("git rev-parse --short HEAD").toString().trim();
    const date = execSync("git log -1 --format=%cd --date=format:%Y%m%d").toString().trim();
    return `${date}-${hash}`;
  } catch {
    return "dev";
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: readBuildVersion(),
  },
};

export default nextConfig;
