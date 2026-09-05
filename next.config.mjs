/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // não roda ESLint durante o build (Vercel)
    ignoreDuringBuilds: true,
  },
  output: "standalone",
};

export default nextConfig;
