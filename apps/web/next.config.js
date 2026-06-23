/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output is for Docker; Vercel uses its own deployment format.
  ...(process.env.VERCEL ? {} : { output: 'standalone' }),
  transpilePackages: ['@registerkaro/shared-types', '@registerkaro/gst-form-schema'],
};

module.exports = nextConfig;
