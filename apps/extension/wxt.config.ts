import { defineConfig } from 'wxt';

// 读取当前版本号，保证完全符合 Google Chrome Web Store 规范 (严格 1-4 个整数，各段 <= 65535)
const rawVersion = process.env.APP_VERSION || '0.1.1.202611251050';
// Chrome 要求 manifest.version 每段必须 <= 65535，因此前三位作为 version，完整带时间戳作为 version_name
const versionParts = rawVersion.split('.');
const chromeVersion = versionParts.slice(0, 3).join('.');

// WXT 浏览器扩展核心配置 (Google Chrome Web Store MV3 生产标准)
export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: '密诀 MantraKey',
    version: chromeVersion,
    version_name: rawVersion,
    description: '确定性无状态密码管理器，零存储秒级填充',
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAr3t03zdf3A6Ry+Od2LG81sOzciovZsGvHpIFgTx/VpQ+nrHkCV/N4A/5xhhBV0Onu/XiBxmM9sLI1LvqzBYGLROQybGNb9CDFozfkmTosvu8cNx2FrBy0m4R+VlSZhPujnixme6WHR2lI1TBR3Rbns0MvqGfo73T94ilbkWmfZ21AMb42mPrU0ysmDzq+4tK0uOKKn2H8rq0HzyaQtr4BxtIG6v188dcBJniKuEZhzdER9xQ4lG0H3mAWKAsj5x0tMLPjZuux9omN+61X/paFIouOTHQjel19nc+hJD0inHn0eZX1TMcw8Wg4zBrIal2W3Mxvke9bNygnxsDT/pJ2QIDAQAB',
    icons: {
      '16': 'icons/icon-16.png',
      '32': 'icons/icon-32.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    },
    action: {
      default_title: '密诀 MantraKey',
      default_icon: {
        '16': 'icons/icon-16.png',
        '32': 'icons/icon-32.png',
        '48': 'icons/icon-48.png',
      },
    },
    permissions: [
      'nativeMessaging',
      'activeTab',
      'storage',
      'scripting',
    ],
    host_permissions: [
      'https://raw.githubusercontent.com/*',
      'https://ghproxy.net/*',
      'https://gh-proxy.com/*',
      'https://cdn.jsdelivr.net/*',
    ],
  },
});
