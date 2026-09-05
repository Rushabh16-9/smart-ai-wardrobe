/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      { protocol: 'https', hostname: '**' },
    ],
  },

  // Required for @imgly/background-removal ONNX models (SharedArrayBuffer)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ];
  },

  experimental: {
    // Next.js 14: keep these out of Server Component bundles
    serverComponentsExternalPackages: [
      '@imgly/background-removal',
      'onnxruntime-web',
      'onnxruntime-node',
    ],
  },

  webpack: (config, { isServer }) => {
    // Enable async WASM for browser
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    if (!isServer) {
      // Alias away the Node.js native binding from browser bundles
      config.resolve.alias = {
        ...config.resolve.alias,
        'onnxruntime-node': false,
      };

      config.output = {
        ...config.output,
        webassemblyModuleFilename: 'static/wasm/[modulehash].wasm',
      };
    }

    if (isServer) {
      const originalExternals = Array.isArray(config.externals) ? config.externals : [];
      config.externals = [
        ...originalExternals,
        '@imgly/background-removal',
        'onnxruntime-web',
        'onnxruntime-node',
      ];
    }

    return config;
  },
};

export default nextConfig;
