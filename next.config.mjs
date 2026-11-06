/** @type {import('next').NextConfig} */
const nextConfig = {
  // TODO: разобраться с типами и вернуть проверку в сборке.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Vercel по умолчанию запрещает геолокацию — разрешаем своему домену
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
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
