/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const nextConfig = {
  reactStrictMode: true,
  ...(basePath && { basePath, assetPrefix: `${basePath}/` }),
  ...(process.env.NEXT_PUBLIC_STATIC_EXPORT === '1'
    ? {
        output: 'export',
        typescript: { ignoreBuildErrors: true },
        eslint: { ignoreDuringBuilds: true },
      }
    : {}),
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'argon2', 'pino', '@react-pdf/renderer'],
  },
};

export default nextConfig;
