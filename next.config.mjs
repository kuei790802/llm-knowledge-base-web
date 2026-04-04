/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for SSE streaming from route handlers
  experimental: {
    serverComponentsExternalPackages: ['@anthropic-ai/sdk'],
  },
}

export default nextConfig
