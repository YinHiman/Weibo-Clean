# 微博热搜 Clean（MVP）

极简、适配 iPhone Safari 的微博热搜网页。默认过滤娱乐、明星、体育类内容，尽量保留公共事件。

## 当前版本包含
- 极简移动端列表、分类筛选、手动刷新
- 本地保存屏蔽词 / 保留词
- Cloudflare Worker 代理接口，避免浏览器直接跨域请求微博
- 热搜来源失败时展示明确错误提示，不伪造实时数据
- 点击热搜跳转到微博搜索页

## 文件结构
- `public/index.html`：页面
- `public/styles.css`：样式
- `public/app.js`：前端逻辑和过滤器
- `src/worker.js`：Cloudflare Worker 数据接口
- `wrangler.toml`：部署配置

## 本地预览
用任意静态文件服务器打开 `public/index.html` 即可查看页面；但实时热搜需要部署 Worker，并配置前端 API 地址。

## 免费部署建议：Cloudflare Workers + Static Assets
Cloudflare Workers 免费计划当前有每日请求额度，具体限制请查看官方文档：
https://developers.cloudflare.com/workers/platform/limits/

### 部署步骤
1. 安装 Node.js LTS。
2. 在项目目录执行：
   ```bash
   npm install
   npx wrangler login
   npx wrangler deploy
   ```
3. 部署成功后会输出 `*.workers.dev` 地址。前端与 API 同域部署，无需额外配置。
4. Safari 打开该地址即可。

### 关于数据源
Worker 默认尝试访问微博公开热搜接口：
`https://weibo.com/ajax/side/hotSearch`
微博可能调整接口、限流或要求额外验证，因此接口可用性并不保证。若返回错误，网页会明确提示；不要把错误页面误认为热搜数据。
如果上游接口变动，请在 `src/worker.js` 的 `fetchWeiboHotSearch()` 中更新适配逻辑。

## 内容过滤说明
MVP 使用可解释的关键词规则，不调用付费 AI API：
- 过滤明星八卦、综艺、粉丝文化、体育赛事等
- 对涉及公共安全、违法犯罪、政策、公共事件等主题的标题优先保留
- 允许在页面设置里添加自定义屏蔽词和保留词
- 关键词过滤无法保证每条分类都准确，后续可加入更精细的分类器

## 隐私
自定义屏蔽词、保留词仅保存在当前浏览器的 localStorage。此版本不要求微博账号或 API Key。
