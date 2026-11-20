import { defineConfig } from 'wxt';

// 读取当前版本号，保证完全符合 Google Chrome Web Store 规范 (严格 1-4 个整数，各段 <= 65535)
const appVersion = process.env.APP_VERSION || '0.1.0';

// WXT 浏览器扩展核心配置 (Google Chrome Web Store MV3 生产标准)
export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: '密诀 MantraKey',
    version: appVersion,
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
