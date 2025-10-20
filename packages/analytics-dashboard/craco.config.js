const path = require('path');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = {
  webpack: {
    configure: (webpackConfig, { env }) => {
      // Allow importing from outside src directory (for monorepo shared packages)
      webpackConfig.resolve.plugins = webpackConfig.resolve.plugins.filter(
        plugin => plugin.constructor.name !== 'ModuleScopePlugin'
      );

      // Add alias for shared library
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
        '@aws-agent/shared': path.resolve(__dirname, '../shared/dist'),
      };

      // Add shared library to transpilation
      const oneOfRule = webpackConfig.module.rules.find(rule => rule.oneOf);
      if (oneOfRule) {
        const tsRule = oneOfRule.oneOf.find(
          rule => rule.test && rule.test.toString().includes('tsx?')
        );
        if (tsRule) {
          // Ensure include is an array
          if (!Array.isArray(tsRule.include)) {
            tsRule.include = [tsRule.include];
          }
          tsRule.include.push(path.resolve(__dirname, '../shared/src'));
        }
      }

      // Production optimizations
      if (env === 'production') {
        // Configure CDN public path if specified
        if (process.env.REACT_APP_CDN_URL) {
          webpackConfig.output.publicPath = process.env.REACT_APP_CDN_URL;
        }

        // Code splitting optimizations for dashboard
        webpackConfig.optimization = {
          ...webpackConfig.optimization,
          splitChunks: {
            chunks: 'all',
            maxInitialRequests: 10,
            maxAsyncRequests: 10,
            cacheGroups: {
              vendor: {
                test: /[\\/]node_modules[\\/]/,
                name: 'vendors',
                chunks: 'all',
                priority: 10,
              },
              common: {
                name: 'common',
                minChunks: 2,
                chunks: 'all',
                priority: 5,
                reuseExistingChunk: true,
              },
              react: {
                test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
                name: 'react',
                chunks: 'all',
                priority: 20,
              },
              charts: {
                test: /[\\/]node_modules[\\/](recharts|d3|chart\.js)[\\/]/,
                name: 'charts',
                chunks: 'all',
                priority: 15,
              },
              socketio: {
                test: /[\\/]node_modules[\\/]socket\.io-client[\\/]/,
                name: 'socketio',
                chunks: 'all',
                priority: 15,
              }
            },
          },
        };

        // Add bundle analyzer if enabled
        if (process.env.ANALYZE_BUNDLE === 'true') {
          webpackConfig.plugins.push(
            new BundleAnalyzerPlugin({
              analyzerMode: 'static',
              openAnalyzer: false,
              reportFilename: 'bundle-report.html',
            })
          );
        }

        // Optimize asset loading
        webpackConfig.module.rules.push({
          test: /\.(png|jpe?g|gif|svg)$/i,
          type: 'asset',
          parser: {
            dataUrlCondition: {
              maxSize: 8 * 1024, // 8kb
            },
          },
          generator: {
            filename: 'static/media/[name].[hash:8][ext]',
          },
        });

        // Enable performance hints for dashboard
        webpackConfig.performance = {
          hints: 'warning',
          maxEntrypointSize: 1024000, // 1MB for dashboard (larger due to charts)
          maxAssetSize: 512000, // 500kb
        };

        // Add preload/prefetch for critical resources
        webpackConfig.optimization.usedExports = true;
        webpackConfig.optimization.sideEffects = false;
      }

      return webpackConfig;
    },
  },
  jest: {
    configure: (jestConfig) => {
      // Allow Jest to process shared library
      jestConfig.transformIgnorePatterns = [
        'node_modules/(?!(@aws-agent/shared)/)'
      ];
      
      // Add module name mapping for Jest
      jestConfig.moduleNameMapper = {
        ...jestConfig.moduleNameMapper,
        '^@aws-agent/shared$': path.resolve(__dirname, '../shared/dist'),
      };
      
      return jestConfig;
    },
  },
};