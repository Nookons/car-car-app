/** @type {import('next').NextConfig} */
const apiTarget = (
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://api-production-5bee.up.railway.app"
    : "http://127.0.0.1:8080")
).replace(/\/$/, "");

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // Next production server compresses dynamic responses; keep this explicit so
  // deployment defaults cannot silently disable gzip.
  compress: true,
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/brands/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      {
        source: "/bodies/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          // Vercel по умолчанию запрещает геолокацию — разрешаем своему домену
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
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
  async rewrites() {
    // Один origin для фронта и API: cookie сессии остаётся first-party и
    // переживает блокировку сторонних cookie в Safari/Chrome.
    return [{ source: "/api/:path*", destination: `${apiTarget}/api/:path*` }];
  },
  images: {
    // Оптимизатор Vercel считается в квоте (5 000 исходников/мес на бесплатном
    // плане), а CDN площадки уже отдаёт нужный размер. Поэтому `next/image`
    // выключен целиком: картинки идут напрямую с olxcdn через srcSet.
    unoptimized: true,
  },
};

export default nextConfig;
