# 简历自动填充助手（Chrome MV3）

在折叠式表单中手动维护网申档案，可保存到本地或导入导出表单 JSON，并使用 AI 匹配填充当前招聘页面。插件不会自动提交表单。

## 使用

1. Chrome 打开 `chrome://extensions`，开启“开发者模式”并选择“加载已解压的扩展程序”。
2. 选择本目录，然后打开插件侧边栏。
3. 展开“手动填写网申资料”；教育、实习/工作、项目、干部、语言证书和获奖经历均可新增或删除多条。
4. 填写后保存；也可导出表单 JSON，供下次导入恢复。
5. 打开招聘网站的申请表单，点击“AI 匹配填充”。
6. 人工检查下拉框、日期、经历和必填项后自行提交。

更新代码后，需要在 `chrome://extensions` 中重新加载插件并刷新目标网页。

## 数据与边界

- 本地数据使用 `chrome.storage.local` 保存，导出文件为可读 JSON。
- 兼容导入本功能导出的表单 JSON，以及旧版结构化 `profile` JSON。
- 通过 `label`、`aria-label/aria-labelledby`、placeholder、name、id、所属模块和重复项序号识别字段，不绑定单一招聘站点。
- 支持原生输入/下拉/单选/日期，也支持常见 React、Vue 组件库的自定义下拉；写入后触发 `input`、`change`、`blur`，不会自动提交。
- AI 补充选择框时，会实时打开控件读取页面候选项；滚动式或惰性渲染的弹层会有限滚动采样候选。AI 优先返回原样候选；若简历值与页面候选只有唯一的包含式规范化匹配，客户端会规范化为该页面原始选项。对级联控件会在父项选中后再读取一次子项候选；候选缺失、歧义或低置信度时保持为空。
- 支持 Phoenix 月份选择器：按年份切换后选择月份；支持“添加经历”这类带 `_addButton` 标识的普通元素，不要求它必须是 `button`。
- 已有页面值默认保留；重复经历只补充缺少的行，不删除页面原有行。
- 当页面没有独立“实习经历”模块时，会按手动表单原顺序把实习和工作经历一起填入“工作经历”，避免实习条目被过滤掉。
- 表单位于 iframe 时，会轮询动态 frame，并优先选择包含招聘字段语义的 frame。
- 新站点若使用不同文案，只需在 `content.js` 的 `FIELD_ALIASES` 或 `SECTION_ALIASES` 增加同义词；特殊控件只在通用交互无法覆盖时再增加处理。
- 不处理验证码、登录、二次验证和封闭 Shadow DOM。

## AI 配置

需要 Node.js 18+。先启动本地代理：

```powershell
node .\resume-autofill\ai-proxy\server.js
```

在侧边栏填写 API Key、Base URL 和模型名，点击“保存配置并连接”。配置只保存在本机。

## 本地回归

```powershell
cd .\resume-autofill
python -m http.server 8765 --bind 127.0.0.1
```

分别打开：

- `http://127.0.0.1:8765/tests/mock-form.html?ui=native`
- `http://127.0.0.1:8765/tests/mock-form.html?ui=component`
- `http://127.0.0.1:8765/tests/mock-form.html?ui=phoenix`
- `http://127.0.0.1:8765/tests/mock-form.html?ui=phoenix-misleading`

四页均显示 `PASS` 即通过；用例覆盖已有值保护、地区防串填、日期、单选、原生/自定义/Phoenix 下拉、惰性候选、事件触发，以及工作、项目、干部、技能、语言、获奖的多条扩行。
