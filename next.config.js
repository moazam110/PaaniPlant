/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://paani-b.onrender.com/api/:path*', // ⬅ your backend URL
      },
    ];
  },
};

module.exports = nextConfig;

