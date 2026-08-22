/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [".monkeycode-ai.live"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  serverExternalPackages: [],
};

export default nextConfig;
