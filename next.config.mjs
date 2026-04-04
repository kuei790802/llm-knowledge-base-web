/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable Strict Mode to prevent double-mount in dev
  // (Strict Mode calls useEffect cleanup immediately, which closes our WebSocket before it's established)
  reactStrictMode: false,
}

export default nextConfig
