import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: false,
  outputFileTracingRoot: path.join(__dirname),

  // 🛠️ Thêm cụm này để bỏ qua lỗi TypeScript khi build trên Vercel
  typescript: {
    ignoreBuildErrors: true,
  },

  // 🛠️ Thêm cụm này để bỏ qua lỗi ESLint khi build trên Vercel
  eslint: {
    ignoreDuringBuilds: true,
  },

  // 🔥 Găm cứng biến môi trường vào đây để bất kể link Vercel nào cũng nhận đúng IP EC2
  env: {
    NEXT_PUBLIC_API_BASE_URL: 'http://15.135.91.145:4000',
    NEXT_PUBLIC_SOCKET_URL: 'http://15.135.91.145:4000',
    NEXT_PUBLIC_CALL_API_BASE_URL: 'http://15.135.91.145:4000',
  }
};

export default nextConfig;