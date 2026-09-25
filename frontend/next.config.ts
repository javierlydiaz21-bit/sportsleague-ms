import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // /panel sirve el panel interactivo (archivo estatico en public/panel.html)
  async rewrites() {
    return [{ source: "/panel", destination: "/panel.html" }];
  },
};

export default nextConfig;
