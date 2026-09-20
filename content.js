(() => {
  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const visible = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  const editable = (el) => {
    const choice = el.type === "radio" || el.type === "checkbox" || el.getAttribute("role") === "radio" || el.getAttribute("role") === "checkbox";
    const customPicker = el.getAttribute("role") === "combobox" || el.hasAttribute("aria-haspopup") || /select|cascader|calendar|date|area/i.test(String(el.className || ""));
    const linkedLabel = el.id && [...document.querySelectorAll(`label[for="${CSS.escape(el.id)}"]`)].some(visible) || !!el.closest("label");
    const readonlySemantic = el.readOnly && /籍贯|居住|户籍|地区|日期|时间|省|市/.test(String(el.getAttribute("aria-label") || el.placeholder || el.name || el.id || el.parentElement?.innerText || ""));
    const blockedType = ["hidden", "file", "submit", "reset", "image"].includes(el.type) || el.type === "button" && !customPicker;
    return (visible(el) || (choice && linkedLabel)) && !el.disabled && el.getAttribute("aria-disabled") !== "true" && (!el.readOnly || customPicker || readonlySemantic) && !blockedType;
  };
  const fields = () => [...document.querySelectorAll("input, textarea, select, [role=combobox], [role=radio], [role=checkbox], [contenteditable='true'], [aria-haspopup]")]
    .filter(editable)
    .filter((el, index, all) => all.indexOf(el) === index);
  const normalize = (value) => clean(value).toLowerCase().replace(/[：:（）()\[\]【】／\/\s_-]/g, "");
  const salaryRange = (value) => {
    const text = clean(value).toLowerCase();
    if (!text || /面议|保密/.test(text)) return null;
    const amounts = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(万|w|k|千)?/g)].map(([, number, unit]) => Number(number) * (/万|w/.test(unit) ? 10000 : /k|千/.test(unit) ? 1000 : 1));
    if (!amounts.length || amounts.some((amount) => !Number.isFinite(amount))) return null;
    if (amounts.length === 1) {
      if (/以下|以内|不超过|及以下/.test(text)) return [0, amounts[0]];
      if (/以上|起|及以上/.test(text)) return [amounts[0], Infinity];
      return [amounts[0], amounts[0]];
    }
    return [Math.min(...amounts), Math.max(...amounts)];
  };
  const salaryOption = (value, candidates) => {
    const wanted = salaryRange(value);
    if (!wanted || wanted[0] !== wanted[1]) return null;
    const matches = candidates.filter((candidate) => {
      const range = salaryRange(candidate.textContent || candidate);
      return range && range[0] <= wanted[0] && wanted[0] <= range[1];
    });
    return matches.length === 1 ? matches[0] : null;
  };
  const proficiencyLevel = (value) => {
    const text = normalize(value);
    if (/精通|专家|高级/.test(text)) return 4;
    if (/熟练|熟悉|掌握/.test(text)) return 3;
    if (/一般|中等|中级/.test(text)) return 2;
    if (/了解|入门|初级/.test(text)) return 1;
    return 0;
  };
  const proficiencyOption = (value, candidates, label) => {
    if (!/掌握程度|熟练程度|技能等级|语言水平|听说|读写/.test(label)) return null;
    const level = proficiencyLevel(value);
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

  const fieldLabelSelector = ".form-item__title, .form-item__label, .formItem__label, .form-label, .field-label, legend, [class*='form-item-label'], [class*='form-item__label'], [class*='formItemLabel'], [class*='formItem__label'], [class^='title-'], [class*=' title-']";
  const fieldContainer = (el) => {
    const explicit = el?.closest(".form-item, .form-group, .field, fieldset, [data-field]");
    if (explicit) return explicit;
    for (let node = el?.parentElement, depth = 0; node && depth < 8; node = node.parentElement, depth++) {
      if (node.matches?.("[class*='form-item'], [class*='formItem'], [class*='field-item'], [class*='fieldItem'], [class*='apply-field'], [class*='control-group']") && node.querySelector(fieldLabelSelector)) return node;
    }
    return el?.parentElement;
  };
  const associatedLabels = (el) => {
    const ids = clean(el?.getAttribute?.("aria-labelledby")).split(" ").filter(Boolean);
    const nodes = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (el?.id) nodes.push(...document.querySelectorAll(`label[for="${CSS.escape(el.id)}"]`));
    const wrapped = el?.closest?.("label");
    if (wrapped) nodes.push(wrapped);
    return [...new Set(nodes)].map((node) => clean(node.innerText || node.textContent)).filter(Boolean);
  };
  const fieldTitle = (el) => {
    const box = fieldContainer(el);
    const label = box?.querySelector(fieldLabelSelector) || box?.querySelector("label");
    const groupedChoice = ["radio", "checkbox"].includes(el?.type) || ["radio", "checkbox"].includes(el?.getAttribute?.("role"));
    if (groupedChoice && box?.querySelectorAll("input[type=radio], input[type=checkbox], [role=radio], [role=checkbox]").length > 1 && label) return clean(label.innerText || label.textContent || "");
    const associated = associatedLabels(el).find((text) => text.length <= 100);
    if (associated) return associated;
    return clean(label?.innerText || label?.textContent || "");
  };
  const controlSelector = "input, textarea, select, [role=combobox], [role=radio], [role=checkbox], [contenteditable='true'], [aria-haspopup]";
  const semanticText = (el) => clean([fieldTitle(el), el.getAttribute("aria-label"), el.getAttribute("placeholder"), el.name, el.id, el.getAttribute("data-label"), el.getAttribute("title"), el.parentElement?.querySelector("label")?.innerText].filter(Boolean).join(" "));
  const anchorMatch = (el, anchor) => {
    const wanted = [anchor, ...(typeof FIELD_ALIASES !== "undefined" ? (FIELD_ALIASES[anchor] || []) : [])].map(normalize);
    const text = normalize(`${semanticText(el)} ${labelText(el)}`);
    return wanted.some((value) => value && text.includes(value));
  };
  const sectionScope = (el) => el?.closest("[data-nav-id]")
    || el?.closest("[role=region], section, article, fieldset, [class*='apply-block-'], [class*='section'], [class*='module'], [class*='resume-block'], [class*='block']");
  const sectionTitle = (el) => {
    const scope = sectionScope(el);
    const heading = [...(scope?.querySelectorAll(".blockTitle, .section-title, .form-title, h1, h2, h3, h4, h5, h6, legend, [role=heading], [class*='blockTitle'], [class*='section-title']") || [])]
      .filter((node) => !node.contains(el)).map((node) => clean(node.innerText || node.textContent)).find((text) => text && text.length <= 80);
    if (heading) return heading;
    // Fallback for component libraries that render headings as plain div text.
    for (let node = el?.parentElement, depth = 0; node && depth < 8; node = node.parentElement, depth++) {
      const candidate = [...(node.children || [])].map((child) => clean(child.innerText || child.textContent))
        .find((text) => text && text.length <= 40 && /个人信息|求职意向|教育|工作|实习|项目|语言|证书|获奖|自我描述/.test(text));
      if (candidate) return candidate;
    }
    const previous = [...document.querySelectorAll("h1, h2, h3, h4, h5, h6, legend, [role=heading], .blockTitle, .section-title, .form-title, [class*='blockTitle'], [class*='section-title']")]
      .filter((node) => clean(node.innerText || node.textContent).length <= 80)
      .filter((node) => node.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING).at(-1);
    return clean(previous?.innerText || previous?.textContent || "");
  };
  const SECTION_ALIASES = {
    "教育背景": ["教育经历", "教育背景", "学历经历"],
    "教育经历": ["教育背景", "教育经历", "学历经历"],
    "工作经历": ["工作经验", "工作经历", "任职经历"],
    "实习经历": ["实习经验", "实习经历"],
    "项目经验": ["项目经历", "项目经验", "项目经验"],
    "项目经历": ["项目经验", "项目经历"],
    "技能": ["技能", "专业技能", "技能特长"],
    "证书": ["证书", "资格证书", "证书信息"],
    "获奖经历": ["获奖情况", "获奖经历", "竞赛获奖"],
    "语言能力": ["语言技能", "语言能力", "外语能力", "语言证书"],
    "学生干部经历": ["学生干部经历", "干部经历", "校园经历", "社团经历"]
  };
  // Unknown section markup must not make an otherwise valid field invisible.
  // A semantic section hint is a preference, not a selector contract.
  const inSection = (el, section) => {
    if (!section) return true;
    const title = normalize(sectionTitle(el));
    if (!title) return true;
    return [section, ...(SECTION_ALIASES[section] || [])].map(normalize).some((value) => title.includes(value));
  };
  const repeatedContainer = (el, anchor, section = "") => {
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
        [...sibling.querySelectorAll(controlSelector)].some((control) => editable(control) && anchorMatch(control, anchor)));
      if (siblings.length > 1) return node;
    }
    return el.closest("[class*='fields'], [class*='form'], .form-item, .form-group, .field, fieldset") || el;
  };
  const rowContainers = (anchor, section = "") => {
    const matches = fields().filter((el) => anchorMatch(el, anchor));
    // Some sites put a generic heading around every form module. If that
    // heading is misread, keep the anchor's rows available instead of treating
    // the whole repeated group as absent.
    const scoped = matches.filter((el) => inSection(el, section));
    const rows = (scoped.length ? scoped : matches).map((el) => repeatedContainer(el, anchor, section));
    const uniqueRows = [...new Set(rows)];
    // A few component libraries expose both the repeated item and its common
    // parent as candidates. Keep only leaf rows so later fields cannot fall
    // back to the first item and overwrite a different record.
    const leafRows = uniqueRows.filter((row) => !uniqueRows.some((other) => other !== row && row.contains(other)));
    return leafRows.length ? leafRows : uniqueRows;
  };
  const rowField = (anchor, rowIndex, label, section = "", value = "") => {
    const candidate = rowContainers(anchor, section)[rowIndex];
    const row = candidate && [...candidate.querySelectorAll(controlSelector)].filter((el) => anchorMatch(el, anchor)).length === 1 ? candidate : null;
    if (row && /结束时间|毕业时间|教育结束|工作结束|项目结束/.test(label) && /^(?:至今|现在|在职)$/i.test(String(value).trim())) {
      const current = [...row.querySelectorAll("input[type=checkbox], [role=checkbox]")].find((el) => {
        const text = normalize(labelText(el) || el.parentElement?.textContent);
        return text.includes("至今") || text.includes("现在") || text.includes("在职");
      });
      if (current) return current;
    }
    if (row && /开始时间|结束时间|入学时间|毕业时间|教育开始|教育结束|工作开始|工作结束|项目开始|项目结束|获奖时间|获得时间/.test(label)) {
      const dateTarget = [...row.querySelectorAll("input, [role=combobox]")].find((el) => dateControls(el).length >= 2);
      const dates = dateTarget ? dateControls(dateTarget) : [];
      if (dates.length >= 2) return /结束时间|毕业时间|教育结束|工作结束|项目结束/.test(label) ? dates[2] || dates[dates.length - 1] : dates[0];
    }
    const item = [...(row?.querySelectorAll(".form-item, .form-group, .field") || [])].find((el) => normalize(el.querySelector(`${fieldLabelSelector}, label`)?.innerText).includes(normalize(label)));
    const direct = row ? [...row.querySelectorAll(controlSelector)].filter(editable)
      .filter((el) => anchorMatch(el, label))
      .sort((a, b) => Number(fieldTitle(b) === label) - Number(fieldTitle(a) === label))[0] : null;
    const scoped = findField(label, rowIndex, section);
    // Unique profile/education labels remain safe to resolve without a
    // section when a component library hides the section heading from the DOM.
    const uniqueFallback = /学校|院校|专业|学历|性别|出生日期|所在地|最近公司|奖项名称|获奖项/.test(label)
      ? findField(label, rowIndex) : null;
    return item?.querySelector(controlSelector) || direct || scoped || uniqueFallback;
  };
  const labelText = (el) => {
    const parts = [fieldTitle(el), ...associatedLabels(el)];
    let node = el.closest("label") || el.parentElement;
    for (let depth = 0; node && depth < 5; depth++, node = node.parentElement) {
      const controls = [...node.querySelectorAll(controlSelector)].filter(editable);
      if (depth > 0 && controls.length > 1) break;
      const value = clean(node.innerText || node.textContent);
      if (value && value.length <= 80) parts.push(value);
    }
    if (el.previousElementSibling) parts.push(el.previousElementSibling.innerText || el.previousElementSibling.textContent);
    return clean(parts.join(" "));
  };

  const moduleTitle = (el) => {
    const section = sectionTitle(el);
    if (section) return section;
    let node = el;
    for (let depth = 0; node && depth < 16; depth++, node = node.parentElement) {
      const heading = node.querySelector?.("h1, h2, h3, h4, h5, h6, legend, [role=heading], .section-title, .form-title, .title");
      const text = clean(heading?.innerText || heading?.textContent);
      if (text && text.length <= 100 && !heading.contains?.(el)) return text;
    }
    return "";
  };
  const repeatIndex = (el, anchor) => {
    const row = repeatedContainer(el, anchor || semanticText(el));
    const rows = row.parentElement ? [...row.parentElement.children].filter((sibling) => [...sibling.querySelectorAll(controlSelector)].some((control) => editable(control) && anchorMatch(control, anchor || semanticText(el)))) : [];
    return Math.max(0, rows.indexOf(row));
  };
  const controlType = (el) => el.matches("[role=combobox], [aria-haspopup=listbox]") ? "combobox"
    : el.matches("[role=radio]") || el.type === "radio" ? "radio"
      : el.matches("[role=checkbox]") || el.type === "checkbox" ? "checkbox"
        : el.isContentEditable ? "contenteditable" : el.tagName === "SELECT" ? "select" : String(el.type || el.tagName).toLowerCase();
  const choiceRoot = (el) => {
    for (let node = el; node && node !== document.body; node = node.parentElement) {
      if (node !== el && node.querySelectorAll(controlSelector).length > 1) break;
      if (node.getAttribute?.("role") === "combobox" || node.hasAttribute?.("aria-haspopup")
        || /(^|[\s_-])(select|dropdown|cascader|picker|autocomplete)([\s_-]|$)/i.test(String(node.className || ""))) return node;
    }
    return null;
  };
  const isChoiceControl = (el) => !!el && (el.tagName === "SELECT" || ["radio", "checkbox"].includes(el.type)
    || ["combobox", "radio", "checkbox"].includes(el.getAttribute("role")) || el.hasAttribute("aria-haspopup") || !!choiceRoot(el));
  const controlValue = (el) => {
    if (el.type === "checkbox" || el.type === "radio" || el.getAttribute("role") === "checkbox" || el.getAttribute("role") === "radio") return el.checked || el.getAttribute("aria-checked") === "true" ? (el.value || "true") : "";
    if (el.tagName !== "SELECT" && isChoiceControl(el)) {
      const root = choiceRoot(el);
      const displays = [...(root?.querySelectorAll("[aria-valuetext], [class]") || [])].filter((node) =>
        node !== el && clean(node.textContent));
      const display = displays.find((node) => /display-value|selection-item|single-?value|select[-_]?(?:value|tag)|multi-?value|selected/i.test(String(node.className || "")))
        || displays.find((node) => /calc(?:ele)?/i.test(String(node.className || "")) && !/^请选择/.test(clean(node.textContent)));
      return clean(el.getAttribute("aria-valuetext") || el.value || display?.textContent || "");
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
  const stableKey = (el, index) => {
    const explicit = el.getAttribute("data-field-key") || el.getAttribute("data-testid");
    if (explicit && fields().filter((candidate) => (candidate.getAttribute("data-field-key") || candidate.getAttribute("data-testid")) === explicit).length === 1) return explicit;
    const label = normalize(fieldTitle(el) || el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.name || el.id || labelText(el) || `field${index}`);
    const module = normalize(moduleTitle(el));
    const row = repeatIndex(el, label);
    const identity = el.name || el.id || controlType(el);
    const base = [module || "page", label, identity, row].filter(Boolean).join("::");
    const ordinal = fields().slice(0, index).filter((candidate, candidateIndex) => {
      const candidateLabel = normalize(fieldTitle(candidate) || candidate.getAttribute("aria-label") || candidate.getAttribute("placeholder") || candidate.name || candidate.id || labelText(candidate) || `field${candidateIndex}`);
      return [normalize(moduleTitle(candidate)) || "page", candidateLabel, candidate.name || candidate.id || controlType(candidate), repeatIndex(candidate, candidateLabel)].filter(Boolean).join("::") === base;
    }).length;
    return `${base}::${ordinal}`;
  };
  // ponytail: one DOM-label heuristic covers Vue/React forms; add site selectors only when a real page needs them.
  const FIELD_ALIASES = {
    "姓名": ["姓名", "名字", "真实姓名", "中文姓名"],
    "手机号码": ["手机", "手机号", "手机号码", "联系电话", "电话号码"],
    "邮箱": ["邮箱", "电子邮箱", "邮件地址", "email", "e-mail"],
    "出生日期": ["出生日期", "出生年月", "生日", "birthday"],
    "民族": ["民族"],
    "政治面貌": ["政治面貌", "政治身份"],
    "微信号": ["微信", "微信号", "wechat"],
    "证件类型": ["证件类型", "证件种类"],
    "证件号码": ["证件号码", "证件号", "身份证号", "身份证号码"],
    "学校名称": ["学校", "院校", "毕业院校", "就读学校", "学校名称"],
    "学院名称": ["学院", "院系", "所属学院", "学院名称"],
    "专业名称": ["专业", "所学专业", "就读专业", "主修专业", "专业名称"],
    "最高学历": ["学历", "教育程度", "最高学历", "学位"],
    "性别": ["gender", "男女", "性别"],
    "工作经验": ["工作年限", "工作经验", "经验"],
    "最近公司": ["最近任职公司", "最近工作单位", "最近公司"],
    "所在地": ["所在地区", "当前所在地", "居住地", "所在地"],
    "期望城市": ["意向城市", "工作城市", "期望工作城市", "期望城市"],
    "期望从事行业": ["期望从事行业", "期望行业", "意向行业", "目标行业"],
    "期望从事职业": ["期望从事职业", "期望职业", "期望职位", "意向职位", "目标职位", "意向岗位"],
    "期望月薪(税前)": ["期望月薪（税前）", "期望月薪(税前)", "期望薪资（税前）", "期望薪资(税前)", "期望月薪", "期望薪资", "期望待遇"],
    "期望工作城市": ["期望工作城市", "期望城市", "意向城市", "工作意向城市", "期望工作地点", "期望地点"],
    "现月薪(税前)": ["现月薪（税前）", "现月薪(税前)", "当前月薪（税前）", "当前月薪(税前)", "目前月薪（税前）", "目前月薪(税前)", "现月薪", "当前薪资", "目前薪资"],
    "当前薪资": ["现月薪", "当前薪资", "目前薪资"],
    "期望薪资": ["期望月薪", "期望薪资", "期望待遇"],
    "项目描述": ["项目简介", "项目内容", "项目说明", "项目描述"],
    "项目经验": ["项目经历", "项目经验"],
    "实习经历": ["实习经验", "实习经历"],
    "证书": ["证书", "资格证书", "证书信息"],
    "语言类型": ["语言", "语言类型", "语种"],
    "掌握程度": ["掌握程度", "熟练程度", "语言水平", "技能等级"],
    "听说": ["听说", "听力口语", "听力", "口语"],
    "读写": ["读写", "阅读写作", "阅读", "写作"],
    "获奖时间": ["获奖日期", "获得时间", "奖项时间", "获奖时间"],
    "奖项名称": ["获奖项", "奖励名称", "奖项", "奖项名称"],
    "获奖级别": ["奖项级别", "奖励级别", "获奖等级", "获奖级别"],
    "籍贯": ["籍贯"],
    "户口所在地": ["户籍所在地", "户籍地", "户口所在地", "户籍地址"],
    "培养方式": ["学习方式", "就读方式", "受教育类型"],
    "工作描述": ["工作职责", "工作内容", "工作说明"],
    "工作职责": ["工作描述", "工作内容", "工作说明"],
    "工作亮点": ["工作成果", "业绩亮点", "工作成就"],
    "获奖情况": ["奖励活动", "获奖经历", "奖项"],
    "现居住地": ["当前居住地", "当前所在地", "现居地", "居住地", "所在地"],
    "学历": ["学位", "最高学历"],
    "公司名称": ["企业名称", "单位名称", "公司/单位"],
    "职位名称": ["职位", "职务", "岗位", "工作岗位", "任职职位", "任职岗位"],
    "所在部门": ["部门", "所属部门"],
    "开始时间": ["开始时间", "开始日期", "起始时间", "入学时间", "就读时间", "教育开始时间", "教育开始日期"],
    "结束时间": ["结束时间", "结束日期", "终止时间", "毕业时间", "毕业日期", "毕业年月", "教育结束时间", "教育结束日期", "教育结束", "工作结束时间", "项目结束时间"],
    "毕业时间": ["毕业时间", "毕业日期", "毕业年月", "教育结束时间", "教育结束日期", "教育结束", "结业时间"],
    "月薪(税前)": ["月薪（税前）", "月薪(税前)", "月薪税前", "税前月薪", "月工资（税前）", "月工资(税前)", "税前工资", "税前薪资", "薪资"],
    "工作地点": ["工作地点", "工作城市", "办公地点", "工作地区", "办公城市", "任职地点"],
    "离职原因": ["离职原因", "离职缘由"],
    "项目名称": ["项目名称", "项目标题"],
    "项目职责": ["职责", "项目中职责", "项目职务", "职务", "个人工作", "项目角色", "角色"],
    "获奖项": ["奖励活动", "奖项名称", "奖项"],
    "获奖描述": ["奖励描述", "荣誉描述"],
    "证书名称": ["证书", "资格证书"],
    "获得时间": ["获奖时间", "取得时间", "日期"],
    "职务": ["职务", "干部职务", "担任职务"],
    "级别": ["级别", "组织级别", "活动级别"],
    "分数": ["分数", "成绩", "证书成绩"],
    "技能名称": ["技能名称", "专业技能", "技能特长"],
    "使用时间总计": ["使用时间总计", "使用时间", "使用时长", "熟练年限"],
    "技能描述": ["技能描述", "技能说明", "技能详情"]
  };
  function findField(label, occurrence = 0, section = "") {
    const wanted = [label, ...(FIELD_ALIASES[label] || [])].map(normalize);
    const scoreFields = (pool) => pool.map((el) => {
      const attrs = normalize([el.getAttribute("aria-label"), el.getAttribute("placeholder"), el.name, el.id, semanticText(el), labelText(el)].join(" "));
      let score = wanted.some((value) => attrs.includes(value)) ? 100 : 0;
      if (wanted.includes(normalize(fieldTitle(el)))) score += 250;
      if (wanted.some((value) => attrs.includes(value.replace(/名称|号码|税前/g, "")))) score += 20;
      if ((label === "现居住地" || label === "所在地") && /户口|户籍|籍贯/.test(attrs)) score = 0;
      if (label === "籍贯" && /户口|户籍/.test(attrs)) score = 0;
      if (/^期望/.test(label) && /^(?:现|当前|目前)/.test(clean(fieldTitle(el)))) score = 0;
      if (el.type === "date" && /日期|时间/.test(label)) score += 5;
      if (/手机|电话/.test(label) && el.tagName !== "SELECT") score += 15;
      if (/邮箱|email/i.test(label) && el.type === "email") score += 15;
      return { el, score };
    }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score || fields().indexOf(a.el) - fields().indexOf(b.el));
    const scoped = scoreFields(fields().filter((el) => inSection(el, section)));
    const candidates = scoped.length || !section ? scoped : scoreFields(fields());
    return candidates[occurrence]?.el;
  }
  const fieldMatches = (label) => {
    const wanted = [label, ...(FIELD_ALIASES[label] || [])].map(normalize);
    return fields().filter((el) => wanted.some((value) => normalize(semanticText(el) + " " + labelText(el)).includes(value)));
  };

  function setValue(el, value) {
    if (!el || value == null || value === "") return false;
    if (el.readOnly && (el.getAttribute("role") === "combobox" || el.hasAttribute("aria-haspopup") || /select|cascader|calendar|date|area/i.test(String(el.className || "")) || /籍贯|居住|户籍|地区|日期|时间|省|市/.test(String(el.getAttribute("aria-label") || el.placeholder || el.name || el.id || el.parentElement?.innerText || "")))) return false;
    if (el.type === "checkbox" || el.type === "radio" || el.getAttribute("role") === "checkbox" || el.getAttribute("role") === "radio") {
      const wanted = normalize(value);
      const label = normalize(labelText(el) || el.value || el.parentElement?.textContent);
      const shouldCheck = ["true", "1", "yes", "是", "有", "已婚", "男", "女", "至今", "现在", "在职"].includes(wanted) || wanted === label || label.includes(wanted) || wanted.includes(label);
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
    if (!["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.getAttribute("role") === "combobox") return false;
    if (el.tagName === "SELECT") {
      const options = [...el.options];
      const exact = options.find((item) => normalize(item.textContent) === normalize(value) || item.value === value);
      const semantic = options.filter((item) => normalize(item.textContent).includes(normalize(value)) || normalize(value).includes(normalize(item.textContent)));
      const option = exact || (/薪|工资|待遇/.test(labelText(el)) && salaryOption(value, options))
        || proficiencyOption(value, options, labelText(el)) || (semantic.length === 1 ? semantic[0] : null);
      if (!option) return false;
      el.value = option.value;
    } else {
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
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
    return true;
  }

  const dateParts = (value) => {
    const text = String(value || "").trim();
    const match = text.match(/(\d{4})\s*(?:年|[./-])\s*(\d{1,2})(?:\s*(?:月|[./-])\s*(\d{1,2}))?/);
    return match?.slice(1).map((part, index) => index && part ? pad2(part) : part || "") || [];
  };
  const dateForms = (value) => {
    const [year, month, day] = dateParts(value);
    if (!year) return [String(value || "")];
    return [...new Set([String(value), `${year}-${month}${day ? `-${day}` : ""}`, `${year}-${Number(month)}${day ? `-${Number(day)}` : ""}`, `${year}年${month}月${day ? `${day}日` : ""}`, `${year}年${Number(month)}月${day ? `${Number(day)}日` : ""}`, `${year}/${month}${day ? `/${day}` : ""}`, `${year}/${Number(month)}${day ? `/${Number(day)}` : ""}`])];
  };
  console.assert(dateForms("2025.08").includes("2025-8"));
  const looksLikeDate = (value) => /\d{4}\s*(?:年|[./-])\s*\d{1,2}(?:\s*(?:月|[./-])\s*\d{1,2})?/.test(String(value || ""));
  const isDescription = (label) => /描述|职责|评价|亮点/.test(normalize(label));
  const popupSelector = "[role=listbox], [role=menu], [role=dialog], [role=grid], [class*='dropdown'], [class*='Dropdown'], [class*='popover'], [class*='Popover'], [class*='picker'], [class*='Picker'], [class*='calendar'], [class*='Calendar'], [class*='options'], [class*='Options'], [class*='unmodeled-layer'], [class*='selector-container']";
  const isPopup = (el) => {
    if (!visible(el)) return false;
    if (el.matches("[role=listbox], [role=menu], [role=dialog], [role=grid]")) return true;
    const style = getComputedStyle(el);
    return (style.position === "fixed" || style.position === "absolute") && !!el.querySelector("[role=option], li, [data-value], [class*='option'], [class*='Option'], [class*='item'], [class*='Item']");
  };
  const openDropdowns = () => {
    const known = [...document.querySelectorAll(popupSelector)].filter(isPopup);
    // ponytail: scan generic fixed/absolute portals only when semantic/class hooks miss; keep normal closes cheap.
    const candidates = known.length ? known : [...document.querySelectorAll("body *")].filter(isPopup);
    return candidates.filter((popup) => !candidates.some((other) => other !== popup && other.contains(popup)));
  };
  const popupFor = (control, includeGlobal = true) => {
    const linked = control?.getAttribute?.("aria-controls") ? document.getElementById(control.getAttribute("aria-controls")) : null;
    const popupVisible = (popup) => !!popup && !popup.hidden && (isPopup(popup) || popupOptionNodes(popup).length > 0);
    const local = [...(control?.parentElement?.querySelectorAll?.(popupSelector) || [])].filter(popupVisible);
    const related = [...new Set([linked, ...local].filter(popupVisible))];
    return includeGlobal ? [...new Set([...related, ...openDropdowns()])] : related;
  };
  const popupIsOpen = (control) => {
    if (openDropdowns().length || control?.getAttribute?.("aria-expanded") === "true") return true;
    const anchor = control?.getBoundingClientRect?.();
    return !!anchor && [...document.querySelectorAll("body *")].some((el) => {
      if (el === control || control?.contains?.(el) || !visible(el) || el.children.length < 2) return false;
      const style = getComputedStyle(el); const rect = el.getBoundingClientRect();
      return (style.position === "fixed" || style.position === "absolute") && rect.width > 100 && rect.height > 30 && rect.height < 700
        && Math.abs(rect.left - anchor.left) < 600 && Math.abs(rect.top - anchor.bottom) < 700;
    });
  };
  const dismissDropdowns = async (control, toggle = false) => {
    await wait(60);
    const event = new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true });
    [control, document.activeElement, document, window].filter(Boolean).forEach((node) => node.dispatchEvent?.(event));
    await wait(60);
    // Custom portals may not expose a stable class/role; always give their outside-click handlers a chance.
    ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((type) => document.body.dispatchEvent(new MouseEvent(type, { bubbles: true })));
    await wait(60);
    if (toggle && popupIsOpen(control) && control?.click) { control.click(); await wait(60); }
  };
  const closeVisibleDropdowns = async (control) => {
    await dismissDropdowns(control);
    for (let pass = 0; pass < 2; pass++) {
      const popups = openDropdowns();
      if (!popups.length) return;
      const controls = [...document.querySelectorAll("[role=combobox], input")].filter(visible);
      for (const popup of popups) {
        const popupRect = popup.getBoundingClientRect();
        const owner = controls.filter((candidate) => !popup.contains(candidate)).sort((a, b) => {
          const distance = (el) => { const rect = el.getBoundingClientRect(); return Math.abs(rect.left - popupRect.left) + Math.abs(rect.top - popupRect.top); };
          return distance(a) - distance(b);
        })[0];
        owner?.click();
      }
      await wait(80);
    }
    if (openDropdowns().length) {
      const event = new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true });
      [document.activeElement, document, window].filter(Boolean).forEach((node) => node.dispatchEvent?.(event));
    }
  };
  const closeDatePicker = (calendar, control) => closeVisibleDropdowns(control);
  const popupOptionNodes = (scope) => {
    const selector = "[role=option], li, [data-value], [class*='option'], [class*='Option'], [class*='item'], [class*='Item']";
    const text = (node) => clean(node.textContent || node.getAttribute("data-value") || node.getAttribute("value"));
    const action = (node) => node.matches?.("button, [role=button], [data-confirm], [data-confirm] *, [class*='button'], [class*='Button'], [class*='btn'], [class*='Btn']") || /^(?:确定|取消)$/.test(text(node));
    const semantic = [...(scope?.querySelectorAll(selector) || [])].filter((node) => !action(node));
    // Some component libraries use plain div/span rows. Keep their visible
    // leaf text, but not containers that merely repeat a child's label.
    const leaves = [...(scope?.querySelectorAll("*") || [])].filter((node) => {
      const value = text(node);
      return value && value.length <= 80 && !action(node) && ![...node.children].some((child) => visible(child) && text(child) === value);
    });
    const seen = new Set();
    return [...semantic, ...leaves].filter(visible).filter((node) => {
      const value = text(node);
      if (!value || /^请选择$|^暂无选项$/.test(value) || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  };
  const popupOptionDetails = async (popup) => {
    const texts = () => popupOptionNodes(popup)
      .map((node) => clean(node.textContent || node.getAttribute("data-value") || node.getAttribute("value")))
      .filter((text) => text && !/^请选择$|^暂无选项$/.test(text));
    if (!popup) return { texts: [], hasSearch: false, scrolled: false };
    const found = new Set(texts());
    const hasSearch = !![...popup.querySelectorAll("input:not([type=hidden]), textarea")].find((el) => visible(el) && !el.readOnly);
    let scrolled = false;
    const scroller = [...(popup?.querySelectorAll("*") || [])]
      .filter((el) => el.clientHeight >= 40 && el.scrollHeight > el.clientHeight + 2)
      .sort((a, b) => b.clientHeight - a.clientHeight)[0];
    if (scroller) {
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
  async function liveOptions(keys, keepOpen = false, previousOptions = {}) {
    const wanted = new Set(keys || []);
    const schema = formSchema();
    const controls = fields();
    for (const descriptor of schema) {
      if (wanted.size && !wanted.has(descriptor.key)) continue;
      const control = controls[descriptor.index];
      if (!control || controlValue(control) || !isChoiceControl(control)) continue;
      if (/radio|checkbox/.test(descriptor.type)) {
      descriptor.options = [...(fieldContainer(control)?.querySelectorAll("input[type=radio], input[type=checkbox], [role=radio], [role=checkbox]") || [])]
          .map((item) => clean(associatedLabels(item).at(-1) || item.value)).filter(Boolean).filter((text, index, all) => all.indexOf(text) === index);
        descriptor.optionSource = "radio";
        descriptor.optionCount = descriptor.options.length;
        continue;
      }
      if (/日期|时间|年月|date|month/i.test(`${descriptor.type} ${descriptor.label} ${descriptor.ariaLabel} ${descriptor.placeholder}`)) { descriptor.optionSource = "date-deferred"; continue; }
      const known = optionTexts(control);
      if (control.tagName === "SELECT") { descriptor.options = known; descriptor.optionSource = "native"; descriptor.optionCount = known.length; continue; }
      if (lastOpenedControl && lastOpenedControl !== control) await closeVisibleDropdowns(lastOpenedControl);
      const nearestPopup = () => {
        const rect = control.getBoundingClientRect();
        return popupFor(control, keepOpen && lastOpenedControl === control).sort((a, b) => {
          const distance = (el) => { const r = el.getBoundingClientRect(); return Math.abs(r.left - rect.left) + Math.abs(r.top - rect.top); };
          return distance(a) - distance(b);
        })[0];
      };
      if (!nearestPopup()) { control.click(); await wait(100); }
      lastOpenedControl = control;
      const popup = nearestPopup();
      const rect = control.getBoundingClientRect();
      const selectedPopup = popup || await waitFor(() => popupFor(control).sort((a, b) => {
        const distance = (el) => { const r = el.getBoundingClientRect(); return Math.abs(r.left - rect.left) + Math.abs(r.top - rect.top); };
        return distance(a) - distance(b);
      })[0]);
      let popupDetails = await popupOptionDetails(selectedPopup);
      if (keepOpen && selectedPopup) {
        const previous = new Set(previousOptions?.[descriptor.key] || []);
        const before = new Set(popupDetails.texts);
        // Cascaders often replace the province pane a tick after its click.
        // Keep this one popup open and wait only for genuinely new candidates.
        if (!previous.size || !popupDetails.texts.some((text) => !previous.has(text))) await waitFor(() => popupOptionNodes(selectedPopup).some((node) => {
          const text = clean(node.textContent || node.getAttribute("data-value") || node.getAttribute("value"));
          return text && !before.has(text);
        }), 1600);
        popupDetails = await popupOptionDetails(selectedPopup);
      }
      descriptor.options = [...new Set([...known, ...popupDetails.texts])].slice(0, 80);
      descriptor.optionSource = selectedPopup ? "popup" : "popup-not-found";
      descriptor.optionCount = descriptor.options.length;
      descriptor.hasSearch = popupDetails.hasSearch;
      descriptor.scrolled = popupDetails.scrolled;
      if (!keepOpen) { await closeVisibleDropdowns(control); lastOpenedControl = null; }
    }
    return schema;
  }
  const certificateExam = (name) => {
    const level = String(name || "").match(/CET\s*-?\s*(4|6)/i)?.[1];
    return level ? `CET${level}` : "";
  };
  const certificateScore = (row) => row?.score || String(row?.description || "").replace(/^成绩[：:]\s*/, "").trim();
  const awardLevel = (row) => {
    const level = String(row?.level || "").trim();
    if (!/^(一等奖|二等奖|三等奖|特等奖)$/.test(level)) return level;
    const name = String(row?.name || "");
    return /省/.test(name) ? "省区级" : /国家/.test(name) ? "国家级" : /院|校|学/.test(name) ? "院校级" : "";
  };
  const projectParts = (row) => {
    const text = String(row?.description || "").trim();
    const marker = text.search(/\s+(?=(?:负责|实现|构建|设计|开发|使用|参与|主导))/);
    return marker > 0 ? { summary: text.slice(0, marker).trim(), responsibilities: text.slice(marker).trim() } : { summary: text, responsibilities: "" };
  };
  const clickOption = (el) => {
    if (!el) return;
    const init = { bubbles: true, cancelable: true, view: window };
    if (window.PointerEvent) {
      el.dispatchEvent(new PointerEvent("pointerdown", { ...init, pointerId: 1, pointerType: "mouse", isPrimary: true }));
      el.dispatchEvent(new PointerEvent("pointerup", { ...init, pointerId: 1, pointerType: "mouse", isPrimary: true }));
    }
    el.dispatchEvent(new MouseEvent("mousedown", init));
    el.dispatchEvent(new MouseEvent("mouseup", init));
    el.click();
  };
  const confirmationButton = (scope) => {
    const nodes = [...(scope?.querySelectorAll("button, [role=button], [data-confirm], [class*='button'], [class*='Button'], [class*='btn'], [class*='Btn']") || [])];
    return nodes.find((el) => visible(el) && normalize(el.textContent) === "确定")
      || [...(scope?.querySelectorAll("*") || [])].find((el) => visible(el) && normalize(el.textContent) === "确定" && ![...el.children].some((child) => visible(child) && normalize(child.textContent) === "确定"));
  };
  const confirmationFor = (popup, control) => {
    const scopes = []; const seen = new Set();
    for (let node = popup; node && !seen.has(node); node = node.parentElement) { scopes.push(node); seen.add(node); if (node === document.body) break; }
    for (let node = control; node && !seen.has(node); node = node.parentElement) { scopes.push(node); seen.add(node); if (node === document.body) break; }
    const anchor = (popup || control)?.getBoundingClientRect?.();
    return scopes.map(confirmationButton).filter(Boolean).sort((a, b) => {
      const distance = (el) => !anchor ? 0 : Math.abs(el.getBoundingClientRect().left - anchor.left) + Math.abs(el.getBoundingClientRect().top - anchor.top);
      return distance(a) - distance(b);
    })[0] || null;
  };
  const setSearchValue = (el, value) => {
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

  function formSchema() {
    return fields().map((el, index) => {
      // Prefer the nearest visible label. Ancestor text often repeats “请选择”
      // and every sibling label, which makes an otherwise precise AI request noisy.
      const label = clean(fieldTitle(el) || el.getAttribute("aria-label") || associatedLabels(el)[0] || el.getAttribute("placeholder") || labelText(el) || el.name || el.id);
      const key = stableKey(el, index);
      const occurrence = Number(key.match(/::(\d+)$/)?.[1] || 0);
      return {
        key, index,
        label,
        ariaLabel: clean(el.getAttribute("aria-label")), placeholder: clean(el.getAttribute("placeholder")),
        name: clean(el.name), id: clean(el.id),
        module: moduleTitle(el), repeatIndex: repeatIndex(el, label), occurrence, currentValue: controlValue(el),
        type: controlType(el), options: optionTexts(el)
      };
    });
  }

  async function applyAssignments(assignments) {
    let filled = 0;
    const diagnostics = [];
    const schema = formSchema();
    const controls = fields();
    for (const assignment of assignments || []) {
      const descriptor = schema.find((item) => assignment.key && item.key === assignment.key)
        || schema.find((item) => assignment.index != null && item.index === Number(assignment.index));
      const el = descriptor && controls[descriptor.index];
      const detail = { key: assignment.key, label: assignment.label || descriptor?.label || "", value: assignment.value || "" };
      if (!el || !assignment.value) { diagnostics.push({ ...detail, reason: "field-not-found" }); continue; }
      if (controlValue(el)) { diagnostics.push({ ...detail, reason: "page-value-protected" }); continue; }
      if (!Number.isFinite(Number(assignment.confidence)) || Number(assignment.confidence) < 0.65 && !isChoiceControl(el)) { diagnostics.push({ ...detail, reason: "low-confidence" }); continue; }
      const targetLabel = fieldTitle(el) || assignment.label || labelText(el);
      // Guard the common AI failure: dates/scores must not land in free-text descriptions.
      if (isDescription(targetLabel) && looksLikeDate(assignment.value)) { diagnostics.push({ ...detail, reason: "description-date-protected" }); continue; }
      if (looksLikeDate(assignment.value) && !/(日期|时间|获得时间|毕业时间|开始时间|结束时间)/.test(normalize(targetLabel))) { diagnostics.push({ ...detail, reason: "date-field-mismatch" }); continue; }
      if (await applyValue(targetLabel, assignment.value, el, { deferConfirm: !!assignment.deferConfirm, sourceValue: assignment.sourceValue })) { filled++; diagnostics.push({ ...detail, reason: "filled", actual: controlValue(el), choice: lastChoice }); }
      else if (assignment.deferConfirm && lastChoice?.cascadePending) diagnostics.push({ ...detail, reason: "cascade-parent-selected", actual: controlValue(el), choice: lastChoice });
      else diagnostics.push({ ...detail, reason: "page-option-or-validation-failed", actual: controlValue(el), choice: lastChoice });
    }
    return { filled, diagnostics };
  }

  let lastOpenedControl = null;
  let lastChoice = null;
  const datePartText = (el) => clean(el?.getAttribute?.("placeholder") || el?.getAttribute?.("aria-label")).toLowerCase();
  const isYearPart = (el) => /年|year|yyyy/.test(datePartText(el));
  const isMonthPart = (el) => /月|month|^mm$/.test(datePartText(el));
  const dateControls = (target) => {
    for (let node = target?.parentElement, depth = 0; node && depth < 16; node = node.parentElement, depth++) {
      const isDateRange = /date|month|time/i.test(String(node.className || "")) && /range|info|picker/i.test(String(node.className || ""));
      const controls = [...node.querySelectorAll("input, [role=combobox]")].filter((el) => visible(el)
        && !["checkbox", "radio"].includes(el.type)
        && (isYearPart(el) || isMonthPart(el) || /select|date|month|picker|calendar/i.test(String(el.className || "")) || isDateRange && isChoiceControl(el)));
      if (controls.length >= 2 && controls.includes(target) && controls.every((el) => isYearPart(el) || isMonthPart(el))) return controls;
      // Some forms expose date pickers as anonymous inputs (no placeholder,
      // aria-label, or date class). Their stable signal is the nearby range
      // label and separator; the first four controls are year/month pairs.
      const text = clean(node.innerText || node.textContent);
      const anonymous = [...node.querySelectorAll("input, [role=combobox]")].filter((el) => visible(el) && !["checkbox", "radio"].includes(el.type));
      const datePartsOnly = anonymous.filter((el) => /日期|时间|年月|date|month/i.test(`${semanticText(el)} ${labelText(el)}`));
      if (/(起止时间|就读时间|获奖时间|开始时间|结束时间|毕业时间|教育结束)/.test(text) && text.includes("-") && datePartsOnly.length === 4 && datePartsOnly.includes(target)) return datePartsOnly;
    }
    return [];
  };
  async function choose(label, value, target, skipDatePair = false, chooseOptions = {}) {
    if (!value) return false;
    if (target?.tagName === "SELECT") return setValue(target, value);
    const [year, month, day] = dateParts(value);
    const pairedControls = !skipDatePair && year && month ? dateControls(target) : [];
    const pairIndex = pairedControls.indexOf(target);
    const monthControl = isMonthPart(target) || (pairIndex >= 0 && pairIndex % 2 === 1);
    const matchValue = pairIndex >= 0 ? (monthControl ? String(Number(month)) : year) : value;
    if (lastOpenedControl && lastOpenedControl !== target) {
      await closeVisibleDropdowns(lastOpenedControl);
      lastOpenedControl = null;
    }
    const wanted = normalize(matchValue);
    const wantedForms = dateForms(matchValue).map(normalize);
    const optionForms = [matchValue,
      /获奖级别/.test(label) && String(value).replace(/院级|校级/, "院校级").replace(/省级/, "省区级").replace(/市级/, "县市级"),
      /籍贯|居住地|户籍|户口/.test(label) && String(value).replace(/[\/／]/g, "")
    ].filter(Boolean).map(normalize);
    // Month-only controls on this page expose 8/1 instead of 08/01.
    const numericMonth = monthControl && String(Number(month || value));
    const salaryToken = (text) => normalize(text).replace(/(?:税前|人民币|元|每月|月薪|薪资|工资|待遇)/g, "");
    const matches = (text) => {
      const normalized = normalize(text);
      const monthToken = normalized.replace(/月$/, "");
      const numericMonthMatch = numericMonth && /^\d{1,2}$/.test(monthToken) && Number(monthToken) === Number(numericMonth);
      const forms = [...wantedForms, ...optionForms];
      if (/薪|工资|待遇/.test(label)) return forms.some((form) => salaryToken(normalized) === salaryToken(form));
      return numericMonthMatch || forms.some((form) => normalized === form || normalized.includes(form) || form.includes(normalized));
    };
    if (year && month && /(日期|时间)/.test(label)) {
      const dateControl = target && (/date|month|picker|calendar/i.test(String(target.className || "")) || target.getAttribute("aria-haspopup") || isChoiceControl(target)) ? target : null;
      if (dateControl) {
        dateControl.click();
        await wait(80);
        const rect = dateControl.getBoundingClientRect();
        const calendar = [...document.querySelectorAll("[role=grid]")].filter(visible).sort((a, b) => {
          const center = (el) => { const r = el.getBoundingClientRect(); return Math.abs(r.left - rect.left) + Math.abs(r.top - rect.top); };
          return center(a) - center(b);
        })[0];
        const panel = [...document.querySelectorAll("[role=dialog], [class$='month-panel'], [class*='month-panel '], [class*='MonthPanel']")].filter((el) => visible(el) && el.querySelector("[role=grid]")).sort((a, b) => {
          const center = (el) => { const r = el.getBoundingClientRect(); return Math.abs(r.left - rect.left) + Math.abs(r.top - rect.top); };
          return center(a) - center(b);
        })[0];
        if (panel) {
          const yearText = [...panel.querySelectorAll("[aria-label], [title], [class*='year'], [class*='Year'], button, span")]
            .map((el) => clean(el.textContent || el.getAttribute("aria-label") || el.getAttribute("title")))
            .find((text) => /^\d{4}$/.test(text));
          const currentYear = Number(yearText);
          const targetYear = Number(year);
          const direction = targetYear < currentYear ? "prev" : "next";
          for (let i = 0; i < Math.abs(targetYear - currentYear); i++) {
            [...panel.querySelectorAll("button, [role=button]")].find((el) => `${el.getAttribute("aria-label") || ""} ${el.getAttribute("title") || ""} ${el.className || ""}`.match(new RegExp(`${direction}.*year`, "i")))?.click();
            await wait(30);
          }
          const monthNode = [...panel.querySelectorAll("[role=gridcell], [role=option], button, [class*='month'], [class*='Month']")]
            .find((el) => normalize(el.textContent) === normalize(`${Number(month)}月`) || normalize(el.textContent) === normalize(String(Number(month))));
          if (monthNode) { monthNode.click(); await wait(40); await closeDatePicker(panel, dateControl); return true; }
        }
        if (calendar) {
          const currentYear = Number([...calendar.querySelectorAll("[aria-label], [title], [class*='year'], [class*='Year'], button, span")]
            .map((el) => clean(el.textContent || el.getAttribute("aria-label") || el.getAttribute("title"))).find((text) => /\d{4}/.test(text))?.match(/\d{4}/)?.[0]);
          const targetYear = Number(year);
          const yearDirection = targetYear < currentYear ? "prev" : "next";
          for (let i = 0; i < Math.abs(targetYear - currentYear); i++) { [...calendar.querySelectorAll("button, [role=button]")].find((el) => `${el.getAttribute("aria-label") || ""} ${el.getAttribute("title") || ""} ${el.className || ""}`.match(new RegExp(`${yearDirection}.*year`, "i")))?.click(); await wait(30); }
          const currentMonth = Number([...calendar.querySelectorAll("[aria-label], [title], [class*='month'], [class*='Month'], button, span")]
            .map((el) => clean(el.textContent || el.getAttribute("aria-label") || el.getAttribute("title"))).find((text) => /\b\d{1,2}\b/.test(text))?.match(/\d{1,2}/)?.[0]);
          const targetMonth = Number(month);
          const monthDirection = targetMonth < currentMonth ? "prev" : "next";
          for (let i = 0; i < Math.abs(targetMonth - currentMonth); i++) { [...calendar.querySelectorAll("button, [role=button]")].find((el) => `${el.getAttribute("aria-label") || ""} ${el.getAttribute("title") || ""} ${el.className || ""}`.match(new RegExp(`${monthDirection}.*month`, "i")))?.click(); await wait(30); }
          const [, , day] = dateParts(value);
          if (day) {
            const dayNode = [...calendar.querySelectorAll("[role=gridcell], [role=option], button, [class*='cell'], [class*='Cell']")].find((el) => !/prev-month|next-month/i.test(String(el.className || "")) && normalize(el.textContent) === normalize(String(Number(day))));
            if (dayNode) { dayNode.click(); await wait(40); await closeDatePicker(calendar, dateControl); return true; }
          }
          const calendarInput = calendar.querySelector("input[type=date], input[placeholder*='日期'], input[aria-label*='date' i]");
          if (calendarInput) {
            const formatted = `${year}-${pad2(Number(month))}-${pad2(Number(day || 1))}`;
            setValue(calendarInput, formatted);
            calendarInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
            await wait(40);
            await closeDatePicker(calendar, dateControl);
            return true;
          }
        }
      }
    }
    const host = [...document.querySelectorAll("[role=radio], [role=option]")].find((el) => visible(el) && matches(el.textContent)
      && !(/籍贯|居住地|户籍|户口/.test(label) && /省|自治区|特别行政区|市|区|县/.test(String(value)))
      && (normalize(labelText(el.parentElement || el)).includes(normalize(label)) || normalize(labelText(el)).includes(normalize(label))));
    if (host && (!target || !isChoiceControl(target) || target.matches("input[type=radio], [role=radio]"))) { host.click(); await closeVisibleDropdowns(target || host); return true; }
    const exactItem = [...document.querySelectorAll(".form-item")].find((el) => normalize(el.querySelector(`${fieldLabelSelector}, label`)?.innerText) === normalize(label));
    const container = target?.closest(".form-item") || exactItem || [...document.querySelectorAll("label, fieldset, [role=group], div")].find((el) => {
      const content = normalize(el.textContent);
      return visible(el) && content.includes(normalize(label)) && content.length < 100 && el.querySelector("[role=combobox], [aria-haspopup=listbox], input, select");
    });
    const radios = [...(container?.querySelectorAll("input[type=radio], [role=radio]") || [])].filter(editable);
    const radio = radios.find((el) => matches(labelText(el) || el.value || el.parentElement?.textContent));
    if (radio) { radio.click(); await closeVisibleDropdowns(target || radio); return true; }
    const radioOption = [...(container?.querySelectorAll("label, [class*='radio'], [class*='Radio'], [class*='option'], [class*='Option']") || [])]
      .find((el) => visible(el) && matches(el.textContent));
    if (radioOption) { radioOption.click(); await closeVisibleDropdowns(target || radioOption); return true; }
    const control = target || container?.querySelector("[role=combobox], [aria-haspopup=listbox], input, select");
    if (!control) return false;
    lastChoice = { label, value: String(value), before: controlValue(control) };
    let popup = popupFor(control, lastOpenedControl === control).sort((a, b) => {
      const distance = (el) => { const r = el.getBoundingClientRect(); return Math.abs(r.left - control.getBoundingClientRect().left) + Math.abs(r.top - control.getBoundingClientRect().top); };
      return distance(a) - distance(b);
    })[0];
    if (!popup) { control.click(); await wait(80); }
    lastOpenedControl = control;
    const controlRect = control.getBoundingClientRect();
    popup = popup || await waitFor(() => popupFor(control).sort((a, b) => {
      const distance = (el) => { const r = el.getBoundingClientRect(); return Math.abs(r.left - controlRect.left) + Math.abs(r.top - controlRect.top); };
      return distance(a) - distance(b);
    })[0]);
    const optionScope = popup || document;
    const options = () => popupOptionNodes(optionScope);
    const search = [popup?.querySelector("input:not([type=hidden])"), target].find((el) => el?.tagName === "INPUT" && !el.readOnly);
    const sourceValue = String(chooseOptions.sourceValue || "").trim();
    const isLocation = /城市|地点|地区|所在地/.test(label);
    let sourceOption = null;
    if (isLocation && sourceValue && popup?.querySelector("input:not([type=hidden])") && normalize(sourceValue) !== normalize(value)) {
      const sourceSearch = popup.querySelector("input:not([type=hidden])");
      setSearchValue(sourceSearch, sourceValue);
      await wait(160);
      const source = normalize(sourceValue);
      const candidates = options().filter((node) => {
        const text = clean(node.textContent || node.getAttribute("data-value") || node.getAttribute("value"));
        const candidate = normalize(text);
        // A province is only a navigation parent when the local value contains
        // a more specific location; it must not win a search for that location.
        return candidate && (candidate === source || source.includes(candidate))
          && !(candidate !== source && /(?:省|自治区|特别行政区)$/.test(text));
      });
      sourceOption = candidates.length === 1 ? candidates[0] : null;
    }
    // A salary search box filters by displayed range text; searching a raw
    // number such as 3500 hides “2001 ~ 4000”. Match ranges from real options.
    if (search && !sourceOption && !/薪|工资|待遇|掌握程度|熟练程度|技能等级|语言水平|听说|读写/.test(label) && !options().some((el) => matches(el.textContent || el.getAttribute("data-value") || el.getAttribute("value")))) {
      // Autocomplete controls need the desired text before their real options exist.
      setSearchValue(search, value);
      await wait(120);
    }
    if (/籍贯|居住地|户籍|户口/.test(label)) {
      const location = String(value).trim().match(/^(.+?(?:省|自治区|特别行政区|市))[\/／,，\s-]*(.+?(?:市|区|县))$/);
      const areaPopup = await waitFor(() => [...document.querySelectorAll("[role=dialog], [class*='area'], [class*='cascader'], [class*='popper'], [class*='popover']")]
        .find((el) => visible(el) && (el.querySelector('input[placeholder="搜索"], input[placeholder*="搜"]') || /全部省市|已选地区|选择地区/.test(clean(el.innerText || el.textContent)))));
      if (location && areaPopup) {
        const search = areaPopup.querySelector('input[placeholder="搜索"], input[placeholder*="搜"]');
        const writeSearch = (text) => {
          if (!search) return;
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
          setter ? setter.call(search, text) : (search.value = text);
          search.dispatchEvent(new Event("input", { bubbles: true }));
        };
        const findArea = (name) => [...areaPopup.querySelectorAll(".area-item-container, [role=option], li, button, label, [class*=item], [class*=option], div, span")]
          .filter((el) => visible(el) && normalize(el.textContent) === normalize(name))
          .sort((a, b) => (a.children.length - b.children.length) || (a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height))[0];
        let province = findArea(location[1]);
        if (!province) { writeSearch(location[1]); await wait(100); province = findArea(location[1]); }
        if (province) {
          clickOption(province);
          const city = await waitFor(() => findArea(location[2]));
          if (city) clickOption(city);
          const confirm = confirmationFor(areaPopup, control);
          if (confirm) { clickOption(confirm); await wait(120); }
          await closeVisibleDropdowns(control);
          return !!city;
        }
      }
      if (location) {
        const province = options().find((el) => normalize(el.textContent) === normalize(location[1]));
        if (province) {
          clickOption(province); await wait(80);
          const city = options().find((el) => normalize(el.textContent) === normalize(location[2]));
          if (city) clickOption(city);
          const confirm = confirmationFor(popup, control);
          if (confirm) { clickOption(confirm); await wait(120); }
          await closeVisibleDropdowns(control);
          return !!city;
        }
      }
    }
    const findOption = () => {
      const list = options();
      if (lastChoice) lastChoice.candidates = list.map((el) => clean(el.textContent || el.getAttribute("data-value") || el.getAttribute("value")));
      if (sourceOption && list.includes(sourceOption)) return sourceOption;
      const exact = list.find((el) => {
        const text = normalize(el.textContent || el.getAttribute("data-value") || el.getAttribute("value"));
        return [...wantedForms, ...optionForms].some((form) => text === form) || numericMonth && /^\d{1,2}$/.test(text) && Number(text) === Number(numericMonth);
      });
      const semantic = list.filter((el) => matches(el.textContent || el.getAttribute("data-value") || el.getAttribute("value")));
      const salary = /薪|工资|待遇/.test(label) && salaryOption(value, list);
      const proficiency = proficiencyOption(value, list, label);
      if (lastChoice) lastChoice.match = { exact: !!exact, salary: !!salary, proficiency: !!proficiency, semantic: semantic.length };
      return exact || salary || proficiency || (semantic.length === 1 ? semantic[0] : null);
    };
    let option = await waitFor(findOption, 1400);
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
    if (!option) {
      lastChoice.optionFound = false;
      restoreChoiceSearch(target, lastChoice.before);
      await closeVisibleDropdowns(control);
      return false;
    }
    lastChoice.optionFound = true;
    lastChoice.option = clean(option.textContent || option.getAttribute("data-value") || option.getAttribute("value"));
    lastChoice.selectedValue = lastChoice.option;
    lastChoice.selectedFromSource = option === sourceOption;
    clickOption(option);
    await wait(80);
    lastChoice.afterClick = controlValue(control);
    const controls = pairedControls;
    const controlIndex = controls.indexOf(control);
    if (controlIndex >= 0 && controlIndex % 2 === 0 && controls[controlIndex + 1]) {
      if (!await choose(label, String(Number(month)), controls[controlIndex + 1], true, chooseOptions)) return false;
    }
    const confirm = confirmationFor(popup, control);
    if (chooseOptions.deferConfirm && confirm && !controlValue(control) && !lastChoice.selectedFromSource) {
      lastChoice.confirmFound = true;
      lastChoice.cascadePending = true;
      lastChoice.afterConfirm = controlValue(control);
      return false;
    }
    if (confirm) { clickOption(confirm); await wait(120); }
    lastChoice.confirmFound = !!confirm;
    if (target && target.tagName !== "SELECT" && isChoiceControl(target)) {
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
      target.dispatchEvent(new Event("blur", { bubbles: true }));
    }
    // Component state can render after its click handler returns. Verify the
    // displayed value before closing the popup, rather than cancelling it early.
    lastChoice.confirmed = !!await waitFor(() => valueMatches(controlValue(control), lastChoice.selectedValue || value, label), 800);
    lastChoice.afterConfirm = controlValue(control);
    await closeVisibleDropdowns(control);
    return true;
  }

  const valueMatches = (actual, expected, label = "") => {
    const a = normalize(actual); const e = normalize(expected);
    if (!a || !e) return false;
    if (a === e || a.includes(e) || e.includes(a)) return true;
    if (/薪|工资|待遇/.test(label)) {
      const actualRange = salaryRange(actual); const expectedRange = salaryRange(expected);
      if (actualRange && expectedRange && expectedRange[0] === expectedRange[1]) return actualRange[0] <= expectedRange[0] && expectedRange[0] <= actualRange[1];
    }
    const actualDate = dateParts(actual); const expectedDate = dateParts(expected);
    return actualDate.length >= 2 && expectedDate.length >= 2
      && actualDate[0] === expectedDate[0] && actualDate[1] === expectedDate[1]
      && (!expectedDate[2] || actualDate[2] === expectedDate[2]);
  };
  async function applyValue(label, value, target, applyOptions = {}) {
    if (!target || value == null || value === "") return false;
    lastChoice = null;
    const changed = setValue(target, value) || await choose(label, value, target, false, applyOptions);
    if (!changed) return false;
    await wait(70);
    const selected = lastChoice?.selectedValue || value;
    if (valueMatches(controlValue(target), selected, label) || /(?:描述|职责|亮点|评价)/.test(label)) return true;
    const parts = dateParts(value); const controls = dateControls(target); const index = controls.indexOf(target);
    if (index >= 0 && parts.length >= 2) {
      const expectedPart = index % 2 ? Number(parts[1]) : Number(parts[0]);
      return Number(String(controlValue(target)).replace(/\D/g, "")) === expectedPart;
    }
    return false;
  }

  async function addRows(label, count, anchor, buttonPatterns = [], section = "") {
    const countFields = () => {
      const matches = fields().filter((el) => anchorMatch(el, anchor));
      const scoped = matches.filter((el) => inSection(el, section));
      return Math.max(rowContainers(anchor, section).length, (scoped.length ? scoped : matches).length);
    };
    const buttonInSection = (el) => {
      if (!section) return true;
      const sectionNames = [section, ...(SECTION_ALIASES[section] || [])].map(normalize);
      const title = normalize(sectionTitle(el));
      return !title || sectionNames.some((name) => title.includes(name));
    };
    let existing = countFields();
    let clicks = 0;
    while (existing < count && clicks < count * 2) {
      const wanted = normalize(label);
      // Repeated Phoenix modules expose a stable module-id + _addButton pair.
      // Resolve that first so a deeply nested page cannot select another module.
      const moduleField = fields().find((el) => anchorMatch(el, anchor) && inSection(el, section)) || fields().find((el) => anchorMatch(el, anchor));
      let directButton = null;
      for (let node = moduleField; node && !directButton; node = node.parentElement) {
        if (node.id) directButton = document.getElementById(`${node.id}_addButton`);
      }
      const button = directButton && visible(directButton) ? directButton : [...document.querySelectorAll("[id$='_addButton'], button, a, [role=button], [class*='add'], [class*='Add']")].find((el) => {
        if (!visible(el) || el.disabled || el.getAttribute("aria-disabled") === "true") return false;
        const text = normalize(el.textContent);
        const specific = text.includes(wanted) || buttonPatterns.some((pattern) => pattern.test(text));
        return buttonInSection(el) && (specific || /^(?:添加|新增|\+|＋)$/.test(text));
      });
      if (!button) break;
      button.click();
      clicks++;
      const next = await waitFor(() => {
        const current = countFields();
        return current > existing ? current : 0;
      }, 1800);
      if (!next) break;
      existing = next;
    }
    return existing;
  }

  async function ensureRows(counts) {
    // Filling must never delete rows already present on a job-application page.
    const education = await addRows("教育经历", counts?.education || 0, "学校名称", [/添加.*教育.*经历/], "教育背景");
    const languages = await addRows("语言能力", counts?.languages || counts?.english || 0, "语言类型", [/添加.*语言.*能力/], "语言能力");
    const work = await addRows("工作经历", counts?.work || 0, "公司名称", [/添加.*工作.*经历/], "工作经历");
    const internships = await addRows("实习经历", counts?.internships || 0, "公司名称", [/添加.*实习.*经历/], "实习经历");
    const projects = await addRows("项目经历", counts?.projects || 0, "项目名称", [/添加.*项目.*经历/], "项目经验");
    const cadres = await addRows("学生干部经历", counts?.cadres || 0, "职务", [/添加.*(?:学生|干部|校园|社团).*经历/], "学生干部经历");
    const certificates = await addRows("证书", counts?.certificates || 0, "证书名称", [/添加.*证书/], "证书");
    const skills = await addRows("技能", counts?.skills || 0, "技能名称", [/添加.*技能/], "技能");
    const awards = await addRows("获奖情况", counts?.awards || 0, "获奖项", [/添加.*(?:奖励活动|获奖|奖项)/]);
    return { education, languages, work, internships, projects, cadres, certificates, skills, awards };
  }

  async function fill(profile, options = {}) {
    let filled = 0; let missing = 0; let structuredMissing = 0;
    const filledFields = []; const missingFields = []; const skippedFields = [];
    const onlyEmpty = !!options.onlyEmpty;
    const forceWorkDescriptions = !!options.forceWorkDescriptions;
    const formatNumberedText = (value) => String(value || "").replace(/(^|\n)\s*(\d+)[.、)]\s*\n\s*/g, "$1$2. ");
    const mergedWorkText = (row) => [row?.description, row?.highlights].filter(Boolean).map(formatNumberedText).join("\n");
    const usedFields = new Set();
    const deferredFields = [];
    const deferChoice = (field) => {
      const hint = `${field?.type || ""} ${fieldTitle(field)} ${field?.getAttribute("aria-label") || ""} ${field?.getAttribute("placeholder") || ""}`;
      return !!options.deferChoices && isChoiceControl(field) && !/(日期|时间|年月|date|month)/i.test(hint)
        && /期望从事行业|期望行业|意向行业|期望从事职业|期望职业|意向职位|期望月薪|期望薪资|期望待遇|期望工作城市|期望城市|意向城市|期望工作地点|期望地点|工作地点|办公地点|工作地区|办公城市|任职地点/.test(hint);
    };
    const hasSection = (section) => fields().some((el) => {
      const title = normalize(sectionTitle(el));
      return title && [section, ...(SECTION_ALIASES[section] || [])].map(normalize).some((name) => title.includes(name));
    });
    const allExperienceRows = profile.experiences?.length ? profile.experiences : [...(profile.internships || []), ...(profile.work || [])];
    const hasInternshipSection = hasSection("实习经历");
    const workRows = hasInternshipSection ? (profile.work || []) : allExperienceRows;
    const internshipRows = hasInternshipSection ? (profile.internships?.length ? profile.internships : (profile.work || []).filter((row) => /实习|intern/i.test(`${row?.workType || ""} ${row?.title || ""}`))) : [];
    const simple = [["姓名", profile.name], ["手机号码", profile.phone], ["邮箱", profile.email], ["出生日期", profile.birthDate], ["民族", profile.nationality], ["政治面貌", profile.politicalStatus], ["户口所在地", profile.householdRegistration], ["籍贯", profile.nativePlace], ["现居住地", profile.currentResidence], ["微信号", profile.wechat], ["最近公司", allExperienceRows[0]?.company], ["当前就读学校学号", profile.education?.[0]?.studentId], ["兴趣爱好", profile.extras?.hobbies], ["特长", profile.extras?.specialty], ["个人评价", profile.extras?.selfEvaluation], ["获奖经历", profile.extras?.awards], ["学生干部经历", profile.extras?.studentCadres]];
    for (const [label, value] of simple) {
      if (!value) continue;
      const field = findField(label);
      if (onlyEmpty && field && controlValue(field)) { skippedFields.push(label); continue; }
      if (deferChoice(field)) { deferredFields.push(label); continue; }
      if (field && usedFields.has(field)) { skippedFields.push(label); continue; }
      if (await applyValue(label, value, field)) { if (field) usedFields.add(field); filled++; filledFields.push(label); }
      else { missing++; missingFields.push(label); }
    }
    const genderField = findField("性别");
    if (profile.gender && onlyEmpty && genderField && controlValue(genderField)) skippedFields.push("性别");
    else if (profile.gender && deferChoice(genderField)) deferredFields.push("性别");
    else if (profile.gender && await choose("性别", profile.gender, genderField)) { filled++; filledFields.push("性别"); }
    else if (profile.gender) { missing++; missingFields.push("性别"); }
    const highestDegree = profile.education?.[0]?.degree;
    const highestField = findField("最高学历");
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
    for (const [label, value] of intent) {
      if (!value) continue;
      const field = findField(label);
      const detail = { section: "求职意向", row: 1, label, value: String(value), targetIndex: field ? fields().indexOf(field) : -1, targetLabel: field ? fieldTitle(field) || labelText(field) : "" };
      if (onlyEmpty && field && controlValue(field)) { skippedFields.push(label); diagnostics.structuredAttempts.push({ ...detail, reason: "page-value-protected", actual: controlValue(field) }); continue; }
      if (deferChoice(field)) { deferredFields.push(label); diagnostics.structuredAttempts.push({ ...detail, reason: "deferred-to-ai" }); continue; }
      if (field && usedFields.has(field)) { skippedFields.push(label); diagnostics.structuredAttempts.push({ ...detail, reason: "duplicate-field" }); continue; }
      if (await applyValue(label, value, field)) { if (field) usedFields.add(field); filled++; filledFields.push(label); diagnostics.structuredAttempts.push({ ...detail, reason: "filled", actual: controlValue(field), choice: lastChoice }); }
      else { missing++; missingFields.push(label); diagnostics.structuredAttempts.push({ ...detail, reason: "page-option-or-validation-failed", actual: controlValue(field), choice: lastChoice }); }
    }
    for (const [label, value] of Object.entries(profile.customFields || {})) {
      if (!value) continue;
      const field = findField(label);
      if (!field) { missing++; missingFields.push(label); continue; }
      if (controlValue(field) || usedFields.has(field)) { skippedFields.push(label); continue; }
      if (deferChoice(field)) { deferredFields.push(label); continue; }
      if (await applyValue(label, value, field)) { usedFields.add(field); filled++; filledFields.push(label); }
      else { missing++; missingFields.push(label); }
    }
    await ensureRows({ education: profile.education?.length, languages: profile.languages?.length, work: workRows.length, internships: internshipRows.length, projects: profile.projects?.length, cadres: profile.cadres?.length, certificates: profile.certificates?.length, skills: profile.skills?.length, awards: profile.awards?.length });
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
    const certificateGroup = [profile.certificates, [["证书名称", "name"], ["获得时间", "date"], ["证书描述", "description"]], "证书名称", "证书"];
    const groups = [
      [profile.education, [["学校名称", "school"], ["学院名称", "college"], ["专业名称", "major"], ["学历", "degree"], ["开始时间", "start"], ["结束时间", "end"], ["培养方式", "training"], ["GPA", "gpa"], ["成绩排名", "rank"]], "学校名称", "教育背景"],
      certificateGroup,
      [profile.skills, [["技能名称", "name"], ["掌握程度", "proficiency"], ["使用时间总计", "duration"], ["技能描述", "description"]], "技能名称", "技能"],
      [profile.languages, [["语言类型", "language"], ["掌握程度", "proficiency"], ["听说", "speaking"], ["读写", "reading"]], "语言类型", "语言能力"],
      [workRows, [["公司名称", "company"], ["所在部门", "department"], ["职位名称", "title"], ["工作性质", "workType"], ["开始时间", "start"], ["结束时间", "end"], ["月薪(税前)", "salary"], ["工作地点", "location"], ["离职原因", "reason"], ["工作描述", "description"], ["工作职责", "description"], ["工作亮点", "highlights"]], "公司名称", "工作经历"],
      [internshipRows, [["公司名称", "company"], ["所在部门", "department"], ["职位名称", "title"], ["工作性质", "workType"], ["开始时间", "start"], ["结束时间", "end"], ["月薪(税前)", "salary"], ["工作地点", "location"], ["离职原因", "reason"], ["工作描述", "description"], ["工作职责", "description"], ["工作亮点", "highlights"]], "公司名称", "实习经历"],
      [profile.projects, [["项目名称", "name"], ["项目职责", "role"], ["项目中职责", "responsibilities"], ["开始时间", "start"], ["结束时间", "end"], ["项目描述", "description"]], "项目名称", "项目经验"],
      [profile.cadres, [["职务", "position"], ["级别", "level"], ["开始时间", "start"], ["结束时间", "end"], ["工作职责", "duty"]], "职务", "学生干部经历"],
      [profile.awards, [["获奖项", "name"], ["获奖时间", "date"], ["获奖级别", "level"], ["获奖描述", "description"]], "获奖项", "获奖经历"]
    ];
    for (const [rows, mapping, anchor, section] of groups) {
      for (let index = 0; index < (rows || []).length; index++) {
        const row = rows[index];
        const parts = anchor === "项目名称" ? projectParts(row) : null;
        for (const [label, key] of mapping) {
          const value = key === "_exam" ? certificateExam(row?.name)
            : key === "_score" ? certificateScore(row)
            : label === "项目职责" ? row?.role || parts?.responsibilities || row?.responsibilities
            : label === "项目中职责" ? parts?.responsibilities || row?.responsibilities || row?.role
            : label === "项目描述" ? parts?.summary || row?.summary
            : label === "工作性质" ? row?.workType || (/实习|intern/i.test(String(row?.title || "")) ? "实习" : "")
            : label === "获奖级别" ? awardLevel(row)
            : (rows === workRows || rows === internshipRows) && (label === "工作描述" || label === "工作职责") ? mergedWorkText(row)
            : key === "highlights" ? formatNumberedText(row?.[key])
            : row?.[key];
          const field = rowField(anchor, index, label, section, value);
          const isWorkText = (rows === workRows || rows === internshipRows) && /工作内容|工作描述|工作职责|工作亮点|工作成果|业绩亮点/.test(label);
          const fieldName = `${section}[${index + 1}].${label}`;
          const targetLabel = field ? (fieldTitle(field) || labelText(field)) : "";
          const detail = { section, row: index + 1, company: row?.company || "", label, value: String(value || ""), targetIndex: field ? fields().indexOf(field) : -1, targetLabel, targetRepeatIndex: field ? repeatIndex(field, targetLabel) : -1 };
          if (!value) {
            if (/月薪|工作地点/.test(label)) diagnostics.structuredAttempts.push({ ...detail, reason: "profile-value-missing" });
            continue;
          }
          if (onlyEmpty && field && controlValue(field) && !(forceWorkDescriptions && isWorkText)) { skippedFields.push(fieldName); diagnostics.structuredAttempts.push({ ...detail, reason: "page-value-protected" }); continue; }
          if (!field) { structuredMissing++; missingFields.push(fieldName); diagnostics.structuredAttempts.push({ ...detail, reason: "field-not-found" }); continue; }
          if (deferChoice(field)) { deferredFields.push(fieldName); diagnostics.structuredAttempts.push({ ...detail, reason: "deferred-to-ai" }); continue; }
          if (await applyValue(label, value, field)) { filled++; filledFields.push(fieldName); diagnostics.structuredAttempts.push({ ...detail, reason: "filled", actual: controlValue(field), choice: lastChoice }); }
          else { structuredMissing++; missingFields.push(fieldName); diagnostics.structuredAttempts.push({ ...detail, reason: "page-option-or-validation-failed", actual: controlValue(field), choice: lastChoice }); }
        }
      }
    }
    if (lastOpenedControl) {
      await closeVisibleDropdowns(lastOpenedControl);
      lastOpenedControl = null;
    }
    await closeVisibleDropdowns();
    diagnostics.deferredFields = deferredFields;
    const result = { filled, missing: missing + structuredMissing, filledFields, missingFields, skippedFields, diagnostics };
    console.info("[resume-autofill] structured-fill", { filled, missing: result.missing, skipped: skippedFields.length, missingFields, diagnostics });
    return result;
  }

  const runtime = globalThis.chrome?.runtime;
  if (runtime?.onMessage?.addListener) runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const tasks = {
      GET_FORM_SCHEMA: async () => ({ fields: formSchema() }),
      GET_LIVE_OPTIONS: async () => ({ fields: await liveOptions(message.keys, !!message.keepOpen, message.previousOptions) }),
      ENSURE_ROWS: () => ensureRows(message.counts),
      FILL_PROFILE: () => fill(message.profile, message.options),
      APPLY_ASSIGNMENTS: () => applyAssignments(message.assignments)
    };
    const task = tasks[message?.type];
    if (!task) return false;
    Promise.resolve().then(task)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error?.message || "页面填充失败" }));
    return true;
  });
  if (globalThis.__RESUME_AUTOFILL_TEST__) globalThis.__resumeAutofillTest = { formSchema, liveOptions, fill, applyAssignments };
})();
