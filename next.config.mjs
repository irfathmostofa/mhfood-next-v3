/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [".monkeycode-ai.live"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  serverExternalPackages: [],
};

export default nextConfig;
