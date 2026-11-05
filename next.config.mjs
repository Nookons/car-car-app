/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.olxcdn.com" }],
  },
};

export default nextConfig;
