/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Allow this page to be embedded in your WP site iframe
        source: "/voice",
        headers: [
          {
            key: "X-Frame-Options",
            value: "ALLOW-FROM https://jamayaai.com",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://jamayaai.com https://jai.jamayaai.com https://*.jamayaai.com",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
