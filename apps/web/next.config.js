/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@registerkaro/shared-types', '@registerkaro/gst-form-schema'],
};

module.exports = nextConfig;
