import asyncio
import http.server
import socketserver
import threading
import os
import time
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ASSETS_DIR = os.path.join(ROOT_DIR, "docs", "assets")
DIST_DIR = os.path.join(ROOT_DIR, "apps", "extension", ".output", "chrome-mv3")
PORT = 9993

os.makedirs(ASSETS_DIR, exist_ok=True)

class SilentHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIST_DIR, **kwargs)
    def log_message(self, format, *args):
        pass

def start_server():
    with socketserver.TCPServer(("", PORT), SilentHandler) as httpd:
        httpd.serve_forever()

t = threading.Thread(target=start_server, daemon=True)
t.start()

async def capture_all():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe'
        )

        # -----------------------------------------------------------------
        # 1. 扩展端主面板与各模态框截图 (Chrome MV3 Popup)
        # -----------------------------------------------------------------
        page = await browser.new_page(viewport={'width': 420, 'height': 630}, device_scale_factor=2)

        # 注入拟真且脱敏的本地扩展存储与运行时消息拦截
        await page.add_init_script("""
            const now = Date.now();
            const mockStorage = {
                'mantra_active_session': {
                    isUnlocked: true,
                    mantra: 'MySuperSecretMantra2026',
                    canary: 'EFA4500F',
                    expiresAt: now + 890000
                },
                'mantra_meta_github.com': {
                    displayName: 'GitHub 极速代码库',
                    updatedAt: now
                },
                'mantra_accs_github.com': [{
                    username: 'dev_engineer@github.com',
                    version: 1,
                    rulePreset: 'standard-16',
                    serviceKey: 'github.com',
                    displayName: 'GitHub 极速代码库',
                    tag: 'Work',
                    createdAt: now - 3600000,
                    updatedAt: now - 3600000
                }],
                'mantra_meta_三毛机场.com': {
                    displayName: '三毛机场专线',
                    updatedAt: now
                },
                'mantra_accs_三毛机场.com': [{
                    username: 'user_vip@gmail.com',
                    version: 1,
                    rulePreset: 'standard-16',
                    serviceKey: '三毛机场',
                    displayName: '三毛机场专线',
                    aliases: ['*.三毛机场.com', 'cleanip.io', 'sub.sanmao.net'],
                    tag: 'Proxy',
                    createdAt: now - 7200000,
                    updatedAt: now - 7200000
                }],
                'mantra_meta_dashboard.cpolar.com': {
                    displayName: 'Cpolar 内网穿透',
                    updatedAt: now
                },
                'mantra_accs_dashboard.cpolar.com': [{
                    username: 'developer@work.org',
                    version: 1,
                    rulePreset: 'standard-16',
                    serviceKey: 'cpolar',
                    displayName: 'Cpolar 内网穿透',
                    tag: 'Dev',
                    createdAt: now - 86400000,
                    updatedAt: now - 86400000
                }],
                'mantra_webdav_config': {
                    url: 'https://dav.jianguoyun.com/dav/mantra-key',
                    username: 'user@example.com',
                    password: 'masked_app_password',
                    remoteFilename: 'mantra_sync.mkey',
                    syncPassword: 'DemoSyncPassword2026',
                    lastSyncTime: now - 1800000
                }
            };

            window.chrome = {
                storage: {
                    local: {
                        get: (keys, cb) => {
                            if (!keys) return cb ? cb({ ...mockStorage }) : Promise.resolve({ ...mockStorage });
                            if (typeof keys === 'string') {
                                const res = { [keys]: mockStorage[keys] };
                                return cb ? cb(res) : Promise.resolve(res);
                            }
                            if (Array.isArray(keys)) {
                                const res = {};
                                keys.forEach(k => res[k] = mockStorage[k]);
                                return cb ? cb(res) : Promise.resolve(res);
                            }
                            return cb ? cb({ ...mockStorage }) : Promise.resolve({ ...mockStorage });
                        },
                        set: (items, cb) => {
                            Object.assign(mockStorage, items);
                            return cb ? cb() : Promise.resolve();
                        },
                        remove: (keys, cb) => {
                            const arr = Array.isArray(keys) ? keys : [keys];
                            arr.forEach(k => delete mockStorage[k]);
                            return cb ? cb() : Promise.resolve();
                        }
                    },
                    onChanged: { addListener: () => {} }
                },
                runtime: {
                    sendMessage: (msg, cb) => {
                        if (msg.action === 'GET_CURRENT_DOMAIN') {
                            const res = { domain: 'github.com', title: 'GitHub: Let’s build from here' };
                            return cb ? cb(res) : Promise.resolve(res);
                        }
                        if (msg.action === 'AUTOFILL_ACTIVE_TAB') {
                            return cb ? cb({ success: true }) : Promise.resolve({ success: true });
                        }
                        return cb ? cb({}) : Promise.resolve({});
                    }
                }
            };
        """)

        await page.goto(f'http://localhost:{PORT}/popup.html')
        await page.wait_for_timeout(600)

        # 模拟填充主面板账号与口令，触发完整派生状态与金丝雀指纹展示
        input_user = page.locator('#new-acc-user')
        if await input_user.count() > 0:
            await input_user.fill('dev_engineer@github.com')

        input_mantra = page.locator('#input-master-mantra')
        if await input_mantra.count() > 0:
            await input_mantra.fill('MySuperSecretMantra2026')
            await page.wait_for_timeout(300)

        # 1.1 主面板截图 extension_preview.png
        ext_preview_path = os.path.join(ASSETS_DIR, "extension_preview.png")
        await page.screenshot(path=ext_preview_path)
        print(f"[OK] 生成扩展主界面截图: {ext_preview_path}")

        # 1.2 点击 WebDAV 同步按钮，截取 webdav_sync.png
        btn_sync = page.locator('#btn-open-sync-modal')
        if await btn_sync.count() > 0:
            await btn_sync.click()
            await page.wait_for_timeout(300)

            # 点击 WebDAV 选项卡
            tab_webdav = page.locator('#tab-btn-webdav')
            if await tab_webdav.count() > 0:
                await tab_webdav.click()
                await page.wait_for_timeout(300)

            # 填充示范 WebDAV 地址、账号与独立加密密码
            await page.fill('#sync-input-url', 'https://dav.jianguoyun.com/dav/mantra-key')
            await page.fill('#sync-input-user', 'user@example.com')
            await page.fill('#sync-input-pass', '••••••••••••••••')
            await page.fill('#sync-input-sync-pass', '••••••••••••')
            await page.wait_for_timeout(200)

            webdav_preview_path = os.path.join(ASSETS_DIR, "webdav_sync.png")
            await page.screenshot(path=webdav_preview_path)
            print(f"[OK] 生成 WebDAV 界面截图: {webdav_preview_path}")

            # 关闭同步弹窗
            btn_close_sync = page.locator('#btn-close-sync-modal')
            if await btn_close_sync.count() > 0:
                await btn_close_sync.click()
                await page.wait_for_timeout(300)

        # 1.3 打开全站清单总览模态框，截取 manifest_preview.png
        btn_manifest = page.locator('#btn-open-all-manifest')
        if await btn_manifest.count() > 0:
            await btn_manifest.click()
            await page.wait_for_timeout(500)
            manifest_preview_path = os.path.join(ASSETS_DIR, "manifest_preview.png")
            await page.screenshot(path=manifest_preview_path)
            print(f"[OK] 生成清单总览界面截图: {manifest_preview_path}")

        # -----------------------------------------------------------------
        # 2. Android 移动端界面截图 (http://localhost:5174/)
        # -----------------------------------------------------------------
        android_preview_path = os.path.join(ASSETS_DIR, "android_preview.jpg")
        try:
            android_page = await browser.new_page(viewport={'width': 412, 'height': 892}, device_scale_factor=2)
            await android_page.add_init_script("""
                localStorage.setItem('mk_onboarding_guided', 'true');
                localStorage.setItem('mantra_webdav_config', JSON.stringify({
                    serverUrl: 'https://dav.jianguoyun.com/dav/mantra-key',
                    username: 'user@example.com',
                    password: 'masked_password',
                    remoteFilename: 'mantra_sync.mkey'
                }));
                localStorage.setItem('mantra_webdav_sync_info', JSON.stringify({
                    lastSyncTime: Date.now() - 3600000,
                    status: 'success',
                    mergedCount: 3
                }));
                localStorage.setItem('mantra_webdav_rules_manifest', JSON.stringify({
                    version: 1,
                    updatedAt: Date.now() - 3600000,
                    rules: [
                        { domain: 'github.com', accounts: [{ username: 'dev_engineer@github.com', version: 1, rule: 'standard-16' }] },
                        { domain: '三毛机场.com', displayName: '三毛机场专线', accounts: [{ username: 'user_vip@gmail.com', version: 1, rule: 'standard-16' }] },
                        { domain: 'dashboard.cpolar.com', displayName: 'Cpolar 内网穿透', accounts: [{ username: 'developer@work.org', version: 1, rule: 'standard-16' }] }
                    ]
                }));
            """)
            await android_page.goto('http://localhost:5174/', timeout=6000)
            await android_page.wait_for_timeout(600)

            await android_page.wait_for_timeout(1200)

            # 移除引导浮层与开发反馈悬浮组件，呈现纯净官方应用界面
            await android_page.evaluate("""() => {
                document.getElementById('onboarding-overlay')?.remove();
                document.getElementById('ai-feedback-trigger')?.remove();
                document.querySelector('agent-feedback-widget')?.remove();
            }""")

            # 模拟在 Android 端输入口令与域名，触发实时密码计算
            input_m = android_page.locator('#input-mantra')
            if await input_m.count() > 0:
                await input_m.fill('MySuperSecretMantra2026')

            input_d = android_page.locator('#input-domain')
            if await input_d.count() > 0:
                await input_d.fill('github.com')

            await android_page.wait_for_timeout(400)

            # 存为高质量 JPEG
            await android_page.screenshot(path=android_preview_path, type='jpeg', quality=92)
            print(f"[OK] 生成 Android 移动端截图: {android_preview_path}")
        except Exception as e:
            print(f"[Warn] 捕获 Android 页面异常: {e}")

        await browser.close()

    # -----------------------------------------------------------------
    # 3. 动态合成全新多端全景展示图 (docs/assets/hero_showcase.png)
    # -----------------------------------------------------------------
    compose_hero_showcase(
        ext_preview_path,
        manifest_preview_path,
        android_preview_path,
        os.path.join(ASSETS_DIR, "hero_showcase.png")
    )

def compose_hero_showcase(ext_img_path, manifest_img_path, android_img_path, output_path):
    print("正在合成全新 docs/assets/hero_showcase.png 多端全景展示图...")
    W, H = 1360, 760
    # 现代 Obsidian 深黑渐变背景
    bg = Image.new("RGB", (W, H), (11, 15, 23))

    draw = ImageDraw.Draw(bg)
    draw.rectangle([0, 0, W, H], fill=(13, 17, 26))

    try:
        im_android = Image.open(android_img_path).convert("RGBA")
        im_ext = Image.open(ext_img_path).convert("RGBA")
        im_manifest = Image.open(manifest_img_path).convert("RGBA")

        # 调整尺寸
        ratio_a = 660 / im_android.height
        new_w_a = int(im_android.width * ratio_a)
        im_android_resized = im_android.resize((new_w_a, 660), Image.Resampling.LANCZOS)

        ratio_e = 600 / im_ext.height
        new_w_e = int(im_ext.width * ratio_e)
        im_ext_resized = im_ext.resize((new_w_e, 600), Image.Resampling.LANCZOS)

        ratio_m = 600 / im_manifest.height
        new_w_m = int(im_manifest.width * ratio_m)
        im_manifest_resized = im_manifest.resize((new_w_m, 600), Image.Resampling.LANCZOS)

        def paste_with_shadow(base_img, overlay, x, y, radius=16):
            mask = Image.new('L', overlay.size, 0)
            mask_draw = ImageDraw.Draw(mask)
            mask_draw.rounded_rectangle([(0, 0), overlay.size], radius=radius, fill=255)

            border_overlay = overlay.copy()
            border_draw = ImageDraw.Draw(border_overlay)
            border_draw.rounded_rectangle([(0, 0), (overlay.size[0]-1, overlay.size[1]-1)], radius=radius, outline=(45, 55, 72, 180), width=2)

            base_img.paste(border_overlay, (x, y), mask)

        # 1. 左侧：Android 手机界面 (x = 60, y = 50)
        paste_with_shadow(bg, im_android_resized, 60, 50, radius=24)

        # 2. 中间：Chrome MV3 扩展主面板
        x_ext = 60 + new_w_a + 40
        paste_with_shadow(bg, im_ext_resized, x_ext, 80, radius=18)

        # 3. 右侧：全部已存站点与账号清单
        x_man = x_ext + new_w_e + 30
        paste_with_shadow(bg, im_manifest_resized, x_man, 80, radius=18)

        bg.save(output_path, "PNG", optimize=True)
        print(f"[OK] 全新多端全景图合成完毕: {output_path} ({W}x{H})")
    except Exception as e:
        print(f"[Warn] 合成全景图失败: {e}")

if __name__ == '__main__':
    asyncio.run(capture_all())
