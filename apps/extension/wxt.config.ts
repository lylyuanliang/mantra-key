import { defineConfig } from 'wxt';

// 生成构建时间戳版本号（第4位加入时间戳 MMDDHHmm，如 11181545 代表 11月18日 15点45分，纯净数字无括号）
const now = new Date();
const pad = (n: number) => String(n).padStart(2, '0');
const monthDayHourMin = `${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
const version4 = `0.1.0.${monthDayHourMin}`;

// WXT 浏览器扩展核心配置
export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: '密诀 MantraKey',
    version: version4,
    description: '确定性无状态密码管理器，零存储秒级填充',
    permissions: [
      'nativeMessaging',
      'activeTab',
      'storage',
      'scripting',
    ],
    action: {
      default_title: '密诀 MantraKey',
    },
  },
});
