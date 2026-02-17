/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'argon2', 'pino', '@react-pdf/renderer'],
  },
};

export default nextConfig;
