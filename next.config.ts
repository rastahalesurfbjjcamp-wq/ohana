import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "50mb" }, // vídeos nos agendamentos
  },
};

export default nextConfig;
