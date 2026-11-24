import { defineConfig } from 'wxt';

// 读取当前版本号，保证完全符合 Google Chrome Web Store 规范 (严格 1-4 个整数，各段 <= 65535)
const rawVersion = process.env.APP_VERSION || '0.1.1.202611241144';
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
  },
});
