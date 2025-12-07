import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack 配置（空配置，使用默认设置）
  turbopack: {},

  // 优化配置
  reactStrictMode: true,

  // 压缩和优化
  compress: true,

  // 图像优化
  images: {
    minimumCacheTTL: 60,
  },

  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    // 优化 bundle 大小
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            pyodide: {
              test: /[\\/]node_modules[\\/]pyodide[\\/]/,
              name: 'pyodide',
              priority: 10,
            },
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }

    return config;
  },

  // 允许 Pyodide 的 WebAssembly 和其他资源
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
