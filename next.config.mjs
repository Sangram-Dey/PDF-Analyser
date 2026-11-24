/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.npm_lifecycle_event === "verify" ? { distDir: ".next-verify" } : {}),
};

export default nextConfig;
