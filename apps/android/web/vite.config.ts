import { defineConfig, Plugin } from 'vite';
import { agentFeedback } from '@lylyuanliang/agent-feedback-vite-plugin';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * 本地 APK 产物分发与 /api/app-update 联调中间件
 */
function viteApkReleasePlugin(): Plugin {
  function setCorsHeaders(req: any, res: any) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization, X-Access-Key, X-Access-Hash');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Disposition, Accept-Ranges');
  }

  return {
    name: 'vite-plugin-mantra-apk-release',
    configureServer(server) {
      // 1. APK 文件流式下载与断点续传 (GET /releases/*)
      server.middlewares.use('/releases', (req, res, next) => {
        setCorsHeaders(req, res);
        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        const url = req.url || '';
        let filename = decodeURIComponent(url.replace(/^\/+/, '').split('?')[0]);
        const projectRoot = path.resolve(__dirname, '../../..');
        const releaseDir = path.resolve(projectRoot, 'releases');

        if (!filename || filename === '/' || filename.includes('debug')) {
          filename = 'mantra-key-latest-debug.apk';
        } else if (filename.includes('release')) {
          filename = 'mantra-key-latest-release.apk';
        }

        let filePath = path.join(releaseDir, filename);
        const gradleDebugApk = path.resolve(projectRoot, 'apps/android/app/build/outputs/apk/debug/app-debug.apk');
        const gradleReleaseApk = path.resolve(projectRoot, 'apps/android/app/build/outputs/apk/release/app-release.apk');

        if (filename.includes('debug') && fs.existsSync(gradleDebugApk)) {
          if (!fs.existsSync(filePath) || fs.statSync(gradleDebugApk).mtimeMs > fs.statSync(filePath).mtimeMs) {
            filePath = gradleDebugApk;
          }
        } else if (filename.includes('release') && fs.existsSync(gradleReleaseApk)) {
          if (!fs.existsSync(filePath) || fs.statSync(gradleReleaseApk).mtimeMs > fs.statSync(filePath).mtimeMs) {
            filePath = gradleReleaseApk;
          }
        }

        if (!fs.existsSync(filePath)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end(`APK 尚未构建: ${filename}`);
          return;
        }

        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.range;

        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
        res.setHeader('Accept-Ranges', 'bytes');

        if (range) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          const chunksize = end - start + 1;
          const file = fs.createReadStream(filePath, { start, end });

          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Content-Length': chunksize,
          });
          file.pipe(res);
        } else {
          res.writeHead(200, { 'Content-Length': fileSize });
          fs.createReadStream(filePath).pipe(res);
        }
      });

      // 2. 本地 APK 元数据查询接口 (GET /api/app-update)
      server.middlewares.use('/api/app-update', (req, res, next) => {
        setCorsHeaders(req, res);
        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        const projectRoot = path.resolve(__dirname, '../../..');
        const releaseDir = path.resolve(projectRoot, 'releases');
        const gradleDebugApk = path.resolve(projectRoot, 'apps/android/app/build/outputs/apk/debug/app-debug.apk');
        const releaseDebugApk = path.resolve(releaseDir, 'mantra-key-latest-debug.apk');

        let targetApk = releaseDebugApk;
        if (fs.existsSync(gradleDebugApk)) {
          if (!fs.existsSync(targetApk) || fs.statSync(gradleDebugApk).mtimeMs > fs.statSync(targetApk).mtimeMs) {
            targetApk = gradleDebugApk;
          }
        }

        let stat: fs.Stats | null = null;
        if (fs.existsSync(targetApk)) {
          stat = fs.statSync(targetApk);
        }

        const formatSize = (bytes: number) => {
          if (!bytes) return '未知';
          return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        };

        const host = req.headers.host || 'localhost:5173';
        const proto = (req.headers['x-forwarded-proto'] as string) || (req.connection?.encrypted ? 'https' : 'http');

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          status: 'ok',
          latestVersion: '0.1.0',
          apkName: 'mantra-key-latest-debug.apk',
          fileSize: stat ? formatSize(stat.size) : '约 9 MB',
          updateTime: stat ? new Date(stat.mtimeMs).toLocaleString('zh-CN') : '已就绪',
          downloadUrl: `${proto}://${host}/releases/mantra-key-latest-debug.apk`,
        }));
      });
    }
  };
}

/**
 * 解析并生成配对密钥 (存放在 scratch/.agent-feedback-secret)
 */
function resolveAccessControl() {
  const projectRoot = path.resolve(__dirname, '../../..');
  const secretFile = path.resolve(projectRoot, 'scratch', '.agent-feedback-secret');
  let secret = process.env.AGENT_FEEDBACK_SECRET || '';

  if (!secret && fs.existsSync(secretFile)) {
    try {
      secret = fs.readFileSync(secretFile, 'utf8').trim();
    } catch {}
  }

  if (!secret) {
    secret = 'mk-' + crypto.randomBytes(4).toString('hex');
    try {
      if (!fs.existsSync(path.dirname(secretFile))) {
        fs.mkdirSync(path.dirname(secretFile), { recursive: true });
      }
      fs.writeFileSync(secretFile, secret, 'utf8');
    } catch {}
  }

  const keyHash = crypto.createHash('sha256').update(secret).digest('hex');
  return {
    enabled: true,
    keyHash,
    secret
  };
}

const accessControl = resolveAccessControl();

export default defineConfig(({ mode }) => {
  const isRelease = mode === 'release';

  return {
    base: './', // 关键：相对路径使得 file:///android_asset/ 能够无缝加载静态资产
    server: {
      host: true,
      port: 5174,
      allowedHosts: true
    },
    preview: {
      host: true,
      port: 5174,
      allowedHosts: true
    },
    plugins: [
      viteApkReleasePlugin(),
      !isRelease && agentFeedback({
        storageDir: path.resolve(__dirname, '../../..', 'scratch/feedback'),
        accessControl: {
          enabled: true,
          keyHash: accessControl.keyHash
        },
        sentinel: {
          autoStart: true,
          debounceSeconds: 10
        }
      })
    ].filter(Boolean),
    build: {
      outDir: path.resolve(__dirname, '../app/src/main/assets/web'),
      emptyOutDir: true,
      minify: isRelease ? 'esbuild' : false
    }
  };
});
