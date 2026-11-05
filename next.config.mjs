/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // старые ссылки мини-приложения из прежней версии
      { source: "/en/car", destination: "/", permanent: false },
      { source: "/en/car/:id", destination: "/listing/:id", permanent: false },
    ];
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.olxcdn.com" }],
  },
};

export default nextConfig;
