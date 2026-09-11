/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', '@prisma/adapter-better-sqlite3', 'pg', '@prisma/adapter-pg'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sportmonks.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
