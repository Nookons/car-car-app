import path from 'path';
import {NextConfig} from 'next';

const nextConfig: NextConfig = {
    webpack(config) {
        config.resolve.alias = {
            ...(config.resolve.alias || {}),
            '@': path.resolve(__dirname),
        };
        return config;
    },
    images: {
        domains: ['ireland.apollo.olxcdn.com', 'dtprodvehicleimages.blob.core.windows.net', 'i.ytimg.com', 'png.pngtree.com', 'w7.pngwing.com'],
    },
};

export default nextConfig;
