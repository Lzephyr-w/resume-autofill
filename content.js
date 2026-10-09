(() => {
  const CONTENT_PROTOCOL = 100;
  if ((globalThis.__resumeAutofillContentProtocol || 0) > CONTENT_PROTOCOL) return;
  if (globalThis.__resumeAutofillContentListener) globalThis.chrome?.runtime?.onMessage?.removeListener(globalThis.__resumeAutofillContentListener);
  globalThis.__resumeAutofillContentProtocol = CONTENT_PROTOCOL;
  document.getElementById("resume-autofill-page-action")?.setAttribute("data-content-build", "100-virtual-city-committed-input");
  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const visible = (el) => {
    if (!el || getComputedStyle(el).visibility === "hidden") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const captchaBlocking = () => [...document.querySelectorAll('iframe[src*="captcha"]')].some(el => {
    if (!visible(el)) return false;
    const rect = el.getBoundingClientRect();
    if (rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth) return false;
    for (let node = el; node; node = node.parentElement) if (Number(getComputedStyle(node).opacity) === 0 || getComputedStyle(node).display === "none") return false;
    return true;
  });
  const uploadControl = (el) => {
    if (!el) return false;
    if (el.matches?.('input[type=file]')) return true;
    const label = el.closest?.('label[for]');
    if (label && document.getElementById(label.htmlFor)?.type === 'file') return true;
    for (let node = el; node && node !== document.body; node = node.parentElement) {
      if (node.querySelector('input[type=file]') && (/(?:^|[\s_-])(?:upload|uploader)(?:$|[\s_-])/i.test(String(node.className || ''))
        || !node.querySelector('input:not([type=file]):not([type=hidden]), textarea, select, [role=combobox], [role=radio], [role=checkbox], [aria-haspopup], [contenteditable=true]'))) return true;
      if (node.matches('form, fieldset, section')) break;
    }
    return /^(?:上传|添加|选择|新增|upload|choose|select).*(?:文件|附件|照片|图片|file|attachment|photo)/i.test(clean(el.getAttribute?.('aria-label') || el.textContent)) && clean(el.textContent).length < 80;
  };
  const editable = (el) => {
    if (!el || uploadControl(el)) return false;
    const choice = el.type === "radio" || el.type === "checkbox" || el.getAttribute("role") === "radio" || el.getAttribute("role") === "checkbox" || el.matches(".phoenix-radio-group");
    const customPicker = el.getAttribute("role") === "combobox" || el.hasAttribute("aria-haspopup") || /select|cascader|calendar|date|area/i.test(String(el.className || "")) || (el.readOnly || el.tagName === "BUTTON") && !!choiceRoot(el);
    const linkedLabel = el.id && [...document.querySelectorAll(`label[for="${CSS.escape(el.id)}"]`)].some(visible) || !!el.closest("label");
    const readonlySemantic = el.readOnly && /家庭|籍贯|居住|户籍|地区|日期|时间|省|市/.test(String(el.getAttribute("aria-label") || el.placeholder || el.name || el.id || el.parentElement?.innerText || ""));
    const blockedType = ["hidden", "file", "submit", "reset", "image"].includes(el.type) || el.type === "button" && !customPicker;
    const excluded = el.closest("[inert], [aria-hidden=true], nav, [role=search], [role=navigation], [role=listbox], [role=menu], [class*='select-popup'], [class*='select__dropdown'], [data-resume-autofill-ui]")
      || el.closest("[class*='chatbot' i], [class*='chat-widget' i], [class*='chat-composer' i]")
      || el.type === "password" || el.type === "search" && el.getAttribute("role") !== "combobox" && !el.hasAttribute("aria-haspopup") || /one-time-code|password/.test(el.autocomplete || "")
      || /^(?:搜索|search|验证码|短信验证码|登录|login)(?:\b|$|职位|岗位|关键词)/i.test(clean(el.getAttribute("aria-label") || el.placeholder || el.name));
    return !excluded && (visible(el) || (choice && linkedLabel)) && !el.disabled && !el.matches(".phoenix-radio-group--disabled") && el.getAttribute("aria-disabled") !== "true" && (!el.readOnly || customPicker || readonlySemantic) && !blockedType;
  };
  const controlSelector = "input, textarea, select, [role=combobox], [role=radio], [role=checkbox], .phoenix-radio-group:not(:has(input, [role=radio])), [contenteditable='true'], [aria-haspopup], .mtd-select-filter [role=button]:not(:has(input)), [tabindex='0'][class*='select'], [tabindex='0'][class*='Select'], .phoenix-select:not(:has(input)):has([class*='select__tag'])";
  let schemaControls = null;
  const fields = () => schemaControls || [...document.querySelectorAll(controlSelector)]
    .filter(editable)
    .filter((el) => el.matches("input, textarea, select, [role], [aria-haspopup], [contenteditable='true']") || ![...el.querySelectorAll(controlSelector)].some(editable))
    .filter((el, index, all) => all.indexOf(el) === index);
  const normalize = (value) => clean(value).toLowerCase().replace(/[：:（）()\[\]【】／\/\s_-]/g, "");
  const salaryRange = (value) => {
    const text = clean(value).toLowerCase().replace(/\b\d{1,3}(?:[,，]\d{3})+(?!\d)/g, amount => amount.replace(/[,，]/g, ""));
    if (!text || /面议|保密|[,，]/.test(text) || /^[-−]/.test(text)) return null;
    const found = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(万|w|k|千)?/g)];
    const sharedUnit = found.length > 1 && found.filter((match) => match[2]).length === 1 ? found.find((match) => match[2])?.[2] : "";
    const amounts = found.map(([, number, unit]) => Number(number) * (/万|w/.test(unit || sharedUnit) ? 10000 : /k|千/.test(unit || sharedUnit) ? 1000 : 1));
    if (!amounts.length || amounts.some((amount) => !Number.isFinite(amount))) return null;
    if (amounts.length === 1) {
      if (/[<＜]/.test(text)) return [0, amounts[0] - 0.01];
      if (/[>＞]/.test(text)) return [amounts[0] + 0.01, Infinity];
      if (/≤/.test(text)) return [0, amounts[0]];
      if (/≥/.test(text)) return [amounts[0], Infinity];
      if (/以下|以内|不超过|及以下/.test(text)) return [0, amounts[0]];
      if (/以上|起|及以上/.test(text)) return [amounts[0], Infinity];
      return [amounts[0], amounts[0]];
    }
    return [Math.min(...amounts), Math.max(...amounts)];
  };
  const salaryOption = (value, candidates) => {
    const wanted = salaryRange(value);
    if (!wanted || !Number.isFinite(wanted[1])) return null;
    const scored = candidates.map((candidate) => {
      const range = salaryRange(candidate.textContent || candidate);
      const overlap = range && Math.max(0, Math.min(range[1], wanted[1]) - Math.max(range[0], wanted[0]));
      const score = range && wanted[0] === wanted[1] ? Number(range[0] <= wanted[0] && wanted[0] <= range[1])
        : overlap / Math.max(1, wanted[1] - wanted[0]);
      return { candidate, score };
    }).sort((a, b) => b.score - a.score);
    return scored[0]?.score >= 0.9 && scored[0].score > (scored[1]?.score || 0) + 0.1 ? scored[0].candidate : null;
  };
  const proficiencyLevel = (value) => {
    const text = normalize(value);
    if (/^完全专业水平/.test(text)) return 4;
    if (/^专业工作水平/.test(text)) return 3;
    if (/^工作水平/.test(text)) return 2;
    if (/^(?:有限工作水平|初级水平)/.test(text)) return 1;
    if (/精通|专家|高级|无障碍沟通/.test(text)) return 4;
    if (/熟练|熟悉|掌握|商务会话/.test(text)) return 3;
    if (/一般|中等|中级|日常会话/.test(text)) return 2;
    if (/了解|入门|初级/.test(text)) return 1;
    return 0;
  };
  const proficiencyOption = (value, candidates, label) => {
    if (!/掌握程度|熟练程度|精通程度|技能等级|语言水平|等级自评|听说|读写/.test(label)) return null;
    const exact = candidates.find(candidate => normalize(candidate.textContent || candidate) === normalize(value));
    if (exact) return exact;
    const level = proficiencyLevel(value);
    const workingLevels = ["", "初级水平", "工作水平", "专业工作水平", "完全专业水平"];
    if (level && candidates.filter(candidate => workingLevels.slice(1).some(title => clean(candidate.textContent || candidate).startsWith(title))).length >= 3)
      return candidates.find(candidate => clean(candidate.textContent || candidate).startsWith(workingLevels[level])) || null;
    const languageLevels = ["", "入门", "日常会话", "商务会话", "无障碍沟通", "母语"];
    const languageOptions = candidates.filter((candidate) => languageLevels.includes(clean(candidate.textContent || candidate)));
    const language = level && languageOptions.length >= 3 && languageOptions.find((candidate) => clean(candidate.textContent || candidate) === languageLevels[level]);
    if (language) return language;
    const standard = ["", "了解", "掌握", "熟练", "精通"];
    if (level && candidates.filter(candidate => standard.includes(clean(candidate.textContent || candidate))).length >= 3)
      return candidates.find(candidate => clean(candidate.textContent || candidate) === standard[level]) || null;
    const matches = level && candidates.filter((candidate) => proficiencyLevel(candidate.textContent || candidate) === level);
    return matches?.length === 1 ? matches[0] : null;
  };
  const pad2 = (value) => (`0${value ?? ""}`).slice(-2);
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (read, timeout = 1000) => {
    const end = Date.now() + timeout;
    let value;
    while (!(value = read()) && Date.now() < end) await wait(40);
    return value || read();
  };

  function documentRoot() {
    const roots = [...document.querySelectorAll("[contenteditable='true'], article, main")].filter(visible);
    return roots.sort((a, b) => (b.innerText || b.textContent || "").length - (a.innerText || a.textContent || "").length)[0] || document.body;
  }
  const pageText = (root) => {
    if (!root) return "";
    const copy = root.cloneNode(true);
    copy.querySelectorAll("script, style, noscript, template, nav, header, footer, aside, [aria-hidden='true'], [role='navigation'], [role='banner'], [role='contentinfo']").forEach((node) => node.remove());
    return copy.innerText || copy.textContent || "";
  };
  const pageNoise = /To pick up a draggable item|While dragging, use the arrow keys|Press space again to drop|window\._(?:SSR|ROUTER)_DATA|namedChunks|今天有什么工作要处理|云电脑|创建新项目|Ctrl\s*J/;
  const stripDocumentChrome = (value) => String(value || "")
    .replace(/添加图标|添加封面|表单填写[！!]?/g, "")
    .replace(/[\u4e00-\u9fa5]{2,8}\s*(?:今天|昨天|\d+\s*小时前)\s*修改/g, "");
  const documentLines = (value) => String(value || "")
    .split(/[\r\n\u200b\u200c\u200d\u2060\u2028\u2029]+|(?<=[。！？；])\s+/)
    .map((line) => clean(stripDocumentChrome(line)))
    .filter((line) => line && !pageNoise.test(line));
  const mergeDocumentChunks = (chunks) => {
    const lines = [];
    for (const chunk of chunks) {
      const next = documentLines(chunk);
      let overlap = Math.min(lines.length, next.length);
      while (overlap && next.slice(0, overlap).some((line, index) => line !== lines[lines.length - overlap + index])) overlap--;
      lines.push(...next.slice(overlap));
    }
    return lines.join("\n");
  };
  async function readDocumentText() {
    const root = documentRoot();
    const page = document.scrollingElement;
    const ancestors = [];
    for (let node = root; node; node = node.parentElement) ancestors.push(node);
    const candidates = [...new Set([page, ...ancestors])].filter((el) => el && el.scrollHeight > el.clientHeight + 80 && el.clientHeight > 120);
    const target = candidates[0] || page;
    const original = target === page ? window.scrollY : target.scrollTop;
    const max = Math.max(0, target.scrollHeight - target.clientHeight);
    const step = Math.max(240, Math.floor(target.clientHeight * 0.8));
    const chunks = [];
    for (let position = 0; position <= max; position += step) {
      if (target === page) window.scrollTo(0, position); else target.scrollTop = position;
      await wait(80);
      chunks.push(pageText(documentRoot()));
    }
    if (target === page) window.scrollTo(0, original); else target.scrollTop = original;
    return mergeDocumentChunks(chunks);
  }
  console.assert(mergeDocumentChunks(["职责：\n负责开发\n亮点：", "亮点：\n1. 优化性能\n职责："]) === "职责：\n负责开发\n亮点：\n1. 优化性能\n职责：");

  const fieldLabelSelector = ".label, .form-item__title, .form-item__label, .formItem__label, .form-label, .field-label, legend, [class*='field-label'], [class*='field-item-label'], [class*='formily-item-label'], [class*='form-item-label'], [class*='form-item__label'], [class*='formItemLabel'], [class*='formItem__label'], [class^='title-'], [class*=' title-']";
  const fieldContainer = (el) => {
    const explicit = el?.closest(".form-item, .form-group, .field, fieldset, [data-field]");
    if (explicit) return explicit;
    for (let node = el?.parentElement, depth = 0; node && depth < 12; node = node.parentElement, depth++) {
      const fieldWrapper = node.matches?.(".form-row, [class*='form-item'], [class*='formItem'], [class*='formily-item'], [class*='field-item'], [class*='fieldItem'], [class*='apply-field'], [class*='control-group'], [class*='field-control-type-'], [class$='-field'], [class*='-field ']");
      // Keep anonymous caption lookup local; a whole-module search can claim a sibling field.
      if (!fieldWrapper && depth > 3) continue;
      const captions = [...node.querySelectorAll(`${fieldLabelSelector}, label`)].filter((label) => clean(label.textContent) && !label.contains(el) && !label.querySelector(controlSelector));
      if (!captions.length) continue;
      if (fieldWrapper
        || captions.length === 1 && [...node.querySelectorAll(controlSelector)].filter(editable).filter((control) => ![...control.querySelectorAll(controlSelector)].some(editable)).length === 1) return node;
    }
    return el?.parentElement;
  };
  const atsxSearchInput = (el) => el?.closest?.(".atsx-select-combobox")?.querySelector("input.atsx-select-search__field:not([type=hidden])") || el;
  const labelCaption = (node) => {
    if (!node) return "";
    const copy = node.cloneNode(true);
    copy.querySelectorAll("input, select, textarea, [role=combobox], [role=listbox], [contenteditable=true]").forEach((control) => control.remove());
    return clean(copy.textContent);
  };
  const associatedLabels = (el) => {
    const ids = clean(el?.getAttribute?.("aria-labelledby")).split(" ").filter(Boolean);
    const nodes = [...(el?.labels || []), ...ids.map((id) => document.getElementById(id)).filter(Boolean)];
    if (el?.id) nodes.push(...document.querySelectorAll(`label[for="${CSS.escape(el.id)}"]`));
    const wrapped = el?.closest?.("label");
    if (wrapped) nodes.push(wrapped);
    return [...new Set(nodes)].map(labelCaption).filter(Boolean);
  };
  const fieldTitle = (el) => {
    const box = fieldContainer(el);
    const label = [...(box?.querySelectorAll(`${fieldLabelSelector}, label`) || [])]
      .find((node) => labelCaption(node) && !node.contains(el) && !node.querySelector(controlSelector));
    const groupedChoice = ["radio", "checkbox"].includes(el?.type) || ["radio", "checkbox"].includes(el?.getAttribute?.("role")) || el?.matches?.(".phoenix-radio-group");
    if (groupedChoice && box?.querySelectorAll("input[type=radio], input[type=checkbox], [role=radio], [role=checkbox]").length > 1 && label) return clean(label.innerText || label.textContent || "");
    if ((el?.type === "checkbox" || el?.getAttribute?.("role") === "checkbox") && associatedLabels(el)[0]) return associatedLabels(el)[0];
    // A selector's wrapping <label> contains its selected value, not its field caption.
    if (label) {
      const caption = labelCaption(label);
      if (/时间|日期/.test(caption) && /^(?:请选择|请输入)?(?:开始|结束)(?:日期|时间|月)$/.test(el?.placeholder || "")) return el.placeholder.replace(/^(?:请选择|请输入)/, "").replace(/月$/, "时间");
      if (/证件|身份证/.test(caption)) {
        const hint = clean(choiceRoot(el)?.querySelector("[class*=hint], [class*=placeholder]")?.textContent);
        if (/证件类型/.test(hint)) return "证件类型";
      }
      if (/证件|身份证|个人证件|手机|电话|外语类型|语言(?:类型|类别)|外语类别|英语等级|语言考试/.test(caption)) {
        const controls = [...box.querySelectorAll("input, select, textarea, [role=combobox]")].filter(visible)
          .filter(control => !control.querySelector("input, select, textarea, [role=combobox]"));
        if (controls.length === 2) {
          // Search inputs inside selectors are choices too, even though their
          // writing path uses autocomplete rather than isChoiceControl.
          const choices = controls.filter(control => isChoiceControl(control) || isAutocompleteControl(control));
          if (/外语类型|语言(?:类型|类别)|外语类别/.test(caption) && choices.length === 2) return controls[0] === el ? "语言类型" : "语言考试";
          const choice = choices.length === 1 ? choices[0] : null;
          const text = controls.find((control) => control !== choice && !control.readOnly);
          if (choice && text) return /英语等级|语言考试/.test(caption) ? choice === el ? "语言考试" : "考试分数"
            : /证件|身份证|个人证件/.test(caption) ? choice === el ? "证件类型" : "证件号码" : choice === el ? "电话区号" : "手机号码";
        }
      }
      return caption;
    }
    const associated = associatedLabels(el).find((text) => text.length <= 100);
    if (associated) return associated;
    if (el?.tagName === "TEXTAREA") {
      const scope = sectionScope(el), title = clean(scope?.querySelector("[class*='divider-title'], .section-title, [role=heading], h2, h3")?.textContent);
      if (/^(?:自我评价|个人评价|自我描述)$/.test(title) && scope.querySelectorAll("textarea").length === 1) return title;
    }
    return /^(?:请输入|请填写|请选择)(?:证件号码|证件类型)/.test(el?.placeholder || "") ? el.placeholder.replace(/^(?:请输入|请填写|请选择)/, "") : labelCaption(label);
  };
  const semanticText = (el) => clean([fieldTitle(el), el.getAttribute("aria-label"), el.getAttribute("placeholder"), el.name, el.id, el.getAttribute("data-label"), el.getAttribute("title"), labelCaption(el.parentElement?.querySelector("label"))].filter(Boolean).join(" "));
  const anchorMatch = (el, anchor) => {
    if (el.matches('input[type=checkbox], input[type=radio], [role=checkbox], [role=radio]')) return false;
    const wanted = [anchor, ...(typeof FIELD_ALIASES !== "undefined" ? (FIELD_ALIASES[anchor] || []) : [])].map(normalize);
    if (anchor === "学校名称" && /GPA|绩点|就读地|学校所在地|(?:学校|院校)(?:所在)?城市|导师|专业|学院|院系/i.test(fieldTitle(el))) return false;
    const identity = anchor === "语言类型" || ["掌握程度", "听说", "读写"].includes(anchor)
      ? `${el.name || ""} ${el.id || ""}`.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().match(/[a-z]+|\d+/g) || [] : [];
    const languageCategoryIdentity = ["language", "languages"].includes(identity.at(-1)) || ["language type", "language name"].includes(identity.slice(-2).join(" "));
    const technicalLanguageIdentity = /(?:technical|programming|program|development) languages?(?:\s+\d+)?$/.test(identity.join(" "));
    if (anchor === "语言类型" && (technicalLanguageIdentity || /(?:技术开发|编程|开发)语言|program(?:ming)?\s*language|technical\s*language|语言考试|语言水平|外语等级|英语等级|考试分数|proficiency|(?:languages?)[_-]?(?:rank|level)|speaking|reading|writing|listening|exam|score/i.test(`${fieldTitle(el)} ${el.getAttribute("aria-label")} ${el.getAttribute("placeholder")} ${el.name} ${el.id}`))) return false;
    if (anchor === "语言类型" && languageCategoryIdentity) return true;
    if (["掌握程度", "听说", "读写"].includes(anchor) && languageCategoryIdentity) return false;
    if (anchor === "语言类型" && /掌握程度|熟练程度|精通程度|听说|读写/.test(fieldTitle(el))) return false;
    if (anchor === "证书名称" && /描述|说明|成绩|分数|时间|日期|其[它他]语言/.test(fieldTitle(el))) return false;
    if (/^(?:获奖项|奖项名称)$/.test(anchor) && /类型|类别|描述|说明|时间|日期|级别|等级/.test(fieldTitle(el))) return false;
    if (!/学号/.test(anchor) && /学号/.test(fieldTitle(el))) return false;
    if (anchor === "GPA" && /类型|总分|满分|满绩|制式|GPA[-\s_]*BASE/i.test(fieldTitle(el))) return false;
    const text = normalize(fieldTitle(el) || `${semanticText(el)} ${labelText(el)}`);
    return wanted.some((value) => value && text.includes(value));
  };
  const sectionScope = (el) => {
    const explicit = el?.closest("[data-nav-id]") || el?.closest("[role=region], section, article, fieldset, [class*='apply-block-'], [class*='section'], [class*='module'], [class*='model_edit'], [class*='resume-block'], [class*='block']");
    if (explicit) return explicit;
    for (let node = el?.parentElement, depth = 0; node && depth < 24; node = node.parentElement, depth++)
      if ([...node.children].some(child => !child.querySelector(controlSelector) && (child.matches("[class*='divider-title']") || child.querySelector("[class*='divider-title']")))) return node;
    return null;
  };
  const sectionTitle = (el) => {
    const ownTitle = clean(fieldTitle(el));
    const scope = sectionScope(el);
    const heading = [...(scope?.querySelectorAll(".blockTitle, .section-title, .form-title, .ihr_recruit_resume_title_main, .ihr_recruit_resume_title, h1, h2, h3, h4, h5, h6, legend, [role=heading], [class*='blockTitle'], [class*='section-title'], [class*='model_title'], [class*='divider-title']") || [])]
      .filter((node) => !node.contains(el) || !node.querySelector(controlSelector)).map((node) => { const copy = node.cloneNode(true); copy.querySelectorAll("[class*=tip], [class*=hint], [class*=description], .ihr_recruit_resume_title_main-action_button, small").forEach(child => child.remove()); return clean(copy.textContent); }).find((text) => text && text.length <= 80);
    if (heading) return heading;
    // Form libraries may put the module heading beside the entire form body.
    for (let node = el, depth = 0; node && depth < 24; node = node.parentElement, depth++) {
      const sibling = node.previousElementSibling;
      const text = clean(sibling?.innerText || sibling?.textContent);
      if (sibling && !sibling.matches(`${fieldLabelSelector}, label`) && !sibling.querySelector(controlSelector) && text.length <= 80
        && (hasKnownSection(text) || /基本信息|个人信息|求职意向|实践经历|资料证明人/.test(text))) return text;
    }
    // Fallback for component libraries that render headings as plain div text.
    for (let node = el?.parentElement, depth = 0; node && depth < 8; node = node.parentElement, depth++) {
      const branch = [...node.children].find((child) => child === el || child.contains(el));
      const candidate = [...node.children].filter((child) => child !== branch && !child.matches(`${fieldLabelSelector}, label`) && (child.compareDocumentPosition(branch) & Node.DOCUMENT_POSITION_FOLLOWING)
        && !child.querySelector(`${controlSelector}, button, a, h1, h2, h3, h4, h5, h6, [role=heading]`)).map((child) => clean(child.innerText || child.textContent))
        .find((text) => text && text !== ownTitle && text.length <= 80 && (hasKnownSection(text) || /基本信息|基本资料|个人信息|求职意向|实践经历|资料证明人|自我描述/.test(text)));
      if (candidate) return candidate;
    }
    const previous = [...document.querySelectorAll("h1, h2, h3, h4, h5, h6, legend, [role=heading], .blockTitle, .section-title, .form-title, [class*='blockTitle'], [class*='section-title'], [class*='model_title']")]
      .filter((node) => clean(node.innerText || node.textContent).length <= 80)
      .filter((node) => node.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING).at(-1);
    return clean(previous?.innerText || previous?.textContent || "");
  };
  const SECTION_ALIASES = {
    "教育背景": ["教育经历", "教育背景", "学历经历"],
    "教育经历": ["教育背景", "教育经历", "学历经历"],
    "工作经历": ["工作经验", "工作经历", "任职经历", "工作/实习经历", "工作与实习经历", "工作及实习经历"],
    "实习经历": ["实习经验", "实习经历"],
    "学生干部经历": ["学生干部经历", "干部经历", "校园经历", "社团经历", "在校实践", "校内实践"],
    "项目经验": ["项目经历", "项目经验", "项目经验"],
    "项目经历": ["项目经验", "项目经历"],
    "技能": ["技能", "专业技能", "技能特长", "计算机能力"],
    "证书": ["证书", "资格证书", "证书信息"],
    "英语能力": ["英语能力", "英语证书", "英语水平", "英语考试"],
    "获奖经历": ["获奖", "获奖情况", "获奖经历", "竞赛/获奖经历", "竞赛获奖", "竞赛经历", "竞赛", "大赛经历", "大赛/获奖经历", "奖励与荣誉", "奖励荣誉", "荣誉"],
    "竞赛": ["竞赛", "大赛", "比赛"],
    "荣誉": ["荣誉", "奖励", "奖学金"],
    "语言能力": ["语言技能", "语言能力", "语言水平", "外语能力", "其他外语能力", "其它外语能力", "语言类别", "外语类别", "语言证书"],
    "个人评价": ["个人评价", "自我评价", "自我描述"],
    "学生干部经历": ["学生干部经历", "干部经历", "校园经历", "社团经历", "在校实践", "校内实践"]
  };
  const awardModule = title => /竞赛|大赛|比赛/.test(title) ? /荣誉|奖励|奖学金|评奖|评优|表彰/.test(title) ? "获奖经历" : "竞赛"
    : /荣誉|奖励|奖学金|评奖|评优|表彰/.test(title) ? "荣誉" : "获奖经历";
  const hasKnownSection = (title) => {
    const value = normalize(title);
    return /基本信息|基本资料|个人信息|求职意向|应聘信息|实践经历|资料证明人/.test(value)
      || Object.entries(SECTION_ALIASES).some(([name, aliases]) => [name, ...aliases].map(normalize).some((item) => item && value.includes(item)));
  };
  const languageCategoryButton = (el) => /^[+＋]?(?:添加|新增)\s*(?:外语|语言)\s*(?:类别|类型|语种)$/.test(normalize(el?.innerText || el?.textContent));
  const languageCategoryScope = (el) => {
    for (let node = el; node && node !== document.body; node = node.parentElement) {
      if ([...node.querySelectorAll("button, a, [role=button]")].some(languageCategoryButton)
        && [...node.children].some(child => /^(?:外语|语言)(?:类别|类型|语种)$/.test(normalize(child.innerText || child.textContent)))) return node;
    }
    return null;
  };
  const combinedExperience = (title) => /工作\s*(?:[\/／、]|与|及|和)\s*实习|实习\s*(?:[\/／、]|与|及|和)\s*工作/.test(title || "");
  const moduleTitles = () => [...new Set([...fields().map(sectionTitle), ...document.querySelectorAll("h1, h2, h3, h4, legend, [role=heading], [class*='title'], [class*='Title'], div, span")]
    .map((node) => typeof node === "string" ? node : !node.matches(`${fieldLabelSelector}, label`) && !node.querySelector(controlSelector) ? clean(node.textContent) : "")
    .filter((text) => text && text.length <= 40 && hasKnownSection(text) && !/名称|类型|分数|获得时间|添加.*删除|新增.*删除|^请|^建议/.test(text))
    .map((text) => text.replace(/^(?:添加|新增)\s*/, "")))];
  // Unknown section markup must not make an otherwise valid field invisible.
  // A semantic section hint is a preference, not a selector contract.
  const inSection = (el, section) => {
    if (!section) return true;
    if (section === "实习经历" && combinedExperience(sectionTitle(el))) return false;
    if ((section === "语言能力" || (SECTION_ALIASES["语言能力"] || []).some(alias => normalize(alias) === normalize(section)))
      && anchorMatch(el, "语言类型") && (languageCategoryScope(el)
        || section === "语言能力" && [...(sectionScope(el)?.querySelectorAll("button, a, [role=button]") || [])].some(languageCategoryButton))) return true;
    const title = normalize(sectionTitle(el));
    if (!title) return !["竞赛", "荣誉"].includes(section);
    if (["获奖经历", "竞赛", "荣誉"].includes(section) && awardModule(title) !== section) return false;
    if (section === "证书" && /英语能力|英语证书|英语考试/.test(title)) return false;
    return [section, ...(SECTION_ALIASES[section] || [])].map(normalize).some((value) => title.includes(value));
  };
  const repeatedContainer = (el, anchor, section = "") => {
    const arrayRow = el?.closest?.("[class*='array-card'], [class*='array-item']");
    if (arrayRow) return arrayRow;
    const atsxRow = el?.closest?.(".resumeEditForm-item");
    if (atsxRow) return atsxRow;
    const formRow = el?.closest?.("form");
    const formControls = formRow ? [...formRow.querySelectorAll(controlSelector)].filter(editable) : [];
    const rowSection = section || sectionTitle(el);
    if (formRow && formControls.filter(control => anchorMatch(control, anchor)).length === 1
      && !formControls.some(control => hasKnownSection(sectionTitle(control)) && !inSection(control, rowSection))) return formRow;
    const componentRow = el?.closest?.("div.form[id]");
    if (componentRow) return componentRow;
    // This walk is synchronous: collect candidates once, then test ownership.
    const candidates = [...document.querySelectorAll(controlSelector)].filter(editable);
    const matching = candidates.filter(control => anchorMatch(control, anchor));
    let node = el;
    // Some component forms (including Phoenix) wrap each repeated row deeply;
    // stop only after reaching the actual sibling record, not an inner field.
    for (let depth = 0; node && depth < 16; depth++, node = node.parentElement) {
      const parent = node.parentElement;
      if (!parent) continue;
      // Siblings already share the same parent and anchor. Do not re-check a
      // page-level title here: generic wrappers otherwise collapse every row
      // to its first field and make date ranges cross-fill.
      const siblings = [...parent.children].filter((sibling) =>
        matching.some(control => sibling !== control && sibling.contains(control)));
      if (siblings.length > 1) return node;
    }
    for (let node = el.parentElement, depth = 0; node && depth < 12; node = node.parentElement, depth++) {
      const controls = candidates.filter(control => node !== control && node.contains(control));
      const anchors = matching.filter(control => node !== control && node.contains(control));
      if (anchors.length > 1) break;
      if (anchors.length === 1 && controls.length > 1) return node;
    }
    return el.closest("[class*='fields'], [class*='form'], .form-item, .form-group, .field, fieldset") || el;
  };
  const rowContainers = (anchor, section = "") => {
    const matches = fields().filter((el) => anchorMatch(el, anchor));
    const scoped = matches.filter((el) => inSection(el, section));
    // A structured row may never fall back into another named module.  Keep
    // unlabeled component wrappers usable, but not a clearly different block.
    const candidates = ["竞赛", "荣誉"].includes(section) ? scoped
      : scoped.length || !section ? scoped.length ? scoped : matches : matches.filter((el) => !hasKnownSection(sectionTitle(el)));
    const rows = candidates.map((el) => repeatedContainer(el, anchor, section));
    const uniqueRows = [...new Set(rows)];
    // A few component libraries expose both the repeated item and its common
    // parent as candidates. Keep only leaf rows so later fields cannot fall
    // back to the first item and overwrite a different record.
    const leafRows = uniqueRows.filter((row) => !uniqueRows.some((other) => other !== row && row.contains(other)));
    return leafRows.length ? leafRows : uniqueRows;
  };
  const projectFieldOverride = (row, label) => {
    const titled = [...(row?.querySelectorAll(controlSelector) || [])].filter(editable)
      .map((control) => ({ control, title: normalize(fieldTitle(control) || labelText(control)) }));
    const detailedDuty = titled.find(({ title }) => ["项目中职责", "项目职责", "个人工作"].some((name) => title === normalize(name)));
    if (!detailedDuty) return null;
    if (label === "项目职责") return detailedDuty.control;
    if (label === "项目职务") return titled.find(({ control, title }) => title === normalize("职责") && !control.matches("textarea, [contenteditable='true']"))?.control || null;
    return null;
  };
  const rowDescription = (row) => controlValue([...(row?.querySelectorAll("textarea") || [])]
    .find(control => isDescription(fieldTitle(control) || labelText(control))));
  const rowField = (anchor, rowIndex, label, section = "", value = "") => {
    const candidate = rowContainers(anchor, section)[rowIndex];
    // A missing repeated row is not permission to reuse a similarly named
    // field from another module (for example, award date as certificate date).
    if (!candidate) {
      // A single narrative award module may expose a standalone level/type
      // selector without a name anchor. Resolve that field by occurrence.
      if (/(?:获奖|奖励|奖项)(?:级别|等级|类型|类别)|大赛(?:级别|等级)|比赛等级|竞赛等级/.test(label)) return findField(label, rowIndex, section);
      return null;
    }
    const anchors = candidate ? [...candidate.querySelectorAll(controlSelector)].filter((el) => anchorMatch(el, anchor)) : [];
    const row = candidate && (candidate.matches(".resumeEditForm-item") || anchors.length === 1) ? candidate : null;
    const projectOverride = anchor === "项目名称" && projectFieldOverride(row, label);
    if (projectOverride) return projectOverride;
    if (row && /结束时间|毕业时间|毕业年份|教育结束|工作结束|项目结束/.test(label) && /^(?:至今|现在|在职)$/i.test(String(value).trim())) {
      const current = [...row.querySelectorAll("input[type=checkbox], [role=checkbox]")].find((el) => {
        const text = normalize(labelText(el) || el.parentElement?.textContent);
        return text.includes("至今") || text.includes("现在") || text.includes("在职");
      });
      if (current) return current;
    }
    if (row && /开始时间|结束时间|入学时间|毕业时间|毕业年份|教育开始|教育结束|工作开始|工作结束|项目开始|项目结束|获奖时间|获得时间/.test(label)) {
      const fullRange = [...row.querySelectorAll("input")].map(fullDateRange).find((controls) => controls.length === 2);
      if (fullRange) return /结束时间|毕业时间|毕业年份|教育结束|工作结束|项目结束/.test(label) ? fullRange[1] : fullRange[0];
      const atsxPeriod = row.querySelector(".atsx-date-picker-period-month");
      const atsxParts = atsxPeriod ? [...atsxPeriod.querySelectorAll(":scope > .atsx-date-picker-period-month-label")] : [];
      if (atsxParts.length === 2) return /结束时间|毕业时间|毕业年份|教育结束|工作结束|项目结束/.test(label) ? atsxParts[1] : atsxParts[0];
      const dateRange = [...row.querySelectorAll("[class*='date_info'], [class*='date-info'], [class*='dateInfo'], [class*='date-range'], [class*='dateRange']")]
        .map((node) => ({ node, controls: [...node.querySelectorAll("input, [role=combobox]")].filter((el) => visible(el) && !["checkbox", "radio"].includes(el.type)) }))
        .filter(({ controls }) => controls.length === 4 || controls.length === 2 && controls.every((control) => !isYearPart(control) && !isMonthPart(control)))
        .sort((left, right) => left.node.querySelectorAll("*").length - right.node.querySelectorAll("*").length)[0];
      if (dateRange) return /结束时间|毕业时间|毕业年份|教育结束|工作结束|项目结束/.test(label) ? dateRange.controls[dateRange.controls.length === 4 ? 2 : 1] : dateRange.controls[0];
      const dateTarget = [...row.querySelectorAll("input, [role=combobox]")].find((el) => dateControls(el).length >= 2);
      // A module wrapper can contain several repeated date pairs.  Keep the
      // date group in the record that owns the anchor before choosing a part.
      const dates = (dateTarget ? dateControls(dateTarget) : []).filter((el) => row.contains(el));
      if (dates.length >= 2 && (!/结束时间|毕业时间|毕业年份|教育结束|工作结束|项目结束/.test(label) || dates.length >= 4)) return /结束时间|毕业时间|毕业年份|教育结束|工作结束|项目结束/.test(label) ? dates[2] : dates[0];
    }
    if (row && /^(?:工作描述|工作职责|项目描述|项目职责|获奖描述)$/.test(label)) {
      const descriptions = [...row.querySelectorAll("textarea, [contenteditable='true']")].filter(editable);
      const description = descriptions.find((el) => normalize(fieldTitle(el)) === normalize(label))
        || descriptions.find((el) => (label === "项目职责" ? /职责|责任|承担/ : label === "项目描述" ? /描述|简介|内容|摘要/ : /描述|职责|内容|亮点|摘要/).test(fieldTitle(el) || labelText(el)));
      if (description) return description;
    }
    const item = [...(row?.querySelectorAll(".form-item, .form-group, .field") || [])].find((el) => normalize(el.querySelector(`${fieldLabelSelector}, label`)?.innerText).includes(normalize(label)));
    const direct = row ? [...row.querySelectorAll(controlSelector)].filter(editable)
      .filter((el) => anchorMatch(el, label))
      .sort((a, b) => Number(normalize(fieldTitle(b).replace(/[＊*]/g, "")) === normalize(label)) - Number(normalize(fieldTitle(a).replace(/[＊*]/g, "")) === normalize(label)))[0] : null;
    if (row && /学院|院系/.test(label)) return [...row.querySelectorAll(controlSelector)].filter(editable)
      .find((el) => /学院|院系/.test(fieldTitle(el) || labelText(el))) || null;
    const scopedField = findField(label, rowIndex, section);
    const scoped = scopedField && candidate.contains(scopedField) ? scopedField : null;
    // A personal-information school city belongs to the first education
    // source, not to the residence source or every repeated education row.
    const standaloneSchoolCity = label === "学校所在城市" && rowIndex === 0 ? fields().filter(el =>
      normalize(fieldTitle(el)) === normalize(label) && /个人信息|基本信息|基本资料/.test(moduleTitle(el))) : [];
    // Unique profile/education labels remain safe to resolve without a
    // section when a component library hides the section heading from the DOM.
    const uniqueFallback = !section && /学校|院校|专业|学历|性别|出生日期|所在地|最近公司|奖项名称|获奖项/.test(label)
      ? findField(label, rowIndex) : null;
    return atsxSearchInput(item?.querySelector(controlSelector) || direct || scoped || (standaloneSchoolCity.length === 1 ? standaloneSchoolCity[0] : null) || uniqueFallback);
  };
  const labelText = (el) => {
    const parts = [fieldTitle(el), ...associatedLabels(el)];
    if (parts.some(Boolean)) return clean(parts.join(" "));
    let node = el.closest("label") || el.parentElement;
    for (let depth = 0; node && depth < 5; depth++, node = node.parentElement) {
      const controls = [...node.querySelectorAll(controlSelector)].filter(editable);
      if (depth > 0 && controls.length > 1) break;
      const value = labelCaption(node);
      if (value && value.length <= 80) parts.push(value);
    }
    if (el.previousElementSibling) parts.push(el.previousElementSibling.innerText || el.previousElementSibling.textContent);
    return clean(parts.join(" "));
  };

  const moduleTitle = (el) => {
    const section = sectionTitle(el);
    // Numbered record captions belong to one module, rather than separate first rows.
    if (section) return hasKnownSection(section) ? section.replace(/\s*[-－–—#]\s*\d+\s*(?:[（(].*[）)])?$/, "") : section;
    let node = el;
    for (let depth = 0; node && depth < 16; depth++, node = node.parentElement) {
      const heading = node.querySelector?.("h1, h2, h3, h4, h5, h6, legend, [role=heading], .section-title, .form-title, .title");
      const text = clean(heading?.innerText || heading?.textContent);
      if (text && text.length <= 100 && !heading.contains?.(el)) return text;
    }
    return "";
  };
  const repeatIndex = (el, anchor) => {
    const label = anchor || semanticText(el);
    const row = repeatedContainer(el, label);
    const matching = row.parentElement ? [...row.parentElement.querySelectorAll(controlSelector)].filter(control => editable(control) && anchorMatch(control, label)) : [];
    const rows = row.parentElement ? [...row.parentElement.children].filter(sibling => matching.some(control => sibling !== control && sibling.contains(control))) : [];
    return Math.max(0, rows.indexOf(row));
  };
  const controlType = (el) => !el ? "" : el.matches("[role=combobox], [aria-haspopup=listbox]") ? "combobox"
    : el.matches("[role=radio], .phoenix-radio-group") || el.type === "radio" ? "radio"
      : el.matches("[role=checkbox]") || el.type === "checkbox" ? "checkbox"
        : el.isContentEditable ? "contenteditable" : el.tagName === "SELECT" ? "select" : String(el.type || el.tagName).toLowerCase();
  const choiceRoot = (el) => {
    for (let node = el; node && node !== document.body; node = node.parentElement) {
      if (node === el && node.matches("input, textarea")) continue;
      const controls = [...node.querySelectorAll(controlSelector)].filter(visible);
      if (node !== el && controls.filter((control) => !controls.some((other) => other !== control && control.contains(other))).length > 1) break;
      if (!node.hasAttribute('role') && !node.hasAttribute('aria-haspopup') && /dropdown[-_]+open(?:$|\s)/i.test(String(node.className || ''))) continue;
      if (!node.hasAttribute("role") && !node.hasAttribute("aria-haspopup") && /search|input|content|rendered|selection[-_]overflow|selection[-_]item/i.test(String(node.className || ""))
        && !/date|month|calendar|(?:select|dropdown)[-_]*container(?:[\s_-]|$)/i.test(String(node.className || ""))
        && !(/picker/i.test(String(node.className || "")) && !/content|rendered/i.test(String(node.className || "")))) continue;
      if (node.getAttribute?.("role") === "combobox" || node.hasAttribute?.("aria-haspopup")
        || /(^|[\s_-])(select|dropdown|cascader|picker|autocomplete|date[-_]editor)([\s_-]|$)/i.test(String(node.className || ""))) return node;
    }
    return el?.matches("input, textarea") && /(^|[\s_-])(select|dropdown|cascader|picker|autocomplete|date[-_]editor)([\s_-]|$)/i.test(String(el.className || "")) ? el : null;
  };
  const choiceTrigger = (el) => {
    for (let node = el?.parentElement; node && node !== document.body; node = node.parentElement)
      if (node.matches("button, [role=button], [aria-haspopup], [tabindex='0'], [class*='trigger'], [class*='Trigger'], [class*='selector'], [class*='Selector']")
        && (node.matches("button, [role=button], [aria-haspopup]") || !/search|input|content|overflow|suffix/i.test(String(node.className || "")))) return node;
    const root = choiceRoot(el);
    return root && !/(?:^|[\s_-])(?:date|month|calendar)(?:$|[\s_-])/i.test(String(root.className || "")) ? root : el;
  };
  const isSearchableChoiceInput = (el) => el?.tagName === "INPUT" && !el.readOnly && !["date", "month"].includes(el.type)
    && !fullDateRange(el).includes(el) && !!choiceRoot(el) && choiceTrigger(el) !== el;
  const isExplicitTextInput = (el) => el?.tagName === "INPUT" && !el.readOnly && !el.getAttribute("role") && !el.hasAttribute("aria-haspopup")
    && el.closest("[class*='string_info'], [class*='string-info'], [class*='stringInfo'], [data-field-type='string_info']")?.querySelectorAll('input:not([type=hidden]), textarea, select').length === 1;
  const isSuggestionControl = (el) => el?.tagName === "INPUT" && !el.readOnly && (/auto[-_]?complete|suggest|typeahead|select[-_ ]search/i.test([
    el.className, el.getAttribute("aria-autocomplete"), el.parentElement?.className, el.parentElement?.getAttribute("role"), el.closest("[class*='auto-complete'], [class*='auto_complete'], [class*='autocomplete']")?.className
  ].join(" ")) || el.type === "search" && el.getAttribute("role") === "combobox" || /^(?:list|both|inline)$/i.test(el.getAttribute("aria-autocomplete") || ""));
  const isAutocompleteControl = (el) => isSuggestionControl(el) || isExplicitTextInput(el) && !!choiceRoot(el)
    || el?.tagName === "INPUT" && !el.readOnly
    && !["date", "month"].includes(el.type) && !fullDateRange(el).includes(el)
    && (el.hasAttribute("options") || el.closest('[class*="dropdown-open"], [class*="dropdown_open"]'))
    && /(?:^|[\s_-])(?:select|autocomplete)(?:$|[\s_-])/i.test(String(choiceRoot(el)?.className || ""));
  const isSchoolLabel = label => /^(?:毕业学校|毕业院校|最高学历学校|学校|院校|学校名称|学校全称|院校名称|就读学校)[＊*]?$/.test(clean(label));
  const isLocationLabel = (label) => /家庭|家乡|籍贯|居住|户籍|户口|城市|所在地点|所在地|就读地|(?:工作|期望).*地点/.test(label);
  const isChoiceControl = (el) => !!el && !isExplicitTextInput(el) && (el.tagName === "SELECT" || ["radio", "checkbox"].includes(el.type)
    || el.matches(".phoenix-radio-group")
    || ["combobox", "radio", "checkbox"].includes(el.getAttribute("role")) || el.hasAttribute("aria-haspopup") || !!choiceRoot(el)
    || el.tagName === "INPUT" && !["date", "month"].includes(el.type) && fullDateRange(el).includes(el)) && !isSuggestionControl(el);
  const confirmedSingleLocationSources = new WeakMap();
  const isMultipleChoice = (control, popup) => {
    const marked = node => node?.getAttribute?.("aria-multiselectable") === "true" || node?.hasAttribute?.("multiple")
      || !/(?:^|[\s_-])(?:not|non|no)[-_]+multi(?:ple)?(?:$|[\s_-])/i.test(String(node?.className || ""))
        && /(?:^|[\s_-])(?:is-)?multi(?:ple)?(?:$|[\s_-])|select[-_]*multiple/i.test(String(node?.className || ""));
    const root = choiceRoot(control);
    for (let node = control; node && node !== document.body; node = node.parentElement) {
      if (marked(node)) return true;
      if (node === root || !root) break;
    }
    return [...(root?.querySelectorAll('[class], [multiple], [aria-multiselectable]') || [])].some(marked)
      || marked(popup) || !!popup?.querySelector?.('input[type="checkbox"], [role="checkbox"]');
  };
  const controlValue = (el, box = fieldContainer(el)) => {
    if (!el) return "";
    if (el.matches(".phoenix-radio-group")) return clean(el.querySelector(".phoenix-radio--checked, .phoenix-radio--selected, [aria-checked=true]")?.textContent);
    if (!el.isConnected) {
      const relocated = resolveField(elementKeys.get(el));
      if (relocated) return controlValue(relocated);
      return box?.isConnected && !box.querySelector(controlSelector)
        ? clean(box.querySelector("[class*='select__tag'], [class*='select-tag']")?.textContent) : "";
    }
    if (atsxPeriodParts(el).includes(el)) {
      const value = clean(el.innerText || el.textContent);
      return /^y{4}\s*-\s*m{2}$/i.test(value) ? "" : value;
    }
    if (el.type === "radio" || el.getAttribute("role") === "radio") {
      const group = el.name ? [...document.querySelectorAll("input[type=radio]")].filter((item) => item.name === el.name && item.form === el.form)
        : [...(el.closest('[role=radiogroup]') || box || el.parentElement).querySelectorAll('[role=radio], input[type=radio]')];
      const checked = group.find((item) => item.checked || item.getAttribute("aria-checked") === "true");
      return checked ? checked.value || associatedLabels(checked)[0] || "true" : "";
    }
    if (el.type === "checkbox" || el.getAttribute("role") === "checkbox") return el.checked || el.getAttribute("aria-checked") === "true" ? (el.value || "true") : "";
    if (el.tagName !== "SELECT" && (isChoiceControl(el) || isAutocompleteControl(el))) {
      const liveControl = el.matches("input, textarea") ? el : [...el.querySelectorAll("input, textarea")].find(visible) || el;
      const root = choiceRoot(liveControl || el);
      const scope = root?.isConnected ? root : box;
      const displays = [...(scope?.querySelectorAll("[aria-valuetext], [class]") || [])].filter((node) =>
        node !== el && clean(node.textContent) && !/placeholder/i.test(String(node.className || "")) && !/^(?:请输入|请选择)|^please select$/i.test(clean(node.textContent)));
      const display = displays.find((node) => /display-value|selection-item|selection[-_]+choice|single-?value|selectitem|select-filter-label|(?:select|selector)[-_]*(?:value|tag|item)|multi-?value|selected/i.test(String(node.className || "")))
        || displays.find((node) => /calc(?:ele)?/i.test(String(node.className || "")) && !/^(?:请输入|请选择)/.test(clean(node.textContent)));
      const tags = [...(scope?.querySelectorAll?.("[class*='tag'], [class*='Tag']") || [])]
        .filter((node) => visible(node) && clean(node.textContent) && !/placeholder/i.test(String(node.className || "")))
        .map((node) => clean(node.textContent));
      const ownValue = liveControl === el && el.matches?.("button, [role=button], [aria-haspopup]") ? clean(el.textContent) : "";
      const selectionDisplay = scope?.querySelector?.("[class*='display-value'], [class*='selectItem'], [class*='selection-item'], [class*='select-filter-label']");
      const typedValue = clean(selectionDisplay?.textContent) || pendingSuggestions.has(liveControl)
        || isAutocompleteControl(liveControl) && popupFor(liveControl, false).length ? "" : liveControl?.value;
      const selectedValues = [...new Set([...tags, ...displays.filter(node => /selection-item|selection[-_]+choice|(?:select|selector)[-_]*(?:tag|item)|multi-?value|selected/i.test(String(node.className || ""))
        ).map(node => clean(node.textContent)).filter(Boolean)])];
      const multipleDisplay = selectedValues.length > 1 || isMultipleChoice(liveControl || el) ? selectedValues.join("、") : "";
      const value = clean(liveControl?.getAttribute("aria-valuetext") || typedValue || multipleDisplay || display?.textContent || tags.join("") || ownValue);
      return /^(?:请选择|请输入|please select(?:\b|$)|select(?:\s|$))/i.test(value) ? "" : value;
    }
    return clean(el.value ?? el.getAttribute("aria-valuetext") ?? (el.isContentEditable ? el.innerText : ""));
  };
  const optionTexts = (el) => {
    const scope = el.tagName === "SELECT" ? el : fieldContainer(el) || el.parentElement;
    const controlled = el.getAttribute("aria-controls") ? document.getElementById(el.getAttribute("aria-controls")) : null;
    const nodes = [...(scope?.querySelectorAll("option, [role=option], [class*='option'], [class*='Option']") || []), ...(controlled?.querySelectorAll("option, [role=option], [class*='option'], [class*='Option']") || [])];
    return nodes
      .filter((option) => option.tagName === "OPTION" || visible(option)).map((option) => clean(option.innerText || option.textContent)).filter((value) => value && !/^请选择|^暂无选项$/.test(value)).filter((value, index, all) => all.indexOf(value) === index).slice(0, 80);
  };
  // ponytail: one DOM-label heuristic covers Vue/React forms; add site selectors only when a real page needs them.
  const FIELD_ALIASES = {
    "国家/地区": ["国籍（地区）", "国籍(地区)", "国籍/地区", "国籍", "国家／地区", "国家地区", "国家或地区", "国家（地区）", "国家(地区)", "国家", "country/region", "countryRegion", "country"],
    "姓名": ["姓名", "名字", "真实姓名", "中文姓名"],
    "手机号码": ["手机", "手机号", "手机号码", "联系电话", "电话号码"],
    "邮箱": ["邮箱", "电子邮箱", "邮件地址", "email", "e-mail"],
    "出生日期": ["出生日期", "出生年月", "生日", "birthday"],
    "年龄": ["年龄", "周岁"],
    "民族": ["民族", "民族类别", "民族名称"],
    "政治面貌": ["政治面貌", "政治身份"],
    "微信号": ["微信", "微信号", "wechat"],
    "证件类型": ["证件类型", "证件种类", "个人证件"],
    "证件号码": ["证件号码", "证件号", "身份证号", "身份证号码"],
    "学校名称": ["学校", "院校", "毕业院校", "就读学校", "学校名称"],
    "学校所在城市": ["学校城市", "院校所在城市", "院校城市", "学校所在地", "学校所在地区", "目前就读地", "就读地点", "就读地", "就读城市"],
    "家庭所在城市": ["家庭城市", "家庭所在地", "家庭所在地区", "家庭居住地", "家庭地址", "现家庭住址", "家庭住址"],
    "学院名称": ["学院", "院系", "所属学院", "学院名称"],
    "专业名称": ["专业", "所学专业", "就读专业", "主修专业", "专业名称"],
    "GPA": ["GPA成绩", "GPA", "绩点", "平均学分绩点"],
    "GPA类型": ["GPA类型", "GPA总分", "总分", "绩点类型", "绩点满分", "绩点制式", "GPA-BASE", "满绩绩点"],
    "最高学历": ["学历", "教育程度", "最高学历", "学位"],
    "性别": ["gender", "男女", "性别"],
    "工作经验": ["工作年限", "工作经验", "经验"],
    "最近公司": ["最近任职公司", "最近工作单位", "最近公司"],
    "所在地": ["所在地区", "当前所在地", "居住地", "所在地"],
    "期望城市": ["意向城市", "工作城市", "期望工作城市", "期望城市"],
    "期望从事行业": ["期望从事行业", "期望行业", "意向行业", "目标行业"],
    "期望从事职业": ["期望从事职业", "期望职业", "期望职位", "意向职位", "目标职位", "目标职位类别", "意向岗位"],
    "期望月薪(税前)": ["期望月薪（税前）", "期望月薪(税前)", "期望薪资（税前）", "期望薪资(税前)", "期望月薪", "期望薪资", "期望待遇"],
    "期望工作城市": ["期望工作城市", "目标工作城市", "期望城市", "意向城市", "工作意向城市", "期望工作地点", "期望地点"],
    "现月薪(税前)": ["现月薪（税前）", "现月薪(税前)", "当前月薪（税前）", "当前月薪(税前)", "目前月薪（税前）", "目前月薪(税前)", "现月薪", "当前薪资", "目前薪资"],
    "当前薪资": ["现月薪", "当前薪资", "目前薪资"],
    "期望薪资": ["期望月薪", "期望薪资", "期望待遇"],
    "项目描述": ["项目简介", "项目内容", "项目说明", "项目描述"],
    "项目经验": ["项目经历", "项目经验"],
    "实习经历": ["实习经验", "实习经历"],
    "证书": ["证书", "资格证书", "证书信息"],
    "语言类型": ["语言", "语言类型", "语言类别", "外语类别", "语种", "语言名称", "language", "languages", "foreign language", "language type", "language name"],
    "掌握程度": ["掌握程度", "熟练程度", "精通程度", "语言水平", "技能等级", "等级自评"],
    "听说": ["听说", "听力口语", "听力", "口语"],
    "读写": ["读写", "阅读写作", "阅读", "写作"],
    "获奖时间": ["获奖日期", "获得时间", "奖项时间", "获奖时间"],
    "获奖类型": ["获奖类型", "奖励类型", "奖项类型", "奖项类别"],
    "奖项名称": ["获奖项", "获奖名称", "奖励名称", "奖项", "奖项名称", "竞赛名称", "荣誉名称"],
    "获奖级别": ["奖项级别", "奖励级别", "获奖等级", "获奖级别", "大赛等级", "大赛级别", "比赛等级", "竞赛等级", "荣誉等级"],
    "籍贯": ["籍贯", "家乡"],
    "户口所在地": ["户籍所在地", "户籍地", "户口所在地", "户籍地址"],
    "培养方式": ["学习方式", "学习形式", "就读方式", "受教育类型", "学历类型"],
    "学历类型": ["培养方式", "学习方式", "学习形式", "就读方式", "受教育类型", "是否全日制"],
    "工作描述": ["工作职责", "工作内容", "工作说明", "实践描述", "实践内容", "实践说明"],
    "工作职责": ["工作描述", "工作内容", "工作说明", "校园经历描述", "实践描述", "实践内容", "实践说明"],
    "工作性质": ["工作类型", "工作性质"],
    "工作亮点": ["工作成果", "业绩亮点", "工作成就", "工作业绩", "亮点", "业绩"],
    "个人评价": ["个人评价", "自我评价", "自我描述", "评价内容"],
    "获奖情况": ["奖励活动", "获奖经历", "奖项"],
    "现居住地": ["当前居住地", "当前居住城市", "目前居住城市", "现居住城市", "居住城市", "当前所在地", "现居地", "居住地", "所在地", "所在地点"],
    "学历": ["学位", "最高学历"],
    "公司名称": ["企业名称", "单位名称", "公司/单位"],
    "职位名称": ["职位", "职务", "岗位", "工作岗位", "任职职位", "任职岗位"],
    "所在部门": ["部门", "所属部门"],
    "开始时间": ["开始时间", "开始日期", "开始年月", "起始时间", "入学时间", "入学年月", "就读时间", "教育开始时间", "教育开始日期"],
    "结束时间": ["结束时间", "结束日期", "终止时间", "毕业时间", "毕业日期", "毕业年月", "毕业年份", "教育经历结束时间", "教育结束时间", "教育结束日期", "教育结束", "工作结束时间", "项目结束时间"],
    "毕业时间": ["毕业时间", "毕业日期", "毕业年月", "毕业年份", "教育经历结束时间", "教育结束时间", "教育结束日期", "教育结束", "结业时间"],
    "月薪(税前)": ["月薪（税前）", "月薪(税前)", "月薪税前", "税前月薪", "月工资（税前）", "月工资(税前)", "税前工资", "税前薪资", "薪资"],
    "工作地点": ["工作地点", "工作城市", "办公地点", "工作地区", "办公城市", "任职地点"],
    "离职原因": ["离职原因", "离职缘由"],
    "项目名称": ["项目名称", "项目标题"],
    "项目链接": ["项目链接", "项目地址", "项目网址", "在线链接", "演示地址", "GitHub链接", "Github链接"],
    "项目职务": ["职务", "项目角色", "角色", "在项目中担任的角色"],
    "项目职责": ["职责", "项目中职责", "个人工作"],
    "获奖项": ["获奖名称", "奖励活动", "奖项名称", "奖项", "竞赛名称", "荣誉名称", "获奖大赛"],
    "获奖描述": ["奖励描述", "荣誉描述", "奖项说明", "获奖说明"],
    "证书名称": ["证书", "资格证书"],
    "证书描述": ["描述", "说明", "证书说明"],
    "获得时间": ["获奖时间", "取得时间", "日期"],
    "职务": ["职务", "干部职务", "担任职务", "角色", "实践名称", "实践项目", "活动名称"],
    "成绩排名": ["成绩排名", "专业排名", "排名"],
    "级别": ["级别", "组织级别", "活动级别"],
    "分数": ["分数", "成绩", "证书成绩"],
    "技能名称": ["技能名称", "专业技能", "技能特长", "编程语言", "开发语言", "程序设计语言", "计算机语言"],
    "使用时间总计": ["使用时间总计", "使用时间", "使用时长", "熟练年限"],
    "技能描述": ["技能描述", "技能说明", "技能详情"]
  };
  function findField(label, occurrence = 0, section = "") {
    // ATSX renders the two personal-ID controls beneath one shared label.
    // Keep this tied to that composite DOM feature, not a recruiting domain.
    const idCard = document.querySelector("#id-card-select-component");
    if (idCard && label === "证件类型") return idCard.querySelector("[role=combobox]") || undefined;
    if (idCard && label === "证件号码") {
      const numbers = [...idCard.querySelectorAll("input:not([type=hidden])")].filter(el => editable(el) && !el.readOnly && !isChoiceControl(el));
      if (numbers.length === 1) return numbers[0];
    }
    const controls = fields();
    // Composite identity fields put the document type and number under one caption.
    if (label === "证件号码") {
      const groups = controls.filter((el) => /个人证件|证件类型/.test(fieldTitle(el)))
        .map((el) => fieldContainer(el)).filter((box, index, all) => box && all.indexOf(box) === index);
      const numbers = groups.flatMap((box) => [...box.querySelectorAll("input")]
        .filter((el) => editable(el) && !el.readOnly && !isChoiceControl(el)));
      if (numbers.length === 1) return numbers[0];
    }
    const wanted = [label, ...(FIELD_ALIASES[label] || [])].map(normalize);
    const scoreFields = (pool) => pool.map((el) => {
      const attrs = normalize([el.getAttribute("aria-label"), el.getAttribute("placeholder"), el.name, el.id, semanticText(el), labelText(el)].join(" "));
      let score = wanted.some((value) => attrs.includes(value)) ? 100 : 0;
      if (wanted.includes(normalize(fieldTitle(el).replace(/[＊*]/g, "")))) score += 250;
      if (wanted.some((value) => attrs.includes(value.replace(/名称|号码|税前/g, "")))) score += 20;
      if ((label === "现居住地" || label === "所在地") && /户口|户籍|籍贯/.test(attrs)) score = 0;
      if (label === "现居住地" && /家庭|家乡|学校|院校|就读|期望|意向|工作|办公|任职|教育|实习|项目/.test(`${fieldTitle(el)} ${moduleTitle(el)}`)) score = 0;
      if (label === "姓名" && /拼音|pinyin|英文|english|first.?name|last.?name|given.?name|family.?name/i.test(attrs)) score = 0;
      if (/^(?:姓名|手机号码|邮箱)$/.test(label) && /证明人|联系人|推荐人|家属|监护人|父亲|母亲|导师|辅导员/.test(`${attrs} ${moduleTitle(el)}`)) score = 0;
      if (/手机|电话/.test(label) && /区号/.test(fieldTitle(el)) && !/区号/.test(label)) score = 0;
      if (/证件类型|证件号码/.test(label) && /证件类型|证件号码/.test(fieldTitle(el)) && label !== fieldTitle(el)) score = 0;
      if (label === "GPA" && /类型|总分|满分|满绩|制式|GPA[-\s_]*BASE/i.test(fieldTitle(el))) score = 0;
      if (/^(?:获奖项|奖项名称)$/.test(label) && /类型|类别|描述|说明|时间|日期|级别|等级/.test(fieldTitle(el))) score = 0;
      if (label === "籍贯" && /户口|户籍/.test(attrs)) score = 0;
      if (/^期望/.test(label) && /^(?:现|当前|目前)/.test(clean(fieldTitle(el)))) score = 0;
      if (score && el.type === "date" && /日期|时间/.test(label)) score += 5;
      if (score && /手机|电话/.test(label) && el.tagName !== "SELECT") score += 15;
      if (score && /邮箱|email/i.test(label) && el.type === "email") score += 15;
      return { el, score };
    }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score || controls.indexOf(a.el) - controls.indexOf(b.el));
    const scoped = scoreFields(controls.filter((el) => inSection(el, section)));
    const candidates = ["竞赛", "荣誉"].includes(section) ? scoped : scoped.length || !section ? scoped.length ? scoped : scoreFields(controls)
      : scoreFields(controls.filter((el) => !hasKnownSection(sectionTitle(el))));
    return atsxSearchInput(candidates[occurrence]?.el);
  }
  const fieldMatches = (label) => {
    const wanted = [label, ...(FIELD_ALIASES[label] || [])].map(normalize);
    return fields().filter((el) => wanted.some((value) => normalize(semanticText(el) + " " + labelText(el)).includes(value)));
  };

  const textConstraintFailure = (el, value) => {
    if (!el?.matches("input, textarea") || isChoiceControl(el)) return "";
    const text = String(value);
    if (/拼音|pinyin|英文(?:姓|名)|english[\s_-]*name/i.test(semanticText(el)) && !/^[A-Za-z][A-Za-z '\-]*$/.test(text)) return "invalid-name-format";
    if (el.maxLength >= 0 && text.length > el.maxLength) return "text-too-long";
    if (el.pattern) {
      const probe = document.createElement("input"); probe.pattern = el.pattern; probe.value = text;
      if (!probe.checkValidity()) return "pattern-mismatch";
    }
    return "";
  };
  function setValue(el, value, inputOnly = false) {
    if (!el || value == null) return false;
    const invalid = textConstraintFailure(el, value);
    if (invalid) { lastChoice = { failure: invalid }; return false; }
    if (el.readOnly && (el.getAttribute("role") === "combobox" || el.hasAttribute("aria-haspopup") || /select|cascader|calendar|date|area/i.test(String(el.className || "")) || /家庭|籍贯|居住|户籍|地区|日期|时间|省|市/.test(String(el.getAttribute("aria-label") || el.placeholder || el.name || el.id || el.parentElement?.innerText || "")))) return false;
    if (el.type === "checkbox" || el.type === "radio" || el.getAttribute("role") === "checkbox" || el.getAttribute("role") === "radio") {
      const wanted = normalize(value);
      const label = normalize(labelText(el) || el.value || el.parentElement?.textContent);
      if (!wanted || /没有.*(?:经历|经验|成果)|无.*(?:经历|经验|成果)/.test(associatedLabels(el).join(" "))) return false;
      const shouldCheck = ["true", "1", "yes", "是", "有", "已婚", "男", "女", "至今", "现在", "在职"].includes(wanted) || !!label && (wanted === label || label.includes(wanted) || wanted.includes(label));
      if (shouldCheck && !(el.checked || el.getAttribute("aria-checked") === "true")) el.click();
      return shouldCheck;
    }
    // Custom selects use their text input as a search box; assigning it is not selecting an option.
    if (el.tagName !== "SELECT" && isChoiceControl(el)) return false;
    if (el.isContentEditable) {
      el.textContent = String(value);
      const inputEvent = typeof InputEvent === "function" ? new InputEvent("input", { bubbles: true, inputType: "insertText", data: String(value) }) : new Event("input", { bubbles: true });
      el.dispatchEvent(inputEvent);
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true }));
      return true;
    }
    if (!["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.getAttribute("role") === "combobox" && !isSuggestionControl(el)) return false;
    if (el.tagName === "SELECT") {
      const options = [...el.options];
      const exact = options.find((item) => normalize(item.textContent) === normalize(value) || item.value === value);
      const optionLabel = labelText(el);
      const educationLabel = /学历类型|受教育类型|培养方式|学习形式|学习方式|就读方式/.test(optionLabel);
      const educationOption = educationLabel && /全日制|统招|非统招|自学考试/.test(String(value))
        ? options.find((item) => {
          const text = normalize(item.textContent);
          return /非统招/.test(value) ? /非统招/.test(text)
            : /非全日制/.test(value) ? /非全日制/.test(text)
              : /自学考试/.test(value) ? /自学考试/.test(text)
                : /统招/.test(value) ? /统招/.test(text) && !/非统招/.test(text)
                  : /全日制/.test(value) ? /全日制/.test(text) && !/非全日制/.test(text)
                    : false;
        }) : null;
      const semantic = educationLabel || isSchoolLabel(fieldTitle(el) || optionLabel) ? [] : options.filter((item) => normalize(item.textContent).includes(normalize(value)) || normalize(value).includes(normalize(item.textContent)));
      const option = exact || educationOption || (/薪|工资|待遇/.test(optionLabel) && salaryOption(value, options))
        || (/排名/.test(optionLabel) && rankOption(value, options))
        || proficiencyOption(value, options, optionLabel) || (semantic.length === 1 ? semantic[0] : null);
      if (!option) return false;
      el.value = option.value;
      lastChoice = { ...(lastChoice || {}), selectedValue: option.value, confirmed: true };
    } else {
      if (el.type === "number") {
        const numeric = String(value).trim();
        const numberPattern = /^-?(?:\d+|\d*\.\d+)(?:e[+-]?\d+)?$/i;
        if (!numberPattern.test(numeric) || !Number.isFinite(Number(numeric))) {
          lastChoice = { failure: "invalid-number-value" }; return false;
        }
        const probe = document.createElement("input"); probe.type = "number";
        for (const attr of ["min", "max", "step"]) if (el.hasAttribute(attr)) probe.setAttribute(attr, el.getAttribute(attr));
        const defaultNumber = el.getAttribute("value");
        // A valid default value is the native step base when min is absent.
        if (defaultNumber != null && numberPattern.test(defaultNumber) && Number.isFinite(Number(defaultNumber))) probe.setAttribute("value", defaultNumber);
        if (!el.hasAttribute("step") && /GPA|绩点/i.test(semanticText(el))) probe.step = "any";
        probe.value = numeric;
        if (!probe.validity.valid) { lastChoice = { failure: "number-constraint-mismatch" }; return false; }
        value = numeric;
      }
      if (el.type === "date" || (el.type === "text" && /日期|时间/.test(normalize(labelText(el))))) {
        const [year, month, day] = dateParts(value);
        value = year ? `${year}-${month}${day ? `-${day}` : ""}` : value;
      }
      if (el.type === "month") {
        const [year, month] = dateParts(value);
        value = year ? `${year}-${month}` : value;
      }
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      setter ? setter.call(el, value) : (el.value = value);
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    if (!inputOnly) {
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true }));
    }
    return true;
  }

  const dateParts = (value) => {
    const text = String(value || "").trim();
    const match = text.match(/(\d{4})\s*(?:年|[./-])\s*(\d{1,2})(?:\s*(?:月|[./-])\s*(\d{1,2}))?/);
    if (match) return match.slice(1).map((part, index) => index && part ? pad2(part) : part || "");
    const year = text.match(/^(\d{4})(?:年)?$/)?.[1];
    return year ? [year] : [];
  };
  const dateForms = (value) => {
    const [year, month, day] = dateParts(value);
    if (!year || !month) return [...new Set([String(value || ""), year].filter(Boolean))];
    return [...new Set([String(value), `${year}-${month}${day ? `-${day}` : ""}`, `${year}-${Number(month)}${day ? `-${Number(day)}` : ""}`, `${year}年${month}月${day ? `${day}日` : ""}`, `${year}年${Number(month)}月${day ? `${Number(day)}日` : ""}`, `${year}/${month}${day ? `/${day}` : ""}`, `${year}/${Number(month)}${day ? `/${Number(day)}` : ""}`])];
  };
  console.assert(dateForms("2025.08").includes("2025-8"));
  console.assert(dateParts("2025")[0] === "2025");
  const looksLikeDate = (value) => /^\s*\d{4}\s*(?:年|[./-])\s*\d{1,2}(?:\s*(?:月|[./-])\s*\d{1,2})?\s*(?:月|日)?\s*$/.test(String(value || ""));
  const isDescription = (label) => /描述|职责|评价|亮点/.test(normalize(label));
  const popupSelector = "[role=listbox], [role=menu], [role=dialog], [role=grid], [class*='cascader-menus'], [class*='popup'], [class*='Popup'], [class*='dropdown'], [class*='Dropdown'], [class*='popover'], [class*='Popover'], [class*='picker'], [class*='Picker'], [class*='calendar'], [class*='Calendar'], [class*='options'], [class*='Options'], [class*='unmodeled-layer'], [class*='selector-container'], [class*='autocomplete'], [class*='Autocomplete'], [class*='suggest'], [class*='Suggest'], [class*='menu'], [class*='Menu'], [class*='listbox'], [class*='Listbox'], [data-popper-placement], [data-floating-ui-portal]";
  const isPopup = (el) => {
    if (!visible(el) || uploadControl(el) || el.closest('[aria-hidden="true"], [hidden], [inert]') || /(?:^|[\s_-])(?:leave|exit)(?:$|[\s_-])/i.test(String(el.className || ""))) return false;
    if (el.closest('header, nav, footer, [role=navigation], [role=banner], [role=contentinfo], [data-resume-autofill-ui]') || /(?:^|[\s_-])(?:header|navbar|navigation|footer)(?:$|[\s_-])/i.test(String(el.className || ""))) return false;
    if (el.matches("[role=listbox], [role=menu], [role=dialog], [role=grid]")) return true;
    if (/dropdown/i.test(String(el.className)) && (el.querySelector("[role=option], [role=listbox]") || /select[-_]dropdown/i.test(String(el.className)))) return true;
    const style = getComputedStyle(el);
    return (style.position === "fixed" || style.position === "absolute") && (/(?:picker|select|dropdown)[-_]+(?:panel|popup|popper)(?:[\s_-]|$)/i.test(String(el.className)) || !!el.querySelector("[role=option], [role=checkbox], input[type=checkbox], li, [data-value], [class*='option'], [class*='Option'], [class*='item'], [class*='Item'], [class*='picker'][class*='cell'], [role=grid], table td[title]")
      || !!el.querySelector("[class*='calendar'] [role=button], [class*='month-table'] td, [class*='date-table'] td, [class*='date-range-picker'] td, [class*='tree'][class*='node'] [class*='label']"));
  };
  const openDropdowns = () => {
    const known = [...document.querySelectorAll(popupSelector)].filter(isPopup).map((popup) => {
      if (!popup.matches("[role=grid]")) return popup;
      for (let parent = popup.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        if (isPopup(parent)) return parent;
      }
      return popup;
    });
    // Generic portals have no selector hook; check position before inspecting their descendants.
    const generic = [...document.querySelectorAll("body *")].filter(el => /^(?:fixed|absolute)$/.test(getComputedStyle(el).position)).filter(isPopup);
    const candidates = [...new Set([...known, ...generic])];
    return candidates.filter((popup) => !candidates.some((other) => other !== popup && other.contains(popup)));
  };
  const popupFor = (control, includeGlobal = true) => {
    const linked = control?.getAttribute?.("aria-controls") ? document.getElementById(control.getAttribute("aria-controls")) : null;
    const popupVisible = (popup) => !!popup && !popup.contains(control) && visible(popup) && !popup.closest('[aria-hidden="true"], [hidden], [inert]') && !/(?:^|[\s_-])(?:leave|exit)(?:$|[\s_-])/i.test(String(popup.className || "")) && (isPopup(popup) || popup.matches("[role=tree]")
      || !popup.matches(controlSelector) && /dropdown|popover|options|calendar.*panel|unmodeled-layer|selector-container|autocomplete|suggest/i.test(String(popup.className || "")) && popupOptionNodes(popup).length > 0);
    const owned = [linked, control?.nextElementSibling].filter(popupVisible);
    const root = choiceRoot(control);
    const localRoot = root?.parentElement || control?.parentElement;
    const local = [...(localRoot?.querySelectorAll?.(popupSelector) || [])].filter(popupVisible);
    const anchor = (root || control)?.getBoundingClientRect();
    const expanded = control?.getAttribute("aria-expanded") === "true" || /(?:^|[\s_-])expand(?:ed)?(?:$|[\s_-])/.test(String(root?.className || ""));
    const global = includeGlobal || expanded ? openDropdowns() : [];
    const expandedPortals = expanded && anchor ? global.filter(popup => {
      const rect = popup.getBoundingClientRect();
      return Math.abs(rect.left - anchor.left) < 3 && Math.min(Math.abs(rect.top - anchor.bottom), Math.abs(rect.bottom - anchor.top)) < 40;
    }) : [];
    const related = [...new Set(owned.length ? owned : local.length ? local : expandedPortals.length === 1 ? expandedPortals : [])];
    return includeGlobal ? [...new Set([...related, ...global])] : related;
  };
  const nearbyPopup = (control) => {
    const anchor = (choiceRoot(control) || control)?.getBoundingClientRect?.();
    if (!anchor) return null;
    const distance = (popup) => {
      const rect = popup.getBoundingClientRect();
      return Math.abs(rect.left - anchor.left) + Math.abs(rect.top - anchor.bottom);
    };
    return [...document.querySelectorAll(popupSelector)].filter((popup) => {
      const className = String(popup.className || "");
      const hasOptions = popupOptionNodes(popup).length > 0;
      if (popup === control || popup.contains(control) || control?.contains?.(popup) || !isPopup(popup) || !visible(popup) || popup.closest('[aria-hidden="true"], [hidden], [inert]')
        || !hasOptions && !(/popup|dropdown|popover|options|listbox/i.test(className) && clean(popup.innerText || popup.textContent))) return false;
      const style = getComputedStyle(popup);
      const rect = popup.getBoundingClientRect();
      return (style.position === "fixed" || style.position === "absolute") && rect.width > 30 && rect.height > 18 && rect.height < 700 && distance(popup) < 1000;
    }).sort((left, right) => distance(left) - distance(right)
      || left.getBoundingClientRect().width * left.getBoundingClientRect().height - right.getBoundingClientRect().width * right.getBoundingClientRect().height)[0] || null;
  };
  const openChoice = async (control, searchValue) => {
    const trigger = choiceTrigger(control);
    const trace = lastOpening = { focused: document.hasFocus(), alreadyActive: document.activeElement === control, activation: "focus" };
    const signature = (popup) => { const rect = popup.getBoundingClientRect(), fixed = getComputedStyle(popup).position === "fixed"; return [Math.round(rect.left + (fixed ? 0 : scrollX)), Math.round(rect.top + (fixed ? 0 : scrollY)), clean(popup.textContent)].join("\u0001"); };
    const previous = new Map(openDropdowns().map(popup => [popup, signature(popup)]));
    const opened = (activationControl) => {
      const anchor = activationControl.getBoundingClientRect();
      const nearby = nearbyPopup(control);
      const freshNearby = nearby && (!previous.has(nearby) || previous.get(nearby) !== signature(nearby)) ? nearby : null;
      const related = popupFor(control, false);
      return [...new Set(related.length ? related : [...openDropdowns().filter(popup => !previous.has(popup) || previous.get(popup) !== signature(popup)), freshNearby])].filter(popup => popup && !popup.contains(control))
        .sort((left, right) => {
          const distance = (popup) => { const rect = popup.getBoundingClientRect(); return Math.abs(rect.left - anchor.left) + Math.abs(rect.top - anchor.bottom); };
          return distance(left) - distance(right);
        })[0];
    };
    const expanded = () => control.getAttribute("aria-expanded") === "true" || /(?:^|[\s_-])expand(?:ed)?(?:$|[\s_-])/.test(String(choiceRoot(control)?.className || ""));
    const readyPopup = (activationControl) => {
      const popup = opened(activationControl);
      const loading = [...(popup?.querySelectorAll?.('[aria-busy=true], [loading-number], [class*=loading]') || [])].some(node => visible(node)
        && (node.getAttribute("aria-busy") === "true" || Number(node.getAttribute("loading-number")) > 0 || /(?:loading-loading|mask|spinner|rotate)/i.test(String(node.className))));
      return popup && (popupOptionNodes(popup).length || loading || /^(?:请输入|请选择|暂无(?:数据|选项)?|未查询到(?:备选项|候选项)|无匹配数据|加载中)/.test(clean(popup.textContent))) ? popup : null;
    };
    if (!document.hasFocus()) globalThis.focus?.();
    control.focus?.();
    let popup = await waitFor(() => readyPopup(control), 160);
    if (!popup && searchValue != null && (isAutocompleteControl(control) || isSearchableChoiceInput(control)) && editableSearch(control)) {
      const trusted = !!globalThis.chrome?.runtime?.sendMessage;
      trace.activation = trusted ? "trusted-search-trigger" : "synthetic-search-trigger";
      await clickOption(trigger, trusted, null, trace);
      popup = await waitFor(() => readyPopup(trigger), 160);
      if (!popup && trigger !== control && expanded()) popup = await waitFor(() => readyPopup(trigger), 1600);
      if (!popup && trigger !== control && !isAutocompleteControl(control)) {
        if (!opened(trigger)) await clickOption(control, trusted, null, trace);
        popup = await waitFor(() => readyPopup(control), 160);
      }
      if (!popup) {
        // A search-only portal can have zero height until a query is entered.
        setSearchValue(control, searchValue);
        trace.searched = true;
        popup = await waitFor(() => readyPopup(trigger), 5000);
      }
      trace.popupFound = !!popup;
      return popup;
    }
    if (!popup && (opened(control) || expanded())) popup = await waitFor(() => readyPopup(control), 1600);
    if (!popup) {
      const trusted = !!globalThis.chrome?.runtime?.sendMessage;
      const activationControl = trigger;
      trace.activation = trusted ? activationControl !== control ? "trusted-trigger-fallback" : "trusted-fallback" : activationControl !== control ? "synthetic-trigger" : "synthetic";
      await clickOption(activationControl, trusted, null, trace);
      popup = await waitFor(() => readyPopup(activationControl), trigger !== control ? 160 : 1600);
      if (!popup && trigger !== control) {
        if (expanded()) popup = await waitFor(() => readyPopup(control), 1600);
        if (!popup && !opened(trigger)) await clickOption(control, trusted, null, trace);
        if (!popup) popup = await waitFor(() => readyPopup(control), 1600);
      }
    }
    if (!popup && trigger !== control) {
      if (opened(control) || expanded()) popup = await waitFor(() => readyPopup(trigger), 5000);
      if (!popup) {
        const trusted = !!globalThis.chrome?.runtime?.sendMessage;
        trace.activation = trusted ? "trusted-trigger-fallback" : "synthetic-trigger";
        await clickOption(trigger, trusted, null, trace);
        popup = await waitFor(() => readyPopup(trigger), 5000);
      }
    }
    trace.popupFound = !!popup;
    return popup;
  };
  const dismissDropdowns = async (control, toggle = false) => {
    await wait(60);
    const event = new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true });
    [control, document.activeElement, document, window].filter(Boolean).forEach((node) => node.dispatchEvent?.(event));
    await wait(60);
    // Phoenix multi-selects tear down their virtual list on Escape; an extra
    // synthetic outside click races that teardown and corrupts its state.
    if (!control?.closest?.(".phoenix-select--multi")) ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((type) => document.body.dispatchEvent(new MouseEvent(type, { bubbles: true })));
    await wait(60);
    const ownPopupOpen = popupFor(control, false).length > 0;
    if (toggle && ownPopupOpen && isChoiceControl(control) && !control.matches('input[type=checkbox], input[type=radio], [role=checkbox], [role=radio]') && control?.click) { control.click(); await wait(60); }
  };
  const closeVisibleDropdowns = async (control) => {
    const closing = [...new Set([...popupFor(control, false),
      ...(lastOpenedControl === control && lastOpenedPopup && isPopup(lastOpenedPopup) ? [lastOpenedPopup] : []), nearbyPopup(control)])].filter(Boolean);
    await dismissDropdowns(control, true);
    if (openDropdowns().length) {
      const event = new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true });
      [document.activeElement, document, window].filter(Boolean).forEach((node) => node.dispatchEvent?.(event));
    }
    // Some cart menus ignore Escape. Cancel only inside the captured popup.
    for (const popup of closing.filter(node => node.isConnected && visible(node))) {
      const cancel = confirmationButton(popup, "取消");
      if (cancel) await clickOption(cancel, true, () => !visible(popup), null, true);
    }
    await waitFor(() => closing.every(popup => !popup.isConnected || !visible(popup)), 800);
    if (lastOpenedControl === control) lastOpenedPopup = null;
  };
  const closeDatePicker = async (calendar, control) => {
    control = control?.isConnected ? control : resolveField(elementKeys.get(control));
    const input = control?.matches?.("input") ? control : control?.querySelector?.("input");
    // Some editable pickers keep their editing state open after blur/Escape.
    input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", code: "Tab", bubbles: true }));
    input?.blur?.();
    await closeVisibleDropdowns(control);
  };
  const popupOptionNodes = (scope, deduplicate = true) => {
    const selector = "[role=option], li, [data-value], [class*='option'], [class*='Option'], [class*='item'], [class*='Item']";
    const text = (node) => clean(node.textContent || node.getAttribute("data-value") || node.getAttribute("value"));
    const action = (node) => node.matches?.("button, [role=button], [data-confirm], [data-confirm] *, [class*='button'], [class*='Button'], [class*='btn'], [class*='Btn']") || /^(?:确定|取消)$/.test(text(node));
    const candidates = [...new Set([...(scope?.querySelectorAll(selector) || [])].map(node => {
      const row = node.closest("[class*='list-item-container'], [class*='List-item-container']");
      // Search highlighting and category breadcrumbs are not separate choices.
      return row?.querySelector("[class*='item-text-label'], [class*='Item-text-label']") || node;
    }))].filter((node) => !node.matches('input, textarea, select') && !action(node) && visible(node) && !/empty|loading|hint|placeholder/i.test(String(node.className)) && !(/highlight/i.test(String(node.className)) && node.parentElement?.closest(selector) && scope.contains(node.parentElement.closest(selector))) && !/^(?:请输入|请选择|暂无(?:数据|选项)?|未查询到(?:备选项|候选项)|无匹配数据|加载中)[….]?$/.test(text(node)));
    const candidateSet = new Set(candidates);
    const candidateText = new Map(candidates.map((node) => [node, text(node)]));
    const aggregate = new Set();
    for (const child of candidates) for (let parent = child.parentElement; parent && parent !== scope; parent = parent.parentElement) {
      // A one-result menu and its row have the same text. Click the row/label,
      // whose event bubbles to its handler, rather than the enclosing menu.
      if (candidateSet.has(parent) && candidateText.get(child)) aggregate.add(parent);
    }
    const semantic = candidates.filter((node) => !aggregate.has(node));
    // Some component libraries use plain div/span rows. Keep their visible
    // leaf text only when no semantic option exists; otherwise nested labels
    // can turn a parent container into a fake “province + city” candidate.
    const leaves = semantic.length ? [] : [...(scope?.querySelectorAll("*") || [])].filter((node) => {
      const value = text(node);
      return value && value.length <= 80 && !node.matches('input, textarea, select') && !action(node) && ![...node.children].some((child) => visible(child) && text(child) === value);
    });
    const seen = new Set();
    return (semantic.length ? semantic : leaves).filter(visible).filter((node) => {
      const value = text(node);
      if (!value || /empty|loading|hint|placeholder/i.test(String(node.className)) || /^(?:请输入|请选择|暂无(?:数据|选项)?|未查询到(?:备选项|候选项)|无匹配数据|加载中)[….]?$/.test(value) || deduplicate && seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  };
  const popupOptionDetails = async (popup, scan = true) => {
    const texts = () => popupOptionNodes(popup)
      .map((node) => clean(node.textContent || node.getAttribute("data-value") || node.getAttribute("value")))
      .filter((text) => text && !/^请选择$|^暂无选项$/.test(text));
    if (!popup) return { texts: [], hasSearch: false, scrolled: false };
    const found = new Set(texts());
    const hasSearch = [...popup.querySelectorAll(searchInputSelector)].some(editableSearch);
    let scrolled = false;
    const scroller = [...(popup?.querySelectorAll("*") || [])]
      .filter((el) => el.clientHeight >= 40 && el.scrollHeight > el.clientHeight + 2)
      .sort((a, b) => b.clientHeight - a.clientHeight)[0];
    if (scan && scroller && found.size < 80) {
      const originalTop = scroller.scrollTop;
      // ponytail: cap portal scans; raise only for controls with over 80 meaningful choices.
      for (let pass = 0; pass < 12; pass++) {
        const nextTop = Math.min(scroller.scrollHeight - scroller.clientHeight, scroller.scrollTop + Math.max(80, scroller.clientHeight * 0.8));
        if (nextTop <= scroller.scrollTop) break;
        scrolled = true;
        scroller.scrollTop = nextTop;
        scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
        await wait(70);
        texts().forEach((text) => found.add(text));
      }
      scroller.scrollTop = originalTop;
      scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
      await wait(20);
    }
    return { texts: [...found].filter((text, index, all) => all.indexOf(text) === index).slice(0, 80), hasSearch, scrolled };
  };
  const popupOptionTexts = async (popup) => (await popupOptionDetails(popup)).texts;
  const waitForOptions = async (popup) => {
    if (!popup) return false;
    const loading = () => [...popup.querySelectorAll('[aria-busy=true], [loading-number], [class*=loading]')].some(node => visible(node) && (node.getAttribute('aria-busy') === 'true' || Number(node.getAttribute('loading-number')) > 0 || /(?:loading-loading|mask|spinner|rotate)/i.test(String(node.className))));
    const ready = () => !loading() && (popupOptionNodes(popup).length || /^(?:请输入|请选择|暂无(?:数据|选项)?|未查询到(?:备选项|候选项)|无匹配数据)/.test(clean(popup.textContent)));
    await waitFor(() => loading() || ready(), 1600);
    return loading() ? waitFor(ready, 5000) : ready();
  };
  async function liveOptions(keys, keepOpen = false, previousOptions = {}) {
    const wanted = new Set(keys || []);
    const schema = formSchema();
    const controls = fields();
    for (const descriptor of schema) {
      if (!descriptor) continue;
      if (wanted.size && !wanted.has(descriptor.key)) continue;
      const control = resolveField(descriptor.key);
      if (!control || controlValue(control) || !(isChoiceControl(control) || isAutocompleteControl(control))) continue;
      if (/radio|checkbox/.test(descriptor.type || "")) {
        if (control.matches(".phoenix-radio-group")) {
          descriptor.options = [...new Set([...control.querySelectorAll(".phoenix-radio")]
            .filter(el => visible(el) && !el.matches(".phoenix-radio--disabled, [aria-disabled=true]"))
            .map(el => clean(el.textContent)).filter(Boolean))];
          descriptor.optionSource = "radio";
          descriptor.optionCount = descriptor.options.length;
          continue;
        }
        descriptor.options = [...(fieldContainer(control)?.querySelectorAll("input[type=radio], input[type=checkbox], [role=radio], [role=checkbox]") || [])]
          .map((item) => clean(associatedLabels(item).at(-1) || item.value)).filter(Boolean).filter((text, index, all) => all.indexOf(text) === index);
        descriptor.optionSource = "radio";
        descriptor.optionCount = descriptor.options.length;
        continue;
      }
      if (/日期|时间|年月|date|month/i.test(`${descriptor.type || ""} ${descriptor.label || ""} ${descriptor.ariaLabel || ""} ${descriptor.placeholder || ""}`)) { descriptor.optionSource = "date-deferred"; continue; }
      const known = optionTexts(control);
      if (control.tagName === "SELECT") { descriptor.options = known; descriptor.optionSource = "native"; descriptor.optionCount = known.length; continue; }
      // An unconfirmed query can hide every option; it is not a selected value.
      const pendingQuery = editableSearch(control) && pendingSuggestions.has(control) ? control.value : "";
      if (pendingQuery) setSearchValue(control, "");
      if (lastOpenedControl && lastOpenedControl !== control) await closeVisibleDropdowns(lastOpenedControl);
      const nearestPopup = () => {
        const rect = control.getBoundingClientRect();
        return [...new Set([...popupFor(control, false), ...(lastOpenedControl === control && lastOpenedPopup && isPopup(lastOpenedPopup) ? [lastOpenedPopup] : [])])].sort((a, b) => {
          const distance = (el) => { const r = el.getBoundingClientRect(); return Math.abs(r.left - rect.left) + Math.abs(r.top - rect.top); };
          return distance(a) - distance(b);
        })[0];
      };
      const existingPopup = nearestPopup();
      const openedPopup = existingPopup || await openChoice(control);
      descriptor.opening = existingPopup ? { activation: "existing", popupFound: true } : { ...lastOpening };
      lastOpenedControl = control;
      let selectedPopup = lastOpenedPopup = openedPopup;
      await waitForOptions(selectedPopup);
      const scanPopup = !control.closest?.(".phoenix-select--multi");
      let popupDetails = await popupOptionDetails(selectedPopup, scanPopup);
      if (keepOpen && selectedPopup) {
        const previous = new Set(previousOptions?.[descriptor.key] || []);
        const before = new Set(popupDetails.texts);
        // Cascaders often replace the province pane a tick after its click.
        // Keep this one popup open and wait only for genuinely new candidates.
        if (!previous.size || !popupDetails.texts.some((text) => !previous.has(text))) await waitFor(() => {
          selectedPopup = nearestPopup() || selectedPopup;
          return popupOptionNodes(selectedPopup).some((node) => {
          const text = clean(node.textContent || node.getAttribute("data-value") || node.getAttribute("value"));
          return text && !before.has(text);
          });
        }, 1600);
        popupDetails = await popupOptionDetails(selectedPopup, scanPopup);
      }
      descriptor.options = [...new Set([...known, ...popupDetails.texts])].slice(0, 80);
      descriptor.optionSource = selectedPopup ? "popup" : "popup-not-found";
      descriptor.optionCount = descriptor.options.length;
      descriptor.hasSearch = popupDetails.hasSearch || control.tagName === "INPUT" && !control.readOnly;
      descriptor.candidatesTruncated = descriptor.options.length >= 80;
      descriptor.hasConfirmation = !!confirmationFor(selectedPopup, control);
      const cartText = clean(selectedPopup?.innerText || selectedPopup?.textContent);
      descriptor.isMultiSelector = !/已选(?:地区)?\s*\d+\s*\/\s*1(?!\d)/.test(cartText)
        && (isMultipleChoice(control, selectedPopup) || /(?:已选(?:地区)?\s*\d+\s*\/|清空已选)/.test(cartText));
      descriptor.scrolled = popupDetails.scrolled;
      if (!keepOpen) {
        if (pendingQuery) restoreChoiceSearch(control, pendingQuery);
        await closeVisibleDropdowns(control); lastOpenedControl = null;
      }
    }
    return schema;
  }
  const certificateExam = (name) => {
    const level = String(name || "").match(/CET\s*-?\s*(4|6)/i)?.[1];
    return level ? `CET${level}` : "";
  };
  const isEnglishCertificate = (row) => /(?:CET\s*-?\s*[46]|大学英语[四六]级|英语[四六]级|TEM\s*-?\s*[48]|IELTS|TOEFL|雅思|托福)/i.test(String(row?.name || ""));
  // ponytail: explicit contest/cup names or saved type suffice; ambiguous names need a supplied type.
  const competitionAward = (item) => !/奖学金/.test(item?.name || "") && /竞赛|大赛|比赛|杯/.test(`${item?.type || ""} ${item?.category || ""} ${item?.name || ""}`);
  const certificateScore = (row) => row?.score || String(row?.description || "").match(/^成绩[：:]\s*(.+)$/)?.[1]?.trim() || "";
  const rankOption = (value, candidates) => {
    if (!/[%％]/.test(String(value))) return null;
    const rank = Number(String(value || "").match(/\d+(?:\.\d+)?/)?.[0]);
    if (!Number.isFinite(rank) || rank < 0 || rank > 100) return null;
    return candidates.map((candidate) => {
      const text = clean(candidate.textContent || candidate);
      const bounds = /[%％]/.test(text) ? [...text.matchAll(/\d+(?:\.\d+)?/g)].map(match => Number(match[0])) : [];
      return { candidate, lower: bounds.length > 1 ? Math.min(...bounds) : 0, upper: bounds.length ? Math.max(...bounds) : NaN };
    }).filter(({ lower, upper }) => lower <= rank && rank <= upper && upper <= 100).sort((a, b) => a.upper - b.upper)[0]?.candidate || null;
  };
  const awardScope = (value) => clean(value).replace(/^(?:院级|校级)$/, "院校级").replace(/^(?:省级|省市级)$/, "省区级").replace(/^市级$/, "县市级");
  const awardLevel = (row) => {
    const level = String(row?.level || "").trim();
    if (!/^(一等奖|二等奖|三等奖|特等奖)$/.test(level)) return level;
    const name = String(row?.name || "");
    return /省/.test(name) ? "省区级" : /国家/.test(name) ? "国家级" : /院|校|学/.test(name) ? "院校级" : "";
  };
  const projectParts = (row) => {
    const text = String(row?.description || "").trim();
    if (row?.summary || row?.responsibilities) return { summary: row.summary || text, responsibilities: row.responsibilities || "" };
    const marker = text.search(/(?:^|\n)\s*(?=(?:项目职责|核心职责|职责)\s*[：:])/);
    return marker > 0 ? { summary: text.slice(0, marker).trim(), responsibilities: text.slice(marker).trim() } : { summary: text, responsibilities: "" };
  };
  const clickOption = async (el, trusted = false, changed, record, plainTrusted = false) => {
    if (!el || uploadControl(el)) { if (record) record.blocked = "upload-control"; return false; }
    const panel = document.getElementById("resume-autofill-page-action");
    const pointerEvents = panel?.style.pointerEvents;
    // Our review overlay must not intercept native clicks on page controls.
    if (panel) panel.style.pointerEvents = "none";
    try {
      if (trusted && globalThis.chrome?.runtime?.sendMessage) {
        const hitPoint = () => {
          const rect = el.getBoundingClientRect();
          for (const fraction of [0.5, 0.2, 0.8]) {
            const point = { x: rect.left + rect.width * fraction, y: rect.top + rect.height / 2 };
            const hit = document.elementFromPoint(point.x, point.y);
            if (hit && (hit === el || el.contains(hit))) return point;
          }
          return null;
        };
        // Portals realign after focus/scroll; scrolling a stale option moves its anchor again.
        if (!hitPoint() && !await waitFor(hitPoint, 350)) {
          el.scrollIntoView?.({ behavior: "instant", block: "center", inline: "nearest" });
          await wait(80);
          await waitFor(hitPoint, 800);
        }
        const rect = el.getBoundingClientRect();
        if (record) record.rect = { x: Math.round(rect.left), y: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) };
        let delivered = false;
        const observe = event => { if (event.target === el || el.contains(event.target)) delivered = true; };
        document.addEventListener("click", observe, true);
        try {
          const point = hitPoint();
          const result = point ? await chrome.runtime.sendMessage({ type: "RESUME_AUTOFILL_TRUSTED_CLICK", ...point, plain: plainTrusted }) : { clicked: false, reason: "target-not-at-point" };
          if (record) record.trusted = result?.clicked === true;
          if (record && result?.reason) record.trustedError = result.reason;
          if (result?.clicked && (changed ? await waitFor(changed, 800) : delivered)) return true;
          if (result?.clicked && !delivered && record) { record.trusted = false; record.trustedError = "trusted-click-not-observed"; }
        } catch (error) { if (record) record.trustedError = String(error?.message || error); }
        finally { document.removeEventListener("click", observe, true); }
      }
      if (record) record.fallback = true;
      const rect = el.getBoundingClientRect();
      const point = { bubbles: true, cancelable: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, button: 0 };
      const event = (type) => typeof PointerEvent === "function" && type.startsWith("pointer")
        ? new PointerEvent(type, { ...point, buttons: type.endsWith("down") ? 1 : 0, pointerId: 1, pointerType: "mouse", isPrimary: true })
        : new MouseEvent(type, { ...point, buttons: type.endsWith("down") ? 1 : 0 });
      // Phoenix's area rows bind selection on pointer-down; HTMLElement.click()
      // skips that phase and leaves the confirm button with no pending choice.
      ["pointerdown", "mousedown", "pointerup", "mouseup"].forEach((type) => el.dispatchEvent(event(type)));
      if (typeof el.click === "function") el.click();
      else el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return true;
    } finally { if (panel) panel.style.pointerEvents = pointerEvents; }
  };
  const selectionTarget = (option) => {
    let treeNode = option?.closest?.("[role=treeitem], [class*='tree__node'], [class*='tree-node'], [class*='TreeNode']")
      || (option?.parentElement?.matches?.("[role=treeitem], [class*='tree__node'], [class*='tree-node'], [class*='TreeNode']") ? option.parentElement : null);
    while (treeNode && !treeNode.querySelector('input[type=checkbox], [role=checkbox]'))
      treeNode = treeNode.parentElement?.closest("[role=treeitem], [class*='tree__node'], [class*='tree-node'], [class*='TreeNode']");
    const treeCheckbox = treeNode?.querySelector("input[type=checkbox], [role=checkbox]");
    if (treeCheckbox) return treeCheckbox;
    const menuItem = option?.matches?.("[class*='Menu-container'], [class*='menu-container']") ? option
      : option?.querySelector?.("[class*='Menu-container'], [class*='menu-container']");
    if (menuItem) return menuItem;
    const areaItem = option?.closest?.("[class*='area-item-container'], [class*='Area-item-container']");
    if (areaItem) return areaItem.querySelector("[class*='icon-container'], [class*='Icon-container']") || areaItem;
    const listItem = option?.closest?.("[class*='list-item-container'], [class*='List-item-container']");
    // Phoenix's two-column rows bind selection to the checkbox icon; other
    // list rows keep their full-row target.
    if (listItem) return /(?:^|\s)list-item-container-two(?:\s|$)/.test(String(listItem.className || ""))
      ? listItem.querySelector("[class*='icon-container'], [class*='Icon-container']") || listItem
      : listItem;
    // A branch row expands through its row/arrow; its radio icon selects the parent.
    if (option?.querySelector?.("[class*='arrow'], [class*='Arrow']")) return option;
    const marker = option?.querySelector?.("input[type=checkbox], input[type=radio], [role=checkbox], [role=radio], [aria-checked], [class*='Checkbox'], [class*='checkbox'], [class*='Radio'], [class*='radio']");
    if (marker) return marker.closest?.("input, label, button, [role=checkbox], [role=radio], [class*='icon'], [class*='Icon']") || marker;
    return option;
  };
  const selectionTargets = (option) => {
    const listItem = option?.closest?.("[class*='list-item-container'], [class*='List-item-container']");
    if (listItem) {
      const icon = listItem.querySelector("[class*='icon-container'], [class*='Icon-container']");
      const label = listItem.querySelector("[class*='item-text-label'], [class*='Item-text-label']");
      const twoColumn = /(?:^|\s)list-item-container-two(?:\s|$)/.test(String(listItem.className || ""));
      return [...new Set((twoColumn ? [icon, label, listItem] : [listItem, label, icon]).filter(Boolean))];
    }
    return [selectionTarget(option)];
  };
  const choiceState = (control, popup, target) => {
    const root = choiceRoot(control);
    const selected = clean(popup?.innerText || popup?.textContent).match(/已选(?:地区)?\s*\d+\s*\/\s*\d+/)?.[0] || "";
    return {
      input: clean(control?.value), current: controlValue(control),
      displays: [...(root?.querySelectorAll?.("[class*='display-value'], [aria-valuetext]") || [])].map((node) => clean(node.textContent || node.getAttribute("aria-valuetext"))).filter(Boolean),
      selected,
      controlConnected: !!control?.isConnected, targetConnected: !!target?.isConnected,
      popupConnected: !!popup?.isConnected, popupVisible: visible(popup)
    };
  };
  const logChoice = (stage, trace) => console.info("[resume-autofill][choice]", { stage, confirmed: !!trace?.confirmed, failure: trace?.failure || "" });
  const confirmationButton = (scope, caption = "确定") => {
    const nodes = [...(scope?.querySelectorAll("button, [role=button], [data-confirm], [class*='button'], [class*='Button'], [class*='btn'], [class*='Btn']") || [])];
    const leaf = nodes.find((el) => visible(el) && normalize(el.textContent) === caption && ![...el.children].some((child) => visible(child) && normalize(child.textContent) === caption))
      || [...(scope?.querySelectorAll("*") || [])].find((el) => visible(el) && normalize(el.textContent) === caption && ![...el.children].some((child) => visible(child) && normalize(child.textContent) === caption));
    // Phoenix rerenders its footer after a multi-value click. Its handler is
    // on the button root rather than its transient text/container node.
    return leaf?.closest?.(".phoenix-button") || leaf || null;
  };
  const confirmationFor = (popup, control) => {
    const scopes = []; const seen = new Set();
    for (let node = popup; node && !seen.has(node); node = node.parentElement) { scopes.push(node); seen.add(node); if (node === document.body) break; }
    for (let node = control; node && !seen.has(node); node = node.parentElement) { scopes.push(node); seen.add(node); if (node === document.body) break; }
    const anchor = (popup || control)?.getBoundingClientRect?.();
    return scopes.map(scope => confirmationButton(scope)).filter(Boolean).sort((a, b) => {
      const distance = (el) => !anchor ? 0 : Math.abs(el.getBoundingClientRect().left - anchor.left) + Math.abs(el.getBoundingClientRect().top - anchor.top);
      return distance(a) - distance(b);
    })[0] || null;
  };
  const pendingSuggestions = new WeakSet();
  const searchInputSelector = 'input:not([type]), input[type=text], input[type=search], textarea';
  const editableSearch = el => !!el?.matches?.(searchInputSelector) && visible(el) && !el.readOnly;
  const setSearchValue = (el, value) => {
    if (isAutocompleteControl(el)) pendingSuggestions.add(el);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter ? setter.call(el, String(value)) : (el.value = String(value));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const restoreChoiceSearch = (el, value) => {
    if (!el || el.tagName !== "INPUT" || el.value === value) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter ? setter.call(el, value) : (el.value = value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const popupMatchesValue = (popup, value) => {
    const wanted = normalize(value);
    return !!wanted && popupOptionNodes(popup).some((option) => {
      const text = normalize(option.textContent || option.getAttribute("data-value") || option.getAttribute("value"));
      return text === wanted || text.includes(wanted) || wanted.includes(text);
    });
  };
  const nearbySuggestionPopup = (control, value) => {
    const anchor = (choiceRoot(control) || control)?.getBoundingClientRect?.();
    if (!anchor) return null;
    return [...document.querySelectorAll("body *")].filter((popup) => {
      if (popup === control || popup.contains(control) || !visible(popup) || popup.closest('[aria-hidden="true"], [hidden], [inert]')) return false;
      const style = getComputedStyle(popup), rect = popup.getBoundingClientRect();
      return ["fixed", "absolute"].includes(style.position) && rect.width >= 80 && rect.height >= 24 && rect.height <= 700
        && rect.right >= anchor.left - 80 && rect.left <= anchor.right + 80
        && rect.bottom >= anchor.top - 360 && rect.top <= anchor.bottom + 500
        && popupMatchesValue(popup, value);
    }).sort((a, b) => popupOptionNodes(b).length - popupOptionNodes(a).length
      || Math.abs(a.getBoundingClientRect().top - anchor.bottom) - Math.abs(b.getBoundingClientRect().top - anchor.bottom))[0] || null;
  };
  const mayReopenSuggestions = (el) => el?.tagName === "INPUT" && !el.readOnly
    && (isSuggestionControl(el) || /(?:^|[-_])(?:input|field|control)(?:$|[-_])/i.test(`${el.className} ${el.parentElement?.className || ""}`));
  async function writeAndObserveSuggestion(label, value, target, chooseOptions = {}) {
    if (isAutocompleteControl(target)) return choose(label, value, target, false, chooseOptions);
    const before = new Set(openDropdowns());
    target.focus?.();
    if (!setValue(target, value, true)) return false;
    // An autocomplete may reuse a popup that was already open before typing.
    const popup = await waitFor(() => popupFor(target, false).find((candidate) => popupMatchesValue(candidate, value))
      || openDropdowns().find((candidate) => !before.has(candidate) && popupMatchesValue(candidate, value))
      || nearbySuggestionPopup(target, value), 180);
    if (!popup) {
      target.dispatchEvent(new Event("change", { bubbles: true }));
      target.dispatchEvent(new Event("blur", { bubbles: true }));
      return true;
    }
    return choose(label, value, target, false, { ...chooseOptions, popup });
  }

  const fieldHandles = new Map();
  const elementKeys = new WeakMap();
  const scanId = Math.random().toString(36).slice(2);
  let fieldSequence = 0;
  const identityLabel = (el) => clean(fieldTitle(el) || el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.name || el.id || labelText(el)).slice(0, 160);
  const fieldIdentity = (el) => {
    const dateParts = dateControls(el);
    return JSON.stringify([moduleTitle(el), identityLabel(el), controlType(el), el.name || "", el.id || "", el.autocomplete || "", dateParts.length >= 2 ? dateParts.indexOf(el) : -1]);
  };
  function rememberField(el, controls) {
    const existing = elementKeys.get(el);
    if (existing && fieldHandles.has(existing)) return existing;
    controls ||= fields();
    // ponytail: keep handles only for this document, bounded to 2000 controls.
    if (fieldHandles.size >= 2000) fieldHandles.delete(fieldHandles.keys().next().value);
    const key = `${scanId}:${++fieldSequence}`;
    const label = identityLabel(el);
    const module = moduleTitle(el);
    const repeated = hasKnownSection(module) || controls.filter((other) => moduleTitle(other) === module && identityLabel(other) === label).length > 1;
    fieldHandles.set(key, { el, identity: fieldIdentity(el), label, module, root: choiceRoot(el), row: repeated ? repeatedContainer(el, label) : null });
    elementKeys.set(el, key);
    return key;
  }
  function resolveField(key) {
    const saved = fieldHandles.get(key);
    if (!saved) return null;
    if (saved.el.isConnected) return editable(saved.el) && fieldIdentity(saved.el) === saved.identity ? saved.el : null;
    // A rebuilt/reordered repeated module has no proven row identity. Never
    // migrate an old handle to a row that happens to occupy the same index.
    if (saved.row && !saved.row.isConnected) return null;
    // A selected control may remove its editing input. Keep only its original,
    // still-connected root and row; never adopt a different field or module.
    if (saved.root?.isConnected && !saved.root.querySelector(controlSelector) && editable(saved.root)
      && identityLabel(saved.root) === saved.label && moduleTitle(saved.root) === saved.module) {
      saved.el = saved.root;
      saved.identity = fieldIdentity(saved.root);
      elementKeys.set(saved.root, key);
      return saved.root;
    }
    const matches = fields().filter((el) => fieldIdentity(el) === saved.identity && (!saved.row || saved.row.contains(el)));
    if (matches.length !== 1) return null;
    saved.el = matches[0];
    elementKeys.set(saved.el, key);
    return saved.el;
  }
  function formSchema() {
    const previousControls = schemaControls;
    // Only this synchronous scan shares a list; selections and later scans must rediscover controls.
    schemaControls = fields();
    try {
    // Disabled dependent inputs still belong to the form; never try to write them.
    const controls = [...new Set([...fields(), ...document.querySelectorAll("input:disabled, select:disabled, textarea:disabled, input[aria-disabled=true]")])]
      .filter((el) => !uploadControl(el) && (editable(el) || visible(el) && !["hidden", "password", "file"].includes(el.type) && !!fieldTitle(el)));
    const moduleRows = new Map();
    for (const [key, saved] of fieldHandles) if (!saved.el.isConnected) resolveField(key);
    const metadata = controls.map((el, index) => {
      // Prefer the nearest visible label. Ancestor text often repeats “请选择”
      // and every sibling label, which makes an otherwise precise AI request noisy.
      const label = clean(fieldTitle(el) || el.getAttribute("aria-label") || associatedLabels(el)[0] || el.getAttribute("placeholder") || labelText(el) || el.name || el.id);
      const stableLabel = normalize(fieldTitle(el) || el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.name || el.id || labelText(el) || `field${index}`);
      const module = moduleTitle(el);
      const repeat = repeatIndex(el, label);
      const base = [normalize(module) || "page", stableLabel, el.name || el.id || controlType(el), repeat].filter(Boolean).join("::");
      return { el, index, label, module, repeat, base };
    });
    const ordinals = new Map();
    return metadata.map(({ el, index, label, module, repeat, base }) => {
      const ordinal = ordinals.get(base) || 0;
      ordinals.set(base, ordinal + 1);
      const key = rememberField(el, controls);
      const occurrence = ordinal;
      const references = (attribute) => clean(el.getAttribute(attribute)).split(" ").filter(Boolean)
        .map((id) => clean(document.getElementById(id)?.textContent).slice(0, 100)).slice(0, 3);
      const data = Object.fromEntries([...el.attributes].filter(({ name, value }) => /^data-(?:label|field|name|title|testid|field-key)$/.test(name)
        && value.length <= 80 && !/[a-f0-9]{16}|[a-z0-9_-]{40}/i.test(value)).map(({ name, value }) => [name, value]));
      const anchor = /教育|学历/.test(module) ? "学校名称" : /工作|实习|任职/.test(module) ? "公司名称" : /项目/.test(module) ? "项目名称" : /证书|英语/.test(module) ? "证书名称" : /语言|外语/.test(module) ? "语言类型" : /获奖|奖励|竞赛|大赛|比赛|荣誉|奖学金/.test(module) ? "获奖项" : /技能|计算机能力/.test(module) ? "技能名称" : /干部|社团|校园经历|在校实践|校内实践/.test(module) ? "职务" : "";
      if (anchor && !moduleRows.has(module)) moduleRows.set(module, rowContainers(anchor, module));
      const rows = moduleRows.get(module) || [];
      const row = rows.find((container) => container.contains(el));
      const anchorField = row && [...row.querySelectorAll(controlSelector)].find((control) => anchorMatch(control, anchor));
      // ponytail: a name selector follows its preceding type/category in the same record.
      const educationParent = /教育|学历/.test(module) && row && /学院|院系|专业/.test(label)
        ? metadata.filter((field) => row.contains(field.el) && (/专业/.test(label) ? /学院|院系/.test(field.label) : /学校|院校/.test(field.label))).at(-1)?.el : null;
      const gpaParent = row && anchorMatch(el, "GPA") ? metadata.find(field => row.contains(field.el) && /GPA.*(?:类型|BASE)|绩点.*(?:类型|满分|制式)|满绩/i.test(field.label))?.el : null;
      const languageCategoryDetail = /语言考试|语言水平|掌握程度|熟练程度|精通程度|等级自评|相关证书|语言证书|听说|读写/.test(label);
      const languagePeers = languageCategoryDetail || /外语等级|考试分数/.test(label) ? metadata.filter(field => field.index < index && field.module === module
        && (row ? row.contains(field.el) : fieldContainer(field.el) === fieldContainer(el) || fieldContainer(field.el)?.parentElement === fieldContainer(el)?.parentElement || field.repeat === repeat)) : [];
      const languageCategory = languagePeers.filter(field => /^(?:语言类型|语言类别|外语类别|语言名称|语种)[＊*]?$/.test(field.label)).at(-1)?.el;
      const languageParent = (/^(?:语言考试|语言水平|掌握程度|熟练程度|精通程度|等级自评|相关证书|语言证书|外语等级|考试分数|听说(?:能力|水平)?|读写(?:能力|水平)?)[＊*]?$/.test(label)
        || languageCategoryDetail && anchor === "语言类型")
        ? languageCategoryDetail && anchor === "语言类型" && row && anchorField ? anchorField : languageCategoryDetail ? languageCategory
          : languagePeers.filter(field => /^(?:语言考试|英语等级)[＊*]?$/.test(field.label)).at(-1)?.el : null;
      const parentChoice = educationParent || gpaParent || languageParent || (isChoiceControl(el) && /名称/.test(label) && row
        ? metadata.filter((field) => field.index < index && row.contains(field.el) && isChoiceControl(field.el) && /类型|类别/.test(field.label)).at(-1)?.el : null);
      return {
        key, index,
        label: label.slice(0, 160), labels: associatedLabels(el).slice(0, 3).map((value) => value.slice(0, 100)),
        ariaLabel: clean(el.getAttribute("aria-label")), placeholder: clean(el.getAttribute("placeholder")),
        name: clean(el.name), id: clean(el.id),
        autocomplete: clean(el.autocomplete), title: clean(el.title).slice(0, 100), data,
        ariaLabelledby: references("aria-labelledby"), ariaDescribedby: references("aria-describedby"),
        required: !!el.required || el.getAttribute("aria-required") === "true", role: el.getAttribute("role") || "",
        isChoice: isChoiceControl(el),
        blocked: !!el.disabled || el.getAttribute("aria-disabled") === "true",
        constraints: { maxLength: el.maxLength >= 0 ? el.maxLength : undefined, pattern: el.pattern || "", min: el.min || "", max: el.max || "", step: el.step || "" },
        gpaScaleValue: row && /GPA|绩点/i.test(label) ? controlValue([...row.querySelectorAll(controlSelector)].find(control => /GPA.*(?:类型|BASE)|绩点.*(?:类型|满分|制式)|满绩/i.test(fieldTitle(control)))) : "",
        examValue: /外语等级|考试分数/.test(label) ? controlValue(languageParent) : "",
        languageValue: languageParent ? controlValue(/外语等级|考试分数/.test(label) ? languageCategory : languageParent) : "",
        examScoreValue: /语言考试|英语等级/.test(label) ? controlValue(metadata.find(field => /考试分数/.test(field.label) && (row ? row.contains(field.el) : fieldContainer(field.el) === fieldContainer(el) || field.module === module && field.repeat === repeat))?.el) : "",
        narrative: el.tagName === "TEXTAREA" && !!anchor && !anchorField,
        dependsOn: parentChoice ? rememberField(parentChoice, controls) : "",
        rowAnchor: anchorField ? { label: anchor, value: controlValue(anchorField), choice: isChoiceControl(anchorField) } : null,
        rowAnchors: rows.map(container => controlValue([...container.querySelectorAll(controlSelector)].find(control => anchorMatch(control, anchor)))),
        rowDescriptions: /^(?:证书名称|获奖项)$/.test(anchor) ? rows.map(rowDescription) : [],
        module, repeatIndex: row ? rows.indexOf(row) : repeat, occurrence, currentValue: controlValue(el),
        type: controlType(el), options: optionTexts(el)
      };
    });
    } finally { schemaControls = previousControls; }
  }

  const matchReviewField = (schema, locator) => {
    if (!locator || typeof locator.label !== "string" || !Number.isInteger(locator.row) || locator.row < 0) return null;
    const label = normalize(locator.label.replace(/[＊*]/g, ""));
    const module = normalize(locator.module || "");
    const matches = (schema || []).filter((field) => normalize(String(field.label || "").replace(/[＊*]/g, "")) === label
      && (!module || normalize(field.module || "") === module) && field.repeatIndex === locator.row);
    return matches.length === 1 ? matches[0] : null;
  };

  async function applyAssignments(assignments) {
    let filled = 0;
    const diagnostics = [];
    for (const assignment of assignments || []) {
      const el = resolveField(assignment.key);
      const detail = { key: assignment.key, label: el ? identityLabel(el) : "", value: assignment.value || "" };
      if (!el || !assignment.value) { diagnostics.push({ ...detail, stage: "scan", reason: "field-not-found" }); continue; }
      if (controlValue(el) && !(mayReopenSuggestions(el) && normalize(controlValue(el)) === normalize(assignment.value))) { diagnostics.push({ ...detail, reason: "page-value-protected" }); continue; }
      if (!Number.isFinite(Number(assignment.confidence)) || Number(assignment.confidence) < 0.65 && !isChoiceControl(el)) { diagnostics.push({ ...detail, reason: "low-confidence" }); continue; }
      const targetLabel = assignment.label || identityLabel(el);
      // Guard the common AI failure: dates/scores must not land in free-text descriptions.
      if (isDescription(targetLabel) && looksLikeDate(assignment.value)) { diagnostics.push({ ...detail, reason: "description-date-protected" }); continue; }
      if (looksLikeDate(assignment.value) && !/(日期|时间|年月)/.test(normalize(targetLabel))) { diagnostics.push({ ...detail, reason: "date-field-mismatch" }); continue; }
      if (await applyValue(targetLabel, assignment.value, el, { deferConfirm: !!assignment.deferConfirm, sourceValue: assignment.sourceValue, locationHint: assignment.locationHint })) { filled++; diagnostics.push({ ...detail, stage: "interaction", reason: "filled", actual: controlValue(resolveField(assignment.key)), choice: lastChoice }); }
      else if (assignment.deferConfirm && lastChoice?.cascadePending) diagnostics.push({ ...detail, reason: "cascade-parent-selected", actual: controlValue(el), choice: lastChoice });
      else diagnostics.push({ ...detail, stage: "interaction", reason: "page-option-or-validation-failed", actual: controlValue(resolveField(assignment.key)), choice: lastChoice });
    }
    return { filled, diagnostics };
  }

  let lastOpenedControl = null;
  let lastOpenedPopup = null;
  let lastChoice = null;
  let lastOpening = null;
  const atsxPeriodParts = (target) => {
    const picker = target?.closest?.(".atsx-date-picker-period-month");
    return picker ? [...picker.querySelectorAll(":scope > .atsx-date-picker-period-month-label")] : [];
  };
  const datePartText = (el) => clean(el?.getAttribute?.("placeholder") || el?.getAttribute?.("aria-label")).toLowerCase();
  const isYearPart = (el) => /年|year|yyyy/.test(datePartText(el));
  const isMonthPart = (el) => /^(?:月(?:份)?|month|mm|请选择月(?:份)?|选择月(?:份)?)$/i.test(datePartText(el));
  const fullDateRange = (target) => {
    const range = target?.closest?.("[class*='picker'][class*='range'], [class*='date-editor'][class*='range']");
    const inputs = [...(range?.querySelectorAll("input") || [])].filter(visible);
    return inputs.length === 2 && inputs.every((input) => /日期|时间|开始月|结束月|date|time|start.*month|end.*month/i.test(input.placeholder) && !isYearPart(input) && !isMonthPart(input)) ? inputs : [];
  };
  const dateControls = (target) => {
    if (fullDateRange(target).includes(target)) return [];
    const atsxParts = atsxPeriodParts(target);
    if (atsxParts.includes(target)) return atsxParts;
    if (!/日期|时间|年月|date|month|year|yyyy|calendar|picker/i.test(`${fieldTitle(target)} ${datePartText(target)} ${target?.className || ""} ${target?.name || ""} ${target?.id || ""}`)) return [];
    const box = fieldContainer(target);
    let nearestPair = [];
    for (let node = target?.parentElement, depth = 0; node && depth < 16; node = node.parentElement, depth++) {
      const isDateRange = /date|month|time/i.test(String(node.className || "")) && /range|info|picker/i.test(String(node.className || ""));
      const controls = [...node.querySelectorAll("input, [role=combobox]")].filter((el) => visible(el)
        && !["checkbox", "radio"].includes(el.type)
        && (isYearPart(el) || isMonthPart(el) || /select|date|month|picker|calendar/i.test(String(el.className || "")) || isDateRange && isChoiceControl(el)));
      if (controls.length >= 2 && controls.includes(target)) {
        const text = clean(node.innerText || node.textContent);
        const ordered = [...controls].sort((left, right) => {
          const a = left.getBoundingClientRect(); const b = right.getBoundingClientRect();
          return Math.abs(a.top - b.top) > 4 ? a.top - b.top : a.left - b.left;
        });
        // Some range pickers leave the end controls anonymous.  Their stable
        // signal is four Selects beside a range separator, not placeholders.
        if (isDateRange && ordered.length === 4 && /[-—–]/.test(text)) return ordered;
        if (isDateRange && ordered.length === 2 && !/起止|就读|区间|范围/.test(fieldTitle(target))) return ordered;
        if (!nearestPair.length && ordered.every((el) => isYearPart(el) || isMonthPart(el))) nearestPair = ordered;
      }
      // Some forms expose date pickers as anonymous inputs (no placeholder,
      // aria-label, or date class). Their stable signal is the nearby range
      // label and separator; the first four controls are year/month pairs.
      const text = clean(node.innerText || node.textContent);
      const anonymous = [...node.querySelectorAll("input, [role=combobox]")].filter((el) => visible(el) && !["checkbox", "radio"].includes(el.type));
      const datePartsOnly = anonymous.filter((el) => /日期|时间|年月|date|month/i.test(`${semanticText(el)} ${labelText(el)}`));
      if (/(起止时间|就读时间|获奖时间|开始时间|结束时间|毕业时间|教育结束)/.test(text) && text.includes("-") && datePartsOnly.length === 4 && datePartsOnly.includes(target)) return datePartsOnly;
      if (node === box && node.matches(".form-item, .form-group, .field, fieldset, [data-field], [class*='form-item'], [class*='formily-item'], [class*='apply-field']")) break;
    }
    return nearestPair;
  };
  const dateValueMatches = (target, expected) => {
    target = target?.isConnected ? target : resolveField(elementKeys.get(target));
    if (!target) return false;
    const [year, month, day] = dateParts(expected);
    if (!year || !month) return false;
    const controls = dateControls(target); const index = controls.indexOf(target);
    if (index < 0 && isYearPart(target)) return dateParts(controlValue(target))[0] === year;
    if (atsxPeriodParts(target).includes(target)) {
      const actual = dateParts(controlValue(target));
      return actual[0] === year && actual[1] === month;
    }
    if (index >= 0) {
      const actual = dateParts(controlValue(target));
      if (actual.length >= 2) {
        return actual[0] === year && actual[1] === month && (!day || !actual[2] || actual[2] === day);
      }
      const first = index - index % 2;
      const start = Number(String(controlValue(controls[first])).replace(/\D/g, ""));
      const end = Number(String(controlValue(controls[first + 1])).replace(/\D/g, ""));
      // Year/month hints can disappear after selection or rerender; verify both displayed parts.
      return start === Number(year) && end === Number(month);
    }
    const actual = dateParts(controlValue(target));
    return actual[0] === year && actual[1] === month && (!day || !actual[2] || actual[2] === day);
  };
  const hasWrongPickerYear = (target, expected) => {
    const actual = dateParts(controlValue(target)); const wanted = dateParts(expected);
    return actual[0] && actual[1] && wanted[0] && wanted[1] && actual[0] !== wanted[0] && actual[1] === wanted[1];
  };
  async function choose(label, value, target, skipDatePair = false, chooseOptions = {}) {
    const finishDatePicker = (calendar, control) => chooseOptions.keepDateRangeOpen && (trace.confirmed || trace.rangeStartPending) ? Promise.resolve() : closeDatePicker(calendar, control);
    if (target) rememberField(target);
    const trace = lastChoice = {
      label,
      value: String(value || ""),
      target: {
        tag: target?.tagName || "",
        placeholder: target?.getAttribute?.("placeholder") || "",
        choice: !!target && isChoiceControl(target),
        skipDatePair: !!skipDatePair
      }
    };
    if (!value) { trace.failure = "empty-value"; return false; }
    if (target?.matches(".phoenix-radio-group")) {
      const options = [...target.querySelectorAll(".phoenix-radio")]
        .filter(el => visible(el) && !el.matches(".phoenix-radio--disabled, [aria-disabled=true]"));
      const matches = options.filter(el => normalize(el.textContent) === normalize(value));
      trace.path = "radio-group";
      trace.candidates = options.map(el => clean(el.textContent));
      if (matches.length !== 1) { trace.failure = "radio-option-not-found"; return false; }
      const key = rememberField(target);
      await clickOption(matches[0]);
      trace.confirmed = !!await waitFor(() => normalize(controlValue(resolveField(key))) === normalize(value), 800);
      if (!trace.confirmed) trace.failure = "radio-value-not-confirmed";
      return trace.confirmed;
    }
    if (target?.tagName === "SELECT") {
      trace.path = "native-select";
      const educationOptions = /学历类型|受教育类型|培养方式|学习形式|学习方式|就读方式/.test(label) && /全日制|统招|非统招|自学考试/.test(value)
        ? [...target.options].filter(option => !option.disabled && !option.closest("optgroup[disabled]")) : [];
      const exactEducation = educationOptions.find(option => normalize(option.text) === normalize(value));
      const educationType = exactEducation || educationOptions.filter((option) =>
        /是否全日制/.test(fieldTitle(target)) ? /非全日制/.test(value) ? option.text === "否" : /全日制|统招/.test(value) && option.text === "是"
          : /非全日制/.test(value) ? /非全日制/.test(option.text) : /非统招/.test(value) ? /非统招/.test(option.text) : /自学考试/.test(value) ? /自学考试/.test(option.text) : /全日制|统招/.test(value) ? /全日制/.test(option.text) && !/非全日制/.test(option.text) : false)[0];
      if (educationOptions.length && !educationType) { trace.failure = "education-type-not-confirmed"; return false; }
      trace.confirmed = setValue(target, educationType?.value || value);
      if (!trace.confirmed) trace.failure = "native-select-no-match";
      return trace.confirmed;
    }
    const [year, month, day] = dateParts(value);
    const atsxParts = atsxPeriodParts(target);
    if (year && month && atsxParts.includes(target)) {
      trace.path = "atsx-period-month";
      target.click();
      const cy = target.getAttribute("data-cy");
      const panel = await waitFor(() => cy && document.querySelector(`[data-cy="${CSS.escape(`${cy}Dropdown`)}"]`), 1000);
      const lists = [...(panel?.querySelectorAll(".atsx-date-picker-period-month-panel-list") || [])];
      const item = (list, wanted) => [...(list?.querySelectorAll(".atsx-date-picker-period-month-panel-list-item") || [])]
        .find((node) => node.getAttribute("data-cy") === wanted);
      const yearItem = item(lists[0], year);
      trace.datePicker = { protocol: CONTENT_PROTOCOL, panelFound: !!panel, target: cy || "", year, month: Number(month), yearFound: !!yearItem };
      if (yearItem) yearItem.click();
      const monthItem = await waitFor(() => item((panel?.isConnected ? panel : document.querySelector(`[data-cy="${CSS.escape(`${cy}Dropdown`)}"]`))?.querySelectorAll(".atsx-date-picker-period-month-panel-list")[1], pad2(month)), 800);
      trace.datePicker.monthFound = !!monthItem;
      if (monthItem) monthItem.click();
      trace.selectedValue = value;
      trace.confirmed = !!monthItem && !!await waitFor(() => dateValueMatches(target, value), 1000);
      trace.datePicker.after = controlValue(target);
      if (!trace.confirmed) trace.failure = monthItem ? "display-not-confirmed" : "atsx-period-option-not-found";
      await closeVisibleDropdowns(target);
      return trace.confirmed;
    }
    const atsxYearPicker = target?.matches?.('input[placeholder="YYYY"]') && target.closest(".atsx-date-picker");
    if (year && atsxYearPicker) {
      trace.path = "atsx-year-picker";
      target.click();
      const cy = target.getAttribute("data-cy");
      const panelFor = () => cy && document.querySelector(`[data-cy="${CSS.escape(`${cy}Dropdown`)}"]`);
      let panel = await waitFor(panelFor, 1000);
      const optionFor = () => panel?.querySelector(`[data-cy="${CSS.escape(year)}"]`);
      for (let attempts = 0; !optionFor() && attempts < 20; attempts++) {
        const range = clean(panel?.querySelector('[data-cy="year"]')?.textContent).match(/(\d{4})\D+(\d{4})/);
        const direction = range && Number(year) < Number(range[1]) ? "prev" : "next";
        const button = panel?.querySelector(`[data-cy="${direction}"]`);
        if (!button) break;
        button.click();
        await wait(40);
        panel = panelFor() || panel;
      }
      const yearOption = optionFor();
      trace.datePicker = { protocol: CONTENT_PROTOCOL, panelFound: !!panel, target: cy || "", year, yearFound: !!yearOption };
      if (yearOption) yearOption.click();
      trace.selectedValue = year;
      trace.confirmed = !!yearOption && !!await waitFor(() => normalize(controlValue(target)) === normalize(year), 1000);
      trace.datePicker.after = controlValue(target);
      if (!trace.confirmed) trace.failure = yearOption ? "display-not-confirmed" : "atsx-year-option-not-found";
      await closeVisibleDropdowns(target);
      return trace.confirmed;
    }
    const pairedControls = !skipDatePair && year && month ? dateControls(target) : [];
    const pairIndex = pairedControls.indexOf(target);
    const initialMonthValue = pairIndex >= 0 && pairIndex % 2 === 0 ? controlValue(pairedControls[pairIndex + 1]) : "";
    const monthControl = isMonthPart(target) || (pairIndex >= 0 && pairIndex % 2 === 1);
    const matchValue = pairIndex >= 0 ? (monthControl ? String(Number(month)) : year) : value;
    if (lastOpenedControl && lastOpenedControl !== target) {
      await closeVisibleDropdowns(lastOpenedControl);
      lastOpenedControl = null;
    }
    const wanted = normalize(matchValue);
    const wantedForms = dateForms(matchValue).map(normalize);
    const areaName = (text) => normalize(text).replace(/(?:特别行政区|自治区|自治州|省|市|地区|盟|区|县)$/g, "");
    const sameArea = (left, right) => areaName(left) === areaName(right);
    const locationName = (text) => areaName(String(text).replace(/(?:总部|分部|办事处)$/g, ""));
    const optionForms = [matchValue,
      /(?:获奖|奖项|奖励|大赛|比赛|竞赛)(?:级别|等级)/.test(label) && awardScope(value),
      /家庭|家乡|籍贯|居住地|户籍|户口|所在地点|所在地/.test(label) && String(value).replace(/[\/／]/g, "")
    ].filter(Boolean).map(normalize);
    // Month-only controls on this page expose 8/1 instead of 08/01.
    const numericMonth = monthControl && String(Number(month || value));
    const salaryToken = (text) => normalize(text).replace(/(?:税前|人民币|元|每月|月薪|薪资|工资|待遇)/g, "");
    let locationOptionMatches = null;
    let locationSearchTerms = [];
    const matches = (text) => {
      const normalized = normalize(text);
      if (!normalized) return false;
      if (locationOptionMatches) return locationOptionMatches(text);
      const monthToken = normalized.replace(/月$/, "");
      const numericMonthMatch = numericMonth && /^\d{1,2}$/.test(monthToken) && Number(monthToken) === Number(numericMonth);
      const forms = [...wantedForms, ...optionForms];
      if (/(?:获奖|奖项|奖励|大赛|比赛|竞赛)(?:级别|等级)/.test(label)) return normalize(awardScope(text)) === normalize(awardScope(value));
      if (/薪|工资|待遇/.test(label)) return forms.some((form) => salaryToken(normalized) === salaryToken(form));
      if (isLocationLabel(label)) return locationName(text) === locationName(value);
      if (isSchoolLabel(label)) return normalized === wanted;
      const educationTypeMatch = /学历类型|受教育类型|培养方式|学习形式|学习方式|就读方式/.test(label)
        && (/是否全日制/.test(fieldTitle(target)) ? /非全日制/.test(value) ? normalized === "否" : /全日制|统招/.test(value) && normalized === "是"
          : /非全日制/.test(value) ? /非全日制/.test(normalized) : /全日制|统招/.test(value) ? /全日制/.test(normalized) && !/非全日制/.test(normalized) : false);
      if (/学历类型|受教育类型|培养方式|学习形式|学习方式|就读方式/.test(label)) return educationTypeMatch;
      return numericMonthMatch || forms.some((form) => normalized === form || normalized.includes(form) || form.includes(normalized));
    };
    if (year && month && /(日期|时间|年月)/.test(label)) {
      // Paired year/month Selects stay on the regular option path. A single
      // custom control is a date picker only when its visible popup proves it.
      const explicitDateControl = target && /date|month|picker|calendar/i.test(String(target.className || ""));
      const dateControl = target && (explicitDateControl || !pairedControls.length) ? target : null;
      if (dateControl) {
        trace.path = "calendar";
        const dateBox = fieldContainer(dateControl);
        const liveDateControl = () => dateControl.isConnected ? dateControl : resolveField(elementKeys.get(dateControl));
        if (!chooseOptions.keepExistingCalendar) liveDateControl()?.scrollIntoView?.({ block: "center", inline: "nearest" });
        await wait(80);
        const dateInput = liveDateControl()?.matches?.("input") ? liveDateControl() : liveDateControl()?.querySelector?.("input");
        const dateTrigger = () => dateInput?.matches?.(".phoenix-select__input--unText")
          ? choiceRoot(liveDateControl()) || liveDateControl() : dateInput || liveDateControl();
        const priorDatePopups = new Set(openDropdowns());
        if (!document.hasFocus()) globalThis.focus?.();
        (dateInput || liveDateControl())?.focus?.({ preventScroll: true });
        await wait(80);
        const rect = dateControl.getBoundingClientRect();
        const popupDistance = (popup) => { const r = popup.getBoundingClientRect(); return Math.abs(r.left - rect.left) + Math.min(Math.abs(r.top - rect.bottom), Math.abs(r.bottom - rect.top)); };
        const popupRoots = () => popupFor(liveDateControl() || dateControl).filter((popup) => isPopup(popup) && !/leave|exit/.test(String(popup.className || ""))).sort((a, b) => {
          return Number(priorDatePopups.has(a)) - Number(priorDatePopups.has(b)) || popupDistance(a) - popupDistance(b);
        }).slice(0, 1);
        const exactText = (node) => clean(node?.innerText || node?.textContent || node?.getAttribute?.("aria-label") || node?.getAttribute?.("title") || node?.getAttribute?.("data-value") || node?.getAttribute?.("value"));
        const dateText = (node) => exactText(node).replace(/\s/g, "").replace(/^(一|二|三|四|五|六|七|八|九|十|十一|十二)月$/, (_match, month) => `${["一","二","三","四","五","六","七","八","九","十","十一","十二"].indexOf(month) + 1}月`);
        const exactNodes = (scope, pattern) => [...scope.querySelectorAll("*")].filter((node) => {
          const text = dateText(node);
          return visible(node) && pattern.test(text) && ![...node.children].some((child) => visible(child) && dateText(child) === text);
        });
        const calendarIsOpen = () => popupRoots().some((popup) => popup.matches?.("[class*='calendar'], [class*='Calendar']")
          || popup.querySelector?.("[class*='calendar'], [class*='Calendar'], [role=grid], table td")
          || new Set(exactNodes(popup, /^(?:0?[1-9]|1[0-2])月$/).map(dateText)).size >= 6);
        // Focus can open the picker. Clicking again would close it and expose another field's portal.
        const focusOpened = calendarIsOpen() && popupRoots().some((popup) => !priorDatePopups.has(popup) || popupDistance(popup) < 48);
        if (!focusOpened && !(chooseOptions.keepExistingCalendar && openDropdowns().some((popup) => popup.querySelector("table, [role=grid]")))) await clickOption(dateTrigger());
        if (!await waitFor(calendarIsOpen, 1400)) {
          const alternateTrigger = dateInput && dateTrigger() !== dateInput ? dateInput : choiceRoot(liveDateControl()) || dateTrigger();
          await clickOption(alternateTrigger, true, calendarIsOpen);
          await waitFor(calendarIsOpen, 1400);
        }
        const invalidYearList = () => popupRoots().some((popup) => {
          const numbers = exactNodes(popup, /^-?\d{1,4}$/).map(dateText);
          return numbers.length >= 6 && numbers.some((text) => Number(text) <= 0) && !numbers.some((text) => /^\d{4}$/.test(text));
        });
        const reopenYearList = invalidYearList();
        if (reopenYearList) {
          // Focus can mount a cached year list before its anchor is initialized.
          // End editing before reopening; blur alone can leave the cached panel mounted.
          await closeDatePicker(null, liveDateControl());
          await waitFor(() => !calendarIsOpen(), 400);
          (liveDateControl()?.querySelector?.("input") || liveDateControl())?.focus?.({ preventScroll: true });
          await wait(80);
          if (!calendarIsOpen()) await clickOption(liveDateControl(), true, calendarIsOpen);
          await waitFor(() => calendarIsOpen() && !invalidYearList(), 1400);
        }
        const popupNodes = () => [...new Set(popupRoots().flatMap((popup) => [popup, ...popup.querySelectorAll("*")]))].filter(visible);
        const visibleMonthNodes = [...new Set(popupRoots().flatMap((popup) => [...exactNodes(popup, /^(?:0?[1-9]|1[0-2])月$/), ...popupOptionNodes(popup).filter((node) => /^(?:0?[1-9]|1[0-2])月$/.test(dateText(node)))]))];
        const visibleYearNodes = popupRoots().flatMap((popup) => {
          const years = exactNodes(popup, /^\d{4}年?$/);
          if (years.length) return years;
          // A month portal may render its year header as a separate sibling.
          const anchor = popup.getBoundingClientRect();
          const headers = [...(popup.parentElement?.children || [])].filter((node) => {
            const box = node.getBoundingClientRect(); const position = getComputedStyle(node).position;
            return node !== popup && visible(node) && /fixed|absolute/.test(position) && !/leave|exit/.test(String(node.className || ""))
              && !node.querySelector(controlSelector) && Math.abs(box.left - anchor.left) < 40 && Math.abs(box.bottom - anchor.top) < 80;
          }).flatMap((node) => exactNodes(node, /^\d{4}年?$/));
          return headers.length === 1 ? headers : [];
        });
        const panelCandidates = [...new Set([...popupRoots(), ...visibleMonthNodes].flatMap((popup) => {
          const parents = [];
          for (let node = popup; node && node !== document.body; node = node.parentElement) parents.push(node);
          return parents;
        }))].filter(visible);
        const monthPanels = panelCandidates.map((panel) => {
          const monthNodes = visibleMonthNodes.filter((node) => panel.contains(node));
          const yearNodes = visibleYearNodes.filter((node) => panel.contains(node));
          return { panel, monthNodes, yearTitle: yearNodes.find((node) => /年$/.test(dateText(node))) || yearNodes.find((node) => node.matches?.("button, [role=button], [title], [aria-label], [class*='year'], [class*='Year']")) || (yearNodes.length === 1 ? yearNodes[0] : null) };
        }).filter(({ monthNodes, yearTitle }) => new Set(monthNodes.map(dateText)).size >= 6 && yearTitle).sort((a, b) => {
          if (a.panel.contains(b.panel)) return 1;
          if (b.panel.contains(a.panel)) return -1;
          const center = (el) => { const r = el.getBoundingClientRect(); return Math.abs(r.left - rect.left) + Math.abs(r.top - rect.top); };
          return center(a.panel) - center(b.panel);
        });
        const leafPanels = monthPanels.filter(({ panel }) => !monthPanels.some((other) => other.panel !== panel && panel.contains(other.panel)))
          .sort((a, b) => a.panel.getBoundingClientRect().left - b.panel.getBoundingClientRect().left);
        const rangeIndex = fullDateRange(dateControl).indexOf(dateControl);
        const monthPanelDetails = (rangeIndex >= 0 && leafPanels.length === 2 ? leafPanels.find(({ yearTitle }) => Number(dateText(yearTitle).match(/^\d{4}/)?.[0]) === Number(year)) || leafPanels[rangeIndex] : monthPanels[0]) || (() => {
          const roots = popupRoots();
          const monthNodes = visibleMonthNodes.filter((node) => roots.some((root) => root === node || root.contains(node)));
          if (new Set(monthNodes.map(dateText)).size < 6) return null;
          const anchor = roots[0]?.getBoundingClientRect?.() || rect;
          const distance = (node) => { const box = node.getBoundingClientRect(); return Math.abs(box.left - anchor.left) + Math.abs(box.top - anchor.top); };
          const yearTitle = visibleYearNodes.filter((node) => distance(node) < 800).sort((a, b) => distance(a) - distance(b))[0];
          return yearTitle ? { panel: roots[0], monthNodes, yearTitle } : null;
        })();
        const monthPanel = monthPanelDetails?.panel;
        const liveMonthPanel = () => monthPanel?.isConnected ? monthPanel
          : popupRoots().flatMap(popup => [popup, ...popup.querySelectorAll("[class]")]).find(node => visible(node) && String(node.className) === String(monthPanel?.className) && exactNodes(node, /^(?:0?[1-9]|1[0-2])月$/).length >= 6)
          || [...document.querySelectorAll(".phoenix-calendar-month-panel, .Phoenix-calendar-month-panel")].filter(visible).sort((a, b) => {
            const center = (el) => { const r = el.getBoundingClientRect(); return Math.abs(r.left - rect.left) + Math.abs(r.top - rect.top); };
            return center(a) - center(b);
          })[0] || popupRoots().find((popup) => exactNodes(popup, /^(?:0?[1-9]|1[0-2])月$/).length >= 6) || monthPanel;
        trace.datePicker = { protocol: CONTENT_PROTOCOL, popupCount: popupRoots().length, panelFound: !!monthPanel, monthCount: monthPanelDetails ? new Set(monthPanelDetails.monthNodes.map(dateText)).size : 0, reopenedYearList: reopenYearList };
        if (reopenYearList && invalidYearList()) {
          trace.failure = "year-option-not-visible";
          await finishDatePicker(monthPanel, liveDateControl());
          return false;
        }
        if (monthPanel) {
          const yearTitle = monthPanelDetails.yearTitle;
          const currentYear = Number(dateText(yearTitle).match(/^\d{4}/)?.[0]);
          const targetYear = Number(year);
          if (!Number.isFinite(currentYear)) {
            trace.failure = "current-year-not-found";
            await finishDatePicker(monthPanel, dateControl);
            return false;
          }
          const direction = targetYear < currentYear ? "prev" : "next";
          const pickerNodes = () => { const panel = liveMonthPanel(); return [...new Set([panel, ...(panel?.querySelectorAll("*") || []), ...popupNodes()])].filter(visible); };
          const yearButton = () => [...new Set([...(liveMonthPanel()?.querySelectorAll("a, button, [role=button]") || []), ...popupNodes().filter(node => node.matches("button, [role=button]"))])].find((el) => {
            const hint = `${el.getAttribute("aria-label") || ""} ${el.getAttribute("title") || ""} ${el.className || ""}`;
            return new RegExp(`${direction}.*year|super-${direction}|(?:d-)?arrow-${direction === "prev" ? "left" : "right"}|${direction === "prev" ? "left" : "right"}-switcher`, "i").test(hint);
          });
          const displayedYear = () => {
            if (yearTitle.isConnected && visible(yearTitle)) return Number(dateText(yearTitle).match(/^\d{4}/)?.[0]);
            const headers = exactNodes(liveMonthPanel(), /^\d{4}年?$/).filter(node => node.tagName === yearTitle.tagName && String(node.className) === String(yearTitle.className));
            return headers.length === 1 ? Number(dateText(headers[0]).replace(/年$/, "")) : NaN;
          };
          Object.assign(trace.datePicker, { currentYear, targetYear });
          const shownYears = visibleYearNodes.filter((node) => node !== yearTitle && [String(targetYear), `${targetYear}年`].includes(dateText(node))
            && !node.closest("[disabled], [aria-disabled=true], [class*='disabled']"));
          if (targetYear !== currentYear && shownYears.length === 1) {
            trace.datePicker.yearMethod = "visible-option";
            await clickOption(shownYears[0]); await wait(40);
          } else if (targetYear !== currentYear && yearButton()) {
            trace.datePicker.yearMethod = direction;
            trace.datePicker.yearClicks = [];
            for (let i = 0; i < Math.abs(targetYear - currentYear); i++) {
              const expected = currentYear + (direction === "prev" ? -1 : 1) * (i + 1);
              const attempt = {}; trace.datePicker.yearClicks.push(attempt);
              await clickOption(yearButton(), true, () => displayedYear() === expected, attempt);
              if (!await waitFor(() => displayedYear() === expected, 1400)) break;
            }
          } else if (targetYear !== currentYear && yearTitle) {
            const yearListOpen = exactNodes(liveMonthPanel(), /^\d{4}年?$/).filter((node) => node !== yearTitle).length >= 6;
            if (!yearListOpen && exactNodes(liveMonthPanel(), /^-?\d{1,4}$/).length >= 6) {
              trace.failure = "year-option-not-visible";
              await finishDatePicker(monthPanel, dateControl);
              return false;
            }
            trace.datePicker.yearMethod = yearListOpen ? "late-option" : "title";
            if (!yearListOpen) yearTitle.click();
            const yearOption = await waitFor(() => pickerNodes().find((node) => [String(targetYear), `${targetYear}年`].includes(dateText(node))
              && ![...node.children].some(child => visible(child) && dateText(child) === dateText(node))), 1400);
            trace.datePicker.yearOptionFound = !!yearOption;
            if (!yearOption) {
              trace.failure = "year-not-found";
              await finishDatePicker(monthPanel, dateControl);
              return false;
            }
            yearOption.click(); await wait(40);
          } else trace.datePicker.yearMethod = "already-current";
          // Year selection can asynchronously rebuild the month grid. Wait for its header before clicking a month.
          if (!await waitFor(() => displayedYear() === targetYear, 1400)) {
            trace.failure = "year-change-not-confirmed";
            await finishDatePicker(liveMonthPanel(), liveDateControl());
            return false;
          }
          const monthNode = await waitFor(() => exactNodes(liveMonthPanel() || document.body, /^(?:0?[1-9]|1[0-2])月$/).find((node) => Number(dateText(node).replace(/月$/, "")) === Number(month)
            && !node.closest('[disabled], [aria-disabled=true], [data-disabled=true], [class*="disabled"]')), 1400);
          trace.datePicker.month = Number(month);
          trace.datePicker.monthFound = !!monthNode;
          if (monthNode) monthNode.click();
          await wait(40);
          trace.confirmed = !!monthNode && !!await waitFor(() => dateValueMatches(liveDateControl(), value), 800);
          // Range pickers commit both inputs only after the end click. A
          // visible start cell proves progress, but is not a confirmed value.
          trace.rangeStartPending = !trace.confirmed && chooseOptions.keepDateRangeOpen && rangeIndex === 0
            && !!monthNode?.closest("[class*='start-date'], [class*='range-start'], [class*='is-start']") && visible(liveMonthPanel());
          if (!trace.confirmed && !trace.rangeStartPending && monthNode?.isConnected && visible(monthNode)) {
            trace.datePicker.monthClick = {};
            await clickOption(monthNode, true, () => dateValueMatches(liveDateControl(), value), trace.datePicker.monthClick);
            trace.confirmed = !!await waitFor(() => dateValueMatches(liveDateControl(), value), 800);
            trace.rangeStartPending = !trace.confirmed && chooseOptions.keepDateRangeOpen && rangeIndex === 0
              && !!monthNode.closest("[class*='start-date'], [class*='range-start'], [class*='is-start']") && visible(liveMonthPanel());
          }
          trace.selectedValue = value;
          trace.afterConfirm = trace.datePicker.after = controlValue(liveDateControl());
          if (!trace.confirmed) trace.failure = trace.rangeStartPending ? "range-awaiting-end" : monthNode ? "display-not-confirmed" : "month-not-found";
          logChoice("calendar", trace, choiceState(liveDateControl(), liveMonthPanel(), monthNode));
          await finishDatePicker(liveMonthPanel(), liveDateControl());
          return trace.confirmed;
        }
        const visibleCalendar = () => popupRoots().flatMap((popup) => [...popup.querySelectorAll("[role=grid], table"), ...(popup.matches("[role=grid], table") ? [popup] : [])]).filter((el) => visible(el) && el.querySelector("td, [role=gridcell]")).sort((a, b) => {
          const center = (el) => { const r = el.getBoundingClientRect(); return Math.abs(r.left - rect.left) + Math.abs(r.top - rect.top); };
          return center(a) - center(b);
        })[0];
        let calendar = visibleCalendar();
        if (calendar) {
          trace.datePicker.panelFound = true;
          trace.datePicker.mode = "table";
          const panelFor = (grid) => {
            let panel = grid;
            const owner = popupRoots().find((popup) => popup === grid || popup.contains(grid));
            if (!owner) return grid;
            while (panel.parentElement && panel !== owner && !panel.querySelector("[class*='prev-year'], [class*='previous-year'], [class*='super-prev'], [aria-label*='previous year' i], [aria-label*='prev year' i]")) panel = panel.parentElement;
            return panel;
          };
          let calendarPanel = panelFor(calendar);
          const currentYear = Number([...calendarPanel.querySelectorAll("[aria-label], [title], [class*='year'], [class*='Year'], button, span, [class*='header']")]
            .map((el) => clean(el.textContent || el.getAttribute("aria-label") || el.getAttribute("title"))).find((text) => /\d{4}/.test(text))?.match(/\d{4}/)?.[0]);
          const targetYear = Number(year);
          const yearDirection = targetYear < currentYear ? "prev" : "next";
          const navigation = (direction, unit) => [...new Set([...calendarPanel.querySelectorAll("a, button, [role=button]"), ...popupRoots().flatMap((popup) => [...popup.querySelectorAll("a, button, [role=button]")])])].find((el) => !el.disabled && visible(el) && (new RegExp(`${direction}.*${unit}`, "i").test(`${el.getAttribute("aria-label") || ""} ${el.getAttribute("title") || ""} ${el.className || ""}`)
            || new RegExp(unit === "year" ? `super-${direction}|d-arrow-${direction === "prev" ? "left" : "right"}` : `header-${direction}-btn|(?:^|\\s)arrow-${direction === "prev" ? "left" : "right"}(?:$|\\s)`).test(String(el.className || ""))));
          if (!Number.isFinite(currentYear) || (targetYear !== currentYear && !navigation(yearDirection, "year"))) {
            trace.failure = "calendar-year-navigation-unavailable";
            await finishDatePicker(calendar, dateControl);
            return false;
          }
          for (let i = 0; i < Math.abs(targetYear - currentYear); i++) {
            const button = navigation(yearDirection, "year");
            if (!button) { trace.failure = "calendar-year-navigation-lost"; await finishDatePicker(calendar, dateControl); return false; }
            button.click(); await wait(30);
            calendar = visibleCalendar() || calendar;
            calendarPanel = panelFor(calendar);
          }
          const currentMonth = Number([...calendarPanel.querySelectorAll("[aria-label], [title], [class*='month'], [class*='Month'], button, span, [class*='header']")]
            .map((el) => clean(el.textContent || el.getAttribute("aria-label") || el.getAttribute("title")))
            .map((text) => text.match(/(?:^|\D)(\d{1,2})\s*月(?:\D|$)/)?.[1]).find(Boolean));
          const targetMonth = Number(month);
          const monthDirection = targetMonth < currentMonth ? "prev" : "next";
          if (!Number.isFinite(currentMonth) || (targetMonth !== currentMonth && !navigation(monthDirection, "month"))) {
            trace.failure = "calendar-month-navigation-unavailable";
            await finishDatePicker(calendar, dateControl);
            return false;
          }
          for (let i = 0; i < Math.abs(targetMonth - currentMonth); i++) {
            const button = navigation(monthDirection, "month");
            if (!button) { trace.failure = "calendar-month-navigation-lost"; await finishDatePicker(calendar, dateControl); return false; }
            button.click(); await wait(30);
            calendar = visibleCalendar() || calendar;
            calendarPanel = panelFor(calendar);
          }
          const [, , sourceDay] = dateParts(value);
          const day = sourceDay || "01";
          const hasDayCells = [...calendar.querySelectorAll("[role=gridcell], td")].some((cell) => /^\d{1,2}$/.test(dateText(cell)));
          const calendarInputScope = hasDayCells ? (calendarPanel.closest("[class*='calendar-panel'], [class*='Calendar-panel']") || calendarPanel) : null;
          const calendarInput = calendarInputScope?.querySelector("input[type=date], input[placeholder*='日期'], input[aria-label*='date' i], input[class*='calendar-input'], input[class*='date-input']");
          const commitCalendarInput = async () => {
            if (!calendarInput) return false;
            const formatted = `${year}-${pad2(Number(month))}-${pad2(Number(day))}`;
            setValue(calendarInput, formatted);
            calendarInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
            return !!await waitFor(() => dateValueMatches(liveDateControl(), sourceDay ? value : formatted), 800);
          };
          const dayCell = [...calendar.querySelectorAll("[role=gridcell], td, [role=option], button, [class*='cell'], [class*='Cell']")].map((el) => el.closest("td, [role=gridcell]") || el).find((el) => !el.disabled && el.getAttribute("aria-disabled") !== "true" && !/disabled|(?:prev|previous|next|other|last)[-_ ]?month|outside/i.test(String(el.className || ""))
            && (!el.getAttribute("title") || el.getAttribute("title") === `${year}-${pad2(month)}-${pad2(day)}`) && normalize(el.textContent) === normalize(String(Number(day))));
          const dayNode = dayCell?.querySelector("button, [role=button], [class*='date'], [class*='Date'], [class*='cell-inner']") || dayCell;
          trace.datePicker.dayFound = !!dayNode;
          if (dayNode) {
            await clickOption(dayNode);
            await wait(40);
            trace.datePicker.day = Number(day);
            trace.datePicker.dayDefaulted = !sourceDay;
            trace.confirmed = !!await waitFor(() => dateValueMatches(liveDateControl(), sourceDay ? value : `${year}-${month}-${day}`), 800);
            if (!trace.confirmed) trace.confirmed = await commitCalendarInput();
            if (!trace.confirmed) trace.failure = "display-not-confirmed";
            trace.afterConfirm = controlValue(liveDateControl());
            await finishDatePicker(calendar, liveDateControl());
            return trace.confirmed;
          }
          if (calendarInput) {
            trace.confirmed = await commitCalendarInput();
            if (!trace.confirmed) trace.failure = "display-not-confirmed";
            trace.afterConfirm = controlValue(liveDateControl());
            await finishDatePicker(calendar, liveDateControl());
            return trace.confirmed;
          }
        }
      }
    }
    const host = [...document.querySelectorAll("[role=radio], [role=option]")].find((el) => visible(el) && matches(el.textContent)
      && !(/籍贯|居住地|户籍|户口/.test(label) && /省|自治区|特别行政区|市|区|县/.test(String(value)))
      && (normalize(labelText(el.parentElement || el)).includes(normalize(label)) || normalize(labelText(el)).includes(normalize(label))));
    if (host && (!target || !isChoiceControl(target) && !isAutocompleteControl(target) || target.matches("input[type=radio], [role=radio]"))) { trace.path = "radio-host"; host.click(); await closeVisibleDropdowns(target || host); trace.confirmed = true; return true; }
    const exactItem = [...document.querySelectorAll(".form-item")].find((el) => normalize(el.querySelector(`${fieldLabelSelector}, label`)?.innerText) === normalize(label));
    const container = target ? fieldContainer(target) : exactItem || [...document.querySelectorAll("label, fieldset, [role=group], div")].find((el) => {
      const content = normalize(el.textContent);
      return visible(el) && content.includes(normalize(label)) && content.length < 100 && el.querySelector("[role=combobox], [aria-haspopup=listbox], input, select");
    });
    const radios = [...(container?.querySelectorAll("input[type=radio], [role=radio]") || [])].filter(editable);
    const radio = radios.find((el) => matches(labelText(el) || el.value || el.parentElement?.textContent));
    if (radio) { trace.path = "radio"; radio.click(); await closeVisibleDropdowns(target || radio); trace.confirmed = true; return true; }
    const radioOption = (!target || target.matches("input[type=radio], [role=radio]")) && [...(container?.querySelectorAll("label, [class*='radio'], [class*='Radio'], [class*='option'], [class*='Option']") || [])]
      .find((el) => visible(el) && matches(el.textContent));
    if (radioOption) { trace.path = "radio-option"; radioOption.click(); await closeVisibleDropdowns(target || radioOption); trace.confirmed = true; return true; }
    const control = target || container?.querySelector("[role=combobox], [aria-haspopup=listbox], input, select");
    if (!control) { trace.failure = "control-not-found"; return false; }
    const controlBox = fieldContainer(control);
    const readControl = () => controlValue(control, controlBox)
      || (!control.isConnected ? clean(controlBox?.querySelector("[class*='select__tag'], [class*='select-tag']")?.textContent) : "");
    Object.assign(trace, { path: "popup", before: readControl() });
    let popup = chooseOptions.popup?.isConnected && visible(chooseOptions.popup) && (isPopup(chooseOptions.popup) || popupMatchesValue(chooseOptions.popup, value)) ? chooseOptions.popup : [...new Set([...popupFor(control, false), ...(lastOpenedControl === control && lastOpenedPopup && isPopup(lastOpenedPopup) ? [lastOpenedPopup] : [])])].sort((a, b) => {
      const distance = (el) => { const r = el.getBoundingClientRect(); return Math.abs(r.left - control.getBoundingClientRect().left) + Math.abs(r.top - control.getBoundingClientRect().top); };
      return distance(a) - distance(b);
    })[0];
    let searched = false;
    if (!popup) {
      popup = await openChoice(control, (isAutocompleteControl(control) || isSearchableChoiceInput(control)) && !isLocationLabel(label) ? value : undefined);
      trace.opening = { ...lastOpening };
      searched = searched || !!lastOpening?.searched;
    }
    lastOpenedControl = control;
    lastOpenedPopup = popup;
    const controlRect = control.getBoundingClientRect();
    await waitForOptions(popup);
    trace.popupFound = !!popup;
    if (!popup && isAutocompleteControl(control)) {
      trace.failure = "popup-not-found";
      restoreChoiceSearch(control, trace.before);
      await closeVisibleDropdowns(control);
      return false;
    }
    const multiValues = String(value).split(/[、,，;；]/).map((part) => part.trim()).filter(Boolean);
    const multiplePopup = isMultipleChoice(control, popup);
    if (isLocationLabel(label) && multiValues.length > 1 && !multiplePopup) {
      const confirmed = await choose(label, multiValues[0], control, skipDatePair, { ...chooseOptions, popup, locationHint: "" });
      if (confirmed) confirmedSingleLocationSources.set(resolveField(elementKeys.get(control)) || control, String(value));
      lastChoice = { ...lastChoice, sourceSelection: "first-for-single", sourceCount: multiValues.length };
      return confirmed;
    }
    if (multiValues.length > 1 && multiplePopup) {
      trace.path = "popup-multi";
      trace.multiValues = multiValues;
      await closeVisibleDropdowns(control);
      lastOpenedControl = lastOpenedPopup = null;
      trace.parts = [];
      for (const part of multiValues) {
        const protectedValue = valueMatches(readControl(), part, label);
        const partTarget = target?.isConnected ? target : resolveField(elementKeys.get(target));
        const confirmed = protectedValue || !!partTarget && await choose(label, part, partTarget, skipDatePair, { ...chooseOptions, locationHint: isLocationLabel(label) ? "" : chooseOptions.locationHint });
        trace.parts.push({ value: part, confirmed, ...(protectedValue ? { protected: true } : { choice: lastChoice }) });
        if (!confirmed) { trace.failure = `multi:${lastChoice?.failure || "not-confirmed"}`; lastChoice = trace; return false; }
      }
      trace.selectedValue = trace.parts.map(part => part.choice?.selectedValue || part.value).join("、");
      trace.afterConfirm = controlValue(control, controlBox);
      trace.confirmed = valueMatches(trace.afterConfirm, value, label);
      if (!trace.confirmed) trace.failure = "multi-display-not-confirmed";
      lastChoice = trace;
      return trace.confirmed;
    }
    const options = () => popup ? popupOptionNodes(popup) : [];
    const refreshPopup = async () => {
      const previous = popup;
      const found = await waitFor(() => {
        const distance = (el) => { const r = el.getBoundingClientRect(); return Math.abs(r.left - controlRect.left) + Math.abs(r.top - controlRect.top); };
        return popupFor(control, false).sort((a, b) => distance(a) - distance(b))[0]
          || (previous?.isConnected && isPopup(previous) ? previous : null)
          || nearbySuggestionPopup(control, value)
          || nearbyPopup(control);
      }, 1400);
      if (found) popup = found;
    };
    const isLocationPicker = isLocationLabel(label);
    const search = [...(popup?.querySelectorAll(searchInputSelector) || []), target].find(editableSearch);
    // A salary search box filters by displayed range text; searching a raw
    // number such as 3500 hides “2001 ~ 4000”. Match ranges from real options.
    const matchedProficiency = proficiencyOption(value, options(), label);
    const proficiencySearch = matchedProficiency ? clean(matchedProficiency.textContent || matchedProficiency.getAttribute("data-value") || matchedProficiency.getAttribute("value"))
      : /掌握程度|熟练程度|精通程度|技能等级|语言水平|听说|读写/.test(label) ? ["", "了解", "一般", "熟练", "精通"][proficiencyLevel(value)] : "";
    if (search && !isLocationPicker && !/薪|工资|待遇/.test(label) && !options().some((el) => matches(el.textContent || el.getAttribute("data-value") || el.getAttribute("value")))) {
      // Autocomplete controls need the desired text before their real options exist.
      setSearchValue(search, proficiencySearch || value);
      searched = true;
      await refreshPopup();
    }
    if (isLocationPicker) {
      const rawLocation = String(value).trim();
      const location = rawLocation.match(/^(.+?(?:省|自治区|特别行政区|市))[\/／,，\s-]*(.+?(?:市|自治州|地区|盟|区|县))(?:[\/／,，\s-]*(.+?(?:区|县|市|旗)))?$/)
        || (() => {
          const parts = rawLocation.replace(/^中国(?:大陆|内地)?[\/／,，\s\->]+/i, "").split(/[\/／,，、\s\->]+/).filter(Boolean);
          return parts.length >= 2 ? [rawLocation, parts[0], parts[1], parts[2] || ""] : null;
        })();
      const regions = options();
      const province = location && regions.find((option) => sameArea(clean(option.textContent), location[1]));
      // A flat province menu can accept only the explicitly supplied parent region.
      if (province && popup && regions.filter((option) => /省$/.test(clean(option.textContent))).length >= 3
        && !regions.some((option) => sameArea(clean(option.textContent), location[2]))
        && !popup?.querySelector("[role=tree], [role=treeitem], [aria-haspopup], [class*='cascader'], [class*='switcher'], [class*='expand'], .area-item-container")) {
        trace.option = trace.selectedValue = clean(province.textContent);
        await clickOption(selectionTarget(province));
        await closeVisibleDropdowns(control);
        trace.confirmed = !!await waitFor(() => valueMatches(readControl(), trace.selectedValue, label), 800);
        if (!trace.confirmed) trace.failure = "province-display-not-confirmed";
        return trace.confirmed;
      }
      const areaPopup = await waitFor(() => [popup, ...openDropdowns(), ...document.querySelectorAll("[role=dialog], [class*='area'], [class*='cascader'], [class*='popper'], [class*='popover']")]
        .find((el) => el && visible(el) && (el.querySelector('[role=tree], .atsx-tree, .atsx-select-tree, .ihr_tree-tree, .area-item-container') || /select-tree-dropdown|area[-_]picker|全部省市|已选地区|选择地区/.test(`${el.className} ${clean(el.innerText || el.textContent)}`))));
      const companyHint = (() => {
        for (let node = control?.parentElement, depth = 0; node && depth < 16; node = node.parentElement, depth++) {
          const company = [...node.querySelectorAll(controlSelector)].find((el) => el !== control && /单位名称|公司名称/.test(fieldTitle(el)));
          const value = controlValue(company);
          if (value) return value.match(/^([\u4e00-\u9fff]{2,6}市)/)?.[1] || value.match(/^([\u4e00-\u9fff]{2})/)?.[1] || "";
        }
        return "";
      })();
      const cityName = chooseOptions.locationHint || location?.[2] || String(value).trim() || companyHint;
      const cityPart = location?.[2] || String(value).match(/([^省自治区特别行政区]+?(?:市|区|县))$/)?.[1] || cityName;
      const provincePart = location?.[1] || "";
      const provinceBare = provincePart.replace(/(?:特别行政区|自治区|自治州|省)$/, "");
      const cityBare = cityPart.replace(/(?:特别行政区|自治区|自治州|市|地区|盟|区|县)$/, "");
      const citySearchTerms = [...new Set([
        provinceBare && cityBare ? `${provinceBare}-${cityBare}` : "",
        cityBare,
        cityPart,
        rawLocation,
        rawLocation.replace(/^中国(?:大陆|内地)?[\/／,，\s\->]+/i, ""),
        provincePart && cityPart ? `${provincePart}-${cityPart}` : ""
      ].map(clean).filter((term) => term.length >= 2))];
      trace.area = { protocol: CONTENT_PROTOCOL, source: String(value), hint: chooseOptions.locationHint || "", companyHint, city: cityName, popupFound: !!areaPopup };
      if (!areaPopup && (search || location) && popup && !popup.querySelector("[role=tree], [role=treeitem], [class*='cascader'], [class*='tree'][class*='node'] [class*='label']")) {
        // Flat city choices are not a region tree. Match the supplied
        // province path when present; a bare city must be unique in the menu.
        locationSearchTerms = citySearchTerms;
        const sourceParts = (location ? location.slice(1, /城市/.test(label) ? 3 : 4) : [rawLocation]).filter(Boolean).map(areaName);
        const candidateParts = (text) => String(text).replace(/^中国(?:大陆|内地)?[\/／,，\s\->]+/i, "").split(/[\/／,，、\s\->]+/).filter(Boolean).map(areaName);
        locationOptionMatches = (text) => {
          const parts = candidateParts(text);
          return parts.length >= sourceParts.length && sourceParts.every((part, index) => part === parts[parts.length - sourceParts.length + index])
            || parts.length === 1 && sourceParts.length > 1 && parts[0] === sourceParts.at(-1)
              && popupOptionNodes(popup, false).filter(node => candidateParts(clean(node.textContent)).at(-1) === parts[0]).length === 1;
        };
      }
      if (areaPopup) {
        const search = [...areaPopup.querySelectorAll('input[placeholder="搜索"], input[placeholder*="搜"], input[placeholder*="输入"], input[placeholder*="地点"], input[placeholder*="城市"], input[aria-label*="输入"], input[aria-label*="地点"], input[aria-label*="城市"]')].find((input) => visible(input) && !input.readOnly)
          || [control, target, controlBox].flatMap((node) => node?.matches?.(searchInputSelector) ? [node] : [...(node?.querySelectorAll?.(searchInputSelector) || [])]).find(editableSearch);
        trace.area.searchFound = !!search;
        const writeSearch = (text) => {
          if (!search) return;
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
          setter ? setter.call(search, text) : (search.value = text);
          search.dispatchEvent(new Event("input", { bubbles: true }));
        };
        const findArea = (name) => {
          const areaText = (node) => clean(node?.innerText || node?.textContent);
          const isAtsxTree = !!areaPopup.querySelector(".atsx-tree, .atsx-select-tree");
          const matchesArea = (text) => normalize(text) === normalize(name) || normalize(text) === `${normalize(name)}市` || normalize(name) === `${normalize(text)}市`;
          if (!isAtsxTree) {
            const items = [...areaPopup.querySelectorAll(".area-item-container, [role=option], li")];
            const rows = (items.length ? items : [...areaPopup.querySelectorAll("button, label, [class*=item], [class*=option], div, span")]).filter(visible)
              .filter(node => {
                const parts = areaText(node).split(/[\/／>\s]+/).filter(Boolean);
                const label = node.querySelector("[class*='text-label'], [class*='Text-label']");
                const leaf = label ? areaText(label).split(/[\/／>\s]+/).filter(Boolean).at(-1) : parts.at(-1);
                const parents = parts.filter(part => !sameArea(part, leaf));
                return sameArea(leaf, name) && (!parents.length || !provincePart || sameArea(parents.at(-1), provincePart));
              });
            return rows.length === 1 ? rows[0] : null;
          }
          // ATSX repeats hidden title text; generic pickers may include a parent region.
          const treeCity = [...areaPopup.querySelectorAll("[role=treeitem]")].filter(visible).find((item) => matchesArea(areaText(item.querySelector("[data-cy-value], [class*='tree-title'], [class*='Tree-title']") || item)));
          if (treeCity) return treeCity;
          return [...new Set([...areaPopup.querySelectorAll(".area-item-container, [role=option], li, button, label, [class*=item], [class*=option], div, span")]
          .filter((el) => visible(el) && matchesArea(areaText(el)))
          .map((el) => el.closest(".area-item-container, [role=treeitem], [role=option], li") || el)
          .filter((el) => {
            const text = areaText(el.querySelector?.("[data-cy-value], [class*='tree-title'], [class*='Tree-title']") || el);
            return matchesArea(text);
          }))]
          .sort((a, b) => (a.children.length - b.children.length) || (a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height))[0];
        };
        const areaRows = () => [...areaPopup.querySelectorAll(".area-item-container, [role=treeitem], [role=option], li")].filter(visible);
        const waitForAreaResult = async (name) => {
          let signature = areaRows().map((row) => clean(row.innerText || row.textContent)).join("\u0001"); let changed = false; let settled = 0;
          const end = Date.now() + 1600;
          while (Date.now() < end) {
            const city = findArea(name); if (city) return { city, count: areaRows().length, settled: true };
            const rows = areaRows(); const next = rows.map((row) => clean(row.innerText || row.textContent)).join("\u0001");
            if (next !== signature) { signature = next; changed = true; settled = 0; }
            else if (changed && ++settled >= 3) return { city: null, count: rows.length, settled: true };
            await wait(80);
          }
          return { city: findArea(name), count: areaRows().length, settled: false };
        };
        if (search && cityName) {
          let city; let searchTerm = cityName;
          trace.area.queryResults = [];
          for (const term of citySearchTerms) {
            writeSearch(term); await wait(100);
            searchTerm = term;
            const result = await waitForAreaResult(cityName);
            trace.area.queryResults.push({ term, count: result.count, settled: result.settled });
            city = result.city;
            if (city) { searchTerm = term; break; }
          }
          trace.area.search = searchTerm;
          trace.optionFound = !!city;
          trace.area.candidates = areaRows().map((el) => clean(el.innerText || el.textContent)).slice(0, 8);
          if (city) {
            trace.option = clean(city.innerText || city.textContent);
            const isAtsxTree = !!areaPopup.querySelector(".atsx-tree, .atsx-select-tree");
            const cityTargets = isAtsxTree
              ? [
                city.querySelector?.(".atsx-select-tree-checkbox"),
                city.querySelector?.(".atsx-select-tree-node-content-wrapper, .atsx-tree-node-content-wrapper"),
                city
              ].filter((node, index, list) => node && list.indexOf(node) === index)
              : [selectionTarget(city)];
            trace.commitTarget = { tag: cityTargets[0]?.tagName || "", className: String(cityTargets[0]?.className || ""), text: clean(cityTargets[0]?.textContent) };
            const selectedBefore = clean(areaPopup.innerText || areaPopup.textContent).match(/已选(?:地区)?\s*\d+\s*\/\s*\d+/)?.[0] || "";
            const checkedBefore = !!city.querySelector?.("input:checked, [aria-checked=true], [class*='checkbox-checked'], [class*='Checkbox-checked'], [class*='CheckboxChecked']");
            const displaySelected = () => isAtsxTree && !visible(areaPopup) && valueMatches(clean(controlBox?.innerText || control?.innerText), cityName, label);
            const selectionChanged = () => {
              const selected = clean(areaPopup.innerText || areaPopup.textContent).match(/已选(?:地区)?\s*\d+\s*\/\s*\d+/)?.[0] || "";
              const currentCity = findArea(cityName);
              return displaySelected() || selected && selected !== selectedBefore || !checkedBefore && !!currentCity?.querySelector?.("input:checked, [aria-checked=true], [class*='checkbox-checked'], [class*='Checkbox-checked'], [class*='CheckboxChecked']");
            };
            trace.selectionAttempts = [];
            trace.selectionObserved = checkedBefore;
            for (let targetIndex = 0; targetIndex < cityTargets.length && !trace.selectionObserved; targetIndex++) {
              for (const plainTrusted of [false, true]) {
                const liveCity = findArea(cityName);
                const liveTargets = isAtsxTree ? [
                  liveCity?.querySelector?.(".atsx-select-tree-checkbox"),
                  liveCity?.querySelector?.(".atsx-select-tree-node-content-wrapper, .atsx-tree-node-content-wrapper"), liveCity
                ].filter((node, index, list) => node && list.indexOf(node) === index) : [selectionTarget(liveCity)];
                const cityTarget = liveTargets[targetIndex];
                if (!cityTarget?.isConnected) break;
                const attempt = { target: String(cityTarget.className || cityTarget.tagName), plainTrusted, connected: true };
                trace.selectionAttempts.push(attempt);
                await clickOption(cityTarget, true, null, attempt, plainTrusted);
                trace.selectionObserved = !!await waitFor(selectionChanged, 800);
                if (trace.selectionObserved) break;
              }
            }
            trace.afterClick = readControl();
            const confirm = confirmationFor(areaPopup, control);
            trace.confirmFound = !!confirm;
            if (confirm) { trace.confirmClick = {}; await clickOption(confirm, true, () => !visible(areaPopup), trace.confirmClick, true); await wait(120); }
            trace.afterConfirm = readControl();
            trace.confirmed = !!await waitFor(() => (displaySelected() || valueMatches(readControl(), cityName, label)) && !(search === target && normalize(readControl()) === normalize(searchTerm)), 800);
            if (!trace.confirmed) trace.failure = "area-display-not-confirmed";
            logChoice("area-confirmed", trace);
            await closeVisibleDropdowns(control);
            return trace.confirmed;
          }
        }
        // A generic tree without search falls through to its normal
        // selectionTarget path below; ATSX must not degrade to a province.
        if (areaPopup.querySelector(".atsx-tree, .atsx-select-tree")) {
          trace.failure = "area-city-not-found";
          return false;
        }
      }
      const rolelessTree = !!popup?.querySelector("[class*='tree'][class*='node'] [class*='label']");
      if (location || rolelessTree) {
        // Midas first shows countries. Parent row clicks select a value;
        // expanding requires its dedicated switcher before selecting a city.
        const treeRows = "[role=treeitem], .ihr_tree-item, [role=menuitem], [class*='tree'][class*='node']:not(button):not(span):not([class*='label']):not([class*='indent']):not([class*='checker']):not([class*='expand'])";
        const treeLabel = "[data-cy-value], [class*='tree-title'], [class*='Tree-title'], .ihr_tree-item_label, [class*='node'][class*='label']";
        const locationTree = () => [...document.querySelectorAll("[role=tree], .ihr_tree-tree, [class*='tree'][class*='list']")].filter(visible).sort((left, right) => {
          const distance = (el) => { const rect = el.getBoundingClientRect(); return Math.abs(rect.left - controlRect.left) + Math.abs(rect.top - controlRect.bottom); };
          return distance(left) - distance(right);
        })[0];
        const locationOptions = () => [...new Set([...options(), ...(popup?.querySelectorAll(treeRows) || []), ...(locationTree()?.querySelectorAll(treeRows) || [])])].filter(visible);
        const locationText = (el) => clean(el?.querySelector?.(treeLabel)?.textContent || el?.textContent);
        const treeRow = el => el.closest(treeRows) || el;
        const cascadeColumn = el => el?.closest("[class*='cascader-menu'][role=menu], div[class~='el-cascader-menu']") || el?.closest("ul[class*='cascader-menu']");
        const treeLevel = el => el?.style.getPropertyValue("--ihr-tree-item-level") || String(el?.querySelectorAll("[class*='indent']").length || 0);
        const liveTreeItem = (item) => {
          if (!item || item.isConnected) return item;
          const key = item.getAttribute("data-tree-key") || item.getAttribute("data-virtual-key");
          const matches = [...new Set(locationOptions().map(treeRow))].filter(el => key
            ? (el.getAttribute("data-tree-key") || el.getAttribute("data-virtual-key")) === key
            : locationText(el) === locationText(item) && treeLevel(el) === treeLevel(item));
          return matches.length === 1 ? matches[0] : null;
        };
        const treeItem = (name, parent) => {
          const items = [...new Set(locationOptions().map(treeRow))];
          if (parent) { parent = liveTreeItem(parent); if (!parent) return null; }
          const virtual = parent && (parent.matches(".ihr_tree-item") && parent.style.getPropertyValue("--ihr-tree-item-level") !== "" || rolelessTree && parent.querySelector(treeLabel));
          const level = Number(treeLevel(parent));
          const afterParent = items.indexOf(parent) + 1;
          const column = cascadeColumn(parent);
          const childColumn = column?.nextElementSibling;
          const end = virtual ? items.findIndex((el, index) => index >= afterParent && Number(treeLevel(el)) <= level) : -1;
          const matches = items.filter((el, index) => sameArea(locationText(el), name)
            && (!parent || (column ? childColumn?.contains(el) : parent.contains(el) || virtual && index >= afterParent && (end < 0 || index < end) || !virtual && !parent.matches("[role=treeitem]"))));
          return matches.length === 1 ? matches[0] : null;
        };
        const findTreeItem = async (name, parent) => {
          let item = await waitFor(() => treeItem(name, parent), 1400);
          if (item) return item;
          const tree = locationTree();
          const scroller = [tree, ...(tree?.querySelectorAll("*") || [])].filter((el) => el?.clientHeight > 60 && el.scrollHeight > el.clientHeight + 2)
            .sort((left, right) => right.clientHeight - left.clientHeight)[0];
          if (!scroller) return null;
          const originalTop = scroller.scrollTop;
          // ponytail: bounded virtual-tree scan; a searchable tree is faster when available.
          for (let pass = 0; pass < 20 && !item; pass++) {
            const nextTop = Math.min(scroller.scrollHeight - scroller.clientHeight, scroller.scrollTop + Math.max(80, scroller.clientHeight * 0.8));
            if (nextTop <= scroller.scrollTop) break;
            scroller.scrollTop = nextTop;
            scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
            await wait(70);
            item = treeItem(name, parent);
          }
          if (!item) { scroller.scrollTop = originalTop; scroller.dispatchEvent(new Event("scroll", { bubbles: true })); }
          return item;
        };
        const expandTreeItem = async (item) => {
          item = liveTreeItem(item);
          if (!item) return false;
          const switcher = item?.querySelector?.(".atsx-tree-switcher, [data-cy=switcher], .ihr_tree-item_status, button[class*='expand'], button[class*='switcher']");
          const opened = () => {
            const current = liveTreeItem(item), currentSwitcher = current?.querySelector(".atsx-tree-switcher, [data-cy=switcher], .ihr_tree-item_status");
            const column = cascadeColumn(current);
            if (column) return /(?:^|[\s_-])active(?:$|[\s_-])/.test(String(current.className)) && !!column.nextElementSibling?.querySelector("[role=menuitem], li");
            const rows = [...new Set(locationOptions().map(treeRow))], next = rows[rows.indexOf(current) + 1];
            return rolelessTree && current && next && Number(treeLevel(next)) > Number(treeLevel(current))
              || current?.getAttribute("aria-expanded") === "true" || /(?:^|[\s_-])expand(?:ed)?(?:$|[\s_-])/.test(String(current?.className || "")) || (currentSwitcher ? /(?:^|[_-])open\b/.test(String(currentSwitcher.className || "")) : [...(current?.querySelectorAll("[role=group]") || [])].some(visible));
          };
          if (opened()) return true;
          // ponytail: only trust the debugger click after the tree actually expands.
          await clickOption(switcher || selectionTarget(item), true, opened);
          return !!await waitFor(opened, 1200);
        };
        // A checkbox tree may be a flat city list, with no parent region to
        // expand. Only discard the supplied parent when the menu has no
        // hierarchy signals and offers a unique equivalent city.
        const flatCity = rolelessTree && location && !popup.querySelector("[role=group], [aria-level], [aria-expanded], [class*='indent'], [class*='switcher'], [class*='expand']")
          && !treeItem(location[1]) && !treeItem("中国") && !treeItem("中国大陆");
        trace.tree = { flat: !!flatCity, roleless: rolelessTree, sourceParts: location?.length || 0,
          rows: new Set(locationOptions().map(treeRow)).size,
          hierarchy: popup.querySelectorAll("[role=group], [aria-level], [aria-expanded], [class*='indent'], [class*='switcher'], [class*='expand']").length,
          cityFound: !!location && !!treeItem(location[2]), provinceFound: !!location && !!treeItem(location[1]), countryFound: !!treeItem("中国大陆") || !!treeItem("中国") };
        if (rolelessTree && search && (!flatCity || !treeItem(location[2]))) {
          setSearchValue(search, areaName(location?.[2] || rawLocation));
          await waitFor(() => location ? treeItem(location[flatCity ? 2 : 1]) : treeItem(rawLocation), 1600);
        }
        const mainland = location && treeItem("中国大陆");
        if (mainland) await expandTreeItem(mainland);
        const province = flatCity ? await findTreeItem(location[2]) : location && await findTreeItem(location[1], rolelessTree ? mainland : undefined);
        if (province || rolelessTree && !location) {
          let leaf = province || await findTreeItem(rawLocation);
          const path = location ? location.slice(flatCity ? 2 : 1).filter(Boolean) : [];
          for (const name of path.slice(1)) {
            let child = treeItem(name, leaf);
            if (!child) { await expandTreeItem(leaf); child = await findTreeItem(name, leaf); }
            leaf = child;
            if (!leaf) break;
            // A city-only column picker may receive a saved city + district.
            if (cascadeColumn(leaf) && leaf.getAttribute("aria-haspopup") !== "true" && !/expand/.test(String(leaf.className))) break;
          }
          if (leaf) {
            trace.option = trace.selectedValue = locationText(leaf);
            const checkbox = leaf.querySelector("input[type=checkbox], [role=checkbox]");
            const selected = () => {
              const current = liveTreeItem(leaf)?.querySelector("input[type=checkbox], [role=checkbox]");
              return current ? current.checked || current.getAttribute("aria-checked") === "true" : valueMatches(readControl(), trace.selectedValue, label);
            };
            if (!selected()) await clickOption(leaf.querySelector(".atsx-tree-node-content-wrapper, .ihr_tree-item_info") || selectionTarget(leaf), true, selected);
            if (checkbox && !await waitFor(selected, 800)) leaf = null;
          }
          const confirm = confirmationFor(popup, control);
          if (confirm) { await clickOption(confirm, true); await wait(120); }
          trace.afterConfirm = readControl();
          trace.confirmed = !!leaf && !!await waitFor(() => valueMatches(readControl(), trace.selectedValue, label), 1000);
          if (!trace.confirmed) trace.failure = leaf?.querySelector(".ihr_tree-item_status--visible") ? "location-requires-more-detail" : leaf ? "tree-display-not-confirmed" : "tree-city-not-found";
          logChoice("tree-confirmed", trace, choiceState(control, popup, leaf));
          if (!trace.confirmed) restoreChoiceSearch(control, trace.before);
          await closeVisibleDropdowns(control);
          return trace.confirmed;
        }
        if (rolelessTree) {
          // An explicit tree path must not fall through to a same-name foreign leaf.
          trace.failure = "tree-province-not-found";
          restoreChoiceSearch(control, trace.before);
          await closeVisibleDropdowns(control);
          return false;
        }
      }
    }
    const findOption = () => {
      const list = options();
      trace.candidates = list.map((el) => clean(el.textContent || el.getAttribute("data-value") || el.getAttribute("value")));
      const exact = list.find((el) => {
        if (locationOptionMatches && !locationOptionMatches(el.textContent)) return false;
        const text = normalize(el.textContent || el.getAttribute("data-value") || el.getAttribute("value"));
        return [...wantedForms, ...optionForms].some((form) => text === form) || numericMonth && /^\d{1,2}$/.test(text) && Number(text) === Number(numericMonth);
      });
      const semantic = list.filter((el) => matches(el.textContent || el.getAttribute("data-value") || el.getAttribute("value")));
      const salary = /薪|工资|待遇/.test(label) && salaryOption(value, list);
      const rank = /排名/.test(label) && rankOption(value, list);
      const proficiency = proficiencyOption(value, list, label);
      const languageChoice = /^(?:语言|语言类型|语言类别|外语类别|语言名称|语种)[＊*]?$/.test(label);
      const language = languageChoice
        ? list.filter(el => languageToken(el.textContent) === languageToken(value)) : [];
      const identity = /证件类型/.test(label) && /身份证/.test(String(value))
        ? list.find((el) => /居民身份证/.test(clean(el.textContent || el.getAttribute("data-value") || el.getAttribute("value")))) : null;
      trace.match = { exact: !!exact, salary: !!salary, rank: !!rank, proficiency: !!proficiency, identity: !!identity, semantic: semantic.length };
      const matched = languageChoice ? language.length === 1 ? language[0] : null
        : exact || identity || salary || rank || proficiency || (semantic.length === 1 ? semantic[0] : null);
      const other = !matched && /^(?:证书名称|获奖项|竞赛名称)$/.test(label.replace(/[＊*]/g, "")) && list.find((el) => normalize(el.textContent) === "其他");
      if (other) trace.fallback = "page-option-other";
      return matched || other || null;
    };
    let option = await waitFor(findOption, searched ? 5000 : 1400);
    if (!option && search && locationSearchTerms.length) {
      trace.area.queryResults = [];
      for (const term of locationSearchTerms) {
        setSearchValue(search, term);
        await refreshPopup();
        option = await waitFor(findOption, 1600);
        trace.area.queryResults.push({ term, count: options().length, matched: !!option });
        if (option) break;
      }
    }
    if (!option && popup) {
      const scroller = [...popup.querySelectorAll("*")].filter((el) => el.clientHeight >= 40 && el.scrollHeight > el.clientHeight + 2)
        .sort((a, b) => b.clientHeight - a.clientHeight)[0];
      if (scroller) {
        const originalTop = scroller.scrollTop;
        // ponytail: bounded virtual-list scan; search remains the fast path.
        for (let pass = 0; pass < 12 && !option; pass++) {
          const nextTop = Math.min(scroller.scrollHeight - scroller.clientHeight, scroller.scrollTop + Math.max(80, scroller.clientHeight * 0.8));
          if (nextTop <= scroller.scrollTop) break;
          scroller.scrollTop = nextTop;
          scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
          await wait(70);
          option = findOption();
        }
        if (!option) { scroller.scrollTop = originalTop; scroller.dispatchEvent(new Event("scroll", { bubbles: true })); }
      }
    }
    if (!option && search && /^(?:证书名称|获奖项|竞赛名称)$/.test(label.replace(/[＊*]/g, ""))) {
      setSearchValue(search, "");
      await refreshPopup();
      option = await waitFor(findOption, 800);
    }
    if (!option) {
      trace.optionFound = false;
      trace.failure = popup ? /获奖大赛/.test(label) ? "competition-not-offered" : "option-not-found" : "popup-not-found";
      restoreChoiceSearch(target, trace.before);
      await closeVisibleDropdowns(control);
      return false;
    }
    trace.optionFound = true;
    trace.option = clean(option.textContent || option.getAttribute("data-value") || option.getAttribute("value"));
    trace.selectedValue = trace.option;
    trace.commit = "option-click";
    const commitTargets = selectionTargets(option);
    const commitTarget = commitTargets[0];
    trace.commitTarget = { tag: commitTarget?.tagName || "", className: String(commitTarget?.className || ""), text: clean(commitTarget?.textContent) };
    trace.commitTargets = commitTargets.map((node) => ({ tag: node?.tagName || "", className: String(node?.className || ""), text: clean(node?.textContent) }));
    trace.beforeClickState = choiceState(control, popup, commitTarget);
    logChoice("before-click", trace, trace.beforeClickState);
    const attemptedTargets = new Set(commitTargets);
    const searchSelect = control?.tagName === "INPUT" && control.getAttribute("role") === "combobox" && control.type === "search";
    const selectedOption = () => {
      const candidate = findOption() || option;
      for (let node = candidate; node && node !== popup; node = node.parentElement)
        if (node.getAttribute?.("aria-selected") === "true" || /(?:^|[-_\s])selected(?:$|[-_\s])/i.test(String(node.className || ""))) return true;
      return false;
    };
    const selectedBefore = searchSelect && selectedOption();
    const observeClick = (event) => { if ([...attemptedTargets].some((node) => event.target === node || node?.contains?.(event.target))) trace.clickObserved = true; };
    document.addEventListener("click", observeClick, true);
    const selectedCount = () => [...new Set([popup, ...popupFor(control)])]
      .filter((candidate) => candidate?.isConnected && visible(candidate))
      .map((candidate) => clean(candidate.innerText || candidate.textContent).match(/已选(?:地区)?\s*\d+\s*\/\s*\d+/)?.[0] || "")
      .sort((left, right) => Number(right.match(/\d+/)?.[0] || 0) - Number(left.match(/\d+/)?.[0] || 0))[0] || "";
    const selectedBeforeClick = selectedCount();
    const valueBeforeClick = readControl();
    const multiSelector = !!selectedBeforeClick || isMultipleChoice(control, popup);
    const optionChecked = () => {
      const option = findOption(), treeItem = option?.closest?.("[role=treeitem], [class*='tree__node'], [class*='tree-node'], [class*='TreeNode']");
      const selected = selectionTarget(option);
      return !!(selected?.checked || selected?.getAttribute?.('aria-checked') === 'true' || selected?.querySelector?.("[aria-checked=true], input:checked, [class*='CheckboxChecked'], [class*='checkbox-checked'], [class*='RadioChecked'], [class*='radio-checked']") || option?.querySelector?.("[aria-checked=true], input:checked, [class*='CheckboxChecked'], [class*='checkbox-checked'], [class*='RadioChecked'], [class*='radio-checked']")
        || treeItem?.querySelector?.("[aria-checked=true], input:checked, [class*='CheckboxChecked'], [class*='checkbox-checked'], [class*='RadioChecked'], [class*='radio-checked']"));
    };
    const checkedBeforeClick = optionChecked();
    const selectionChanged = () => {
      const selected = selectedCount();
      const current = readControl();
      return selected && selected !== selectedBeforeClick || optionChecked() !== checkedBeforeClick
        || !!current && current !== valueBeforeClick;
    };
    trace.selectionAttempts = [];
    if (multiSelector && checkedBeforeClick) {
      trace.selectionObserved = true;
      trace.selectionProtected = true;
    } else if (!multiSelector && selectedBefore) {
      // Search can commit an exact option; clicking it again can deselect it.
      trace.selectionProtected = true;
      trace.commit = "selected-option-protected";
    } else if (!multiSelector) {
      trace.optionClick = {};
      await clickOption(commitTarget, isAutocompleteControl(control), null, trace.optionClick);
      if (popup?.isConnected && visible(popup) && !await waitFor(selectionChanged, 350)) {
        for (const fallbackTarget of selectionTargets(option).filter((candidate) => candidate !== commitTarget)) {
          await clickOption(fallbackTarget);
          if (await waitFor(selectionChanged, 350)) break;
        }
      }
    }
    else for (let targetIndex = 0; targetIndex < commitTargets.length && !trace.selectionObserved; targetIndex++) {
      for (const plainTrusted of [false, true]) {
        if (!popup?.isConnected || !visible(popup)) {
          control.click();
          await wait(80);
          await refreshPopup();
          const liveSearch = [...(popup?.querySelectorAll?.(searchInputSelector) || [])].find(editableSearch);
          if (liveSearch && !isLocationPicker && !/薪|工资|待遇/.test(label) && !options().some((el) => matches(el.textContent || el.getAttribute("data-value") || el.getAttribute("value")))) {
            setSearchValue(liveSearch, proficiencySearch || value);
            await refreshPopup();
          }
        }
        option = await waitFor(findOption, 1400);
        const target = selectionTargets(option)[targetIndex];
        if (!target) break;
        attemptedTargets.add(target);
        const attempt = { target: String(target.className || target.tagName), plainTrusted, connected: !!target.isConnected };
        trace.selectionAttempts.push(attempt);
        await clickOption(target, true, null, attempt, plainTrusted);
        trace.selectionObserved = !!await waitFor(selectionChanged, 800);
        if (trace.selectionObserved) break;
      }
    }
    document.removeEventListener("click", observeClick, true);
    if (!multiSelector) await wait(80);
    trace.afterClick = readControl();
    trace.afterClickState = choiceState(control, popup, commitTarget);
    logChoice("after-click", trace, trace.afterClickState);
    if (multiSelector && !trace.selectionObserved) {
      trace.failure = "selection-not-observed";
      await closeVisibleDropdowns(control);
      lastChoice = trace;
      return false;
    }
    const choiceForControl = trace;
    const controls = pairedControls;
    const controlIndex = controls.indexOf(control);
    if (controlIndex >= 0 && controlIndex % 2 === 0 && controls[controlIndex + 1]) {
      const currentMonth = initialMonthValue;
      const monthSelected = currentMonth ? Number(currentMonth.replace(/\D/g, "")) === Number(month)
        : await choose(label, String(Number(month)), controls[controlIndex + 1], true, chooseOptions);
      choiceForControl.month = currentMonth ? { confirmed: monthSelected, protected: true } : lastChoice;
      lastChoice = choiceForControl;
      if (!monthSelected) {
        trace.failure = `month:${trace.month?.failure || "not-confirmed"}`;
        return false;
      }
    }
    // Re-read a live footer after the option click; multi-selects can remount it.
    if (multiSelector) await wait(100);
    const phoenixSelectionCart = multiSelector && (popup?.matches?.(".constant-main-selector-container")
      ? popup
      : popup?.querySelector?.(".constant-main-selector-container") || popup?.closest?.(".constant-main-selector-container"));
    if (phoenixSelectionCart) {
      trace.selectionCartReady = !!await waitFor(() => [...phoenixSelectionCart.querySelectorAll(".right-container .select-text-label")]
        .some((node) => matches(node.textContent || "")), 1500);
    }
    const confirm = multiSelector
      ? await waitFor(() => confirmationButton(phoenixSelectionCart || popup) || confirmationFor(popup, control), 800)
      : confirmationFor(popup, control);
    if (chooseOptions.deferConfirm && confirm && !readControl() && !(multiSelector && trace.selectionObserved)) {
      trace.confirmFound = true;
      trace.cascadePending = true;
      trace.afterConfirm = readControl();
      return false;
    }
    if (confirm) {
      trace.confirmAttempted = true;
      trace.confirmTarget = { tag: confirm.tagName || "", className: String(confirm.className || ""), connected: !!confirm.isConnected };
      trace.confirmClick = {};
      const plainPhoenixConfirm = !!phoenixSelectionCart;
      trace.confirmMode = plainPhoenixConfirm ? "plain-trusted-cart" : "trusted";
      await clickOption(confirm, multiSelector, multiSelector ? () => !visible(popup) : null, trace.confirmClick, plainPhoenixConfirm);
      if (multiSelector) await waitFor(() => !visible(popup), 800);
      else await wait(120);
    }
    trace.confirmFound = !!confirm;
    const committedControl = control.isConnected ? control : resolveField(elementKeys.get(control));
    // The option click commits component state; synthetic change on its container can clear dependent choices.
    // Component state can render after its click handler returns. Verify the
    // displayed value before closing the popup, rather than cancelling it early.
    const autocomplete = isAutocompleteControl(control);
    if (autocomplete) {
      committedControl?.blur?.();
      await closeVisibleDropdowns(committedControl || control);
    }
    if (autocomplete) pendingSuggestions.delete(committedControl || control);
    const expectedDisplay = year && month && pairIndex < 0 ? value : trace.selectedValue || value;
    trace.confirmed = !!await waitFor(() => valueMatches(readControl(), expectedDisplay, label)
      && (!searchSelect || !committedControl?.value || !selectedBefore && selectedOption()
        || trace.selectionProtected && selectedBefore
        || autocomplete && trace.clickObserved && (trace.afterClickState.input !== trace.beforeClickState.input || !trace.afterClickState.popupVisible))
      && (!autocomplete || !popup?.isConnected || !visible(popup)), 800);
    trace.afterConfirm = readControl();
    if (!trace.confirmed) {
      if (autocomplete) pendingSuggestions.add(committedControl || control);
      trace.failure = autocomplete && valueMatches(readControl(), expectedDisplay, label) ? "popup-still-open" : "display-not-confirmed";
      // Phoenix multi-selects commit through their empty control input.
      // Restoring that input after the footer click clears its pending tags.
      if (!multiSelector) restoreChoiceSearch(control, trace.before);
      else trace.restoreSkipped = "multi-selector";
    }
    trace.afterConfirmState = choiceState(committedControl || control, popup, commitTarget);
    if (trace.confirmed && autocomplete) pendingSuggestions.delete(committedControl || control);
    logChoice("confirmed", trace, trace.afterConfirmState);
    await closeVisibleDropdowns(committedControl || control);
    lastChoice = trace;
    return trace.confirmed;
  }

  const languageToken = (value) => {
    const token = normalize(value);
    const groups = [['英语','英文','english'],['中文','汉语','普通话','chinese','mandarin'],['日语','日本语','japanese'],['韩语','朝鲜语','korean'],['法语','french'],['德语','german'],['西班牙语','西语','spanish'],['俄语','russian'],['葡萄牙语','葡语','portuguese'],['阿拉伯语','arabic'],['意大利语','italian']];
    return groups.find(names => names.includes(token))?.[0] || token;
  };
  const valueMatches = (actual, expected, label = "") => {
    const a = normalize(actual); const e = normalize(expected);
    if (!a || !e) return false;
    if (a === e) return true;
    if (isSchoolLabel(label)) return false;
    if (/^(?:语言|语言类型|语言类别|外语类别|语言名称|语种)[＊*]?$/.test(label)) return languageToken(actual) === languageToken(expected);
    if (isLocationLabel(label)) {
      const locationKey = (text) => normalize(text).replace(/总部|分部|办事处/g, "").replace(/(?:特别行政区|自治区|自治州|省|市|地区|盟|区|县)/g, "");
      const expectedParts = String(expected).split(/[、,，;；]/).map((part) => locationKey(part)).filter(Boolean);
      const actualKey = locationKey(actual);
      const actualParts = String(actual).split(/[、,，;；]/).map(locationKey).filter(Boolean);
      if (expectedParts.length > 1 || actualParts.length > 1) {
        return expectedParts.every(part => actualKey.includes(part) || actualParts.some(actual => actual.length >= 2 && part.endsWith(actual)));
      }
      if (expectedParts[0] && actualKey === expectedParts[0]) return true;
    }
    if (/学历类型|受教育类型|培养方式|学习形式|学习方式|就读方式/.test(label) && /全日制|统招|非统招|自学考试/.test(expected))
      return /非全日制/.test(expected) ? /非全日制/.test(actual) : /非统招/.test(expected) ? /非统招/.test(actual) : /自学考试/.test(expected) ? /自学考试/.test(actual) : /全日制|统招/.test(actual) && !/非全日制/.test(actual);
    if (/描述|职责|简介|摘要|工作内容|亮点|业绩/.test(label)) return a === e;
    if (a.includes(e) || e.includes(a)) return true;
    if (/(?:获奖|奖项|奖励|大赛|比赛|竞赛)(?:级别|等级)/.test(label) && normalize(awardScope(actual)) === normalize(awardScope(expected))) return true;
    if (/薪|工资|待遇/.test(label)) {
      const actualRange = salaryRange(actual); const expectedRange = salaryRange(expected);
      if (actualRange && expectedRange && expectedRange[0] === expectedRange[1]) return actualRange[0] <= expectedRange[0] && expectedRange[0] <= actualRange[1];
      if (actualRange && expectedRange) return !!salaryOption(expected, [actual]);
    }
    if (/排名/.test(label)) return !!rankOption(expected, [actual]);
    if (proficiencyOption(expected, [actual], label)) return true;
    const actualDate = dateParts(actual); const expectedDate = dateParts(expected);
    return actualDate.length >= 2 && expectedDate.length >= 2
      && actualDate[0] === expectedDate[0] && actualDate[1] === expectedDate[1]
      && (!expectedDate[2] || !actualDate[2] || actualDate[2] === expectedDate[2]);
  };
  const fieldValueMatches = (target, expected, label) => {
    if (!target) return false;
    if (isLocationLabel(label) && (target.tagName === "SELECT" && !target.multiple || confirmedSingleLocationSources.get(target) === String(expected)))
      expected = String(expected).split(/[、,，;；]/).map(part => part.trim()).filter(Boolean)[0] || expected;
    if (pendingSuggestions.has(target) || pageValidationFailed(target)) return false;
    if (target.matches(".phoenix-radio-group")) return normalize(controlValue(target)) === normalize(expected);
    if (/日期|时间|年月/.test(label) && dateParts(expected).length >= 2) return dateValueMatches(target, expected);
    if (target.tagName === "SELECT" && normalize(target.selectedOptions[0]?.textContent) === normalize(expected)) return true;
    return isChoiceControl(target) || isLocationLabel(label)
      ? valueMatches(controlValue(target), expected, label) : clean(controlValue(target)) === clean(expected);
  };
  const verifyTargets = (targets) => (targets || []).map(({ key, value, label }) => ({ key, label, confirmed: fieldValueMatches(resolveField(key), value, label) }));
  const pageValidationFailed = (target) => {
    if (target?.getAttribute("aria-invalid") === "true") return true;
    const box = fieldContainer(target);
    const range = target?.closest?.("[class*='picker'][class*='range'], [class*='date-editor'][class*='range']");
    const inputs = [...(box?.querySelectorAll("input") || [])].filter(visible);
    const peers = range || inputs.length === 2 && inputs.every(input => /开始|结束|start|end/i.test(datePartText(input))) ? inputs : [];
    const choicePeers = inputs.length === 2 && inputs.every(isChoiceControl) ? inputs : [];
    const selectedRoot = choiceRoot(target);
    return [...(box?.querySelectorAll('[role=alert], [class*="feedback"], [class*="error"], [class*="invalid"]') || [])]
      .some(node => {
        const text = clean(node.textContent);
        // Compound selectors share a required error while the next choice is still empty.
        if (choicePeers.includes(target) && controlValue(target) && choicePeers.some(peer => peer !== target && !controlValue(peer))
          && selectedRoot?.querySelector('[aria-valuetext], [class*="single_selected"], [class*="selection-item"], [class*="display-value"]')
          && selectedRoot.getAttribute('aria-invalid') !== 'true' && !/(?:^|[\s_-])(?:error|invalid)(?:$|[\s_-])/i.test(String(selectedRoot.className))
          && /^(?:请选择|请输入|必填|required)$/i.test(text)) return false;
        // A shared date error can name only the missing endpoint, including separate pickers.
        if (peers.length === 2 && dateParts(controlValue(target)).length >= 2 && peers.some(peer => peer !== target && !controlValue(peer)
          && (/完整.*(?:时间|日期)|complete.*(?:date|range)/i.test(text)
            || fieldTitle(peer) && text.startsWith(fieldTitle(peer)) && !text.startsWith(fieldTitle(target))))) return false;
        return visible(node) && !node.closest('[aria-hidden="true"], [hidden]')
          && /必填|不能为空|无效|不正确|不存在|请选择|请填写|请输入|invalid|required|not found/i.test(text);
      });
  };
  async function applyValue(label, value, target, applyOptions = {}) {
    lastChoice = null;
    if (!target || value == null || value === "") return false;
    if (isLocationLabel(label) && target.tagName === "SELECT" && !target.multiple) value = String(value).split(/[、,，;；]/).map(part => part.trim()).filter(Boolean)[0] || value;
    if (target.matches('input[type=checkbox], [role=checkbox]') && /没有.*(?:经历|经验|成果)|无.*(?:经历|经验|成果)/.test(associatedLabels(target).join(" "))) {
      lastChoice = { failure: "negative-experience-toggle" }; return false;
    }
    const invalid = textConstraintFailure(target, value);
    if (invalid) { lastChoice = { failure: invalid }; return false; }
    const handle = rememberField(target);
    const originalBox = fieldContainer(target);
    // A year/month range is a set of select controls even when its internal
    // inputs look editable.  Do not write a full date into one part.
    // A source may state only a year. Select that known part and leave the
    // month empty rather than trying to write a complete date into one Select.
    const splitDate = dateParts(value).length >= 1 && dateControls(target).length >= 2;
    const autocompleteText = isAutocompleteControl(target);
    const range = fullDateRange(target);
    const pendingEnd = range[0] === target && applyOptions.rangeEnd && !controlValue(range[1]) && !["date", "month"].includes(target.type);
    let changed;
    if (pendingEnd) {
      const start = await choose(label, value, target, false, { ...applyOptions, keepDateRangeOpen: true });
      changed = (start || lastChoice?.rangeStartPending) && await choose("结束时间", applyOptions.rangeEnd, range[1], false, { ...applyOptions, keepExistingCalendar: true })
        && dateValueMatches(resolveField(handle), value) && dateValueMatches(range[1].isConnected ? range[1] : resolveField(elementKeys.get(range[1])), applyOptions.rangeEnd);
    } else changed =
      splitDate ? await choose(label, value, target, false, applyOptions)
      : autocompleteText ? isLocationLabel(label) ? await choose(label, value, target, false, applyOptions) : await writeAndObserveSuggestion(label, value, target, applyOptions)
        : target.tagName === "INPUT" && !isChoiceControl(target) ? await writeAndObserveSuggestion(label, value, target, applyOptions)
          : setValue(target, value) || await choose(label, value, target, false, applyOptions);
    if (!changed) return false;
    resolveField(handle)?.blur?.();
    await wait(150);
    const relocated = resolveField(handle);
    const displayOnly = !relocated && originalBox?.isConnected && !originalBox.querySelector(controlSelector) && isChoiceControl(target);
    if (!relocated && !displayOnly) return false;
    target = relocated || target;
    const defaultGpaStep = target.type === "number" && !target.hasAttribute("step") && /GPA|绩点/i.test(semanticText(target))
      && target.validity?.stepMismatch && !["badInput", "rangeOverflow", "rangeUnderflow", "valueMissing", "customError"].some(key => target.validity[key]);
    if (pageValidationFailed(target) || target.validity && !target.validity.valid && !defaultGpaStep) {
      lastChoice = { ...(lastChoice || {}), confirmed: false, failure: "page-validation-failed" }; return false;
    }
    const selected = pendingEnd ? value : lastChoice?.selectedValue || value;
    if (valueMatches(controlValue(target, originalBox), selected, label)) {
      if (autocompleteText && lastChoice?.confirmed && lastChoice?.selectedValue) pendingSuggestions.delete(target);
      return true;
    }
    const parts = dateParts(value); const controls = dateControls(target); const index = controls.indexOf(target);
    if (index >= 0 && parts.length >= 2) {
      const expectedPart = index % 2 ? Number(parts[1]) : Number(parts[0]);
      return Number(String(controlValue(target)).replace(/\D/g, "")) === expectedPart;
    }
    return false;
  }

  let rowAddDiagnostics = [];
  async function addRows(label, count, anchor, buttonPatterns = [], section = "") {
    if ([...document.querySelectorAll('input[type=checkbox], [role=checkbox]')].some((el) =>
      (el.checked || el.getAttribute("aria-checked") === "true") && inSection(el, section)
      && /没有.*(?:经历|经验|成果)|无.*(?:经历|经验)/.test(associatedLabels(el).join(" ") || el.closest("label")?.textContent || ""))) return 0;
    const countFields = () => {
      const matches = fields().filter((el) => anchorMatch(el, anchor));
      const scoped = matches.filter((el) => inSection(el, section));
      const sectionNames = [section, ...(SECTION_ALIASES[section] || [])].map(normalize);
      const atsxRows = section ? [...document.querySelectorAll(".createFormSection-repeatable")]
        .filter((node) => { const title = normalize(node.querySelector(".createFormSection-text")?.textContent); return sectionNames.some((name) => name && title.includes(name))
          && (!["获奖经历", "竞赛", "荣誉"].includes(section) || awardModule(title) === section); })
        .reduce((total, node) => Math.max(total, node.querySelectorAll(".resumeEditForm-item").length), 0) : 0;
      const owned = ["竞赛", "荣誉"].includes(section) ? scoped : section ? scoped.length ? scoped : matches.filter((el) => !hasKnownSection(sectionTitle(el))) : matches;
      return Math.max(atsxRows, rowContainers(anchor, section).length, new Set(owned.map((el) => repeatedContainer(el, anchor, section))).size);
    };
    const buttonInSection = (el) => {
      if (!section) return true;
      if (anchor === "语言类型" && languageCategoryButton(el)) return true;
      if (["获奖经历", "竞赛", "荣誉"].includes(section) && !inSection(el, section)) return false;
      const sectionNames = [section, ...(SECTION_ALIASES[section] || [])].map(normalize);
      const title = normalize(sectionTitle(el));
      return !hasKnownSection(title) || sectionNames.some((name) => title.includes(name));
    };
    let existing = countFields();
    // Existing controls without a recognized row anchor have ambiguous ownership.
    if (!existing && section && fields().some((el) => !el.matches('input[type=radio], input[type=checkbox], [role=radio], [role=checkbox]') && hasKnownSection(sectionTitle(el)) && inSection(el, section))) return 0;
    let clicks = 0;
    while (existing < count && clicks < count * 2) {
      const wanted = normalize(label);
      const sectionNames = [section, ...(SECTION_ALIASES[section] || [])].map(normalize);
      const atsxSection = [...document.querySelectorAll(".createFormSection-repeatable")].find((node) => {
        const title = normalize(node.querySelector(".createFormSection-text")?.textContent);
        return sectionNames.some((name) => name && title.includes(name))
          && (!["获奖经历", "竞赛", "荣誉"].includes(section) || awardModule(title) === section);
      });
      // Repeated Phoenix modules expose a stable module-id + _addButton pair.
      // Resolve that first so a deeply nested page cannot select another module.
      const moduleField = fields().find((el) => anchorMatch(el, anchor) && inSection(el, section))
        || (!["竞赛", "荣誉"].includes(section) && fields().find((el) => anchorMatch(el, anchor) && !hasKnownSection(sectionTitle(el))));
      let directButton = null;
      for (let node = moduleField; node && !directButton; node = node.parentElement) {
        if (node.id) directButton = document.getElementById(`${node.id}_addButton`);
      }
      const atsxButton = atsxSection?.querySelector(".createFormSection-addBtn, .formOperate-addBtn");
      const button = atsxButton && visible(atsxButton) ? atsxButton : directButton && visible(directButton) && buttonInSection(directButton) ? directButton : [...document.querySelectorAll("[id$='_addButton'], button, a, [role=button], [class*='add'], [class*='Add'], div, span")].find((el) => {
        if (!visible(el) || uploadControl(el) || el.disabled || el.getAttribute("aria-disabled") === "true" || el.closest("[data-resume-autofill-ui]")) return false;
        const text = normalize(el.textContent);
        if (text.length > 40 || el.querySelector(controlSelector) || el.matches("div, span") && (!/^(?:添加|新增|\+|＋)/.test(text) || [...el.children].some((child) => normalize(child.textContent) === text || /^(?:添加|新增)/.test(normalize(child.textContent))))) return false;
        const specific = text.includes(wanted) || buttonPatterns.some((pattern) => pattern.test(text));
        const genericInSection = /^(?:添加|新增|\+|＋)$/.test(text) && sectionNames.some((name) => name && normalize(sectionTitle(el)).includes(name));
        return buttonInSection(el) && (specific || genericInSection);
      });
      if (!button || uploadControl(button)) break;
      await clickOption(button, true, () => countFields() > existing);
      clicks++;
      const next = await waitFor(() => {
        const current = countFields();
        return current > existing ? current : 0;
      }, 1800);
      if (!next) {
        const saveRequired = [...document.querySelectorAll('[role=alert], [class*="message"], [class*="toast"], [class*="notification"]')].some(el => visible(el) && /请先保存|保存.*(?:后|再).*(?:添加|新增)|未保存/.test(clean(el.textContent)));
        rowAddDiagnostics.push({ label, section, stage: "interaction", reason: saveRequired ? "record-add-save-required" : "record-add-not-confirmed" });
        break;
      }
      existing = next;
    }
    return existing;
  }

  async function prepareProfile(profile, corrections = []) {
    let filled = 0;
    const diagnostics = [];
    const captcha = captchaBlocking();
    const record = (el, reason, repair) => diagnostics.push({ key: rememberField(el), label: identityLabel(el), stage: "interaction", reason, repair });
    if (!captcha) for (const correction of Array.isArray(corrections) ? corrections : []) {
      if (!correction) continue;
      const el = resolveField(correction.key);
      if (el?.tagName !== 'TEXTAREA') continue;
      const hints = [fieldTitle(el), el?.placeholder, el?.title, el?.getAttribute('aria-label'), ...associatedLabels(el)].filter(Boolean).join(' ').replace(/[\s（）()＊*]/g, '');
      const combinedRepair = correction.repair === "include-awards-in-combined-field" && /竞赛|大赛|比赛/.test(hints) && /评奖|评优|荣誉|奖励|奖学金|表彰/.test(hints);
      if (!/奖学金|获奖|荣誉|竞赛/.test(hints) || !combinedRepair && !/((?:院|校|市|省|国家|国际)级)(?:及|含)?以上/.test(hints)
        || typeof correction.expectedValue !== 'string' || !correction.expectedValue || el.value !== correction.expectedValue.replace(/\r\n?/g, '\n') || typeof correction.value !== 'string') continue;
      if (setValue(el, correction.value) && el.value === correction.value.replace(/\r\n?/g, '\n')) { filled++; record(el, 'filled', combinedRepair ? correction.repair : 'filter-awards-below-minimum'); }
    }
    for (const el of fields().filter(el => el.type === "checkbox" || el.getAttribute("role") === "checkbox")) {
      const caption = associatedLabels(el)[0] || fieldTitle(el);
      const rows = /没有.*项目/.test(caption) ? profile.projects : /没有.*实习/.test(caption) ? profile.internships : /没有.*工作/.test(caption) ? profile.work : [];
      if (!rows?.length || !controlValue(el)) continue;
      if (captcha) { record(el, "captcha-blocked", "show-existing-experience"); continue; }
      el.click();
      const confirmed = await waitFor(() => !controlValue(el), 800);
      if (confirmed) filled++;
      record(el, confirmed ? "filled" : "display-not-confirmed", "show-existing-experience");
    }
    if (!captcha && profile.extras?.selfEvaluation) await addRows("个人评价", 1, "个人评价", [/(?:添加|新增).*(?:自我|个人)(?:评价|描述)/], "个人评价");
    const exams = fields().filter(el => /^(?:语言考试|英语等级)[＊*]?$/.test(fieldTitle(el)));
    const certificates = (profile.certificates || []).filter(row => /^CET[46]$/.test(certificateExam(row.name)));
    const highest = [...certificates].sort((a, b) => certificateExam(a.name).localeCompare(certificateExam(b.name))).at(-1);
    // ponytail: correct only a supplied CET exam/score pair in a single slot; keep unrelated edits.
    if (!captcha && exams.length === 1 && highest) {
      const el = exams[0], current = certificateExam(controlValue(el));
      const schema = formSchema(), descriptor = schema.find(field => field.key === rememberField(el));
      const score = fields().find(control => fieldTitle(control) === "考试分数" && fieldContainer(control) === fieldContainer(el))
        || fields().find(control => rememberField(control) === schema.find(field => field.label === "考试分数" && field.dependsOn === descriptor?.key)?.key);
      const previousMatches = certificates.filter(row => current ? certificateExam(row.name) === current : score && controlValue(score) && certificateScore(row) === controlValue(score));
      const previous = previousMatches.length === 1 ? previousMatches[0] : null;
      const emptyPair = !controlValue(el) && score && !controlValue(score);
      if (score && certificateScore(highest) && (emptyPair || previous && (!controlValue(score) || controlValue(score) === certificateScore(previous)))
        && (current !== certificateExam(highest.name) || !controlValue(score))) {
        const oldScore = controlValue(score);
        const changed = await applyValue("语言考试", certificateExam(highest.name), el)
          && certificateExam(controlValue(el)) === certificateExam(highest.name)
          && await applyValue("考试分数", certificateScore(highest), score);
        if (changed) { filled += 2; record(el, "filled", "highest-cet-with-score"); record(score, "filled", "highest-cet-with-score"); }
        else { if (current || previous) await applyValue("语言考试", current || certificateExam(previous.name), el); setValue(score, oldScore); record(el, "exam-pair-not-confirmed", "highest-cet-with-score"); }
      }
    }
    if (!captcha) for (const el of fields()) {
      if (!/其[它他]语言水平证书/.test(fieldTitle(el)) || el.tagName !== "TEXTAREA") continue;
      if ((profile.certificates || []).some(row => !isEnglishCertificate(row))) continue;
      if (!(profile.certificates || []).some(row => isEnglishCertificate(row) && normalize(controlValue(el)) === normalize(row.name))) continue;
      if (setValue(el, "") && !controlValue(el)) { filled++; record(el, "filled", "remove-misplaced-english-certificate"); }
    }
    return { filled, diagnostics };
  }

  async function ensureRows(counts) {
    rowAddDiagnostics = [];
    // Filling must never delete rows already present on a job-application page.
    const education = await addRows("教育经历", counts?.education || 0, "学校名称", [/(?:添加|新增).*教育.*经历/], "教育背景");
    const languages = await addRows("语言能力", counts?.languages || counts?.english || 0, "语言类型", [/(?:添加|新增).*(?:语言|外语).*(?:能力|水平|类别|语种)/], "语言能力");
    const work = await addRows("工作经历", counts?.work || 0, "公司名称", [/(?:添加|新增).*工作.*经历/], "工作经历");
    const internships = await addRows("实习经历", counts?.internships || 0, "公司名称", [/(?:添加|新增).*实习.*经历/], "实习经历");
    const projects = await addRows("项目经历", counts?.projects || 0, "项目名称", [/(?:添加|新增).*项目.*(?:经历|经验)/], "项目经验");
    const cadres = await addRows("学生干部经历", counts?.cadres || 0, "职务", [/(?:添加|新增).*(?:(?:学生|干部|校园|社团).*经历|在校实践|校内实践)/], "学生干部经历");
    const englishCertificates = await addRows("英语能力", counts?.englishCertificates || 0, "证书名称", [/添加.*英语.*能力/], "英语能力");
    const certificates = await addRows("证书", counts?.certificates || 0, "证书名称", [/添加.*证书/], "证书");
    const skills = await addRows("技能", counts?.skills || 0, "技能名称", [/(?:添加|新增).*(?:技能|计算机能力)/], "技能");
    const unifiedAwards = await addRows("获奖情况", counts?.awards || 0, "获奖项", [/(?:添加|新增).*(?:奖励活动|获奖|奖项|荣誉)/], "获奖经历");
    const competitions = await addRows("竞赛", counts?.competitions || 0, "获奖项", [/(?:添加|新增).*(?:竞赛|大赛|比赛)/], "竞赛");
    const honors = await addRows("荣誉", counts?.honors || 0, "获奖项", [/(?:添加|新增).*(?:奖励|荣誉|奖学金)/], "荣誉");
    return { education, languages, work, internships, projects, cadres, englishCertificates, certificates, skills, awards: unifiedAwards + competitions + honors, competitions, honors, diagnostics: rowAddDiagnostics };
  }

  async function fill(profile, options = {}) {
    const prepared = await prepareProfile(profile);
    let filled = prepared.filled; let missing = 0; let structuredMissing = 0;
    const filledFields = []; const missingFields = []; const skippedFields = [];
    const onlyEmpty = !!options.onlyEmpty;
    const expectedEmpty = new Map();
    const noteEmpty = (field, value, label) => {
      if (field && value != null && value !== "" && !controlValue(field)) expectedEmpty.set(rememberField(field), { value, label });
    };
    const formatNumberedText = (value) => String(value || "").replace(/(^|\n)\s*(\d+)[.、)]\s*\n\s*/g, "$1$2. ");
    const mergedWorkText = (row) => {
      const duties = formatNumberedText(row?.description).replace(/^\s*(?:工作内容|工作描述|工作职责|职责)\s*[：:]\s*/, "").trim();
      const highlights = formatNumberedText(row?.highlights).replace(/^\s*(?:亮点|工作亮点|工作业绩|工作成果|业绩亮点|工作成就)\s*[：:]\s*/, "").trim();
      return [duties && `职责：\n${duties}`, highlights && `亮点：\n${highlights}`].filter(Boolean).join("\n");
    };
    const usedFields = new Set();
    const deferredFields = [];
    const deferChoice = (field) => {
      const hint = `${field?.type || ""} ${fieldTitle(field)} ${field?.getAttribute("aria-label") || ""} ${field?.getAttribute("placeholder") || ""}`;
      return !!options.deferChoices && !/(日期|时间|年月|date|month)/i.test(hint)
        && (isSuggestionControl(field) || isChoiceControl(field)
          && /期望从事行业|期望行业|意向行业|期望从事职业|期望职业|意向职位|(?:职位|职业|岗位)(?:类别|类型)/.test(hint));
    };
    const hasSection = (section) => moduleTitles().some((text) => [section, ...(SECTION_ALIASES[section] || [])].map(normalize).some((name) => normalize(text).includes(name))) || fields().some((el) => {
      const title = normalize(sectionTitle(el));
      return title && [section, ...(SECTION_ALIASES[section] || [])].map(normalize).some((name) => title.includes(name));
    }) || [...document.querySelectorAll("h1, h2, h3, h4, h5, h6, legend, [role=heading], [class*='title'], [class*='Title'], .createFormSection-text")].some((el) => {
      const title = normalize(clean(el.innerText || el.textContent));
      return [section, ...(SECTION_ALIASES[section] || [])].map(normalize).some((name) => title === name);
    });
    const allExperienceRows = profile.experiences?.length ? profile.experiences : [...(profile.internships || []), ...(profile.work || [])];
    const hasInternshipSection = hasSection("实习经历") && moduleTitles().some((title) => /实习/.test(title) && !combinedExperience(title));
    const hasCombinedExperience = fields().some((el) => combinedExperience(sectionTitle(el))) || [...document.querySelectorAll("div, span, h2, h3")].some((el) => combinedExperience(clean(el.textContent)) && clean(el.textContent).length <= 30);
    const workRows = hasCombinedExperience || !hasInternshipSection ? allExperienceRows : (profile.work || []);
    const internshipRows = hasInternshipSection ? (profile.internships?.length ? profile.internships : (profile.work || []).filter((row) => /实习|intern/i.test(`${row?.workType || ""} ${row?.title || ""}`))) : [];
    const simple = [["姓名", profile.name], ["手机号码", profile.phone], ["邮箱", profile.email], ["出生日期", profile.birthDate], ["年龄", profile.age], ["民族", profile.nationality], ["国家/地区", profile.countryRegion], ["政治面貌", profile.politicalStatus], ["户口所在地", profile.householdRegistration], ["家庭所在城市", profile.nativePlace || profile.householdRegistration], ["工作经验", profile.workExperience], ["籍贯", profile.nativePlace], ["现居住地", profile.currentResidence], ["微信号", profile.wechat], ["最近公司", allExperienceRows[0]?.company], ["当前就读学校学号", profile.education?.[0]?.studentId], ["兴趣爱好", profile.extras?.hobbies], ["特长", profile.extras?.specialty], ["个人评价", profile.extras?.selfEvaluation], ["获奖经历", profile.extras?.awards], ["学生干部经历", profile.extras?.studentCadres]];
    for (const [label, fallback] of simple) {
      const field = findField(label);
      const value = Object.entries(profile.customFields || {}).find(([key]) => normalize(key) === normalize(fieldTitle(field)))?.[1] || fallback;
      if (!value) continue;
      noteEmpty(field, value, label);
      if (onlyEmpty && field && controlValue(field)) { skippedFields.push(label); continue; }
      if (deferChoice(field)) { deferredFields.push(label); continue; }
      if (field && usedFields.has(field)) { skippedFields.push(label); continue; }
      if (await applyValue(label, value, field)) { if (field) usedFields.add(field); filled++; filledFields.push(label); }
      else { missing++; missingFields.push(label); }
    }
    const genderField = findField("性别");
    noteEmpty(genderField, profile.gender, "性别");
    if (profile.gender && onlyEmpty && genderField && controlValue(genderField)) skippedFields.push("性别");
    else if (profile.gender && deferChoice(genderField)) deferredFields.push("性别");
    else if (profile.gender && await choose("性别", profile.gender, genderField)) { filled++; filledFields.push("性别"); }
    else if (profile.gender) { missing++; missingFields.push("性别"); }
    const degreeRank = (degree) => {
      const text = normalize(degree);
      if (/博士/.test(text)) return 6;
      if (/硕士|mba/.test(text)) return 5;
      if (/本科|学士/.test(text)) return 4;
      if (/大专|专科/.test(text)) return 3;
      if (/中专|高中/.test(text)) return 2;
      if (/初中/.test(text)) return 1;
      return 0;
    };
    const highestDegree = [...(profile.education || [])].map((row) => row?.degree).filter(Boolean)
      .sort((left, right) => degreeRank(right) - degreeRank(left))[0];
    const highestField = findField("最高学历");
    noteEmpty(highestField, highestDegree, "最高学历");
    if (highestDegree && onlyEmpty && highestField && controlValue(highestField)) skippedFields.push("最高学历");
    else if (highestDegree && deferChoice(highestField)) deferredFields.push("最高学历");
    else if (highestDegree && await choose("最高学历", highestDegree, highestField)) { filled++; filledFields.push("最高学历"); }
    else if (highestDegree) { missing++; missingFields.push("最高学历"); }
    const intent = [["期望从事行业", profile.jobIntent?.industry], ["期望从事职业", profile.jobIntent?.occupation], ["现月薪(税前)", profile.jobIntent?.currentSalary], ["期望月薪(税前)", profile.jobIntent?.expectedSalary], ["期望工作城市", profile.jobIntent?.city], ["到岗时间", profile.jobIntent?.arrival]];
    const diagnostics = {
      intentSources: Object.fromEntries(intent.map(([label, value]) => [label, !!value])),
      educationEndSources: (profile.education || []).map((row) => !!row?.end),
      experienceSalarySources: allExperienceRows.map((row) => !!row?.salary),
      experienceLocationSources: allExperienceRows.map((row) => !!row?.location),
      structuredAttempts: [], targetFields: [], experienceLocations: []
    };
    const highestRows = (profile.education || []).filter((row) => degreeRank(row?.degree) > 0 && degreeRank(row.degree) === degreeRank(highestDegree));
    for (const [label, key] of [["最高学历学校", "school"], ["最高学历专业", "major"], ["最高学历毕业日期", "end"], ["预计毕业时间", "end"], ["毕业学校", "school"], ["毕业院校", "school"], ["毕业学院", "college"], ["毕业院系", "college"], ["毕业学校专业", "major"], ["毕业专业", "major"], ["毕业时间", "end"], ["学习形式", "training"]]) {
      const targets = fields().filter((field) => normalize(fieldTitle(field).replace(/[＊*]/g, "")) === normalize(label)
        && (!["毕业时间", "学习形式"].includes(label) || !/教育|学历/.test(moduleTitle(field))));
      if (!targets.length) continue;
      const detail = { key: targets.length === 1 ? rememberField(targets[0]) : "", label, section: "最高学历", row: 1 };
      if (targets.length !== 1 || highestRows.length !== 1) {
        diagnostics.structuredAttempts.push({ ...detail, reason: "ambiguous-highest-education" }); continue;
      }
      const field = targets[0]; const value = highestRows[0][key];
      if (!value) { diagnostics.structuredAttempts.push({ ...detail, reason: "profile-value-missing" }); continue; }
      noteEmpty(field, value, label);
      if (controlValue(field)) {
        skippedFields.push(label); diagnostics.structuredAttempts.push({ ...detail, reason: "page-value-protected", matchesSource: valueMatches(controlValue(field), value, label) }); continue;
      }
      if (await applyValue(label, value, field)) {
        usedFields.add(field); filled++; filledFields.push(label); diagnostics.structuredAttempts.push({ ...detail, reason: "filled", choice: lastChoice });
      } else { missing++; missingFields.push(label); diagnostics.structuredAttempts.push({ ...detail, reason: "page-option-or-validation-failed", choice: lastChoice }); }
    }
    for (const [label, value] of intent) {
      if (!value) continue;
      const field = findField(label);
      const detail = { key: field ? rememberField(field) : "", section: "求职意向", row: 1, label, value: String(value), targetIndex: field ? fields().indexOf(field) : -1, targetLabel: field ? fieldTitle(field) || labelText(field) : "" };
      noteEmpty(field, value, label);
      if (onlyEmpty && field && controlValue(field)) { skippedFields.push(label); diagnostics.structuredAttempts.push({ ...detail, reason: "page-value-protected", actual: controlValue(field), matchesSource: valueMatches(controlValue(field), value, label) }); continue; }
      if (deferChoice(field)) { deferredFields.push(label); diagnostics.structuredAttempts.push({ ...detail, reason: "deferred-to-ai" }); continue; }
      if (field && usedFields.has(field)) { skippedFields.push(label); diagnostics.structuredAttempts.push({ ...detail, reason: "duplicate-field" }); continue; }
      if (await applyValue(label, value, field)) { if (field) usedFields.add(field); filled++; filledFields.push(label); diagnostics.structuredAttempts.push({ ...detail, reason: "filled", actual: controlValue(field), choice: lastChoice }); }
      else { missing++; missingFields.push(label); diagnostics.structuredAttempts.push({ ...detail, reason: "page-option-or-validation-failed", actual: controlValue(field), choice: lastChoice }); }
    }
    for (const [label, value] of Object.entries(profile.customFields || {})) {
      if (!value) continue;
      const field = findField(label);
      if (!field) { missing++; missingFields.push(label); continue; }
      noteEmpty(field, value, label);
      if (controlValue(field) || usedFields.has(field)) { skippedFields.push(label); continue; }
      if (deferChoice(field)) { deferredFields.push(label); continue; }
      if (await applyValue(label, value, field)) { usedFields.add(field); filled++; filledFields.push(label); }
      else { missing++; missingFields.push(label); }
    }
    const hasEnglishCertificateSection = rowContainers("证书名称", "英语能力").length > 0;
    const englishCertificates = hasEnglishCertificateSection ? (profile.certificates || []).filter(isEnglishCertificate) : [];
    // A separate certificate module asks for certificates again, including English exams.
    const certificates = profile.certificates || [];
    diagnostics.structuredAttempts.push(...prepared.diagnostics);
    const awardTitles = moduleTitles().join(" ");
    const competitions = (profile.awards || []).filter(competitionAward);
    // Generic honor sections are the only award destination on many forms;
    // keep explicit contest names usable there when no contest section exists.
    const honors = /竞赛|大赛|比赛/.test(awardTitles)
      ? (profile.awards || []).filter(item => !competitionAward(item))
      : (profile.awards || []);
    diagnostics.rows = await ensureRows({ education: profile.education?.length, languages: profile.languages?.length, work: workRows.length, internships: internshipRows.length, projects: profile.projects?.length, cadres: profile.cadres?.length, englishCertificates: englishCertificates.length, certificates: certificates.length, skills: profile.skills?.length, awards: profile.awards?.length, competitions: competitions.length, honors: honors.length });
    const describeTarget = (field, method) => field ? {
      method, label: fieldTitle(field) || labelText(field), element: field.tagName.toLowerCase(), module: moduleTitle(field),
      repeatIndex: repeatIndex(field, fieldTitle(field) || labelText(field)), currentValue: controlValue(field), targetIndex: fields().indexOf(field)
    } : { method, label: "", element: "", module: "", repeatIndex: -1, currentValue: "", targetIndex: -1 };
    for (const label of ["期望从事行业", "期望从事职业", "期望月薪(税前)", "期望工作城市"]) diagnostics.targetFields.push({ requestedLabel: label, ...describeTarget(findField(label), "findField") });
    for (const [rows, section] of [[workRows, "工作经历"], [internshipRows, "实习经历"]]) {
      for (let index = 0; index < rows.length; index++) {
        const field = rowField("公司名称", index, "工作地点", section, rows[index]?.location);
        diagnostics.experienceLocations.push({ company: rows[index]?.company || "", profileRow: index + 1, pageRow: field ? repeatIndex(field, "工作地点") + 1 : -1, targetLabel: field ? fieldTitle(field) || labelText(field) : "", ...describeTarget(field, "rowField") });
      }
    }
    const certificateMapping = [["证书名称", "name"], ["分数", "_score"], ["获得时间", "date"], ["证书描述", "description"]];
    const alignRows = (sourceRows, mapping, anchor, section) => {
      const remaining = [...(sourceRows || [])];
      const key = mapping.find(([label]) => label === anchor)?.[1];
      const matched = rowContainers(anchor, section).map((container) => {
        const field = [...(container.matches?.(controlSelector) ? [container] : []), ...container.querySelectorAll(controlSelector)]
          .find((el) => editable(el) && anchorMatch(el, anchor));
        const actual = controlValue(field);
        const description = /^(?:证书名称|获奖项)$/.test(anchor) && rowDescription(container);
        const descriptionBinding = (!actual || /^(?:其他|其它)$/.test(actual)) && description;
        if (!actual && !descriptionBinding) return undefined;
        const matches = (sourceRows || []).filter(row => {
          const expected = row?.[key];
          if (descriptionBinding) return clean(row.description) === description;
          return anchor === "证书名称" && certificateExam(actual) && certificateExam(expected)
            ? certificateExam(actual) === certificateExam(expected) : anchor === "语言类型" ? languageToken(actual) === languageToken(expected) : normalize(actual) === normalize(expected);
        });
        const index = matches.length === 1 ? remaining.indexOf(matches[0]) : -1;
        return index >= 0 ? remaining.splice(index, 1)[0] : null;
      });
      return [...matched.map((row) => row === undefined ? remaining.shift() : row), ...remaining];
    };
    const groups = [
      [profile.education, [["学历类型", "training"], ["学历", "degree"], ["学校名称", "school"], ["学校所在城市", "location"], ["学院名称", "college"], ["专业名称", "major"], ["开始时间", "start"], ["结束时间", "end"], ["GPA类型", "gpaType"], ["GPA", "gpa"], ["成绩排名", "rank"]], "学校名称", "教育背景"],
      [englishCertificates, certificateMapping, "证书名称", "英语能力"],
      [certificates, certificateMapping, "证书名称", "证书"],
      [profile.skills, [["技能名称", "name"], ["掌握程度", "proficiency"], ["使用时间总计", "duration"], ["技能描述", "description"]], "技能名称", "技能"],
      [profile.languages, [["语言类型", "language"], ["掌握程度", "proficiency"], ["听说", "speaking"], ["读写", "reading"]], "语言类型", "语言能力"],
      [workRows, [["公司名称", "company"], ["所在部门", "department"], ["职位名称", "title"], ["工作性质", "workType"], ["开始时间", "start"], ["结束时间", "end"], ["月薪(税前)", "salary"], ["工作地点", "location"], ["离职原因", "reason"], ["工作描述", "description"], ["工作职责", "description"], ["工作亮点", "highlights"]], "公司名称", "工作经历"],
      [internshipRows, [["公司名称", "company"], ["所在部门", "department"], ["职位名称", "title"], ["工作性质", "workType"], ["开始时间", "start"], ["结束时间", "end"], ["月薪(税前)", "salary"], ["工作地点", "location"], ["离职原因", "reason"], ["工作描述", "description"], ["工作职责", "description"], ["工作亮点", "highlights"]], "公司名称", "实习经历"],
      [profile.projects, [["项目名称", "name"], ["项目职务", "role"], ["项目职责", "responsibilities"], ["开始时间", "start"], ["结束时间", "end"], ["项目链接", "link"], ["项目描述", "description"], ["项目成果", "outcomes"]], "项目名称", "项目经验"],
      [profile.cadres, [["职务", "position"], ["级别", "level"], ["开始时间", "start"], ["结束时间", "end"], ["工作职责", "duty"]], "职务", "学生干部经历"],
      ...[[profile.awards, "获奖经历"], [competitions, "竞赛"], [honors, "荣誉"]].map(([rows, section]) =>
        [rows, [["获奖类型", "_type"], ["获奖项", "name"], ["获奖时间", "date"], ["获奖级别", "level"], ["获奖描述", "description"]], "获奖项", section])
    ];
    for (const [sourceRows, mapping, anchor, section] of groups) {
      const rows = alignRows(sourceRows, mapping, anchor, section);
      for (let index = 0; index < (rows || []).length; index++) {
        const row = rows[index];
        if (!row) continue;
        const parts = anchor === "项目名称" ? projectParts(row) : null;
        let startDateConfirmed = true;
        let languageTypeConfirmed = anchor !== "语言类型";
        let awardTypeConfirmed = anchor !== "获奖项" || !rowField(anchor, index, "获奖类型", section);
        const gpaFraction = String(row.gpa || "").trim().match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
        const explicitScale = gpaFraction && Number.isFinite(Number(gpaFraction[1])) && Number.isFinite(Number(gpaFraction[2])) && Number(gpaFraction[2]) > 0 && Number(gpaFraction[1]) <= Number(gpaFraction[2]) ? `${Number(gpaFraction[2])}分制` : "";
        const gpaScaleAgrees = explicitScale && [row.gpaType, row.gpaScale].every((type) => !type || normalize(type) === normalize(explicitScale));
        const gpaType = row.gpaType || row.gpaScale || explicitScale;
        for (const [label, key] of mapping) {
          let value = key === "_exam" ? certificateExam(row?.name)
            : key === "_type" ? row?.type || row?.category || (/奖学金/.test(row?.name || "") ? "奖学金" : competitionAward(row) ? "竞赛" : row?.name)
            : key === "_score" ? certificateScore(row)
            : label === "项目职责" ? row?.responsibilities || parts?.responsibilities
            : label === "项目描述" ? parts?.summary || row?.summary || row?.description
            : label === "成绩排名" ? row?.rank || String(row?.gpa || "").match(/\d+(?:\.\d+)?\s*%/)?.[0]
            : label === "GPA类型" ? gpaType
            : label === "GPA" && gpaScaleAgrees ? gpaFraction[1]
            : label === "工作性质" ? row?.workType || (/实习|intern/i.test(String(row?.title || "")) ? "实习" : "")
            : label === "获奖级别" ? awardLevel(row)
            : (sourceRows === workRows || sourceRows === internshipRows) && (label === "工作描述" || label === "工作职责") ? formatNumberedText(row?.description)
            : key === "highlights" ? formatNumberedText(row?.[key])
            : row?.[key];
          const field = rowField(anchor, index, label, section, value);
          if (label === "GPA类型" && field?.type === "number") value = String(gpaType).match(/^(\d+(?:\.\d+)?)(?:分制)?$/)?.[1] || "";
          if (key === "_type" && !field) continue;
          if (key === "_type" && !isChoiceControl(field)) value = row?.type || row?.category;
          if ((sourceRows === workRows || sourceRows === internshipRows) && (label === "工作描述" || label === "工作职责")) {
            const highlightsField = rowField(anchor, index, "工作亮点", section);
            if (!highlightsField || highlightsField === field) value = mergedWorkText(row);
          }
          if (label === "GPA" && field?.type === "number") {
            value = String(value ?? "").trim().match(/^(\d+(?:\.\d+)?)\s*\/\s*\d+(?:\.\d+)?\s*%$/)?.[1] || value;
          }
          if (field && label === "项目描述" && !rowField(anchor, index, "项目职责", section)) {
            const text = row?.description || row?.summary || "";
            value = [text, row?.responsibilities && !text.includes(row.responsibilities) ? row.responsibilities : ""].filter(Boolean).join("\n");
          }
          noteEmpty(field, value, label);
          const isWorkText = (sourceRows === workRows || sourceRows === internshipRows) && /工作内容|工作描述|工作职责|工作亮点|工作成果|业绩亮点/.test(label);
          const repairPartialWorkText = isWorkText && key === "description" && row?.highlights && value === mergedWorkText(row)
            && formatNumberedText(controlValue(field)).trim() === formatNumberedText(row?.description).trim();
          const fieldName = `${section}[${index + 1}].${label}`;
          const targetLabel = field ? (fieldTitle(field) || labelText(field)) : "";
          const detail = { key: field ? rememberField(field) : "", section, row: index + 1, company: row?.company || "", label, value: String(value || ""), datePartCount: /时间/.test(label) ? dateParts(value).length : 0, dateControlCount: /时间/.test(label) && field ? dateControls(field).length : 0, targetIndex: field ? fields().indexOf(field) : -1, targetLabel, targetRepeatIndex: field ? repeatIndex(field, targetLabel) : -1 };
          if (anchor === "获奖项" && label === "获奖项" && !awardTypeConfirmed) {
            deferredFields.push(fieldName); diagnostics.structuredAttempts.push({ ...detail, reason: "choice-parent-not-confirmed" }); continue;
          }
          if (anchor === "语言类型" && label !== "语言类型" && !languageTypeConfirmed) {
            skippedFields.push(fieldName); diagnostics.structuredAttempts.push({ ...detail, reason: "language-type-not-confirmed" }); continue;
          }
          if (/结束时间/.test(label) && !startDateConfirmed) { structuredMissing++; missingFields.push(fieldName); diagnostics.structuredAttempts.push({ ...detail, reason: "start-date-not-confirmed" }); continue; }
          if (label === "GPA" && gpaFraction && !gpaScaleAgrees) {
            structuredMissing++; missingFields.push(fieldName); diagnostics.structuredAttempts.push({ ...detail, reason: "gpa-source-conflict" }); continue;
          }
          if (label === "GPA" && value && gpaType && !controlValue(field)) {
            const typeField = rowField(anchor, index, "GPA类型", section, gpaType);
            if (typeField && !valueMatches(controlValue(typeField), gpaType, "GPA类型")) {
              structuredMissing++; missingFields.push(fieldName); diagnostics.structuredAttempts.push({ ...detail, reason: "gpa-type-not-confirmed" }); continue;
            }
          }
          if (!value) {
            if (label === "语言类型") languageTypeConfirmed = false;
            if (/月薪|工作地点|获奖时间|成绩排名/.test(label)) diagnostics.structuredAttempts.push({ ...detail, reason: "profile-value-missing" });
            continue;
          }
          if (onlyEmpty && field && controlValue(field) && !repairPartialWorkText) {
            detail.matchesSource = valueMatches(controlValue(field), value, label);
            if (key === "_type") awardTypeConfirmed = detail.matchesSource;
            if (label === "语言类型") languageTypeConfirmed = valueMatches(controlValue(field), value, label);
            if (/开始时间/.test(label)) {
              startDateConfirmed = dateValueMatches(field, value);
            }
            if (dateParts(value).length >= 2 && /日期|时间/.test(label)) detail.dateMatch = { confirmed: dateValueMatches(field, value), controlCount: dateControls(field).length };
            skippedFields.push(fieldName); diagnostics.structuredAttempts.push({ ...detail, reason: "page-value-protected" }); continue;
          }
          if (!field) { if (label === "语言类型") languageTypeConfirmed = false; if (value && /开始时间/.test(label)) startDateConfirmed = false; structuredMissing++; missingFields.push(fieldName); diagnostics.structuredAttempts.push({ ...detail, reason: "field-not-found" }); continue; }
          if (deferChoice(field)) { if (label === "语言类型") languageTypeConfirmed = false; if (value && /开始时间/.test(label)) startDateConfirmed = false; deferredFields.push(fieldName); diagnostics.structuredAttempts.push({ ...detail, reason: "deferred-to-ai" }); continue; }
          const range = fullDateRange(field);
          const rangeEnd = label === "开始时间" && range[0] === field ? row?.end : "";
          if (rangeEnd) noteEmpty(range[1], rangeEnd, "结束时间");
          let applied = false, interactionError = false;
          lastChoice = null;
          try { applied = await applyValue(label, value, field, { rangeEnd }); } catch { interactionError = true; }
          if (key === "_type") awardTypeConfirmed = applied;
          if (label === "语言类型") languageTypeConfirmed = applied;
          if (/开始时间/.test(label)) startDateConfirmed = applied && dateValueMatches(field, value);
          if (applied) {
            if (field && lastChoice?.fallback === "page-option-other") expectedEmpty.set(rememberField(field), { value: lastChoice.selectedValue, label });
            filled++; filledFields.push(fieldName); diagnostics.structuredAttempts.push({ ...detail, reason: "filled", actual: controlValue(field), choice: lastChoice });
          }
          else { structuredMissing++; missingFields.push(fieldName); diagnostics.structuredAttempts.push({ ...detail, reason: interactionError ? "page-interaction-error" : "page-option-or-validation-failed", actual: controlValue(field), choice: lastChoice }); }
        }
      }
    }
    if (lastOpenedControl) {
      await closeVisibleDropdowns(lastOpenedControl);
      lastOpenedControl = null;
    }
    await closeVisibleDropdowns();
    diagnostics.deferredFields = deferredFields;
    diagnostics.expectedEmpty = expectedEmpty.size;
    const finalFields = new Map(formSchema().map((field) => [field.key, field]));
    diagnostics.emptyTargets = [...expectedEmpty].map(([key, { value, label }]) => {
      const field = resolveField(key);
      const descriptor = finalFields.get(key);
      return { key, label, module: descriptor?.module || "", row: descriptor ? descriptor.repeatIndex + 1 : 0,
        confirmed: !!field && (/日期|时间/.test(label) && dateParts(value).length >= 2 ? dateValueMatches(field, value) : valueMatches(controlValue(field), value, label)) };
    });
    diagnostics.confirmedEmpty = diagnostics.emptyTargets.filter((target) => target.confirmed).length;
    const result = { filled, missing: missing + structuredMissing, filledFields, missingFields, skippedFields, diagnostics };
    console.info("[resume-autofill] structured-fill", { filled, missing: result.missing, skipped: skippedFields.length });
    return result;
  }

  const runtime = globalThis.chrome?.runtime;
  const locateField = (key, locator) => {
    const target = resolveField(key) || (() => {
      const match = matchReviewField(formSchema(), locator);
      return match ? resolveField(match.key) : null;
    })();
    if (!target) return { located: false };
    target.scrollIntoView({ block: "center", inline: "nearest" });
    const original = target.style.outline;
    target.style.outline = "3px solid #f59e0b";
    setTimeout(() => { if (target.isConnected && target.style.outline === "3px solid rgb(245, 158, 11)") target.style.outline = original; }, 3000);
    return { located: true };
  };
  function showPageAction(result) {
    if (window.top !== window || !result && fields().length < 4 || !runtime?.sendMessage) return { shown: false };
    const existing = document.getElementById("resume-autofill-page-action");
    if (!result && existing?.dataset.contentInstance === scanId && existing.querySelector("button")?.disabled) return { shown: true, protocol: CONTENT_PROTOCOL };
    const panel = existing || document.createElement("aside");
    panel.id = "resume-autofill-page-action";
    panel.dataset.resumeAutofillUi = "true";
    panel.dataset.contentProtocol = String(CONTENT_PROTOCOL);
    panel.dataset.contentBuild = "100-virtual-city-committed-input";
    panel.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;width:min(380px,calc(100vw - 32px));max-height:calc(100vh - 32px);box-sizing:border-box;overflow:hidden;display:flex;flex-direction:column;gap:8px;padding:12px;background:white;color:#173e30;border:1px solid #b5d8c7;border-radius:10px;font:14px system-ui;box-shadow:0 4px 18px #0002";
    if (!result && existing?.dataset.contentInstance === scanId && existing.querySelector("details[data-section=diagnostics]") && existing.querySelector("details[data-section=review]")) return { shown: true, protocol: CONTENT_PROTOCOL };
    panel.dataset.contentInstance = scanId;
    const oldButton = panel.querySelector("button");
    const button = oldButton ? oldButton.cloneNode(true) : document.createElement("button");
    oldButton?.replaceWith(button);
    button.type = "button";
    button.disabled = false;
    button.textContent = "简历助手：填充当前页面";
    button.style.cssText = "display:block;width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid #b5d8c7;border-radius:7px;background:#f5fff8;color:#173e30;font:inherit;text-align:left;cursor:pointer";
    const status = panel.querySelector('[role="status"]') || document.createElement("p");
    status.setAttribute("role", "status");
    status.style.cssText = "margin:0;max-height:48px;overflow:auto;color:#526b5d;font-size:12px;line-height:1.45";
    const detailStyle = "flex:0 1 auto;max-height:calc((100vh - 180px) / 2);min-height:0;overflow:auto;overscroll-behavior:contain;margin:0;border-top:1px solid #e1eee6;padding-top:4px";
    const summaryStyle = "position:sticky;top:0;z-index:1;padding:4px 0;background:white;color:#173e30;font-weight:600;cursor:pointer";
    const details = panel.querySelector("details[data-section=diagnostics]") || panel.querySelector("details") || document.createElement("details");
    const legacyReview = details.querySelector("[data-review]");
    const reviewDetails = panel.querySelector("details[data-section=review]") || document.createElement("details");
    details.dataset.section = "diagnostics";
    reviewDetails.dataset.section = "review";
    details.style.cssText = `${detailStyle};display:block`;
    reviewDetails.style.cssText = `${detailStyle};display:block`;
    const summary = details.querySelector("summary") || document.createElement("summary");
    summary.textContent = "填充诊断";
    summary.style.cssText = summaryStyle;
    const reviewSummary = reviewDetails.querySelector("summary") || document.createElement("summary");
    reviewSummary.textContent = "截图核对";
    reviewSummary.style.cssText = summaryStyle;
    const report = details.querySelector("pre") || document.createElement("pre");
    report.style.cssText = "margin:8px 0;white-space:pre-wrap;font-size:12px;line-height:1.45";
    details.append(summary, report);
    if (result) {
      status.textContent = result.status || "";
      report.textContent = JSON.stringify(result.diagnostics || {}, null, 2);
    }
    const review = reviewDetails.querySelector('[data-review]') || legacyReview || document.createElement("div");
    review.dataset.review = "true";
    review.style.cssText = "display:block;min-height:20px;max-height:220px;overflow:auto;margin:0;padding:0 0 2px;color:#173e30;font:12px/1.45 system-ui";
    const reviewable = (result?.diagnostics?.remainingFields || []).filter(field => field.key && field.label);
    if (result) review.replaceChildren();
    if (result && !reviewable.length) review.textContent = "当前没有未填写的字段。";
    if (!result && !review.childNodes.length) review.textContent = "填充后将在这里显示仍未填写的字段。";
    reviewDetails.hidden = false;
    if (result && reviewable.length) reviewDetails.open = true;
    legacyReview?.remove();
    const reviewed = new Set();
    for (const field of reviewable) {
      if (reviewed.has(field.key)) continue;
      reviewed.add(field.key);
      const inspect = document.createElement("button");
      inspect.type = "button";
      const caption = `截图核对：${field.label || "未确认字段"}（仅本地）`;
      inspect.textContent = caption;
      inspect.style.cssText = "display:block;width:100%;box-sizing:border-box;margin:6px 0;padding:6px 8px;border:1px solid #b5d8c7;border-radius:6px;background:#f8fbf9;color:#173e30;font:12px system-ui;text-align:left;cursor:pointer";
      inspect.addEventListener("click", async (event) => {
        if (!event.isTrusted || inspect.disabled) return;
        inspect.disabled = true;
        try {
          const response = await runtime.sendMessage({ type: "RESUME_AUTOFILL_REVIEW_FIELD", key: field.fieldKey || field.key,
            locator: { label: field.label, module: field.module || "", row: field.row }, frameId: field.frameId ?? result?.diagnostics?.frameId ?? 0 });
          if (response?.image) {
            const preview = document.createElement("img");
            preview.src = response.image;
            preview.alt = "当前页面本地截图，不会发送给模型";
            preview.style.cssText = "display:block;max-width:100%;max-height:240px;object-fit:contain";
            const host = document.createElement("div");
            host.dataset.localPreview = "true";
            host.style.cssText = "display:block;max-height:240px;overflow:auto;margin-top:8px;border:1px solid #dbe7df;border-radius:6px;background:#f8fbf9";
            host.attachShadow({ mode: "closed" }).append(preview);
            review.querySelector("[data-local-preview]")?.remove();
            review.append(host);
            inspect.textContent = caption;
          } else inspect.textContent = response?.located ? `${field.label}：请切回该网页再截图` : `${field.label}字段已变化，请重新填充或人工核对`;
        } catch { inspect.textContent = `${field.label}截图不可用，请人工核对`; }
        finally { inspect.disabled = false; }
      });
      review.append(inspect);
    }
    reviewDetails.append(reviewSummary, review);
    // Keep the review disclosure before the long diagnostic report so its title remains reachable.
    panel.append(button, status, reviewDetails, details);
    button.addEventListener("click", async (event) => {
      if (!event.isTrusted || button.disabled) return;
      button.disabled = true;
      status.textContent = "正在填充，请保持简历助手侧栏打开…";
      report.textContent = "";
      try {
        const result = await runtime.sendMessage({ type: "RESUME_AUTOFILL_PAGE_FILL_V100" });
        status.textContent = result?.status || "请打开简历助手侧栏后重试。";
        if (result?.diagnostics) showPageAction(result);
      } catch { status.textContent = "请打开简历助手侧栏后重试。"; }
      finally { button.disabled = false; }
    });
    document.documentElement.append(panel);
    return { shown: true, protocol: CONTENT_PROTOCOL };
  }
  const contentListener = (message, _sender, sendResponse) => {
    const tasks = {
      GET_FORM_SCHEMA: async () => ({ fields: formSchema(), modules: moduleTitles() }),
      GET_LIVE_OPTIONS: async () => ({ fields: await liveOptions(message.keys, !!message.keepOpen, message.previousOptions) }),
      ENSURE_ROWS: () => ensureRows(message.counts),
      PREPARE_PROFILE: () => prepareProfile(message.profile, message.corrections),
      FILL_PROFILE: () => fill(message.profile, message.options),
      APPLY_ASSIGNMENTS: () => applyAssignments(message.assignments),
      LOCATE_FIELD: () => locateField(message.key, message.locator),
      SHOW_PAGE_ACTION: () => showPageAction(message.result)
    };
    const type = String(message?.type || "");
    const suffix = `_V${CONTENT_PROTOCOL}`;
    if (!type.endsWith(suffix)) return false;
    const task = tasks[type.slice(0, -suffix.length)];
    if (!task) return false;
    Promise.resolve().then(task)
      .then((result) => {
        if (type === `FILL_PROFILE${suffix}`) {
          const details = document.querySelector("#resume-autofill-page-action details[data-section=diagnostics]") || document.querySelector("#resume-autofill-page-action details");
          let report = details?.querySelector("pre[data-structured]");
          if (details && !report) {
            report = document.createElement("pre"); report.dataset.structured = "true";
            report.style.cssText = "margin:8px 0;white-space:pre-wrap;font-size:12px;line-height:1.45";
            details.append(report);
          }
          if (report) report.textContent = JSON.stringify({ phase: "structured", confirmed: result.filled, protected: result.skippedFields?.length || 0,
            expectedEmpty: result.diagnostics?.expectedEmpty, confirmedEmpty: result.diagnostics?.confirmedEmpty,
            targets: result.diagnostics?.emptyTargets,
            emptyFields: formSchema().filter((field) => !field.currentValue).map(({ label, module, repeatIndex, type }) => ({ label, module, row: repeatIndex + 1, type })),
            diagnostics: (result.diagnostics?.structuredAttempts || []).map((item) => ({ label: item.label, section: item.section, row: item.row,
              reason: item.reason, datePartCount: item.datePartCount, dateControlCount: item.dateControlCount, interaction: item.choice?.failure,
              path: item.choice?.path, calendarFound: item.choice?.datePicker?.panelFound,
              calendarMode: item.choice?.datePicker?.mode, dayFound: item.choice?.datePicker?.dayFound,
              calendarPopupCount: item.choice?.datePicker?.popupCount, calendarReopened: item.choice?.datePicker?.reopenedYearList,
              dateMatch: item.dateMatch, matchesSource: item.matchesSource })) }, null, 2);
        }
        sendResponse(result);
      })
      .catch((error) => sendResponse({ error: error?.message || "页面填充失败" }));
    return true;
  };
  if (runtime?.onMessage?.addListener) {
    globalThis.__resumeAutofillContentListener = contentListener;
    runtime.onMessage.addListener(contentListener);
  }
  if (globalThis.__RESUME_AUTOFILL_TEST__) globalThis.__resumeAutofillTest = { formSchema, liveOptions, ensureRows, fill, prepareProfile, applyAssignments, rowField, isChoiceControl, showPageAction, matchReviewField, verifyTargets };
})();
