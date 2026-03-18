/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Custom Server를 사용하므로 Next.js의 기본 서버 대신 Express를 사용
  // Socket.IO와 함께 동작하기 위해 필요
  experimental: {
    serverComponentsExternalPackages: ['socket.io'],
  },
};

export default nextConfig;
