const $ = (id) => document.getElementById(id);

const emptyProfile = () => ({
  name: "", phone: "", email: "", gender: "", birthDate: "", age: "", nationality: "", countryRegion: "", politicalStatus: "", wechat: "", nativePlace: "", currentResidence: "", householdRegistration: "", workExperience: "",
  jobIntent: { industry: "", occupation: "", currentSalary: "", expectedSalary: "", city: "", arrival: "" },
  education: [], experiences: [], work: [], internships: [], projects: [], cadres: [], skills: [], languages: [], certificates: [], awards: [], customFields: {}, extras: { hobbies: "", specialty: "", selfEvaluation: "", skills: "", languages: "", awards: "", studentCadres: "" }
});

function skillsFromText(value) {
  const source = String(value || "").trim();
  if (!source) return [];
  const rows = source.split(/(?:^|[\s,，;；])(?=\d+[、.．)]\s*|[-*•]\s*)/).map((item) => item.replace(/^\s*(?:\d+[、.．)]|[-*•])\s*/, "").trim()).filter(Boolean);
  const items = rows.length > 1 ? rows : (() => {
    const parts = source.split(/[、,，]/).map((item) => item.trim()).filter(Boolean);
    const bare = (item) => item.replace(/^(?:熟练掌握|熟练|熟悉|了解|掌握)\s*/, "").trim();
    return parts.length > 1 && parts.every((item) => bare(item).length <= 30 && !/使用|开发|设计|流程|协作|等/.test(item)) ? parts : [source];
  })();
  return items.map((description) => {
    const proficiency = description.match(/^(熟练掌握|熟练|熟悉|了解|掌握)/)?.[1] || "";
    const name = description.split(/[，,；;：:]/)[0].replace(/^(?:熟练掌握|熟练|熟悉|了解|掌握)\s*/, "").trim();
    return { name, proficiency, description };
  }).filter((item) => item.name);
}

function certificatesFromLanguages(value) {
  return String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const match = line.match(/^(.+?)\s*((?:\d{4}[./-]\d{1,2}(?:[./-]\d{1,2})?)|(?:\d{4}年\s*\d{1,2}月(?:\s*\d{1,2}日)?))\s*[：:]\s*(.+)$/);
    return match ? { name: match[1].trim(), date: match[2], score: match[3].trim(), description: `成绩：${match[3].trim()}` } : null;
  }).filter(Boolean);
}

function awardsFromText(value) {
  const lines = String(value || "").replace(/[|｜]/g, "｜").split(/\r?\n/).map((line) => line.trim().replace(/^[-*#>、\s]+/, "")).filter(Boolean);
  const rows = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const match = line.match(/^(.+?)\s*｜\s*((?:\d{4}[./-]\d{1,2}(?:[./-]\d{1,2})?)|(?:\d{4}年\s*\d{1,2}月(?:\s*\d{1,2}日)?))$/);
    if (!match) continue;
    const next = lines.findIndex((item, nextIndex) => nextIndex > index && /｜\s*(?:\d{4}[./-]\d{1,2}(?:[./-]\d{1,2})?|\d{4}年\s*\d{1,2}月(?:\s*\d{1,2}日)?)$/.test(item));
    const details = lines.slice(index + 1, next < 0 ? lines.length : next);
    const explicitLevel = details.find((item) => item.match(/^获奖级别\s*[：:]\s*(.+)$/))?.match(/^获奖级别\s*[：:]\s*(.+)$/)?.[1]?.trim() || "";
    const description = details.filter((item) => !/^获奖级别\s*[：:]/.test(item)).map((item) => item.replace(/^获奖描述\s*[：:]\s*/, "")).join(" ").trim();
    const name = match[1].trim().replace(/^\*+|\*+$/g, "");
    const inferredLevel = /省/.test(name) ? "省区级" : /国家/.test(name) ? "国家级" : /市|区|县/.test(name) ? "县市级" : /院|校|学校|学院/.test(name) ? "院校级" : "";
    rows.push({ name, date: match[2], level: explicitLevel || inferredLevel, description });
  }
  return rows;
}

const aliases = {
  countryRegion: ["国籍（地区）", "国籍(地区)", "国籍/地区", "国籍", "国家/地区", "国家／地区", "国家地区", "国家或地区", "国家（地区）", "国家(地区)", "国家", "country/region", "country"],
  name: ["姓名", "名字"], phone: ["手机", "手机号", "电话", "联系电话"], email: ["邮箱", "电子邮箱", "email"],
  gender: ["性别"], birthDate: ["出生日期", "生日"], age: ["年龄", "周岁"], nationality: ["民族"], politicalStatus: ["政治面貌"], wechat: ["微信号"], nativePlace: ["籍贯"], currentResidence: ["现居住地", "当前居住地", "当前居住城市", "目前居住城市", "现居住城市", "居住城市", "现居地", "居住地"], workExperience: ["工作经验", "工作年限", "经验年限"],
  city: ["期望工作城市", "工作城市", "意向城市"], arrival: ["到岗时间", "入职时间"],
  expectedSalary: ["期望月薪", "期望薪资"], currentSalary: ["现月薪", "当前薪资"],
  industry: ["期望从事行业", "意向行业"], occupation: ["期望从事职业", "意向职位"],
  hobbies: ["兴趣爱好", "爱好"], specialty: ["特长", "技能"],
  school: ["学校", "学校名称", "院校"], college: ["学院", "学院名称"], major: ["专业", "专业名称"], degree: ["学历", "学位"],
  company: ["公司", "公司名称", "单位"], title: ["职位", "职位名称"],
  description: ["工作职责", "工作描述", "工作内容", "工作说明", "项目描述", "职责"], highlights: ["亮点", "工作亮点", "工作成果", "业绩亮点"], role: ["职务", "角色"], project: ["项目名称", "项目"],
  start: ["开始时间", "入学时间", "教育开始", "工作开始", "起止时间", "时间"], end: ["结束时间", "毕业时间", "教育结束", "工作结束"]
};

function cleanProfile(input) {
  const base = emptyProfile();
  const p = input || {};
  ["name", "phone", "email", "gender", "birthDate", "age", "nationality", "countryRegion", "politicalStatus", "wechat", "nativePlace", "currentResidence", "householdRegistration", "workExperience"].forEach((key) => {
    if (p[key] != null) base[key] = String(p[key]).trim();
  });
  const monthOnlyBirth = base.birthDate.match(/^(\d{4})\s*(?:年|[./-])\s*(\d{1,2})(?:月)?$/);
  if (monthOnlyBirth && Number(monthOnlyBirth[2]) >= 1 && Number(monthOnlyBirth[2]) <= 12) base.birthDate = `${monthOnlyBirth[1]}-${monthOnlyBirth[2].padStart(2, "0")}-01`;
  const legacyIntentKeys = {
    industry: ["intentIndustry", "expectedIndustry", "期望从事行业"], occupation: ["intentOccupation", "expectedOccupation", "期望从事职业"],
    currentSalary: ["intentCurrentSalary", "currentSalary", "现月薪(税前)"], expectedSalary: ["intentExpectedSalary", "expectedSalary", "期望月薪(税前)"],
    city: ["intentCity", "expectedCity", "期望工作城市"], arrival: ["intentArrival", "arrival", "到岗时间"]
  };
  Object.keys(base.jobIntent).forEach((key) => {
    const value = p.jobIntent?.[key] ?? legacyIntentKeys[key].map((legacyKey) => p[legacyKey] ?? p.customFields?.[legacyKey]).find((item) => item != null);
    if (value != null) base.jobIntent[key] = String(value).trim();
  });
  ["education", "experiences", "work", "internships", "projects", "cadres", "skills", "languages", "awards"].forEach((key) => {
    base[key] = Array.isArray(p[key]) ? p[key].map((item) => Object.fromEntries(
      Object.entries(item || {}).map(([k, v]) => [k, String(v ?? "").trim()])
    )).filter((item) => Object.values(item).some((value) => String(value || "").trim())) : [];
  });
  base.education = base.education.map((row) => ({ ...row, training: row.training || row.educationType || row.education_type || row.受教育类型 || row.学历类型 || row.培养方式 || row.学习形式 || "" }));
  const dateKey = (value) => {
    const match = String(value || "").match(/(\d{4})\s*(?:年|[./-])\s*(\d{1,2})(?:\s*(?:月|[./-])\s*(\d{1,2}))?/);
    return match ? Number(match[1]) * 10000 + Number(match[2]) * 100 + Number(match[3] || 1) : 0;
  };
  ["education", "experiences", "work", "internships", "projects", "cadres"].forEach((key) => {
    base[key] = base[key].map((row) => {
      if (row.start && row.end && !/至今|现在|在职/i.test(row.end) && dateKey(row.start) > dateKey(row.end)) {
        return { ...row, start: row.end, end: row.start };
      }
      return row;
    });
  });
  base.certificates = Array.isArray(p.certificates) ? p.certificates.map((item) => Object.fromEntries(
    Object.entries(item || {}).map(([k, v]) => [k, String(v ?? "").trim()])
  )) : certificatesFromLanguages(p.extras?.languages);
  if (!base.skills.length) base.skills = skillsFromText(p.extras?.skills || p.extras?.specialty);
  base.awards = Array.isArray(p.awards) ? p.awards.map((item) => Object.fromEntries(
    Object.entries(item || {}).map(([k, v]) => [k, String(v ?? "").trim()])
  )) : awardsFromText(p.extras?.awards);
  base.awards = base.awards.map((row) => ({
    ...row,
    date: row.date || row.awardDate || row.awardedAt || row.time || row.获奖时间 || row.获得时间 || row.获奖日期 || ""
  }));
  const legacyInternships = base.work.filter((row) => /实习|intern/i.test(`${row.workType || ""} ${row.title || ""}`));
  base.work = base.work.filter((row) => !legacyInternships.includes(row));
  if (legacyInternships.length) base.internships = [...base.internships, ...legacyInternships];
  // ponytail: old parsers could copy a job title into company; drop only the
  // malformed twin when its dates/details exactly match a real experience row.
  const compact = (value) => String(value || "").replace(/\s+/g, "").toLowerCase();
  const dedupeExperience = (rows) => rows.filter((row, index, all) => {
    if (row.title || !row.company) return true;
    const signature = [row.start, row.end, row.description, row.highlights].map(compact).join("\u0001");
    return !all.some((other, otherIndex) => otherIndex !== index && other.title &&
      compact(row.company) === compact(other.title) &&
      signature === [other.start, other.end, other.description, other.highlights].map(compact).join("\u0001"));
  });
  const uniqueRows = (rows) => rows.filter((row, index, all) => index === all.findIndex((other) =>
    compact(JSON.stringify(row)) === compact(JSON.stringify(other))));
  base.work = dedupeExperience(base.work);
  base.internships = uniqueRows(dedupeExperience(base.internships));
  base.work = base.work.filter((row) => row.title || !base.internships.some((other) => other.title &&
    compact(row.company) === compact(other.title) &&
    [row.start, row.end, row.description, row.highlights].map(compact).join("\u0001") ===
    [other.start, other.end, other.description, other.highlights].map(compact).join("\u0001")));
  base.customFields = Object.fromEntries(Object.entries(p.customFields || {})
    .map(([key, value]) => [String(key).trim(), String(value ?? "").trim()])
    .filter(([key, value]) => key && value));
  if (/^[\u4e00-\u9fff]{2,6}$/.test(base.name) && typeof pinyinPro !== "undefined") {
    const surname = base.name.match(/^(?:欧阳|司马|上官|诸葛|东方|皇甫|尉迟|公孙|慕容|司徒|司空|令狐|宇文|长孙|夏侯|南宫|独孤|闻人|澹台|仲孙|申屠|公羊|太史|端木|拓跋|轩辕|百里|呼延|东郭|西门|亓官|羊舌|第五)/)?.[0] || base.name[0];
    const latin = (name, surnameMode) => pinyinPro.pinyin(name, { toneType: "none", surname: surnameMode, separator: "", v: true }).replace(/^./, c => c.toUpperCase());
    // ponytail: local dictionary for Chinese names; explicit spellings win for polyphonic names.
    base.customFields["姓拼音"] ||= latin(surname, "head");
    base.customFields["名拼音"] ||= latin(base.name.slice(surname.length), "off");
  }
  const standard = new Set(["name", "phone", "email", "gender", "birthDate", "age", "nationality", "countryRegion", "politicalStatus", "wechat", "nativePlace", "currentResidence", "householdRegistration", "workExperience", "jobIntent", "education", "experiences", "work", "internships", "projects", "cadres", "skills", "languages", "certificates", "awards", "customFields", "extras"]);
  Object.entries(p).forEach(([key, value]) => {
    if (!standard.has(key) && value != null && typeof value !== "object" && String(value).trim()) base.customFields[key] = String(value).trim();
  });
  ["hobbies", "specialty", "selfEvaluation", "skills", "languages", "awards", "studentCadres"].forEach((key) => {
    if (p.extras?.[key] != null) base.extras[key] = String(p.extras[key]).trim();
  });
  if (!base.extras.studentCadres && base.cadres.length) base.extras.studentCadres = base.cadres.map((row) => [
    row.position, row.level, [row.start, row.end].filter(Boolean).join(" 至 "), row.duty || row.description
  ].filter(Boolean).join("\n")).join("\n\n");
  return base;
}

function findValue(lines, keys) {
  const keyPattern = keys.map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(`^(?:[-*#>、\\s]*)?(?:${keyPattern})\\s*[：:]\\s*(.+)$`, "i");
  return lines.map((line) => line.trim().match(re)?.[1]?.trim()).find(Boolean) || "";
}

const headings = ["教育经历", "教育背景", "工作经历", "实习经历", "项目经历", "项目经验", "学生干部经历", "语言能力", "竞赛/获奖经历", "个人评价"];
const monthRange = /(\d{4}(?:年\s*\d{1,2}月(?:\s*\d{1,2}日)?|[./-]\d{1,2}(?:[./-]\d{1,2})?))\s*[至到—–-]\s*(\d{4}(?:年\s*\d{1,2}月(?:\s*\d{1,2}日)?|[./-]\d{1,2}(?:[./-]\d{1,2})?)|至今)/;

function customFieldsFromLines(lines) {
  const known = new Set(Object.values(aliases).flat().map((key) => key.replace(/[：:（）()\[\]【】\s_-]/g, "").toLowerCase()));
  return Object.fromEntries(lines.map((line) => {
    const match = line.match(/^(?:[-*#>、\s]*)([^：:]{1,30})\s*[：:]\s*(.+)$/);
    const key = match?.[1]?.replace(/^\*+|\*+$/g, "").trim();
    const value = match?.[2]?.trim();
    return key && value && !known.has(key.replace(/[：:（）()\[\]【】\s_-]/g, "").toLowerCase()) ? [key, value] : null;
  }).filter(Boolean));
}

function sectionBody(source, names) {
  const candidates = [];
  names.forEach((name) => {
    let cursor = 0;
    while (true) {
      const at = source.indexOf(name, cursor);
      if (at < 0) break;
      const start = at + name.length;
      const end = headings.map((heading) => source.indexOf(heading, start)).filter((index) => index >= 0).sort((a, b) => a - b)[0];
      const body = source.slice(start, end == null ? source.length : end).trim();
      const dates = (body.match(new RegExp(monthRange.source, "g")) || []).length;
      candidates.push({ body, dates });
      cursor = start;
    }
  });
  return candidates.sort((a, b) => b.dates - a.dates || b.body.length - a.body.length)[0]?.body || "";
}

function parseExperienceRows(body, project = false) {
  const lines = body.replace(/[|｜]/g, "｜").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rows = [];
  // A detail line can be followed by a date in copied documents.  It is not
  // a new entry header; accepting it creates phantom project/work rows.
  const detailLine = (line) => /^(?:摘要|描述|项目描述|项目简介|项目内容|项目成果|职责|项目职责|项目中职责|工作职责|工作内容|工作描述|亮点|工作亮点|工作成果|业绩亮点|成果|负责|使用|基于|实现|参与|主导|github|ai使用)\s*[：:]/i.test(String(line || ""));
  const formLabel = (line) => /^(?:起止时间|就读时间|获奖时间|公司名称|单位名称|职位名称|工作职责|项目名称|项目描述|学校名称|专业名称|学历)$/i.test(String(line || "").replace(/[：:]\s*$/, ""));
  const likelyProjectHeader = (line) => !detailLine(line) && !formLabel(line) && !/^(?:\d+[.)、]|[•●▪◦*-])\s*/.test(String(line || ""));
  const starts = (index) => {
    const current = lines[index] || "";
    const currentDate = current.match(monthRange);
    const nextDate = (lines[index + 1] || "").match(monthRange);
    const nextNextDate = (lines[index + 2] || "").match(monthRange);
    const dateOnly = currentDate && !current.slice(0, currentDate.index).trim() && !current.slice(currentDate.index + currentDate[0].length).trim();
    const header = dateOnly ? "" : current;
    if (currentDate && index > 0 && !monthRange.test(lines[index - 1]) && lines[index - 1].includes("｜")) return false;
    return !!header && (currentDate || nextDate || nextNextDate) && (project ? likelyProjectHeader(header) : !detailLine(header) && !formLabel(header));
  };
  for (let i = 0; i < lines.length; i++) {
    if (!starts(i)) continue;
    const dateOnHeader = !!lines[i].match(monthRange);
    const dateLineIndex = dateOnHeader ? i : monthRange.test(lines[i + 1] || "") ? i + 1 : i + 2;
    const dateLine = lines[dateLineIndex] || "";
    const dateMatch = dateLine.match(monthRange);
    const dates = dateMatch?.[0] || "";
    const [start, end] = dateMatch?.slice(1, 3) || ["", ""];
    const headerText = dateOnHeader ? `${lines[i].slice(0, dateMatch.index)}${lines[i].slice(dateMatch.index + dates.length)}`.trim() : lines[i];
    const header = headerText.split("｜").map((part) => part.trim());
    if (project) header[0] = header[0].replace(/^(?:项目名称|项目)\s*[：:]\s*/i, "");
    else header[0] = header[0].replace(/^(?:公司名称|单位名称|企业名称|公司|单位)\s*[：:]\s*/i, "");
    const row = project
      ? { name: header[0], role: header.slice(1).join(" | "), start, end, description: "" }
      : (() => {
        const rest = header.slice(1).filter(Boolean);
        // Common resume form is “company｜title”; when a department is
        // present, the last role-like segment is the title and the prefix is
        // the department.  This keeps both two- and three-part headers usable.
        const roleIndex = rest.reduce((found, part, index) => /实习|开发|工程师|程序员|设计师|经理|主管|专员|职位|岗位|运营|测试|算法|产品/i.test(part) ? index : found, -1);
        const titleIndex = roleIndex >= 0 ? roleIndex : Math.max(0, rest.length - 1);
        return { company: header[0], department: rest.slice(0, titleIndex).join(" | "), title: rest[titleIndex] || "", workType: "", start, end, description: "", highlights: "" };
      })();
    if (!project) {
      const titleLine = dateOnHeader ? "" : dateLineIndex === i + 1
        ? lines[dateLineIndex].slice(0, lines[dateLineIndex].indexOf(dates)).replace(/[｜|]$/, "").trim()
        : lines[i + 1];
      const explicitTitle = titleLine.replace(/^(?:职位名称|任职职位|职位|岗位|职务)\s*[：:]\s*/i, "").trim();
      if (explicitTitle) row.title = explicitTitle;
      row.workType = /实习|intern/i.test(`${row.title} ${titleLine}`) ? "实习" : "";
    }
    const details = [];
    const summary = [];
    const responsibilities = [];
    let inResponsibilities = false;
    const outcomes = [];
    let inOutcomes = false;
    const highlights = [];
    let inHighlights = false;
    for (let j = dateLineIndex + 1; j < lines.length && !starts(j); j++) {
      const raw = lines[j];
      const heading = raw.replace(/^\*+|\*+$/g, "").replace(/&#x20;|&nbsp;/gi, " ").trim();
      if (!project && /^(?:亮点|工作亮点|工作成果|业绩亮点|工作成就|highlights?)[：:]/i.test(heading)) {
        inHighlights = true;
        highlights.push(heading);
        continue;
      }
      if (project && /^(?:职责|项目职责|核心职责)[：:]/.test(heading)) {
        inResponsibilities = true;
        inOutcomes = false;
        responsibilities.push(heading);
        continue;
      }
      if (project && /^项目成果[：:]/.test(heading)) {
        inOutcomes = true;
        const value = heading.replace(/^项目成果[：:]\s*/, "");
        if (value) outcomes.push(value);
        continue;
      }
      if (!project && inHighlights) highlights.push(raw);
      else if (project && inOutcomes) outcomes.push(raw);
      else {
        details.push(raw);
        if (project) (inResponsibilities ? responsibilities : summary).push(raw);
      }
    }
    row.description = details.join("\n").trim();
    if (project) {
      row.summary = summary.join("\n").trim();
      row.responsibilities = responsibilities.join("\n").trim();
      row.outcomes = outcomes.join("\n").trim();
    }
    if (!project) row.highlights = highlights.join("\n").trim();
    rows.push(row);
  }
  // Some resumes list internships or projects as numbered bullets without dates.
  // Keep every bullet as an entry instead of silently dropping the whole section.
  if (!rows.length) {
    const bullets = [];
    for (const line of lines) {
      const marker = line.match(/^(?:\d+[.)、]|[•●▪◦*-])\s*/);
      if (marker) bullets.push(line.slice(marker[0].length).trim());
      else if (bullets.length && !/^(?:职责|描述|亮点|成果)[：:]/.test(line)) bullets[bullets.length - 1] += `\n${line}`;
    }
    for (const description of bullets.filter(Boolean)) {
      rows.push(project
        ? { name: "", role: "", start: "", end: "", description, summary: description, responsibilities: "" }
        : { company: "", department: "", title: "", workType: /实习|intern/i.test(description) ? "实习" : "", start: "", end: "", description, highlights: "" });
    }
  }
  return rows;
}

function parseCadreRows(body) {
  return parseExperienceRows(body).map((row) => ({
    position: row.title || row.company || "",
    start: row.start || "",
    end: row.end || "",
    duty: row.description || row.highlights || ""
  })).filter((row) => row.position || row.duty);
}

function parseText(text) {
  if (!text.trim()) throw new Error("请先粘贴简历文本或读取当前文档。");
  // Keep JSON intact first; document viewers often use zero-width characters as line separators.
  const raw = String(text).replace(/[\u00a0]/g, " ").replace(/\\@/g, "@").replace(/&#x20;/g, " ").replace(/\ufeff/g, "");
  try { return cleanProfile(JSON.parse(raw)); } catch (_) { /* plain text */ }
  // Plain-text copies from document editors may include their fixed toolbar/status labels.
  const source = raw.replace(/添加图标|添加封面|表单填写[！!]?/g, "")
    .replace(/[\u4e00-\u9fa5]{2,8}\s*(?:今天|昨天|\d+\s*小时前)\s*修改/g, "")
    .replace(/[\u200b\u200c\u200d\u2060\u2028\u2029]/g, "\n");
  const lines = source.replace(/(教育经历|教育背景|工作经历|实习经历|项目经历|项目经验|学生干部经历|语言能力|竞赛\/获奖经历|个人评价)/g, "\n$1\n").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const formNoise = lines.filter((line) => /^(?:起止时间|就读时间|获奖时间|公司名称|单位名称|职位名称|工作职责|项目名称|项目描述|学校名称|专业名称|学历)$/.test(line)).length;
  if (formNoise >= 8 && (source.match(/起止时间/g) || []).length >= 2) throw new Error("当前内容看起来是招聘填写表单，不是简历文档；请切换到简历文档后再识别。");
  const p = emptyProfile();
  p.name = findValue(lines, aliases.name); p.phone = findValue(lines, aliases.phone);
  p.email = findValue(lines, aliases.email); p.gender = findValue(lines, aliases.gender);
  p.birthDate = findValue(lines, aliases.birthDate); p.age = findValue(lines, aliases.age); p.nationality = findValue(lines, aliases.nationality);
  p.countryRegion = findValue(lines, aliases.countryRegion);
  p.politicalStatus = findValue(lines, aliases.politicalStatus);
  p.wechat = findValue(lines, aliases.wechat); p.nativePlace = findValue(lines, aliases.nativePlace);
  p.currentResidence = findValue(lines, aliases.currentResidence);
  p.workExperience = findValue(lines, aliases.workExperience);
  p.customFields = customFieldsFromLines(lines);
  p.jobIntent.city = findValue(lines, aliases.city); p.jobIntent.arrival = findValue(lines, aliases.arrival);
  p.jobIntent.expectedSalary = findValue(lines, aliases.expectedSalary);
  p.jobIntent.currentSalary = findValue(lines, aliases.currentSalary);
  p.jobIntent.industry = findValue(lines, aliases.industry); p.jobIntent.occupation = findValue(lines, aliases.occupation);
  if (!p.name) p.name = source.match(/([\u4e00-\u9fa5]{2,4})\s+(?:今天|昨天|\d+\s*小时前)\s*修改/)?.[1] || "";
  p.phone = p.phone || source.match(/(?:手机号|手机|电话)\s*[：:]?\s*(1\d{10})/)?.[1] || "";
  p.email = p.email || source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";

  const educationBody = sectionBody(source, ["教育经历", "教育背景"]);
  const educationDate = educationBody.match(monthRange);
  if (educationDate || educationBody) {
    const before = educationBody.slice(0, educationDate?.index ?? educationBody.length).replace(/[|｜]/g, "\n").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const educationLines = educationBody.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const schoolValue = findValue(educationLines, ["学校", "学校名称", "院校", "院校名称", "毕业院校", "就读院校"]);
    const collegeValue = findValue(educationLines, ["学院", "学院名称", "院系", "所属学院"]);
    const majorValue = findValue(educationLines, ["专业", "专业名称", "所学专业", "就读专业", "主修专业"]);
    const degreeValue = findValue(educationLines, ["学历", "学位", "最高学历", "教育程度"]);
    const studentId = findValue(educationLines, ["学号"]);
    const startValue = findValue(educationLines, ["就读日期", "入学日期", "开始时间"]);
    const endValue = findValue(educationLines, ["毕业日期", "结束时间"]);
    const dateParts = educationDate?.[0].match(monthRange)?.slice(1, 3) || [];
    const school = schoolValue || before.find((line) => /大学|学院/.test(line)) || "";
    const majorLine = before.find((line) => line.includes("|") && /计算机|软件|信息|技术|工程|专业/.test(line)) || "";
    const parts = majorLine.split(/[|｜]/).map((part) => part.trim()).filter(Boolean);
    const degreePattern = /本科|硕士|博士|大专|专科|学士|研究生/;
    const major = majorValue || parts.filter((part) => !degreePattern.test(part)).at(-1) || [...before].reverse().find((line) => line !== school && !degreePattern.test(line) && !/排名|GPA/.test(line)) || "";
    const college = collegeValue || (parts.length > 1 ? parts[0] : "");
    const gpaText = educationBody.match(/GPA\s*[：:]?\s*([^\n]+)/i)?.[1]?.trim() || "";
    const rank = educationBody.match(/(?:专业排名|排名)\s*[：:]?\s*([^\n]+)/)?.[1]?.trim() || gpaText.match(/\/\s*(\d+(?:\.\d+)?%)/)?.[1] || "";
    p.education.push({ school: school.replace(/^学校[：:]\s*/, "").replace(/\s*(计算机学院|软件学院|信息学院)$/, ""), college, major, degree: degreeValue || before.find((line) => /本科|硕士|博士|大专/.test(line))?.replace(/^(?:学历|学位)[：:]\s*/, "") || "", studentId, start: startValue || dateParts[0] || "", end: endValue || dateParts[1] || "", gpa: gpaText, rank, training: findValue(educationLines, ["培养方式", "学习形式", "学习方式", "就读方式", "学历类型", "受教育类型"]) });
  }
  p.work = parseExperienceRows(sectionBody(source, ["工作经历"]));
  p.internships = parseExperienceRows(sectionBody(source, ["实习经历"]));
  const embeddedInternships = p.work.filter((row) => /实习|intern/i.test(`${row.workType || ""} ${row.title || ""}`));
  p.work = p.work.filter((row) => !embeddedInternships.includes(row));
  p.internships.push(...embeddedInternships);
  if (!p.work.length && !p.internships.length) {
    const fallbackRows = parseExperienceRows(sectionBody(source, ["实习经历", "工作经历"]));
    p.internships = fallbackRows.filter((row) => /实习|intern/i.test(`${row.workType || ""} ${row.title || ""}`));
    p.work = fallbackRows.filter((row) => !p.internships.includes(row));
  }
  p.projects = parseExperienceRows(sectionBody(source, ["项目经历", "项目经验"]), true);
  p.awards = awardsFromText(sectionBody(source, ["竞赛/获奖经历"]));
  p.extras.languages = sectionBody(source, ["语言能力"]);
  p.certificates = certificatesFromLanguages(p.extras.languages);
  p.extras.awards = sectionBody(source, ["竞赛/获奖经历"]);
  p.extras.studentCadres = sectionBody(source, ["学生干部经历"]);
  p.cadres = parseCadreRows(p.extras.studentCadres);
  p.extras.selfEvaluation = sectionBody(source, ["个人评价"]).split(/识别的与以下保存|保存的内容存在/)[0].trim();
  p.extras.skills = [...new Set((p.extras.selfEvaluation.match(/Vue3|React|TypeScript|JavaScript|微信小程序|uni-app|Node\.js|LangChain|Pinia|WebSocket|Vite/g) || []))].join("、");
  p.skills = skillsFromText(p.extras.skills);
  return cleanProfile(p);
}

function show(profile) { $("preview").textContent = JSON.stringify(profile, null, 2); }
function renderStatus(target, data = {}) {
  data ||= {};
  const status = $(target) || $("status");
  status.textContent = data.value || "";
  status.className = data.variant || (data.value ? data.error ? "error" : "success" : "");
  status.style.color = data.error ? "#b42318" : "#15803d";
  return status;
}
function message(value, error = false, target = "status", variant = "") {
  const status = renderStatus(target, { value, error, variant });
  if (status.id !== "status") { $("status").textContent = ""; $("status").className = ""; }
  chrome.storage.local.set({ lastStatus: value, lastStatusError: error, lastStatusTarget: status.id, lastStatusVariant: status.className });
}
async function activeTab() { return (await chrome.tabs.query({ active: true, currentWindow: true }))[0]; }
const CONTENT_MESSAGE_SUFFIX = "_V100";
const contentMessage = (message) => ({ ...message, type: `${message.type}${CONTENT_MESSAGE_SUFFIX}` });
const injectCurrentContent = (tabId) => {
  if (!chrome.scripting?.executeScript) throw new Error("扩展权限尚未更新，请在 chrome://extensions 重载扩展后重试。");
  return chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ["content.js"] });
};
const isWebPage = (url) => /^https?:\/\//i.test(url || "");
const proxyUrl = "http://127.0.0.1:8787";
function responseOrThrow(result) { if (result?.error) throw new Error(result.error); return result; }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function fieldLabel(field) {
  const parts = String(field?.label || field?.ariaLabel || field?.placeholder || field?.name || "").split(/\s+/)
    .map((item) => item.trim()).filter((item) => item && item !== "请选择");
  return ([...new Set(parts)][0] || "").replace(/[＊*]/g, "").replace(/^(?:请选择|请输入|请填写)(?:您的?|你(?:的)?)?/, "");
}
function missingFieldLabels(missingFields, fields) {
  const pageLabels = (fields || []).map(fieldLabel).filter(Boolean);
  return [...new Set(missingFields || [])].reduce((result, label) => {
    const onPage = pageLabels.some((pageLabel) => pageLabel === label || pageLabel.includes(label) || label.includes(pageLabel));
    result[onPage ? "unresolved" : "unavailable"].push(label);
    return result;
  }, { unresolved: [], unavailable: [] });
}
const combinedExperience = (title) => /工作\s*(?:[\/／、]|与|及|和)\s*实习|实习\s*(?:[\/／、]|与|及|和)\s*工作/.test(title || "");
function uniqueEmptyFields(fields) {
  const seen = new Set();
  return (fields || []).filter(Boolean).filter((field) => {
    if (field.currentValue) return false;
    const label = fieldLabel(field);
    if (field.type === "checkbox" && /至今|现在|在职|没有|无.*(?:经历|经验|成果)|承诺|认同|同意|已阅读/.test(label)) return false;
    // Navigation/search controls are editable page chrome, not application fields.
    if (!label || /^(?:首页|home|搜索|search|登录|login|搜索(?:职位|岗位|工作)?关键词|(?:职位|岗位|工作)关键词)$/i.test(label)) return false;
    const key = field.key || [field.module || "page", field.repeatIndex ?? "", label || field.index].join("::");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function aiFieldContext(field, profile) {
  const sources = profileSources(field, profile || {});
  if ((field.rowAnchor?.value || field.rowAnchors?.length) && !sources.length) return {};
  const boundIndex = (field.rowAnchor?.value || field.rowAnchors?.length) && sources.map(source => source.path.match(/^(?:experiences|internships|work|education)\[(\d+)\]/)?.[1]).find(value => value != null);
  const index = boundIndex == null || boundIndex === false || boundIndex === '' ? Math.max(0, Number(field?.repeatIndex) || 0, Number(field?.occurrence) || 0) : Number(boundIndex);
  const all = profile?.experiences?.length ? profile.experiences : [...(profile?.internships || []), ...(profile?.work || [])];
  const module = String(field?.module || "");
  const label = fieldLabel(field);
  const personalLocation = /家庭|家乡|籍贯|户籍|户口|居住|现居|所处地|所在(?:地|地点|地区)?/.test(label) && !/(?:工作|期望|任职|办公)/.test(`${module} ${label}`);
  const personalSource = /^(?:出生(?:日期|年月)(?:[（(]年龄[）)])?|生日|birthday)$/i.test(label) ? profile?.birthDate
    : /^(?:民族|民族类别|民族名称)$/.test(label) ? profile?.nationality
    : /家庭|家乡|籍贯/.test(label) ? profile?.nativePlace || profile?.householdRegistration
    : /户籍|户口/.test(label) ? profile?.householdRegistration
      : /居住|现居|所处地|所在(?:地|地点|地区)?/.test(label) ? profile?.currentResidence
        : /^(?:(?:国籍|国家)(?:[\/／或（(]?地区[）)]?)?|country(?:[\/\s]*region)?)$/i.test(label) ? profile?.countryRegion : "";
  const combined = combinedExperience(module);
  const rows = combined ? all : /实习/.test(module) ? (profile?.internships?.length ? profile.internships : all) : /工作/.test(module) ? (profile?.separateInternships ? profile.work || [] : profile?.work?.length ? profile.work : all) : /工作地点|月薪|职位名称|所在部门|工作性质/.test(label) ? all : [];
  const educationKey = /排名/.test(label) ? "rank" : /^(?:最高学历|学历|学位)$/.test(label) ? 'degree' : /专业/.test(label) ? "major" : /学院|院系/.test(label) ? "college" : /学校|院校/.test(label) ? "school" : /公司|企业|单位/.test(label) ? "company" : "";
  const educationSource = educationKey && /教育|学历|工作|实习|任职|毕业/.test(`${module} ${label}`) ? sources.find(source => source.path.endsWith(`.${educationKey}`))?.value : "";
  const educationType = /学历类型|受教育类型|培养方式|学习形式|学习方式|就读方式/.test(label) ? sources.find(source => /\.training$/.test(source.path))?.value : "";
  const skillProficiency = /技能|计算机能力/.test(`${module} ${label}`) && /掌握程度|熟练程度|技能水平|熟练度|能力等级/.test(label) ? sources.find(source => /\.proficiency$/.test(source.path))?.value : "";
  const languageProficiency = /语言|外语/.test(module) && /掌握程度|熟练程度|精通程度|语言水平|等级自评|听说|读写/.test(label) ? sources.find(source => /\.(?:proficiency|speaking|reading)$/.test(source.path))?.value : "";
  const examSources = /^(?:语言考试|外语等级|考试分数|英语等级|语言类型|语言类别|外语类别)[＊*]?$/.test(label) ? sources : [];
  const languageSource = /^(?:语言|语言类型|语言类别|外语类别|语言名称|语种)[＊*]?$/.test(label) ? sources.find(source => /\.language$/.test(source.path))?.value : "";
  const examSource = examSources.length === 1 ? examSources[0].value : "";
  const awardSource = /获奖类型|奖励类型|奖项(?:类别|类型)/.test(label) ? (sources.find(source => /\.name$/.test(source.path) && /奖学金/.test(source.value))
    || sources.find(source => /\.(?:type|category)$/.test(source.path)) || sources.find(source => /\.name$/.test(source.path)))?.value : "";
  const awardLevelSource = /(?:获奖|奖励|奖项|大赛|比赛|竞赛)(?:级别|等级)/.test(label) ? sources.find(source => /\.level$/.test(source.path))?.value : "";
  const awardName = /荣誉名称|获奖大赛|竞赛名称/.test(label) ? sources.find(source => /\.name$/.test(source.path))?.value : "";
  const certificateNames = label === '证书名称' ? sources.filter(source => /^certificates\[\d+\]\.name$/.test(source.path)) : [];
  const certificateName = certificateNames.length === 1 ? certificateNames[0].value : '';
  const customSource = sources.find(source => source.path === `customFields[${JSON.stringify(label.replace(/[＊*]/g, ""))}]`)?.value;
  const derivedSource = sources.length === 1 && sources[0].path.startsWith("derived.") ? sources[0].value : "";
  const intentField = /求职意向|期望|目标职位类别|现月薪|工作城市|行业|职业|到岗/.test(`${module} ${label}`);
  const sourceValue = isAnnualSalaryField(field) ? sources[0]?.value
    : /(?:学校|院校)(?:所在)?(?:城市|地区)|就读地|学校所在地|院校所在地/.test(label) ? sources.find(({ path }) => /\.(?:location|studyLocation|currentLocation)$/.test(path))?.value
    : /期望从事行业|期望行业|意向行业/.test(label) ? profile?.jobIntent?.industry
    : /期望从事职业|期望职业|意向职位|目标职位类别/.test(label) ? profile?.jobIntent?.occupation
      : /期望月薪|期望薪资|期望待遇/.test(label) ? profile?.jobIntent?.expectedSalary
        : /期望工作城市|目标工作城市|期望城市|意向城市|期望工作地点|期望地点/.test(label) ? profile?.jobIntent?.city
        : /工作地点|办公地点|工作地区|办公城市|任职地点/.test(label) ? rows[index]?.location : customSource || educationType || educationSource || skillProficiency || languageProficiency || languageSource || examSource || personalSource || awardLevelSource || awardSource || awardName || certificateName || derivedSource || (label === "项目成果" ? sources[0]?.value : "");
  const locationCandidates = personalLocation ? [
    ["nativePlace", "籍贯", profile?.nativePlace], ["currentResidence", "现居住地", profile?.currentResidence], ["householdRegistration", "户口所在地", profile?.householdRegistration]
  ].filter(([, , value]) => String(value || "").trim()).map(([key, label, value]) => ({ key, label, value: String(value).trim() })) : [];
  return { ...(intentField ? { jobIntent: profile?.jobIntent || {} } : {}), ...(rows.length && Number.isInteger(index) ? { experience: rows[index] || null } : {}), ...(sourceValue ? { sourceValue: String(sourceValue) } : {}), ...(locationCandidates.length ? { locationCandidates } : {}) };
}
const locationSearchHint = (field, profile) => {
  const context = aiFieldContext(field, profile); const source = String(context.sourceValue || "");
  if (!/(?:省|自治区|特别行政区)$/.test(source)) return source;
  const company = String(context.experience?.company || "");
  return company.match(/^([\u4e00-\u9fff]{2,6}市)/)?.[1] || company.match(/^([\u4e00-\u9fff]{2})/)?.[1] || source;
};
const fieldsWithLiveOptions = (fields) => (fields || []).filter(Boolean).filter((field) => field.options?.length);
const semanticTextField = (field) => !field.isChoice && /^(?:text|textarea|email|tel|url|number|date|month|contenteditable)$/.test(field.type || "");
const programmingLanguageField = field => /^(?:开发语言|编程语言|程序设计语言|计算机语言)$/.test(fieldLabel(field));
const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const programmingOptionMentioned = (option, sources) => !!option && sources.some(source => new RegExp(`(?:^|[^A-Za-z0-9_])${escapeRegExp(option)}(?![A-Za-z0-9_+#])`, "i").test(source.value));
const awardRank = value => ({ '院级': 0, '学院级': 0, '院系级': 0, '系级': 0, '班级': 0, '校级': 1, '学校级': 1,
  '市级': 2, '地市级': 2, '省级': 3, '省市级': 3, '省区级': 3, '省部级': 3, '国家级': 4, '全国级': 4, '国际级': 5 })[String(value || '').trim()] ?? -1;
const awardMinimum = field => {
  const hints = [field.label, field.ariaLabel, field.placeholder, field.title, ...(field.labels || [])].filter(Boolean).join(' ').replace(/[\s（）()＊*]/g, '');
  return awardRank(hints.match(/((?:院|校|市|省|国家|国际)级)(?:及|含)?以上/)?.[1]);
};
// ponytail: explicit contest/cup names or saved type suffice; ambiguous names need a supplied type.
const competitionAward = item => !/奖学金/.test(item?.name || "") && /竞赛|大赛|比赛|杯/.test(`${item?.type || ""} ${item?.category || ""} ${item?.name || ""}`);
const awardModule = title => /竞赛|大赛|比赛/.test(title) ? /荣誉|奖励|奖学金|评奖|评优|表彰/.test(title) ? "获奖经历" : "竞赛"
  : /荣誉|奖励|奖学金|评奖|评优|表彰/.test(title) ? "荣誉" : "获奖经历";
function profileSources(field, profile, ignoreAwardMinimum = false) {
  const module = field.module || "";
  const label = fieldLabel(field).replace(/[＊*]/g, "");
  if (/password|api.?key|token|密码|验证码|密钥|令牌/i.test([field.label,field.ariaLabel,field.placeholder,field.name,field.id].filter(Boolean).join(' '))) return [];
  if (/^(?:请选择|请输入|请填写|选择日期)$/.test(label) && !field.autocomplete && !['email','tel'].includes(field.type)) return [];
  const researchKey = /论文|发表文章/.test(label) ? /\.(?:paper|papers|publication|publications)$/ : /实验室/.test(label) ? /\.(?:lab|laboratory)$/ : /研究方向|领域方向/.test(label) ? /\.(?:research|researchDirection)$/ : null;
  const explicitOnly = /AI\s*(?:应用|工具|协作)|工具.*模型|模型.*(?:名称|版本)/i.test(`${module} ${label}`);
  const explicit = Object.entries(profile.customFields || {}).filter(([key, value]) => !/password|api.?key|token|密码|验证码/i.test(key) && choiceToken(key) === choiceToken(label) && String(value || '').trim())
    .map(([key, value]) => ({path:`customFields[${JSON.stringify(key)}]`,value:String(value)}));
  if (/^(?:出生(?:日期|年月)(?:[（(]年龄[）)])?|生日|birthday)$/i.test(label)) return explicit.length ? explicit
    : profile.birthDate ? [{path:'birthDate',value:String(profile.birthDate)}] : [];
  if (/^(?:证件(?:号码|号)|身份证(?:号码|号))$/.test(label)) return explicit.length ? explicit
    : profile.customFields?.证件号码 ? [{path:'customFields["证件号码"]',value:String(profile.customFields.证件号码)}] : [];
  if (researchKey && explicit.length) return explicit;
  if (explicitOnly) {
    if (explicit.length) return explicit;
    const aiEvidence = /\bAI\b|人工智能|智能体|大模型|\b(?:Codex|Cursor|Copilot|Trae|ChatGPT|Claude|DeepSeek|Coze|LLM)\b/i;
    const projects = (profile.projects || []).map((item,index)=>({item,index})).filter(({item}) => aiEvidence.test([item.name,item.role,item.description,item.responsibilities].filter(Boolean).join(' ')));
    if (/链接|网址/.test(label)) return projects.filter(({item})=>item.link).map(({item,index})=>({path:`projects[${index}].link`,value:String(item.link)}));
    if (/协作|项目|任务/.test(label)) {
      const value = projects.map(({item})=>[['项目',item.name],['角色',item.role],['描述',item.description],['职责',item.responsibilities],['链接',item.link]]
        .filter(([,value])=>value).map(([title,value])=>`${title}：${value}`).join('\n')).filter(Boolean).join('\n\n');
      return value ? [{path:'derived.aiProjects',value}] : [];
    }
    const toolEvidence = /AI.*(?:工具|模型)|大模型|\b(?:Codex|Cursor|Copilot|Trae|ChatGPT|Claude|DeepSeek|Coze|GPT-\d|LLM)\b/i;
    const texts = [profile.extras?.skills,profile.extras?.selfEvaluation,...(profile.skills || []).map(item=>item.description || item.name),...projects.map(({item})=>item.description)];
    const sentences = [...new Set(texts.filter(Boolean).flatMap(text=>String(text).split(/\n|(?<=[。！？；])/)).map(text=>text.trim())
      .filter(text=>toolEvidence.test(text) && !/password|api.?key|token|密码|验证码|密钥|令牌/i.test(text)))];
    return sentences.length ? [{path:'derived.aiTools',value:sentences.join('\n')}] : [];
  }
  if (programmingLanguageField(field) && !field.rowAnchor && !field.rowAnchors?.length) {
    if (explicit.length) return explicit;
    const sources = (profile.skills || []).flatMap((item,index)=>['name','description'].filter(key=>item[key]).map(key=>({path:`skills[${index}].${key}`,value:String(item[key])})));
    if (profile.extras?.skills) sources.push({path:'extras["skills"]',value:String(profile.extras.skills)});
    return sources;
  }
  if (/^(?:当前所处地|目前所在地|当前所在地|现居住地)$/.test(label)
    || /^(?:当前居住地|(?:当前|目前|现)?居住(?:城市|省[\/／]市)|现居地|居住地|所在地|所在地点)$/.test(label) && !/教育|学校|工作|实习|项目|任职/.test(module)) return explicit.length ? explicit
    : profile.currentResidence ? [{path:'currentResidence',value:String(profile.currentResidence)}] : [];
  if (/^(?:奖学金类型|奖学金类别)$/.test(label)) {
    const explicit = profile.customFields?.[label];
    if (String(explicit || '').trim()) return [{ path: `customFields[${JSON.stringify(label)}]`, value: String(explicit) }];
    return (profile.awards || []).flatMap((item, index) => /奖学金/.test(item.name || '')
      ? ['name', 'level'].filter(key => item[key]).map(key => ({ path: `awards[${index}].${key}`, value: String(item[key]) })) : []);
  }
  if (/^(?:是否通过(?:大学)?英语四级|是否通过CET-?4)$/i.test(label)) {
    if (explicit.length) return explicit;
    const exams = (profile.certificates || []).filter(item => /CET\s*-?\s*4(?!\d)|(?:大学)?英语四级/i.test(item.name || '') && !/口语|SET/i.test(item.name || ''));
    const results = exams.map(item => {
      const status = String(item.result || item.status || '').trim();
      if (/^(?:通过|合格|是)$/.test(status)) return true;
      if (/^(?:未通过|不合格|否)$/.test(status)) return false;
      return /^\d+(?:\.\d+)?$/.test(String(item.score ?? '')) && Number(item.score) >= 0 && Number(item.score) <= 710 ? Number(item.score) >= 425 : null;
    });
    const passed = results.includes(true), failed = results.length && results.every(result => result === false);
    return passed || failed ? [{path:'derived.cet4Passed',value:passed ? '是' : '否'}] : [];
  }
  if (/^(?:应届[\/／]?往届|应往届|毕业生类型|是否应届(?:毕业生)?)$/.test(label)) {
    if (explicit.length) return explicit;
    const status = String(profile.workExperience || '').trim().match(/^(应届|往届)(?:生|毕业生)?$/)?.[1];
    return status ? [{path:'derived.graduateStatus',value:/^是否/.test(label) ? status === '应届' ? '是' : '否' : status}] : [];
  }
  const educationDetail = !/教育|学历/.test(module) && (/^(?:毕业时间|毕业日期|毕业年月|毕业年份)$/.test(label) ? 'end' : /^(?:学习形式|学习方式|就读方式|培养方式|学历类型|受教育类型)$/.test(label) ? 'training' : '');
  const graduationKey = educationDetail || ({ '最高学历': 'degree', '毕业学校': 'school', '毕业院校': 'school', '毕业学院': 'college', '毕业院系': 'college', '毕业学校专业': 'major', '毕业专业': 'major', '最高学历学校': 'school', '最高学历专业': 'major', '最高学历毕业日期': 'end', '预计毕业时间': 'end' })[label];
  if (graduationKey) {
    const rank = value => /博士/.test(value) ? 6 : /硕士|mba/i.test(value) ? 5 : /本科|学士/.test(value) ? 4 : /大专|专科/.test(value) ? 3 : /中专|高中/.test(value) ? 2 : /初中/.test(value) ? 1 : 0;
    const rows = (profile.education || []).map((item, index) => ({ item, index, rank: rank(item.degree || '') }));
    const highest = Math.max(0, ...rows.map(row => row.rank));
    const matches = rows.filter(row => row.rank > 0 && row.rank === highest);
    return matches.length === 1 && matches[0].item[graduationKey] ? [{ path: `education[${matches[0].index}].${graduationKey}`, value: String(matches[0].item[graduationKey]) }] : [];
  }
  if (field.type === "checkbox" && /至今|现在|在职|没有|无.*(?:经历|经验|成果)|承诺|认同|同意|已阅读/.test(label)) return [];
  const personHints = [module, label, field.ariaLabel, field.placeholder, field.name, field.id].filter(Boolean).join(" ");
  const otherPerson = /证明人|联系人|推荐人|家属|监护人|父亲|母亲|导师|辅导员/;
  if (otherPerson.test(personHints)) {
    const hints = [label, field.ariaLabel, field.placeholder?.replace(/^(?:请输入|请填写)/, ""), `${module}${label}`].filter(Boolean).map(choiceToken);
    return Object.entries(profile.customFields || {}).filter(([key, value]) => otherPerson.test(key) && hints.includes(choiceToken(key)) && String(value || "").trim())
      .map(([key, value]) => ({ path: `customFields[${JSON.stringify(key)}]`, value: String(value) }));
  }
  // Name spellings come from the local dictionary or an explicit override.
  if (/拼音|pinyin|英文(?:姓|名)|(?:english|first|last|given|family)[\s_-]*name/i.test([label, field.autocomplete, field.id, field.name, field.ariaLabel, field.placeholder].join(" ")) || /^(?:姓|名|姓氏)$/.test(label)) {
    return Object.entries(profile.customFields || {}).filter(([key, value]) => [label, field.id, field.name].filter(Boolean).some(hint => choiceToken(key) === choiceToken(hint)) && String(value || "").trim())
      .map(([key, value]) => ({ path: `customFields[${JSON.stringify(key)}]`, value: String(value) }));
  }
  const englishExam = (item) => /(?:CET\s*-?\s*[46]|大学英语[四六]级|英语[四六]级|TEM\s*-?\s*[48]|IELTS|TOEFL|雅思|托福)/i.test(String(item?.name || ""));
  const exams = (profile.certificates || []).map((item, index) => ({ item, index })).filter(({ item }) => englishExam(item));
  if (/^(?:相关证书|语言证书)$/.test(label) && /语言|外语/.test(module)) {
    const language = field.rowAnchor?.value || field.languageValue;
    return /^(?:英语|english)$/i.test(language || '') ? exams.flatMap(({ item, index }) => [['name', item.name], ['score', item.score]].filter(([, value]) => String(value || '').trim()).map(([key, value]) => ({ path: `certificates[${index}].${key}`, value: String(value) }))) : [];
  }
  if (/^(?:语言考试|英语等级|外语等级|考试分数)$/.test(label)) {
    if (field.languageValue && !/英语|english/i.test(field.languageValue)) return [];
    const examToken = value => String(value || "").match(/(?:CET|TEM)\s*-?\s*([468])/i)?.[0].replace(/[\s-]/g, "").toLowerCase() || choiceToken(value);
    const selected = field.examValue ? exams.filter(({ item }) => examToken(item.name) === examToken(field.examValue)) : [];
    if (/外语等级|考试分数/.test(label)) return selected.length === 1 && selected[0].item.score
      ? [{ path: `certificates[${selected[0].index}].score`, value: String(selected[0].item.score) }] : [];
    const eligible = field.examScoreValue ? exams.filter(({ item }) => String(item.score || "").trim() === String(field.examScoreValue).trim()) : exams;
    return field.examScoreValue && eligible.length !== 1 ? [] : eligible.map(({ item, index }) => ({ path: `certificates[${index}].name`, value: item.name }));
  }
  if (/^(?:语言类型|语言类别|外语类别)$/.test(label) && !/语言|外语/.test(module)) {
    const languages = (profile.languages || []).map((item, index) => ({ path: `languages[${index}].language`, value: item.language })).filter(source => source.value);
    return languages.length ? languages : exams.length ? [{ path: "derived.languageType", value: "英语" }] : [];
  }
  const combined = combinedExperience(module);
  const narrative = !researchKey && (field.narrative || field.type === "textarea" && !field.rowAnchor && /经历|经验|竞赛|大赛|奖励|荣誉|奖学金|研究成果|其[它他]语言.*证书/.test(label));
  const context = /(?:学校|院校)(?:所在)?(?:城市|地区)|就读地|学校所在地|院校所在地/.test(label) ? "教育经历"
    : narrative && /实习|工作|项目|获奖|竞赛|大赛|奖励|荣誉|奖学金|其[它他]语言.*证书/.test(label) ? label
    : /教育|学历|实习|工作|任职|项目|获奖|奖励|竞赛|大赛|比赛|荣誉|奖学金|证书|英语|语言|外语|技能|干部|社团|校园经历|在校实践|校内实践/.test(module) ? module : narrative ? label : module;
  const group = combined ? "experiences" : /教育|学历/.test(context) ? "education" : /实习/.test(context) ? "internships"
    : /工作|任职/.test(context) ? (!profile.separateInternships && profile.experiences?.length ? "experiences" : "work") : /项目/.test(context) ? "projects"
      : /获奖|奖励|竞赛|大赛|比赛|荣誉|奖学金/.test(context) ? "awards" : /证书|英语/.test(context) ? "certificates"
        : /语言|外语/.test(context) ? "languages" : /技能|计算机能力/.test(context) ? "skills" : /干部|社团|校园经历|在校实践|校内实践/.test(context) ? "cadres" : "";
  const sourceRows = combined && !profile.experiences?.length ? [...(profile.internships || []), ...(profile.work || [])] : profile[group] || [];
  const awardSection = awardModule(narrative ? label : module || label);
  const groupRows = sourceRows.map((item, index) => ({ item, index })).filter(({ item }) =>
    group === "awards" ? awardSection === "竞赛" ? competitionAward(item) : awardSection === "荣誉" ? !competitionAward(item) : true
      : group !== "certificates" || !profile.separateEnglishCertificates || (/英语|英语能力/.test(module) === englishExam(item)));
  if (narrative && group) {
    const minimum = ignoreAwardMinimum ? -1 : awardMinimum(field);
    const rows = groupRows.filter(({ item }) => group === "awards" && /奖学金/.test(label) ? /奖学金/.test(item.name || "")
      : group === "certificates" && /其[它他]语言/.test(label) ? !englishExam(item) : true)
      .filter(({ item }) => group !== 'awards' || minimum < 0 || awardRank(item.level) >= minimum);
    const value = rows.map(({ item }) => {
      const header = [item.start && [item.start, item.end].filter(Boolean).join(" ~ "), item.date, item.company, item.name, item.title, item.role, item.position].filter(Boolean).join(" | ");
      const details = [["职责", item.responsibilities || item.duty], ["描述", item.description || item.summary], ["成果", item.outcomes], ["亮点", item.highlights], ["级别", item.level], ["成绩", item.score]].filter(([, value]) => value).map(([key, value]) => `${key}：${value}`);
      return [header, ...details].filter(Boolean).join("\n");
    }).filter(Boolean).join("\n\n");
    return value ? [{ path: `derived.${group}`, value }] : [];
  }
  let row = Math.max(0, Number(field.repeatIndex) || 0);
  const anchorKey = group === "education" ? "school" : /work|internships|experiences/.test(group) ? "company" : group === "cadres" ? "position" : group === "languages" ? "language" : "name";
  const recordMatches = (value, index, partial = field.rowAnchor?.choice) => {
    const description = /^(?:certificates|awards)$/.test(group) && field.rowDescriptions?.[index];
    return groupRows.flatMap(({ item }, sourceIndex) => {
      const match = (!value || /^(?:其他|其它)$/.test(value)) && description
        ? String(item.description || '').replace(/\s+/g, ' ').trim() === description
        : !!value && (choiceToken(item[anchorKey]) === choiceToken(value)
          || group === 'languages' && languageCategoryCandidate(item.language, [value], '语言') === value
          || group === 'awards' && partial && choiceToken(value).length >= 4 && choiceToken(item[anchorKey]).includes(choiceToken(value)));
      return match ? [sourceIndex] : [];
    });
  };
  if (group && (field.rowAnchor?.value || /^(?:certificates|awards)$/.test(group) && field.rowDescriptions?.[row])) {
    const matches = recordMatches(field.rowAnchor?.value, row);
    if (matches.length !== 1 || field.rowAnchors?.filter((value, index) => recordMatches(value, index).includes(matches[0])).length > 1) return [];
    row = matches[0];
  } else if (group && field.rowAnchors?.length) {
    const reserved = new Set(field.rowAnchors.flatMap((value, index) => recordMatches(value, index, true)));
    const remaining = groupRows.map(({item}, index) => ({item,index})).filter(({index}) => !reserved.has(index));
    const blankIndex = field.rowAnchors.slice(0, row + 1).filter((value, index) => !value && !(/^(?:certificates|awards)$/.test(group) && field.rowDescriptions?.[index])).length - 1;
    if (!remaining[blankIndex]) return [];
    row = remaining[blankIndex].index;
  }
  const sources = [];
  if (group === 'languages' && field.languageValue && !languageCategoryCandidate(groupRows[row]?.item?.language, [field.languageValue], '语言')) return [];
  const add = (path, value) => { if (!/password|api.?key|token|密码|验证码/i.test(path) && (typeof value === "string" || typeof value === "number") && String(value).trim()) sources.push({ path, value: String(value) }); };
  if (group) Object.entries(groupRows[row]?.item || {}).forEach(([key, value]) => add(`${group}[${groupRows[row].index}].${key}`, value));
  else {
    for (const key of ["name", "gender", "phone", "email", "birthDate", "age", "nationality", "countryRegion", "politicalStatus", "nativePlace", "householdRegistration", "currentResidence", "wechat", "workExperience"] ) add(key, profile[key]);
    for (const root of ["jobIntent", "extras", "customFields"]) Object.entries(profile[root] || {}).forEach(([key, value]) => add(`${root}[${JSON.stringify(key)}]`, value));
  }
  if (isAnnualSalaryField(field) && ['experiences','work','internships'].includes(group)) {
    const annual = sources.filter(({path}) => /\.(?:annualSalary|yearlySalary)$/.test(path));
    if (annual.length) return new Set(annual.map(source => source.value)).size === 1 && !annual.some(source => /美元|欧元|港币|英镑|日元|USD|EUR|HKD|GBP|JPY|\$/i.test(source.value)) ? [annual[0]] : [];
    const source = sources.find(({path}) => /\.salary$/.test(path));
    if (!source || /日薪|时薪|周薪|每(?:天|日|小时|周)|[\/／]\s*(?:天|日|时|小时|周)|daily|hourly|weekly|per\s*(?:day|hour|week)|美元|欧元|港币|英镑|日元|USD|EUR|HKD|GBP|JPY|\$/i.test(source.value)) return [];
    const months = Number(source.value.match(/(\d{1,2})\s*薪/)?.[1] || 12);
    const range = salaryRange(source.value.replace(/\d{1,2}\s*薪/, ''));
    const factor = /年|annual|year/i.test(source.value) ? 1 : months;
    return range && range[0] >= 0 && Number.isFinite(range[1]) && range[1] >= range[0] && months >= 1 && months <= 24
      ? [{path:`derived.${group}[${groupRows[row].index}].annualSalary`,value:range.map(amount => Math.round(amount * factor * 100) / 100).filter((amount,index,all) => !index || amount !== all[0]).join('-')+'元/年'}] : [];
  }
  if (group === "cadres" && /校园经历名称/.test(label)) return sources.filter(({ path }) => /\.(?:name|organization|activity)$/.test(path));
  if (researchKey) return sources.filter(({path}) => researchKey.test(path));
  if (group === "education" && /^(?:学校|院校|学校名称|学校全称|院校名称|就读学校)$/.test(label)) return sources.filter(({ path }) => /\.school$/.test(path));
  if (group === "education" && /^(?:学院|院系|学院名称)$/.test(label)) return sources.filter(({ path }) => /\.college$/.test(path));
  if (group === "education" && /^(?:专业|专业名称|所学专业)$/.test(label)) return sources.filter(({ path }) => /\.major$/.test(path));
  if (group === 'projects' && /^(?:项目名称|项目标题)$/.test(label)) return sources.filter(({path}) => /\.name$/.test(path));
  if (group && /^(?:开始(?:时间|日期|年月)|起始时间|入学(?:时间|年月))$/.test(label)) return sources.filter(({path}) => /\.start$/.test(path));
  if (group && /^(?:结束(?:时间|日期|年月)|终止时间|毕业(?:时间|日期|年月|年份))$/.test(label)) return sources.filter(({path}) => /\.end$/.test(path));
  if (/家庭|家乡|籍贯/.test(label)) {
    const explicit = sources.filter(({ path }) => path === `customFields[${JSON.stringify(label)}]`);
    return explicit.length ? explicit : sources.filter(({ path }) => /(?:^|\.)nativePlace$|(?:^|\.)householdRegistration$/.test(path));
  }
  if (/(?:学校|院校)(?:所在)?(?:城市|地区)|就读地|学校所在地|院校所在地/.test(label)) return sources.filter(({ path }) => /\.(?:location|studyLocation|currentLocation)$/.test(path));
  if (group === "cadres" && /^(?:角色|职务)$/.test(label)) return sources.filter(({ path }) => /\.position$/.test(path));
  if (group === 'cadres' && /^实践名称$/.test(label)) return sources.filter(({path}) => /\.position$/.test(path));
  if (group === 'cadres' && /^(?:实践描述|实践内容|实践说明|在校实践)$/.test(label)) return sources.filter(({path}) => /\.(?:duty|description)$/.test(path));
  if (group === 'education' && /^(?:学习形式|学习方式|就读方式|培养方式|学历类型|受教育类型)$/.test(label)) return sources.filter(({path}) => /\.training$/.test(path));
  if (group === 'education' && /^(?:学历|学位)$/.test(label)) return sources.filter(({path}) => /\.degree$/.test(path));
  if (group === 'education' && /^(?:成绩排名|专业排名)$/.test(label)) return sources.filter(({path}) => /\.rank$/.test(path));
  if (group === "projects" && label === "项目成果") {
    const explicit = sources.find(({ path }) => /\.outcomes$/.test(path)) || sources.find(({ path }) => /\.highlights$/.test(path));
    if (explicit) return [explicit];
    for (const key of ["responsibilities", "description", "summary"]) {
      const text = String(groupRows[row]?.item?.[key] || "");
      const marked = text.match(/(?:^|\n)\s*(?:项目成果|成果|项目亮点|亮点)\s*[：:]\s*([\s\S]*)/);
      const value = marked?.[1]?.split(/\n\s*(?:项目职责|核心职责|职责|描述|项目描述|项目简介|github)\s*[：:]/i)[0]?.trim();
      if (value) return [{ path: `derived.projects[${groupRows[row].index}].outcomes`, value }];
    }
    const description = sources.find(({ path }) => /\.summary$/.test(path)) || sources.find(({ path }) => /\.description$/.test(path));
    if (description && /完成|交付|上线|构建|实现|支持|打通|覆盖/.test(description.value)
      && !/计划|将要|待实现|拟(?:实现|开发|构建)|目标|旨在|希望|预计/.test(description.value))
      return [{ path: `derived.projects[${groupRows[row].index}].outcomes`, value: description.value }];
    return [];
  }
  if (/^(?:语言|语言类型|语言类别|外语类别|语言名称|语种)$/.test(label)) return sources.filter(({ path }) => /\.language$/.test(path));
  if (group === 'languages' && /^(?:听说(?:能力|水平)?|听力口语)$/.test(label)) return field.languageValue ? sources.filter(({path}) => /\.speaking$/.test(path)) : [];
  if (group === 'languages' && /^(?:读写(?:能力|水平)?|阅读写作)$/.test(label)) return field.languageValue ? sources.filter(({path}) => /\.reading$/.test(path)) : [];
  if (group === 'languages' && /^(?:掌握程度|熟练程度|精通程度|语言水平|等级自评)$/.test(label)) return field.languageValue ? sources.filter(({path}) => /\.proficiency$/.test(path)) : [];
  if (group === 'skills' && /^(?:掌握程度|熟练程度|技能水平|熟练度|能力等级)$/.test(label)) return sources.filter(({path}) => /\.proficiency$/.test(path));
  if (/GPA[-\s_]*BASE|GPA.*(?:总分|满分|满绩)|满(?:绩|分).*绩点|绩点.*满分/i.test([label, field.placeholder, field.name].join(" "))) {
    const item = groupRows[row]?.item || {};
    const fraction = String(item.gpa || "").match(/^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/);
    const scales = [item.gpaType, item.gpaScale, field.gpaScaleValue].filter(Boolean).map(value => String(value).match(/^(\d+(?:\.\d+)?)\s*(?:分制)?$/)?.[1]);
    const scale = fraction?.[2] || scales[0];
    return scale && Number(scale) > 0 && scales.every(value => value && Number(value) === Number(scale)) && (!fraction || Number(fraction[1]) <= Number(scale))
      ? [{ path: `derived.education[${row}].gpaBase`, value: String(Number(scale)) }] : [];
  }
  if (/^(?:个人GPA|GPA(?:成绩)?|绩点|平均学分绩点)$/i.test(label)) {
    return sources.filter(({ path }) => /\.gpa$/.test(path)).flatMap(source => {
      const match = source.value.trim().match(/^(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?$/);
      const scales = [groupRows[row]?.item?.gpaType, groupRows[row]?.item?.gpaScale, field.gpaScaleValue].filter(Boolean).map(value => String(value).match(/^(\d+(?:\.\d+)?)\s*(?:分制)?$/)?.[1]);
      return match && (!match[2] || Number(match[1]) <= Number(match[2]) && scales.every(value => value && Number(value) === Number(match[2]))) ? [{ ...source, value: match[1] }] : [];
    });
  }
  const personalPath = /^(?:中文姓名|真实姓名|姓名|名字)$/.test(label) ? "name" : /^(?:手机(?:号码|号)?|联系电话|电话号码)$/.test(label) ? "phone" : /^(?:邮箱|电子邮箱|邮件地址)$/.test(label) ? "email" : "";
  if (personalPath) return sources.filter(({ path }) => path === personalPath);
  if (/区号|证件类型|证件号码/.test(label)) {
    const explicit = sources.filter(({ path }) => path === `customFields[${JSON.stringify(label)}]`);
    return explicit.length || !/区号/.test(label) ? explicit
      : /^(?:中国|中国大陆|中国内地|大陆|china|mainland china)$/i.test(profile.countryRegion || "") && /^1\d{10}$/.test(profile.phone || "") || /^\+86\s*1\d{10}$/.test(profile.phone || "")
        ? [{ path: "derived.phoneCountryCode", value: "+86" }] : [];
  }
  const standardPath = { name: "name", email: "email", tel: "phone", bday: "birthDate", sex: "gender", country: "countryRegion", "country-name": "countryRegion" }[String(field.autocomplete || "").split(" ").at(-1)]
    || ({ email: "email", tel: "phone" })[field.type];
  if (/GPA\s*类型|绩点(?:类型|满分|制式)/i.test(fieldLabel(field))) return sources.filter(({ path }) => /\.(?:gpaType|gpaScale)$/.test(path));
  if (/^(?:期望从事行业|期望行业|意向行业|目标行业)$/.test(label)) return sources.filter(({ path }) => path === 'jobIntent["industry"]');
  if (occupationCategoryField(field) || /期望从事职业|期望职业|期望职位|意向职位|目标职位|意向岗位/.test(fieldLabel(field))) return sources.filter(({ path }) => path === 'jobIntent["occupation"]');
  if (/^(?:期望工作城市|目标工作城市|期望城市|意向城市|工作意向城市|期望工作地点|期望地点)$/.test(label)) return sources.filter(source => source.path === 'jobIntent["city"]');
  if (group === 'awards' && /^(?:获奖时间|获奖日期|获得时间|获得日期|奖项时间)$/.test(label)) return sources.filter(source => /\.date$/.test(source.path));
  if (group === 'awards' && /^(?:奖项|获奖|奖励)(?:等级|名次)$/.test(label) && !field.isChoice && /名次|几等奖|等第/.test(field.placeholder || '')) {
    const item = groupRows[row]?.item;
    const prizes = [...new Set(`${item?.name || ''} ${item?.level || ''}`.match(/(?:特|[一二三四五六七八九十\d]+)等奖|第[一二三四五六七八九十\d]+名/g) || [])];
    return prizes.length === 1 ? [{ path: `derived.awards[${groupRows[row].index}].prize`, value: prizes[0] }] : [];
  }
  if (/获奖类型|奖励类型|奖项(?:类别|类型)/.test(fieldLabel(field))) return sources.filter(({ path }) => /\.(?:name|type|category)$/.test(path));
  if (/奖项名称|获奖项|获奖名称|荣誉名称|获奖大赛|竞赛名称/.test(fieldLabel(field))) return sources.filter(({ path }) => /\.name$/.test(path));
  if (group === 'certificates' && label === '证书名称') return sources.filter(({ path }) => /\.name$/.test(path));
  if (/^(?:民族|民族类别|民族名称)$/.test(label)) return sources.filter(({ path }) => path === "nationality" || path === `customFields[${JSON.stringify(label)}]`);
  if (/^(?:(?:国籍|国家)(?:[\/／或（(]?地区[）)]?)?|country(?:[\/\s]*region)?)$/i.test(label)) return sources.filter(({ path }) => path === "countryRegion");
  return (standardPath ? sources.filter((source) => source.path === standardPath) : sources).slice(0, 100);
}
const aiFailureReason = error => /TimeoutError|AbortError/.test(error?.name || '') ? 'ai-client-timeout'
  : /^(?:upstream-\d{3}|model-timeout|model-output-invalid|match-invalid|config-missing|config-failed)$/.test(error?.code || '') ? `ai-${error.code}`
  : error?.name === 'TypeError' ? 'ai-network-unavailable' : 'ai-service-unavailable';
async function semanticMatch(fields, profile, timeoutMs = 10000) {
  const sourceMaps = new Map(fields.map((field) => [field.key, new Map(profileSources(field, profile).map(({ path, value }) => [path, value]))]));
  const payload = fields.slice(0, 120).map((field) => {
    const sources = sourceMaps.get(field.key);
    const choice = !semanticTextField(field);
    const bounded = (value) => String(value || "").slice(0, 160);
    const awardPath = [...sources.keys()].find((path) => /^awards\[\d+\]\.name$/.test(path));
    const awardLevel = awardPath ? profile.awards?.[Number(awardPath.match(/\[(\d+)\]/)[1])]?.level : "";
    return {
      key: field.key, label: bounded(field.label), type: field.type, module: bounded(field.module), repeatIndex: field.repeatIndex,
      autocomplete: bounded(field.autocomplete), ariaLabel: bounded(field.ariaLabel), placeholder: bounded(field.placeholder),
      name: bounded(field.name), id: bounded(field.id), title: bounded(field.title),
      labels: (field.labels || []).slice(0, 3).map(bounded), data: field.data || {}, isChoice: choice,
      options: choice ? (field.options || []).slice(0, 80).map(bounded) : [], optionSource: field.optionSource,
      sourceLevel: choice ? bounded(awardLevel) : "",
      // Text pairing needs field names, not contact details or full resume prose.
      sources: [...sources].map(([path, value]) => ({ path, ...(choice ? { value: value.slice(0, 160) } : {}) }))
    };
  }).filter((field) => field.sources.length);
  if (!payload.length) return { assignments: [], diagnostics: fields.map((field) => ({ key: field.key, stage: "match", reason: "profile-value-missing" })) };
  const response = await fetch(`${proxyUrl}/match`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: payload }), signal: AbortSignal.timeout(timeoutMs) });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error || "AI 服务返回错误"), {code:result.reason});
  const returned = Array.isArray(result.assignments) ? result.assignments : [];
  const rejected = [];
  const rejectValue = (field, reason) => { rejected.push({ key: field.key, label: field.label, stage: "match", reason }); return []; };
  const assignments = returned.flatMap((item) => {
    if (!item || returned.filter((other) => other?.key === item.key).length !== 1) return [];
    const field = fields.find((candidate) => candidate.key === item.key);
    const value = sourceMaps.get(item.key)?.get(item.profilePath);
    const submitted = payload.find((candidate) => candidate.key === item.key);
    if (!field || field.currentValue || !value || !submitted?.sources.some((source) => source.path === item.profilePath)
      || !Number.isFinite(item.confidence) || item.confidence < 0.8 || item.confidence > 1) return [];
    if (!semanticTextField(field) && !field.options?.includes(item.value)) return [];
    if (/^(?:毕业学校|毕业院校|最高学历学校|学校|院校|学校名称|学校全称|院校名称|就读学校)$/.test(fieldLabel(field)) && choiceToken(value) !== choiceToken(item.value)) return rejectValue(field, 'candidate-source-conflict');
    if (isAnnualSalaryField(field) && localCandidate(field, profile) !== item.value) return rejectValue(field, 'salary-range-not-confirmed');
    if (!semanticTextField(field) && /^(?:国家[\/／]?地区|国家|证件类型|电话区号|手机区号|获奖类型|奖励类型|奖项类别|奖项类型|是否通过(?:大学)?英语四级|是否通过CET-?4|应届[\/／]?往届|应往届|毕业生类型|是否应届(?:毕业生)?|学历类型|受教育类型|培养方式|学习形式|学习方式|就读方式|最高学历|学历|学位|成绩排名|专业排名|语言|语种|语言名称|语言类型|语言类别|外语类别|听说(?:能力|水平)?|读写(?:能力|水平)?|掌握程度|熟练程度|精通程度|语言水平|等级自评)$/i.test(fieldLabel(field))) {
      const expected = localCandidate(field, profile);
      if (/^(?:语言|语言类型|语言类别|外语类别|语言名称|语种)$/.test(fieldLabel(field)) && expected !== item.value) return rejectValue(field, 'candidate-source-conflict');
      if (/学历类型|受教育类型|培养方式|学习形式|学习方式|就读方式/.test(fieldLabel(field)) && /全日制|统招/.test(value) && !expected) return rejectValue(field, 'education-type-not-confirmed');
      if (expected && expected !== item.value) return rejectValue(field, 'candidate-source-conflict');
    }
    if (programmingLanguageField(field) && !programmingOptionMentioned(semanticTextField(field) ? value : item.value, profileSources(field,profile))) return rejectValue(field,'programming-language-not-in-source');
    if (/^(?:奖学金类型|奖学金类别)$/.test(fieldLabel(field).replace(/[＊*]/g, "")) && scholarshipCandidate(field, profile) !== item.value) return rejectValue(field, "scholarship-type-not-confirmed");
    if (/获奖大赛/.test(fieldLabel(field)) && choiceToken(value) !== choiceToken(item.value) && uniqueAnchorOption(value, field.options || []) !== item.value) return rejectValue(field, "competition-not-offered");
    if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return rejectValue(field, "invalid-email-value");
    if (field.type === "number" && !Number.isFinite(Number(value))) return rejectValue(field, "invalid-number-value");
    if (/拼音|pinyin|英文(?:姓|名)|english[\s_-]*name/i.test([field.label, field.placeholder, field.id].join(" ")) && !/^[A-Za-z][A-Za-z '\-]*$/.test(value)) return rejectValue(field, "invalid-name-format");
    if (field.constraints?.maxLength >= 0 && value.length > field.constraints.maxLength) return rejectValue(field, "text-too-long");
    return [{ key: field.key, label: field.label, profilePath: item.profilePath, value: semanticTextField(field) ? value : item.value, confidence: Number(item.confidence) }];
  });
  return { assignments, diagnostics: [...(result.diagnostics || []).filter(item => item.reason !== "accepted" || !rejected.some(other => other.key === item.key)), ...rejected] };
}
const hasProfileContext = (field, profile) => Object.values(aiFieldContext(field, profile)).some((value) => value && (typeof value !== "object" || Object.values(value).some(Boolean)));
const choiceToken = (value) => String(value || "").toLowerCase().replace(/[：:（）()\[\]【】／\/\s_-]/g, "");
const uniqueAnchorOption = (value, options) => {
  const generic = new Set(["行业", "职业", "职位", "岗位", "方向", "工作", "工程", "开发", "技术", "服务", "管理", "设计", "专业", "相关"]);
  const chunks = String(value || "").match(/[\u4e00-\u9fff]{2,}/g) || [];
  const anchors = [...new Set(chunks.flatMap((part) => [...part].flatMap((_, start) => [...part].slice(start + 2).map((_, end) => part.slice(start, start + end + 2)))).filter((anchor) => !generic.has(anchor)))];
  const scored = options.map((option) => ({ option, score: Math.max(0, ...anchors.filter((anchor) => choiceToken(option).includes(anchor)).map((anchor) => anchor.length)) }));
  const best = Math.max(...scored.map((item) => item.score));
  const matches = scored.filter((item) => item.score === best);
  return best >= 2 && matches.length === 1 ? matches[0].option : "";
};
const salaryRange = (value) => {
  const text = String(value || "").trim().toLowerCase().replace(/\b\d{1,3}(?:[,，]\d{3})+(?!\d)/g, amount => amount.replace(/[,，]/g, ""));
  const found = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(万|w|k|千)?/g)];
  const sharedUnit = found.length > 1 && found.filter((match) => match[2]).length === 1 ? found.find((match) => match[2])?.[2] : "";
  const amounts = found.map(([, number, unit]) => Number(number) * (/万|w/.test(unit || sharedUnit) ? 10000 : /k|千/.test(unit || sharedUnit) ? 1000 : 1));
  if (!amounts.length || /面议|保密|[,，]/.test(text) || /^[-−]/.test(text)) return null;
  if (amounts.length === 1 && /[<＜]/.test(text)) return [0, amounts[0] - 0.01];
  if (amounts.length === 1 && /[>＞]/.test(text)) return [amounts[0] + 0.01, Infinity];
  if (amounts.length === 1 && /≤/.test(text)) return [0, amounts[0]];
  if (amounts.length === 1 && /≥/.test(text)) return [amounts[0], Infinity];
  if (amounts.length === 1 && /以下|以内|不超过|及以下/.test(text)) return [0, amounts[0]];
  if (amounts.length === 1 && /以上|起|及以上/.test(text)) return [amounts[0], Infinity];
  return [Math.min(...amounts), Math.max(...amounts)];
};
const languageProficiencyCandidate = (value, options, label = '') => {
  const levels = ["", "入门", "日常会话", "商务会话", "无障碍沟通", "母语"];
  const proficiency = text => /精通|专家|高级/.test(String(text)) ? 4 : /熟练|熟悉|掌握/.test(String(text)) ? 3 : /一般|中等|中级/.test(String(text)) ? 2 : /了解|入门|初级/.test(String(text)) ? 1 : 0;
  const level = proficiency(value);
  const workingLevels = ["", "初级水平", "工作水平", "专业工作水平", "完全专业水平"];
  if (level && options.filter(option => workingLevels.slice(1).some(title => String(option).trim().startsWith(title))).length >= 3)
    return options.find(option => String(option).trim().startsWith(workingLevels[level])) || "";
  const standard = ["", "了解", "掌握", "熟练", "精通"];
  const scale = options.filter(option => levels.includes(String(option).trim())).length >= 3 ? levels
    : options.filter(option => standard.includes(String(option).trim())).length >= 3 ? standard : [];
  const exactScale = level ? options.find(option => String(option).trim() === scale[level]) : '';
  if (exactScale) return exactScale;
  const matches = level && /掌握程度|熟练程度|精通程度|语言水平|听说|读写/.test(label) ? options.filter(option => proficiency(option) === level) : [];
  return matches.length === 1 ? matches[0] : '';
};
const languageCategoryCandidate = (value, options, label = '') => {
  if (!/^(?:语言|语言类型|语言类别|外语类别|语言名称|语种)$/.test(label)) return '';
  const aliases = [['英语','英文','english'],['中文','汉语','普通话','chinese','mandarin'],['日语','日本语','japanese'],['韩语','朝鲜语','korean'],['法语','french'],['德语','german'],['西班牙语','西语','spanish'],['俄语','russian'],['葡萄牙语','葡语','portuguese'],['阿拉伯语','arabic'],['意大利语','italian']];
  const token = choiceToken(value), group = aliases.find(names => names.some(name => choiceToken(name) === token));
  const matches = (options || []).filter(option => (group || [value]).some(name => {
    const alias = choiceToken(name), candidate = choiceToken(option);
    return candidate === alias;
  }));
  return matches.length === 1 ? matches[0] : '';
};
const scholarshipCandidate = (field, profile) => {
  const options = field.options || [], sources = profileSources(field, profile);
  const explicit = sources.find(source => source.path.startsWith('customFields['));
  if (explicit) return options.find(option => choiceToken(option) === choiceToken(explicit.value)) || '';
  const scope = value => /国家励志/.test(value) ? '国家励志' : /国家/.test(value) ? '国家' : String(value || '').match(/(校|院|省|市)(?:级|等)/)?.[1] || '';
  const grade = value => String(value || '').match(/([特一二三123])等/)?.[1]?.replace(/[123]/g, digit => ['一','二','三'][Number(digit)-1]) || '';
  const cohorts = [...new Set((profile.education || []).map(item => /硕士|博士|研究生|mba/i.test(item.degree || '') ? '研究生' : /本科|学士/.test(item.degree || '') ? '本科生' : '').filter(Boolean))];
  const cohort = cohorts.length === 1 ? cohorts[0] : '';
  const matches = sources.filter(source => /^awards\[\d+\]\.name$/.test(source.path)).flatMap(source => {
    const item = profile.awards[Number(source.path.match(/\[(\d+)\]/)[1])];
    const namedScope = scope(item.name), savedScope = scope(item.level), expectedScope = namedScope || savedScope;
    if (namedScope && savedScope && namedScope !== savedScope && !(namedScope === '国家励志' && savedScope === '国家')) return [];
    return options.filter(option => {
      if (choiceToken(option) === choiceToken(item.name)) return true;
      const optionCohort = option.match(/本科生|研究生/)?.[0];
      return /奖学金/.test(option) && !!expectedScope && scope(option) === expectedScope && grade(option) === grade(item.name)
        && (!optionCohort || optionCohort === (item.name.match(/本科生|研究生/)?.[0] || cohort));
    });
  });
  const unique = [...new Set(matches)];
  return unique.length === 1 ? unique[0] : '';
};
const localCandidate = (field, profile) => {
  if (occupationCategoryField(field)) return "";
  const sourceValue = aiFieldContext(field, profile).sourceValue;
  const value = singleLocationSource(field, sourceValue);
  const options = field.options || [];
  const wanted = choiceToken(value);
  if (/^(?:电话|手机)区号$/.test(fieldLabel(field))) {
    const code = text => String(text || '').match(/(?:\+|\b00)(\d{1,4})(?!\d)/)?.[1]
      || String(text || '').match(/(?:^|\s)0?(\d{1,4})\s*$/)?.[1] || '';
    const expected = code(value);
    const matches = expected ? options.filter(option => code(option) === expected) : [];
    return matches.length === 1 ? matches[0] : '';
  }
  const languageCategory = languageCategoryCandidate(value, options, fieldLabel(field));
  if (/^(?:语言|语言类型|语言类别|外语类别|语言名称|语种)$/.test(fieldLabel(field))) return languageCategory;
  if (/^(?:奖学金类型|奖学金类别)$/.test(fieldLabel(field).replace(/[＊*]/g, ""))) return scholarshipCandidate(field, profile);
  if (programmingLanguageField(field)) {
    const matches = (field.options || []).filter(option=>programmingOptionMentioned(option,profileSources(field,profile)));
    return matches.length === 1 ? matches[0] : '';
  }
  if (/^(?:相关证书|语言证书)$/.test(fieldLabel(field)) && /语言|外语/.test(field.module || '')) {
    const sources = profileSources(field, profile);
    const token = value => String(value || '').match(/CET\s*-?\s*([46])/i)?.[1] || (/英语四级/.test(value) ? '4' : /英语六级/.test(value) ? '6' : '');
    const exams = sources.filter(source => source.path.endsWith('.name')).map(source => ({ source, level: token(source.value), score: sources.find(candidate => candidate.path === source.path.replace(/\.name$/, '.score'))?.value }));
    // ponytail: one language-proof slot uses the highest supplied CET with a confirmed score bin.
    if (!exams.length || exams.some(exam => !exam.level)) return '';
    const highest = exams.filter(exam => exam.level === exams.map(item => item.level).sort().at(-1));
    if (highest.length !== 1 || !/^\d+(?:\.\d+)?$/.test(highest[0].score || '') || Number(highest[0].score) > 710) return '';
    const matches = (field.options || []).filter(option => {
      const range = salaryRange(option.replace(/(?:CET\s*-?\s*[46]|(?:大学)?英语[四六]级)/i, ''));
      return token(option) === highest[0].level && range && range[0] <= Number(highest[0].score) && Number(highest[0].score) <= range[1];
    });
    return matches.length === 1 ? matches[0] : '';
  }
  if (/^(?:语言考试|英语等级)[＊*]?$/.test(fieldLabel(field))) {
    const token = value => String(value || "").match(/(?:CET\s*-?\s*[46]|TEM\s*-?\s*[48])/i)?.[0].replace(/[\s-]/g, "").toUpperCase() || "";
    const exams = profileSources(field, profile).map(source => ({ source, token: token(source.value) }));
    // A single exam slot can use the highest supplied level within one family.
    // Keep unrelated exams and score-constrained conflicts for explicit matching.
    if (exams.length && exams.every(exam => exam.token && exam.token.slice(0, 3) === exams[0].token.slice(0, 3))) {
      const wanted = exams.map(exam => exam.token).sort().at(-1);
      const matches = (field.options || []).filter(option => token(option) === wanted);
      if (matches.length === 1) return matches[0];
    }
  }
  if (/^(?:证书名称|竞赛名称|获奖项)$/.test(fieldLabel(field).replace(/[＊*]/g, ''))) {
    const exam = value => String(value || '').match(/CET\s*-?\s*([46])/i)?.[1] || (/英语四级/.test(value) ? '4' : /英语六级/.test(value) ? '6' : '');
    const matches = /证书名称/.test(fieldLabel(field)) && exam(value) ? options.filter(option => exam(option) === exam(value)) : [];
    if (matches.length === 1) return matches[0];
    if (!matches.length && !options.some(option => choiceToken(option).includes(wanted) || wanted.includes(choiceToken(option))))
      return options.find(option => choiceToken(option) === '其他') || '';
  }
  if (/学历类型|受教育类型|培养方式|学习形式|学习方式|就读方式/.test(fieldLabel(field)) && /全日制|统招/.test(value)) {
    const matches = options.filter(option => /非全日制/.test(value) ? /非全日制/.test(option) : /非统招/.test(value) ? choiceToken(option) === wanted : /全日制/.test(option) && !/非全日制/.test(option));
    return matches.length === 1 ? matches[0] : '';
  }
  if (/证件类型/.test(fieldLabel(field)) && /^(?:中国)?(?:居民)?身份证$/.test(wanted)) {
    const matches = options.filter(option => /^(?:中国)?(?:居民)?身份证$/.test(choiceToken(option)));
    return matches.length === 1 ? matches[0] : '';
  }
  if (!wanted) return "";
  if (isLocationField(field)) {
    // A parent region or one leaf cannot stand in for the complete source.
    if (field.isMultiSelector && String(value).split(/[、,，;；]/).filter(part => part.trim()).length > 1) return "";
    const matches = options.filter(option => committedCascadeCandidate(option, value));
    return matches.length === 1 ? matches[0] : "";
  }
  const exact = options.find((option) => choiceToken(option) === wanted);
  if (exact) return exact;
  if (/排名/.test(fieldLabel(field))) {
    const rank = /[%％]/.test(String(value)) ? Number(String(value).match(/\d+(?:\.\d+)?/)?.[0]) : NaN;
    return rank >= 0 && rank <= 100 ? options.map(option => {
      const bounds = /[%％]/.test(option) ? [...option.matchAll(/\d+(?:\.\d+)?/g)].map(match => Number(match[0])) : [];
      return { option, lower: bounds.length > 1 ? Math.min(...bounds) : 0, upper: bounds.length ? Math.max(...bounds) : NaN };
    }).filter(({ lower, upper }) => lower <= rank && rank <= upper && upper <= 100).sort((a, b) => a.upper - b.upper)[0]?.option || "" : "";
  }
  if (/获奖类型|奖励类型|奖项(?:类别|类型)/.test(fieldLabel(field))) {
    const category = /奖学金/.test(String(value)) ? /奖学金/ : /竞赛|大赛|比赛|杯/.test(String(value)) ? /竞赛|大赛|比赛/ : null;
    const matches = category ? options.filter(option => category.test(String(option))) : [];
    return matches.length === 1 ? matches[0] : "";
  }
  if (/(?:获奖|奖励|奖项|大赛|比赛|竞赛)(?:级别|等级)/.test(fieldLabel(field))) {
    const level = String(value || "").trim();
    return options.find(option => choiceToken(option) === choiceToken(level)
      || choiceToken(option).replace(/省级|省区级/g, "省级").replace(/市级|县市级/g, "市级") === choiceToken(level).replace(/省级|省区级/g, "省级").replace(/市级|县市级/g, "市级")) || "";
  }
  const language = languageProficiencyCandidate(value, options, fieldLabel(field));
  if (language) return language;
  if (/掌握程度|熟练程度|精通程度|语言水平|等级自评|听说|读写/.test(fieldLabel(field))) return "";
  if (/薪|工资|待遇|外语等级/.test(fieldLabel(field))) {
    const range = salaryRange(value);
    const scored = range && Number.isFinite(range[1]) ? options.map((option) => {
      const candidate = salaryRange(option);
      const overlap = candidate && Math.max(0, Math.min(candidate[1], range[1]) - Math.max(candidate[0], range[0]));
      const score = candidate && range[0] === range[1] ? Number(candidate[0] <= range[0] && range[0] <= candidate[1])
        : overlap / Math.max(1, range[1] - range[0]);
      return { option, score };
    }).sort((a, b) => b.score - a.score) : [];
    return scored[0]?.score >= 0.9 && scored[0].score > (scored[1]?.score || 0) + 0.1 ? scored[0].option : "";
  }
  if (/^(?:毕业学校|毕业院校|最高学历学校|学校|院校|学校名称|学校全称|院校名称|就读学校)$/.test(fieldLabel(field))) return "";
  const matches = wanted.length >= 2 ? options.filter((option) => {
    const candidate = choiceToken(option);
    return candidate.length >= 2 && (candidate.includes(wanted) || wanted.includes(candidate));
  }) : [];
  return matches.length === 1 ? matches[0] : uniqueAnchorOption(value, options);
};
const isCascadeField = (field) => !!field && !field.isMultiSelector && field.optionSource !== "native"
  && (!!field.hasConfirmation || /城市|地点|地区|所在地|就读地|家庭|家乡|籍贯|户籍|户口|居住|行业|职业|职位|岗位/.test(fieldLabel(field)));
const committedCascadeCandidate = (value, source) => {
  const candidate = choiceToken(value); const wanted = choiceToken(source);
  const short = (text) => text.replace(/(?:特别行政区|自治区|省|市|区|县)$/g, "");
  return candidate === wanted || short(candidate) === short(wanted)
    || wanted.endsWith(candidate) && !/(?:省|自治区|特别行政区)$/.test(String(value));
};
const localCandidateAssignments = (fields, profile) => fields.flatMap((field) => {
  const value = localCandidate(field, profile);
  const source = singleLocationSource(field, aiFieldContext(field, profile).sourceValue);
  // A unique province is only a navigation step, not a committed city value.
  if (isCascadeField(field) && !committedCascadeCandidate(value, source)) return [];
  return value ? [{ key: field.key, index: field.index, label: field.label, value, confidence: 1 }] : [];
});
const isLocationField = (field) => /城市|地点|地区|所在地|就读地|家庭|家乡|籍贯|户籍|户口|居住/.test(fieldLabel(field));
const occupationCategoryField = field => /^(?:(?:目标|期望|意向)(?:从事)?)?(?:职位|职业|岗位)(?:类别|类型)$/.test(fieldLabel(field));
const isAnnualSalaryField = field => /年薪|年度薪资|年度薪酬/.test(fieldLabel(field));
const singleLocationSource = (field, value) => isLocationField(field) && !field.isMultiSelector
  ? String(value || "").split(/[、,，;；]/).map(part => part.trim()).filter(Boolean)[0] || value : value;
const cascadeCandidateAssignments = (fields, profile) => fields.flatMap((field) => {
  const value = localCandidate(field, profile);
  const sourceValue = aiFieldContext(field, profile).sourceValue;
  const directLocationSearch = isLocationField(field);
  return value || directLocationSearch && sourceValue ? [{ key: field.key, index: field.index, label: field.label, value: directLocationSearch ? sourceValue : value, confidence: 1, sourceValue, locationHint: directLocationSearch ? locationSearchHint(field, profile) : "", local: true, directLocationSearch }] : [];
});
// Searchable cascades can resolve a leaf directly when the portal searches
// locations by city name (for example, 优博讯's 工作地点 picker).
const searchableCascadeAssignments = (fields, profile, occupied = new Set()) => fields.flatMap((field) => {
  const value = aiFieldContext(field, profile).sourceValue;
  return (field?.hasSearch || isLocationField(field)) && !field.isMultiSelector && !occupied.has(field.key) && /行业|职业|职位|岗位|城市|地点|地区|所在地/.test(fieldLabel(field)) && value
    ? [{ key: field.key, index: field.index, label: field.label, value, confidence: 1, sourceValue: value, locationHint: isLocationField(field) ? locationSearchHint(field, profile) : "", searchFallback: true, directLocationSearch: isLocationField(field) }] : [];
});
const searchableSelectorAssignments = (fields, profile, occupied = new Set()) => fields.flatMap((field) => {
  const sourceValue = aiFieldContext(field, profile).sourceValue;
  const value = isLocationField(field) ? sourceValue : localCandidate(field, profile) || sourceValue;
  const educationSearch = field?.hasSearch && /学校|院校|学院|院系|专业|公司|企业|单位|语言类型|语言类别|外语类别|语言水平|语种/.test(fieldLabel(field));
  return (field?.isMultiSelector || educationSearch) && !isCascadeField(field) && !occupied.has(field.key) && /城市|地点|地区|所在地|行业|职业|职位|岗位|学校|院校|学院|院系|专业|公司|企业|单位|语言类型|语言类别|外语类别|语言水平|语种|相关证书|语言证书/.test(fieldLabel(field)) && value
    ? [{ key: field.key, index: field.index, label: field.label, value, confidence: 1, sourceValue, local: true }] : [];
});
const cascadeChildOptions = (options, parentOptions) => (options || []).filter((option) => !parentOptions.has(choiceToken(option)));
const retryFieldKeys = (scannedFields, filled) => new Set(filled ? (scannedFields || [])
  .filter(Boolean)
  .filter((field) => field.optionSource === "popup" && !field.options?.length && !/日期|时间|年月|date|month/i.test(`${field.type || ""} ${field.label || ""} ${field.ariaLabel || ""} ${field.placeholder || ""}`))
  .map((field) => field.key) : []);
const derivedTextAssignments = (fields, profile) => fields.filter(field => semanticTextField(field) && !field.currentValue && !field.blocked).flatMap(field => {
  const sources = profileSources(field, profile);
  const examScore = fieldLabel(field) === "考试分数" && field.examValue && /^(?:英语|english)$/i.test(field.languageValue || "")
    && /^certificates\[\d+\]\.score$/.test(sources[0]?.path || "") && /^\d+(?:\.\d+)?$/.test(sources[0]?.value || "");
  return sources.length === 1 && (examScore || !field.dependsOn && (sources[0].path.startsWith("derived.")
    || sources[0].path.startsWith("customFields[") && aiFieldContext(field, profile).sourceValue === sources[0].value))
    ? [{ key: field.key, label: field.label, value: sources[0].value, confidence: 1 }] : [];
});
const awardNarrativeCorrections = (fields, profile) => fields.flatMap(field => {
  if (field.type !== 'textarea' || !field.currentValue || field.blocked) return [];
  const combined = /竞赛|大赛|比赛/.test(fieldLabel(field)) && /评奖|评优|荣誉|奖励|奖学金|表彰/.test(fieldLabel(field));
  if (!combined && awardMinimum(field) < 0) return [];
  const previous = profileSources(combined ? { ...field, label: '竞赛获奖', narrative: true } : field, profile, true)[0];
  const value = profileSources(field, profile)[0]?.value || '';
  return previous?.path === 'derived.awards' && (field.currentValue === previous.value || field.currentValue === previous.value.replace(/\s+/g, ' ').trim()) && value !== previous.value
    ? [{ key: field.key, expectedValue: previous.value, value, ...(combined ? { repair: 'include-awards-in-combined-field' } : {}) }] : [];
});
const missingLocalValue = (field, profile) => /^(?:现|当前|目前)月薪/.test(fieldLabel(field)) && !String(profile?.jobIntent?.currentSalary || "").trim();

async function formFrame(tabId) {
  let fallback; let lastError;
  const schemaScore = (schema) => (schema.fields || []).length + (schema.fields || []).filter((field) => /姓名|手机|邮箱|教育|学校|公司|职位|项目|获奖|语言/.test(field.label || "")).length * 20;
  // SPA forms often mount after document_idle. Poll briefly instead of
  // treating the first empty scan as a permanent failure.
  for (let attempt = 0; attempt < 12; attempt++) {
    let frameIds = [0];
    try {
      frameIds = [...new Set((await chrome.webNavigation.getAllFrames({ tabId }))
        .map(({ frameId }) => frameId).filter((id) => Number.isInteger(id)))];
    } catch (_) { /* ponytail: main-frame fallback for restricted tabs */ }
    for (const frameId of frameIds) {
      try {
        const schema = responseOrThrow(await chrome.tabs.sendMessage(tabId, contentMessage({ type: "GET_FORM_SCHEMA" }), { frameId }));
        if (!fallback || schemaScore(schema) > schemaScore(fallback.schema)) fallback = { frameId, schema };
      } catch (error) { lastError = error; }
    }
    if (fallback?.schema?.fields?.length) return fallback;
    await sleep(200);
  }
  if (fallback) return fallback;
  throw lastError || new Error("页面脚本尚未准备好，请刷新后重试。");
}

function sendToFrame(tabId, frameId, message) {
  return chrome.tabs.sendMessage(tabId, contentMessage(message), { frameId }).then(responseOrThrow);
}

const TAB_STATE_PREFIX = "resume-autofill.tab.";
const TAB_STATE_FIELDS = ["status", "diagnostics", "pageActionVisible", "toolsStatus"];
const tabStateKey = (tabId, field) => `${TAB_STATE_PREFIX}${tabId}.${field}`;
const fillsInProgress = new Map();
const togglingTabs = new Set();
const closedTabs = new Set();
let currentTabId = null;
let currentWindowId = null;
let tabViewRevision = 0;
async function readTabState(tabId) {
  const stored = await chrome.storage.session.get(TAB_STATE_FIELDS.map(field => tabStateKey(tabId, field)));
  return Object.fromEntries(TAB_STATE_FIELDS.map(field => [field, stored[tabStateKey(tabId, field)]]));
}
async function writeTabState(tabId, patch) {
  if (!Number.isInteger(tabId) || closedTabs.has(tabId)) return;
  await chrome.storage.session.set(Object.fromEntries(Object.entries(patch).map(([field, value]) => [tabStateKey(tabId, field), value])));
}
function setFillStatus(tabId, value, error = false, running = false) {
  return writeTabState(tabId, { status: { value, error, running } });
}
function updatePageActionToggle(visible) {
  const pageActionVisible = visible !== false;
  $("toggle-page-action").textContent = pageActionVisible ? "隐藏页面浮窗" : "显示页面浮窗";
  $("toggle-page-action").setAttribute("aria-pressed", String(pageActionVisible));
}
function renderPageReview(report) {
  const list = $("review-fields");
  const preview = $("review-preview");
  list.replaceChildren();
  preview.hidden = true;
  preview.removeAttribute("src");
  const seen = new Set();
  const fields = (report?.remainingFields || []).filter(field => {
    if (!field?.key || !field.label) return false;
    const key = `${field.frameId ?? report.frameId ?? 0}:${field.key}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  $("review-count").textContent = fields.length ? `${fields.length} 项` : "";
  $("review-hint").textContent = !report ? "填充后将在这里显示仍未填写的字段，点击可定位并截图。"
    : fields.length ? "点击字段可跳转定位并截图，截图仅在本地展示。" : "当前没有未填写的字段。";
  for (const field of fields) {
    const button = document.createElement("button");
    const caption = `截图核对：${field.label}（仅本地）`;
    button.type = "button";
    button.textContent = caption;
    button.title = [field.module, Number.isInteger(field.row) ? `第 ${field.row + 1} 条` : ""].filter(Boolean).join(" · ");
    button.addEventListener("click", async event => {
      if (!event.isTrusted || button.disabled) return;
      button.disabled = true;
      preview.hidden = true;
      try {
        const response = await chrome.runtime.sendMessage({ type: "RESUME_AUTOFILL_REVIEW_FIELD", tabId: report.tabId,
          key: field.fieldKey || field.key, frameId: field.frameId ?? report.frameId ?? 0,
          locator: { label: field.label, module: field.module || "", row: field.row } });
        if (currentTabId !== report.tabId || !button.isConnected) return;
        if (response?.image) {
          preview.src = response.image;
          preview.hidden = false;
          button.textContent = caption;
        } else button.textContent = response?.located ? `${field.label}：请切回填充页面再截图` : `${field.label}字段已变化，请重新填充或人工核对`;
      } catch { button.textContent = `${field.label}截图不可用，请人工核对`; }
      finally { button.disabled = false; }
    });
    list.append(button);
  }
  if (fields.length) $("page-review").open = true;
}
function renderTabState(tabId, state = {}) {
  renderStatus("ai-status", state.status);
  renderStatus("page-tools-status", state.toolsStatus);
  updatePageActionToggle(state.pageActionVisible);
  renderPageReview(state.diagnostics || null);
  $("ai").disabled = fillsInProgress.has(tabId);
  $("toggle-page-action").disabled = togglingTabs.has(tabId);
}
async function refreshPageReview(tabId = currentTabId) {
  const revision = ++tabViewRevision;
  if (!Number.isInteger(tabId)) return null;
  if (currentTabId !== tabId) { currentTabId = tabId; renderTabState(tabId); }
  const tab = await chrome.tabs.get(tabId);
  const state = await readTabState(tabId);
  if (revision !== tabViewRevision || currentTabId !== tab.id) return null;
  if (state.status?.running && !fillsInProgress.has(tabId)) state.status = { value: "上次填充已中断，请重新填充。", error: true };
  renderTabState(tabId, state);
  return { tab, state };
}
$("toggle-page-action").addEventListener("click", async () => {
  const button = $("toggle-page-action");
  const tabId = currentTabId;
  if (button.disabled || !Number.isInteger(tabId)) return;
  togglingTabs.add(tabId);
  button.disabled = true;
  try {
    await popupReady;
    const tab = await chrome.tabs.get(tabId);
    if (!isWebPage(tab?.url)) throw new Error("请先打开要填充的网页表单。");
    const state = await readTabState(tabId);
    const visible = state.pageActionVisible === false;
    await sendToFrame(tab.id, 0, { type: "SHOW_PAGE_ACTION", visible });
    await writeTabState(tabId, { pageActionVisible: visible, toolsStatus: null });
  } catch (error) { await writeTabState(tabId, { toolsStatus: { value: error.message || "页面浮窗切换失败，请刷新页面后重试。", error: true } }); }
  finally { togglingTabs.delete(tabId); if (currentTabId === tabId) button.disabled = false; }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && Number.isInteger(currentTabId) && TAB_STATE_FIELDS.some(field => tabStateKey(currentTabId, field) in changes)) refreshPageReview(currentTabId).catch(() => {});
});

async function load() {
  const { profile, lastStatus, lastStatusError, lastStatusTarget, lastStatusVariant } = await chrome.storage.local.get(["profile", "lastStatus", "lastStatusError", "lastStatusTarget", "lastStatusVariant"]);
  if (profile) show(profile);
  if (lastStatus && !["ai-status", "page-tools-status"].includes(lastStatusTarget)) {
    const status = $(lastStatusTarget) || $("status");
    status.textContent = lastStatus;
    status.className = lastStatusVariant || (lastStatusError ? "error" : "success");
    status.style.color = lastStatusError ? "#b42318" : "#15803d";
  }
  const { aiConfig } = await chrome.storage.local.get("aiConfig");
  $("apiKey").value = aiConfig?.apiKey || "";
  $("baseUrl").value = aiConfig?.baseUrl || "http://localhost:62139/v1";
  $("model").value = aiConfig?.model || "gpt-5.6-luna";
}

$("connect").addEventListener("click", async () => {
  const aiConfig = { apiKey: $("apiKey").value.trim(), baseUrl: $("baseUrl").value.trim(), model: $("model").value.trim() };
  if (!aiConfig.apiKey || !aiConfig.baseUrl || !aiConfig.model) return message("请填写 API Key、Base URL 和模型名。", true, "connect-status");
  try {
    await chrome.storage.local.set({ aiConfig });
    const response = await fetch(`${proxyUrl}/config`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(aiConfig) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "配置失败");
    message("配置已保存，AI 服务已连接。请保持 Node 代理运行。", false, "connect-status");
  } catch (error) { message(String(error.message).includes("Failed to fetch") ? "配置已保存，但本地 Node 代理未启动。请先运行 README 中的 node 命令。" : error.message, !String(error.message).includes("Failed to fetch"), "connect-status", String(error.message).includes("Failed to fetch") ? "hint" : ""); }
});

async function fillPage(tabId) {
  const tab = Number.isInteger(tabId) ? await chrome.tabs.get(tabId) : await activeTab();
  if (!isWebPage(tab?.url)) return setFillStatus(tab?.id, "请先打开要填充的网页表单。", true);
  const formData = collectManualForm();
  if (!hasManualData(formData)) return setFillStatus(tab.id, "请先填写手动表单。", true);
  try {
    await writeTabState(tab.id, { diagnostics: null });
    await setFillStatus(tab.id, "正在读取表单字段并请求 AI 匹配…", false, true);
    let profile = await saveManualProfile(false);
    await injectCurrentContent(tab.id);
    const target = await formFrame(tab.id);
    let schema = await sendToFrame(tab.id, target.frameId, { type: "GET_FORM_SCHEMA" });
    const modules = [...(schema.modules || []), ...(schema.fields || []).map((field) => field.module || "")];
    profile = { ...profile, separateInternships: modules.some((title) => /实习/.test(title) && !combinedExperience(title)) };
    profile.separateEnglishCertificates = (schema.fields || []).some((field) => /英语能力|英语证书/.test(field.module || ""));
    const prepared = await sendToFrame(tab.id, target.frameId, { type: "PREPARE_PROFILE", profile, corrections: awardNarrativeCorrections(schema.fields || [], profile) });
    const experiences = profile.experiences?.length ? profile.experiences : [...(profile.internships || []), ...(profile.work || [])];
    const rowCounts = {
      education: profile.education?.length, projects: profile.projects?.length, languages: profile.languages?.length,
      work: modules.some(combinedExperience) || !profile.separateInternships ? experiences.length : profile.work?.length,
      internships: profile.separateInternships ? profile.internships?.length : 0,
      certificates: profile.certificates?.length, awards: profile.awards?.length,
      competitions: (profile.awards || []).filter(competitionAward).length, honors: (profile.awards || []).filter(item => !competitionAward(item)).length,
      skills: profile.skills?.length, cadres: profile.cadres?.length
    };
    let actualRows = await sendToFrame(tab.id, target.frameId, { type: "ENSURE_ROWS", counts: rowCounts });
    schema = await sendToFrame(tab.id, target.frameId, { type: "GET_FORM_SCHEMA" });
    let emptyFields = uniqueEmptyFields(schema.fields || []);
    const parentReady = field => !field.dependsOn || schema.fields.some(parent => parent.key === field.dependsOn && parent.currentValue);
    let candidateFilled = prepared.filled || 0; let aiFilled = 0;
    const aiDiagnostics = [{ pass: 0, fields: [], model: [], apply: prepared.diagnostics || [] }];
    let aiConfiguration;
    let aiUnavailable;
    const match = async (fields, timeoutMs) => {
      if (aiUnavailable) throw aiUnavailable;
      try {
        if (!aiConfiguration) aiConfiguration = (async () => {
          const { aiConfig } = await chrome.storage.local.get("aiConfig");
          if (!aiConfig?.apiKey) throw Object.assign(new Error("请先保存 AI 配置。当前已完成的结构化填充会保留。"), {code:'config-missing'});
          const configured = await fetch(`${proxyUrl}/config`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(aiConfig), signal:AbortSignal.timeout(10000) });
          if (!configured.ok) throw Object.assign(new Error("本地 AI 代理配置失败，请检查侧栏配置。"), {code:'config-failed'});
        })();
        await aiConfiguration;
        return await semanticMatch(fields, profile, timeoutMs);
      } catch (error) { aiUnavailable = error; throw error; }
    };
    // After source-verified repairs, plan the ordinary fill. Plain text does not need
    // a popup, so AI can resolve unfamiliar captions before fuzzy rules run.
    const plan = (schema.fields || []).map((field) => ({ key: field.key, label: field.label, module: field.module, row: field.repeatIndex,
      blocked: !!field.blocked, protected: !!field.currentValue, sourcePaths: profileSources(field, profile).map(({ path }) => path) }));
    const categories = emptyFields.filter(field => occupationCategoryField(field) && !field.blocked && parentReady(field) && profileSources(field, profile).length);
    const categoryKeys = new Set(categories.map(field => field.key));
    let categoryMatch;
    let categoryFields = [];
    if (categories.length) {
      const live = await sendToFrame(tab.id, target.frameId, {type:"GET_LIVE_OPTIONS",keys:categories.map(field => field.key)});
      categoryFields = uniqueEmptyFields(live.fields || []).filter(field => occupationCategoryField(field) && field.options?.length);
      // Network classification can run while local fields fill; page clicks stay serial.
      categoryMatch = match(categoryFields, 60000)
        .then(result => ({result}), error => ({error}));
    }
    const preflightFields = emptyFields.filter((field) => !field.blocked && semanticTextField(field) && !field.dependsOn
      && !/日期|时间|年月|date|month/i.test(`${field.type} ${field.label} ${field.type === "textarea" ? "" : field.placeholder}`) && profileSources(field, profile).length);
    const writeDerivedText = async fields => {
      const assignments = derivedTextAssignments(fields, profile);
      if (assignments.length) {
        const applied = await sendToFrame(tab.id, target.frameId, { type: "APPLY_ASSIGNMENTS", assignments });
        candidateFilled += applied.filled || 0;
        aiDiagnostics.push({ pass: 0, fields: [], model: [], apply: applied.diagnostics || [] });
      }
      return assignments;
    };
    const derived = await writeDerivedText(preflightFields);
    const derivedKeys = new Set(derived.map(item => item.key));
    const unknownText = preflightFields.filter(field => !derivedKeys.has(field.key));
    if (unknownText.length) {
      try {
        const result = await match(unknownText);
        const applied = await sendToFrame(tab.id, target.frameId, { type: "APPLY_ASSIGNMENTS", assignments: result.assignments });
        aiFilled += applied.filled || 0;
        aiDiagnostics.push({ pass: 0, fields: [], model: result.diagnostics || [], apply: applied.diagnostics || [] });
      } catch (error) {
        aiDiagnostics.push({ pass: 0, fields: [], model: [{ reason: aiFailureReason(error) }], apply: [] });
      }
    }
    const repaired = await sendToFrame(tab.id, target.frameId, { type: "FILL_PROFILE", profile, options: { onlyEmpty: true, deferChoices: true } });
    const repairAddedRows = async () => {
      const allAdded = [];
      const limit = Math.max(1, Object.values(rowCounts).reduce((total, count) => total + (Number(count) || 0), 0));
      for (let pass = 0; pass < limit; pass++) {
        const before = await sendToFrame(tab.id, target.frameId, { type: "GET_FORM_SCHEMA" });
        await writeDerivedText(before.fields || []);
        actualRows = await sendToFrame(tab.id, target.frameId, { type: "ENSURE_ROWS", counts: rowCounts });
        const after = await sendToFrame(tab.id, target.frameId, { type: "GET_FORM_SCHEMA" });
        schema = after;
        const known = new Set(plan.map(field => field.key));
        const added = (after.fields || []).filter(field => !known.has(field.key));
        if (!added.length) break;
        allAdded.push(...added);
        plan.push(...added.map(field => ({ key: field.key, label: field.label, module: field.module, row: field.repeatIndex,
          blocked: !!field.blocked, protected: !!field.currentValue, sourcePaths: profileSources(field, profile).map(({ path }) => path) })));
        await writeDerivedText(added);
        const extra = await sendToFrame(tab.id, target.frameId, { type: "FILL_PROFILE", profile, options: { onlyEmpty: true, deferChoices: true } });
        repaired.filled += extra.filled || 0;
        repaired.missingFields = [...new Set([...(repaired.missingFields || []), ...(extra.missingFields || [])])];
        for (const key of ["structuredAttempts", "targetFields", "experienceLocations", "deferredFields"]) {
        if (extra.diagnostics?.[key]) repaired.diagnostics[key] = [...(repaired.diagnostics[key] || []), ...extra.diagnostics[key]];
        }
        schema = await sendToFrame(tab.id, target.frameId, { type: "GET_FORM_SCHEMA" });
        if (!extra.filled) break;
      }
      return allAdded;
    };
    await repairAddedRows();
    emptyFields = uniqueEmptyFields(schema.fields || []);
    // Reread only children and unavailable choices after a real selection.
    let retryKeys;
    let passLimit = 3;
    const rowPassLimit = 3 * (Math.max(1, ...Object.values(rowCounts).map(value => Number(value) || 0)) + 1);
    for (let pass = 0; pass < passLimit && emptyFields.length; pass++) {
      const passFields = retryKeys ? emptyFields.filter((field) => retryKeys.has(field.key)) : emptyFields;
      const eligible = passFields.filter((field) => !categoryKeys.has(field.key) && !field.blocked && parentReady(field)
        && !missingLocalValue(field, profile) && (hasProfileContext(field, profile) || profileSources(field, profile).length));
      const live = eligible.length ? await sendToFrame(tab.id, target.frameId, { type: "GET_LIVE_OPTIONS", keys: eligible.map((field) => field.key) }) : { fields: [] };
      const eligibleKeys = new Set(eligible.map((field) => field.key));
      const scannedFields = uniqueEmptyFields(live.fields || []).filter((field) => eligibleKeys.has(field.key));
      const liveFields = scannedFields.filter((field) => semanticTextField(field) || fieldsWithLiveOptions([field]).length || field.hasSearch).map((field) => ({ ...field, profileContext: aiFieldContext(field, profile) }));
      const absentFields = passFields.filter((field) => field.blocked || !parentReady(field) || missingLocalValue(field, profile) || !profileSources(field, profile).length && !hasProfileContext(field, profile));
      const baseDiagnostics = absentFields.map((field) => ({ key: field.key, label: field.label, optionCount: 0, optionSource: "not-requested", reason: field.blocked ? "dependent-field-blocked" : !parentReady(field) ? "choice-parent-not-confirmed" : "profile-value-missing" }));
      const unreadChoices = scannedFields.filter((field) => ["popup", "popup-not-found"].includes(field.optionSource) && !field.options?.length)
        .map((field) => ({ key: field.key, label: field.label, optionCount: 0, optionSource: field.optionSource, opening: field.opening, reason: field.optionSource === "popup-not-found" ? "candidate-not-read" : "options-unavailable" }));
      if (!liveFields.length) { aiDiagnostics.push({ pass: pass + 1, fields: [], model: [...baseDiagnostics, ...unreadChoices], apply: [] }); break; }
      const localCascade = cascadeCandidateAssignments(liveFields.filter((field) => !semanticTextField(field) && isCascadeField(field)), profile);
      const localCascadeKeys = new Set(localCascade.map((item) => item.key));
      const localAssignments = localCandidateAssignments(liveFields.filter((field) => !localCascadeKeys.has(field.key) && !field.isMultiSelector), profile);
      const directSearch = searchableSelectorAssignments(liveFields, profile, new Set(localAssignments.map((item) => item.key)));
      const local = await sendToFrame(tab.id, target.frameId, { type: "APPLY_ASSIGNMENTS", assignments: [...localAssignments, ...directSearch] });
      candidateFilled += local.filled || 0;
      const locallyFilled = new Set((local.diagnostics || []).filter((item) => item.reason === "filled").map((item) => item.key));
      const aiFields = liveFields.filter((field) => !isAnnualSalaryField(field) && !locallyFilled.has(field.key) && !localCascadeKeys.has(field.key));
      let result = { assignments: [], diagnostics: [] };
      if (aiFields.length) {
        try { result = await match(aiFields); }
        catch (error) { result.diagnostics = aiFields.map(field => ({ key: field.key, label: field.label, reason: aiFailureReason(error) })); }
      }
      const fieldFor = (assignment) => liveFields.find((field) => field.key === assignment.key);
      const aiCascade = (result.assignments || []).filter((assignment) => !semanticTextField(fieldFor(assignment)) && isCascadeField(fieldFor(assignment)))
        .map((assignment) => {
          const field = fieldFor(assignment);
          const sourceValue = field?.profileContext?.sourceValue || assignment.value;
          return { ...assignment, value: isLocationField(field) ? sourceValue : assignment.value, sourceValue, locationHint: isLocationField(field) ? locationSearchHint(field, profile) : "", directLocationSearch: isLocationField(field) };
        });
      const cascadeAssignments = [...localCascade, ...aiCascade, ...searchableCascadeAssignments(liveFields.filter(isCascadeField), profile, new Set([...localCascade, ...aiCascade].map((item) => item.key)))];
      const regularAssignments = (result.assignments || []).filter((assignment) => semanticTextField(fieldFor(assignment)) || !isCascadeField(fieldFor(assignment)));
      let applied = { filled: 0, diagnostics: [] };
      let appliedAiFilled = 0;
      const appendApplied = (part, aiKeys) => {
        applied = { filled: applied.filled + (part.filled || 0), diagnostics: [...applied.diagnostics, ...(part.diagnostics || [])] };
        for (const item of part.diagnostics || []) {
          if (item.reason !== "filled") continue;
          if (aiKeys.has(item.key)) appliedAiFilled++;
          else candidateFilled++;
        }
      };
      if (regularAssignments.length) appendApplied(await sendToFrame(tab.id, target.frameId, { type: "APPLY_ASSIGNMENTS", assignments: regularAssignments }), new Set(regularAssignments.map((item) => item.key)));
      let model = Array.isArray(result.diagnostics) ? result.diagnostics : [];
      // A portal can keep only one cascading menu open. Finish one parent and
      // its child before opening the next, otherwise their child lists erase each other.
      for (const initial of cascadeAssignments) {
        let assignment = initial;
        let field = fieldFor(initial);
        const seenOptions = new Set((field?.options || []).map(choiceToken));
        for (let level = 1; assignment && level <= 6; level++) {
          const step = await sendToFrame(tab.id, target.frameId, { type: "APPLY_ASSIGNMENTS", assignments: [{ ...assignment, deferConfirm: !assignment.directLocationSearch }] });
          const pending = (step.diagnostics || []).find((item) => item.reason === "cascade-parent-selected");
          if (!pending) { appendApplied(step, assignment.local ? new Set() : new Set([assignment.key])); break; }
          const children = await sendToFrame(tab.id, target.frameId, { type: "GET_LIVE_OPTIONS", keys: [assignment.key], keepOpen: true, previousOptions: { [assignment.key]: [...seenOptions] } });
          const child = uniqueEmptyFields(children.fields || []).find((item) => item.key === assignment.key);
          const options = cascadeChildOptions(child?.options, seenOptions);
          pending.cascade = { level, options: field?.options || [], selected: assignment.value, childOptionsUpdated: !!options.length, childOptions: options };
          appendApplied(step, assignment.local ? new Set() : new Set([assignment.key]));
          if (!options.length) {
            const final = await sendToFrame(tab.id, target.frameId, { type: "APPLY_ASSIGNMENTS", assignments: [{ ...assignment, deferConfirm: false }] });
            for (const item of final.diagnostics || []) item.cascade = { ...pending.cascade, finalLeaf: assignment.value, confirmFound: !!item.choice?.confirmFound, confirmedValue: item.actual || item.choice?.afterConfirm || "" };
            appendApplied(final, assignment.local ? new Set() : new Set([assignment.key]));
            break;
          }
          options.map(choiceToken).forEach((option) => seenOptions.add(option));
          const childField = { ...child, options, optionCount: options.length, profileContext: aiFieldContext(child, profile) };
          const localValue = localCandidate(childField, profile);
          let next = localValue ? { key: childField.key, index: childField.index, label: childField.label, value: localValue, confidence: 1, sourceValue: childField.profileContext?.sourceValue || "", local: true } : null;
          if (!next) {
            let childResult;
            try { childResult = await match([childField]); }
            catch (error) { childResult = { assignments: [], diagnostics: [{ key: childField.key, label: childField.label, reason: aiFailureReason(error) }] }; }
            model = [...model, ...(childResult.diagnostics || [])];
            next = childResult.assignments?.[0] && { ...childResult.assignments[0], sourceValue: childField.profileContext?.sourceValue || "" };
          }
          if (!next) {
            applied.diagnostics.push({ key: assignment.key, label: assignment.label, value: assignment.value, optionCount: options.length, optionSource: child?.optionSource || "popup", reason: "cascade-child-options-not-read", cascade: pending.cascade });
            break;
          }
          assignment = next;
          field = childField;
        }
      }
      const resolvedKeys = new Set([...(local.diagnostics || []), ...(applied.diagnostics || [])].filter((item) => item.reason === "filled").map((item) => item.key));
      model = model.filter((item) => item.reason !== "ai-no-assignment" || !resolvedKeys.has(item.key));
      const returned = new Set(model.map((item) => item.key));
      const noAssignment = model.filter((item) => item.reason === "ai-no-assignment");
      if (!noAssignment.length) noAssignment.push(...aiFields.filter((field) => !returned.has(field.key)).map((field) => ({ key: field.key, label: field.label, optionCount: field.options?.length || 0, optionSource: field.optionSource || "", reason: "ai-no-assignment" })));
      aiDiagnostics.push({ pass: pass + 1, fields: liveFields.map(({ key, index, label, module, repeatIndex, optionSource, optionCount, hasSearch, scrolled, candidatesTruncated, options, opening }) => ({ key, index, label, module, repeatIndex, optionSource, optionCount, hasSearch, scrolled, candidatesTruncated, options, opening })), model: [...baseDiagnostics, ...unreadChoices, ...model, ...noAssignment], apply: [...(local.diagnostics || []), ...(applied.diagnostics || [])] });
      console.info("[resume-autofill] AI matching", { pass: pass + 1, fields: liveFields.length, filled: applied.filled || 0 });
      aiFilled += appliedAiFilled;
      retryKeys = retryFieldKeys(scannedFields, candidateFilled + aiFilled + (repaired.filled || 0));
      const selected = (local.filled || 0) + (applied.filled || 0) > 0;
      const added = selected ? await repairAddedRows() : [];
      if (added.length) {
        added.forEach(field => retryKeys.add(field.key));
        passLimit = Math.min(passLimit + 3, rowPassLimit);
      }
      if (!selected) schema = await sendToFrame(tab.id, target.frameId, { type: "GET_FORM_SCHEMA" });
      emptyFields = uniqueEmptyFields(schema.fields || []).filter((field) => !missingLocalValue(field, profile));
      const scannedKeys = new Set(scannedFields.map((field) => field.key));
      for (const field of emptyFields) if (!field.blocked && field.dependsOn && !scannedKeys.has(field.key)
        && schema.fields.some((parent) => parent.key === field.dependsOn && parent.currentValue)) retryKeys.add(field.key);
      if (retryKeys.size && (local.filled || 0) + (applied.filled || 0) > 0) passLimit = Math.min(passLimit + 1, rowPassLimit);
      if (!retryKeys.size) break;
    }
    if (categoryMatch) {
      const {result, error} = await categoryMatch;
      const applied = error ? {} : await sendToFrame(tab.id, target.frameId, {type:"APPLY_ASSIGNMENTS",assignments:result.assignments});
      aiFilled += applied.filled || 0;
      aiDiagnostics.push({pass:0,fields:categoryFields.map(({key,label,options,optionCount,optionSource,candidatesTruncated,opening}) => ({key,label,options,optionCount,optionSource,candidatesTruncated,opening})),
        model:error ? categories.map(field => ({key:field.key,label:field.label,reason:aiFailureReason(error)})) : result.diagnostics || [],apply:applied.diagnostics || []});
    }
    const after = await sendToFrame(tab.id, target.frameId, { type: "GET_FORM_SCHEMA" });
    const remaining = uniqueEmptyFields(after.fields || []);
    const examples = [...new Set(remaining.map(fieldLabel).filter(Boolean))].slice(0, 4).join("、");
    const { unresolved, unavailable } = missingFieldLabels(repaired.missingFields, after.fields);
    const unresolvedText = unresolved.slice(0, 6).join("、");
    const unavailableText = unavailable.slice(0, 6).join("、");
    const absentIntent = Object.entries(repaired.diagnostics?.intentSources || {}).filter(([, present]) => !present).map(([label]) => label).join("、");
    const allDiagnostics = { structured: repaired.diagnostics?.structuredAttempts || [], targetFields: repaired.diagnostics?.targetFields || [], experienceLocations: repaired.diagnostics?.experienceLocations || [], sources: repaired.diagnostics?.intentSources || {}, deferredFields: repaired.diagnostics?.deferredFields || [], ai: aiDiagnostics };
    const absentStructured = [...new Set(allDiagnostics.structured.filter((item) => item.reason === "profile-value-missing")
      .map((item) => `${item.section || "字段"}[${Number(item.row) || 1}].${item.label}`))].join("、");
    const stageFor = (reason) => /field-not-found|unknown-field/.test(reason) ? "scan"
      : /candidate|option/.test(reason) ? "candidate" : /filled|validation|confirm|protected/.test(reason) ? "interaction" : "match";
    const safeTree = tree => tree && ({ flat: tree.flat === true, roleless: tree.roleless === true,
      sourceParts: Number(tree.sourceParts) || 0, rows: Number(tree.rows) || 0, hierarchy: Number(tree.hierarchy) || 0,
      cityFound: tree.cityFound === true, provinceFound: tree.provinceFound === true, countryFound: tree.countryFound === true });
    const safeDiagnostic = (item) => ({ key: item.key, label: item.label, section: item.section, row: item.row,
      stage: item.stage || stageFor(item.reason || ""), reason: item.reason, optionCount: item.optionCount,
      candidatesTruncated: aiDiagnostics.flatMap(pass => pass.fields || []).find(field => field.key === item.key)?.candidatesTruncated,
      interaction: item.choice?.failure, repair: item.repair, path: item.choice?.path, dateControlCount: item.dateControlCount,
      sourceSelection: item.choice?.sourceSelection, sourceCount: item.choice?.sourceCount,
      tree: safeTree(item.choice?.tree),
      parts: item.choice?.parts?.map(({ confirmed, protected: protectedValue, choice }) => ({ confirmed, protected: protectedValue,
        path: choice?.path, interaction: choice?.failure, tree: safeTree(choice?.tree) })),
      opening: item.opening || item.choice?.opening || aiDiagnostics.flatMap(pass => pass.fields || []).find(field => field.key === item.key)?.opening,
      datePicker: item.choice?.datePicker ? { currentYear: item.choice.datePicker.currentYear, targetYear: item.choice.datePicker.targetYear, yearMethod: item.choice.datePicker.yearMethod, monthCount: item.choice.datePicker.monthCount, rangeStartPending: !!item.choice.rangeStartPending } : undefined,
      yearNavigation: item.choice?.datePicker?.yearClicks?.map(({ trusted, fallback, trustedError }) => ({ trusted, fallback, trustedError })) });
    const diagnostics = [...allDiagnostics.structured, ...(actualRows.diagnostics || []), ...aiDiagnostics.flatMap((pass) => [...pass.model, ...pass.apply])].map(safeDiagnostic);
    const lastAiDiagnostics = { protocol: 100, version: "0.9.103", build: "100-virtual-city-committed-input", tabId: tab.id, frameId: target.frameId, discovered: after.fields?.length || 0, structuredFilled: repaired.filled,
      candidateFilled, aiFilled, protected: plan.filter(field => field.protected).length, remaining: remaining.length,
      rows: { requested: rowCounts, present: actualRows }, plan,
      remainingFields: remaining.map(field => ({ key: field.key, label: field.label, module: field.module, row: field.repeatIndex, reason: !profileSources(field, profile).length && !hasProfileContext(field, profile) ? "profile-value-missing" : [...diagnostics].reverse().find(item => item.key === field.key)?.reason || "not-confirmed" })), diagnostics };
    const failures = diagnostics.filter((item) => !["filled", "accepted", "page-value-protected", "deferred-to-ai"].includes(item.reason));
    const failureText = [...new Set(failures.map((item) => `${item.stage}:${item.reason}`))].slice(0, 6).join("、");
    const status = `结构化确认 ${repaired.filled} 项，候选确认 ${candidateFilled} 项，AI 确认 ${aiFilled} 项，保留原值 ${plan.filter(field => field.protected).length} 项；发现 ${after.fields?.length || 0} 个字段，剩余 ${remaining.length} 个空字段${failureText ? `；诊断：${failureText}` : ""}。请检查后自行提交。`;
    await writeTabState(tab.id, { diagnostics: lastAiDiagnostics, status: { value: status, error: false, running: false } });
    const { pageActionVisible: visible } = await readTabState(tab.id);
    await sendToFrame(tab.id, 0, { type: "SHOW_PAGE_ACTION", visible: visible !== false, result: { status, diagnostics: lastAiDiagnostics } }).catch(() => {});
  } catch (error) {
    const detail = String(error.message || error);
    await setFillStatus(tab.id, detail.includes("Failed to fetch") ? "本地 Node 代理未启动，请先运行 README 中的 node 命令。"
      : detail.includes("Receiving end does not exist") ? "插件脚本未注入当前页面，请重新加载插件后重试。" : detail, true);
  }
}
async function fillCurrentPage(tabId = currentTabId) {
  const target = Number.isInteger(tabId) ? chrome.tabs.get(tabId) : activeTab();
  await popupReady;
  const tab = await target;
  if (!Number.isInteger(tab?.id)) return { status: "请先打开要填充的网页表单。" };
  if (fillsInProgress.has(tab.id)) return { status: "当前标签页正在填充，请等待完成。" };
  const job = fillPage(tab.id);
  fillsInProgress.set(tab.id, job);
  if (currentTabId === tab.id) $("ai").disabled = true;
  try {
    await job;
    const state = await readTabState(tab.id);
    return { status: state.status?.value || "", diagnostics: state.diagnostics };
  } catch (error) {
    const status = String(error.message || error);
    await setFillStatus(tab.id, status, true).catch(() => { if (currentTabId === tab.id) renderStatus("ai-status", { value: status, error: true }); });
    return { status };
  } finally { fillsInProgress.delete(tab.id); if (currentTabId === tab.id) $("ai").disabled = false; }
}
$("ai").addEventListener("click", () => fillCurrentPage());
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.type !== "RESUME_AUTOFILL_PAGE_RUN_V100" || sender.id !== chrome.runtime.id || sender.tab || !Number.isInteger(request.tabId)) return false;
  if (currentWindowId == null || request.windowId !== currentWindowId) return false;
  chrome.tabs.get(request.tabId).then(tab => {
    if (tab.windowId !== currentWindowId) { sendResponse({ status: "标签页已移到其他窗口，请在对应窗口重新填充。" }); return; }
    return fillCurrentPage(tab.id).then(sendResponse);
  }).catch(() => sendResponse({ status: "填充失败，请查看简历助手侧栏。" }));
  return true;
});
async function showPageAction(tabId) {
  const refreshed = await refreshPageReview(tabId);
  if (!refreshed) return;
  const { tab, state } = refreshed;
  if (fillsInProgress.has(tab.id)) return;
  if (!isWebPage(tab?.url)) return;
  await injectCurrentContent(tabId);
  await sendToFrame(tabId, 0, { type: "SHOW_PAGE_ACTION", visible: state.pageActionVisible !== false,
    result: state.status ? { status: state.status.value, diagnostics: state.diagnostics || {} } : undefined });
}
chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  if (windowId === currentWindowId) showPageAction(tabId).catch(() => {});
});
chrome.tabs.onRemoved.addListener(tabId => {
  closedTabs.add(tabId);
  if (currentTabId === tabId) { currentTabId = null; tabViewRevision++; renderTabState(null); }
});

const MANUAL_STORAGE_KEY = "applicationFormData";
const MANUAL_SINGLE_FIELD_IDS = [
  "fullName", "gender", "phone", "email", "birthDate", "age", "idType", "idNumber", "nativePlace",
  "wechat", "nationality", "countryRegion", "politicalStatus", "currentResidence", "householdRegistration", "workExperience", "intentIndustry", "intentOccupation", "intentCurrentSalary", "intentExpectedSalary", "intentCity", "intentArrival", "skills", "selfEvaluation"
];
const REPEAT_GROUPS = {
  educations: { firstId: "university", label: "教育经历", addLabel: "新增教育经历", fields: [["degree", "education"], ["training", "educationType"], ["school", "university"], ["location", "educationLocation"], ["college", "college"], ["major", "major"], ["start", "educationStart"], ["end", "graduationYear"], ["gpa", "gpa"], ["gpaType", "gpaType"], ["rank", "educationRank"]] },
  experiences: { firstId: "internCompany1", label: "经历", addLabel: "新增实习/工作经历", fields: [["company", "internCompany"], ["department", "internDepartment"], ["title", "internPosition"], ["start", "internStart"], ["end", "internEnd"], ["salary", "internSalary"], ["location", "internLocation"], ["reason", "internReason"], ["description", "internContent"], ["highlights", "internHighlights"]] },
  projects: { firstId: "projectName1", label: "项目", addLabel: "新增项目", fields: [["name", "projectName"], ["role", "projectRole"], ["start", "projectStart"], ["end", "projectEnd"], ["link", "projectLink"], ["description", "projectDesc"], ["responsibilities", "projectDuty"], ["outcomes", "projectOutcomes"]] },
  cadres: { firstId: "cadrePosition1", label: "干部经历", addLabel: "新增干部经历", fields: [["position", "cadrePosition"], ["level", "cadreLevel"], ["start", "cadreStart"], ["end", "cadreEnd"], ["duty", "cadreDuty"]] },
  languageAbilities: { firstId: "languageType1", label: "语言能力", addLabel: "新增语言能力", fields: [["language", "languageType"], ["proficiency", "languageProficiency"], ["speaking", "languageSpeaking"], ["reading", "languageReading"]] },
  certificates: { firstId: "languageCert1", label: "证书", addLabel: "新增证书", fields: [["name", "languageCert"], ["score", "languageScore"], ["date", "languageDate"], ["description", "languageDesc"]] },
  awards: { firstId: "awardName1", label: "获奖", addLabel: "新增获奖经历", fields: [["name", "awardName"], ["level", "awardLevel"], ["date", "awardDate"], ["description", "awardDesc"]] }
};
const manualHasValues = (row) => Object.values(row).some((value) => String(value ?? "").trim());
const manualOneRow = (row) => manualHasValues(row) ? [row] : [];

function prepareRepeatRow(row, groupName, index, clear = false) {
  const config = REPEAT_GROUPS[groupName];
  row.dataset.repeatRow = groupName;
  row.querySelector(":scope > strong").textContent = `${config.label} ${index}`;
  config.fields.forEach(([key, prefix]) => {
    const control = row.querySelector(`[id^="${prefix}"]`);
    control.id = `${prefix}${index}`;
    control.dataset.repeatField = key;
    if (clear) control.value = "";
  });
  if (!row.querySelector(":scope > .remove-row")) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-row";
    remove.dataset.removeRepeat = groupName;
    remove.textContent = "删除";
    row.append(remove);
  }
}

function refreshRepeatRows(groupName) {
  const rows = [...document.querySelectorAll(`[data-repeat-row="${groupName}"]`)];
  rows.forEach((row, index) => {
    prepareRepeatRow(row, groupName, index + 1);
    row.querySelector(":scope > .remove-row").hidden = rows.length === 1;
  });
}

function addRepeatRow(groupName, values = {}) {
  const list = document.querySelector(`[data-repeat-list="${groupName}"]`);
  const row = list.firstElementChild.cloneNode(true);
  prepareRepeatRow(row, groupName, list.children.length + 1, true);
  REPEAT_GROUPS[groupName].fields.forEach(([key]) => { row.querySelector(`[data-repeat-field="${key}"]`).value = values[key] ?? ""; });
  list.append(row);
  refreshRepeatRows(groupName);
  return row;
}

function setupRepeatableForms() {
  Object.entries(REPEAT_GROUPS).forEach(([groupName, config]) => {
    const first = $(config.firstId).closest(".experience");
    const list = document.createElement("div");
    list.className = "repeat-list";
    list.dataset.repeatList = groupName;
    first.before(list);
    list.append(first);
    prepareRepeatRow(first, groupName, 1);
    const add = document.createElement("button");
    add.type = "button";
    add.className = "add-row";
    add.dataset.addRepeat = groupName;
    add.textContent = `＋ ${config.addLabel}`;
    list.after(add);
    refreshRepeatRows(groupName);
  });
}

function repeatRowsFromData(data, groupName) {
  if (Array.isArray(data?.[groupName])) return data[groupName];
  if (groupName === "certificates" && Array.isArray(data?.languages)) return data.languages.filter((row) => row?.name || row?.score || row?.date);
  const row = Object.fromEntries(REPEAT_GROUPS[groupName].fields.map(([key, prefix]) => [key, data?.[`${prefix}1`] ?? data?.[prefix] ?? ""]));
  return manualOneRow(row);
}

function collectManualForm() {
  const data = Object.fromEntries(MANUAL_SINGLE_FIELD_IDS.map((id) => [id, $(id).value.trim()]));
  Object.keys(REPEAT_GROUPS).forEach((groupName) => {
    data[groupName] = [...document.querySelectorAll(`[data-repeat-row="${groupName}"]`)].map((row) => Object.fromEntries(
      [...row.querySelectorAll("[data-repeat-field]")].map((control) => [control.dataset.repeatField, control.value.trim()])
    )).filter(manualHasValues);
  });
  return data;
}

function populateManualForm(data) {
  MANUAL_SINGLE_FIELD_IDS.forEach((id) => { if (Object.hasOwn(data || {}, id)) $(id).value = String(data[id] ?? ""); });
  Object.keys(REPEAT_GROUPS).forEach((groupName) => {
    const rows = repeatRowsFromData(data, groupName);
    const list = document.querySelector(`[data-repeat-list="${groupName}"]`);
    [...list.children].slice(1).forEach((row) => row.remove());
    prepareRepeatRow(list.firstElementChild, groupName, 1, true);
    const values = rows.length ? rows : [{}];
    REPEAT_GROUPS[groupName].fields.forEach(([key]) => { list.firstElementChild.querySelector(`[data-repeat-field="${key}"]`).value = values[0][key] ?? ""; });
    values.slice(1).forEach((row) => addRepeatRow(groupName, row));
    refreshRepeatRows(groupName);
  });
}

function manualProfileFromForm(data) {
  const educations = repeatRowsFromData(data, "educations");
  const experiences = repeatRowsFromData(data, "experiences");
  const skills = skillsFromText(data.skills);
  const internships = experiences.filter((row) => /实习|intern/i.test(row.title));
  const work = experiences.filter((row) => !internships.includes(row));
  const cadres = repeatRowsFromData(data, "cadres").map((row) => [
    ["职务", row.position], ["级别", row.level], ["时间", [row.start, row.end].filter(Boolean).join(" 至 ")], ["工作职责", row.duty]
  ].filter(([, value]) => value).map(([label, value]) => `${label}：${value}`).join("\n")).filter(Boolean).join("\n\n");
  const customFields = {};
  if (data.idType) customFields.证件类型 = data.idType;
  if (data.idNumber) customFields.证件号码 = data.idNumber;
  if (educations[0]?.end) customFields.毕业年份 = educations[0].end;
  return cleanProfile({
    name: data.fullName, phone: data.phone, email: data.email, gender: data.gender,
    birthDate: data.birthDate, age: data.age, nativePlace: data.nativePlace, wechat: data.wechat,
    nationality: data.nationality, countryRegion: data.countryRegion, politicalStatus: data.politicalStatus,
    currentResidence: data.currentResidence, householdRegistration: data.householdRegistration, workExperience: data.workExperience,
    education: educations,
    experiences, work, internships,
    jobIntent: { industry: data.intentIndustry, occupation: data.intentOccupation, currentSalary: data.intentCurrentSalary, expectedSalary: data.intentExpectedSalary, city: data.intentCity, arrival: data.intentArrival },
    projects: repeatRowsFromData(data, "projects"),
    cadres: repeatRowsFromData(data, "cadres"),
    skills,
    languages: repeatRowsFromData(data, "languageAbilities"),
    certificates: repeatRowsFromData(data, "certificates").map((row) => ({ ...row, description: row.description || (row.score ? `成绩：${row.score}` : "") })),
    awards: repeatRowsFromData(data, "awards"),
    customFields,
    extras: { skills: data.skills, selfEvaluation: data.selfEvaluation, studentCadres: cadres }
  });
}

function manualFormFromProfile(profile) {
  return {
    fullName: profile?.name, gender: profile?.gender, phone: profile?.phone, email: profile?.email,
    birthDate: profile?.birthDate, age: profile?.age, idType: profile?.customFields?.证件类型,
    idNumber: profile?.customFields?.证件号码, nativePlace: profile?.nativePlace,
    wechat: profile?.wechat, nationality: profile?.nationality, countryRegion: profile?.countryRegion, politicalStatus: profile?.politicalStatus,
    currentResidence: profile?.currentResidence,
    householdRegistration: profile?.householdRegistration || profile?.customFields?.户口所在地, workExperience: profile?.workExperience,
    intentIndustry: profile?.jobIntent?.industry, intentOccupation: profile?.jobIntent?.occupation, intentCurrentSalary: profile?.jobIntent?.currentSalary,
    intentExpectedSalary: profile?.jobIntent?.expectedSalary, intentCity: profile?.jobIntent?.city, intentArrival: profile?.jobIntent?.arrival,
    educations: profile?.education || [],
    experiences: profile?.experiences?.length ? profile.experiences : [...(profile?.internships || []), ...(profile?.work || [])],
    projects: profile?.projects || [],
    cadres: profile?.cadres?.length ? profile.cadres : (profile?.extras?.studentCadres ? [{ duty: profile.extras.studentCadres }] : []),
    languageAbilities: profile?.languages || [], certificates: profile?.certificates || [],
    awards: profile?.awards || [],
    skills: profile?.extras?.skills || profile?.extras?.specialty || (profile?.skills || []).map((row) => row.description || row.name).join("\n"), selfEvaluation: profile?.extras?.selfEvaluation
  };
}

function hasManualData(data) {
  return MANUAL_SINGLE_FIELD_IDS.some((id) => String(data?.[id] ?? "").trim()) ||
    Object.keys(REPEAT_GROUPS).some((groupName) => repeatRowsFromData(data, groupName).some(manualHasValues));
}

function isManualFormData(data) {
  return ["fullName", "internCompany1", "educations", "experiences", "cadres", "skills", "languageAbilities", "certificates"].some((key) => Object.hasOwn(data || {}, key));
}

function restoredManualData(stored) {
  const data = stored[MANUAL_STORAGE_KEY] || (stored.profile && manualFormFromProfile(stored.profile));
  if (!data?.certificates?.length || !stored.profile?.certificates?.length) return data;
  return { ...data, certificates: data.certificates.map((row) => {
    if (row.description || !row.name) return row;
    const matches = stored.profile.certificates.filter((item) => item.name === row.name && item.description);
    return matches.length === 1 ? { ...row, description: matches[0].description } : row;
  }) };
}

async function saveManualProfile(showMessage = true) {
  const formData = collectManualForm();
  const profile = manualProfileFromForm(formData);
  await chrome.storage.local.set({ [MANUAL_STORAGE_KEY]: formData, profile });
  show(profile);
  if (showMessage) message("表单已保存，可使用 AI 匹配填充。", false, "manual-status");
  return profile;
}

async function loadManualForm() {
  const stored = await chrome.storage.local.get([MANUAL_STORAGE_KEY, "profile"]);
  const data = restoredManualData(stored);
  if (data) populateManualForm(data);
}

$("applicationForm").addEventListener("submit", (event) => event.preventDefault());
$("saveLocalBtn").addEventListener("click", async () => {
  try { await saveManualProfile(); }
  catch (error) { message(`保存失败：${error.message || error}`, true, "manual-status"); }
});
$("loadLocalBtn").addEventListener("click", async () => {
  try {
    const stored = await chrome.storage.local.get([MANUAL_STORAGE_KEY, "profile"]);
    const data = restoredManualData(stored);
    if (!data) return message("没有找到本地保存的数据。", true, "manual-status");
    populateManualForm(data);
    message("已读取本地数据。", false, "manual-status");
  } catch (error) { message(`读取失败：${error.message || error}`, true, "manual-status"); }
});
$("exportBtn").addEventListener("click", () => {
  const data = collectManualForm();
  const blob = new Blob([JSON.stringify({ _meta: { version: "3.0", exportedAt: new Date().toISOString() }, ...data }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const name = data.fullName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "_") || "网申信息";
  link.href = url;
  link.download = `网申表单_${name}_${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  message("表单文件已导出。", false, "manual-status");
});
$("importFile").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("文件内容不是有效对象");
    const data = isManualFormData(parsed) ? parsed : manualFormFromProfile(parsed);
    if (!hasManualData(data)) throw new Error("文件中没有可导入的表单数据");
    populateManualForm(data);
    message("导入成功；需要保留时请点击保存到本地。", false, "manual-status");
  } catch (error) { message(`导入失败：${error.message || error}`, true, "manual-status"); }
  finally { event.target.value = ""; }
});
$("applicationForm").addEventListener("click", (event) => {
  const add = event.target.closest("[data-add-repeat]");
  if (add) return addRepeatRow(add.dataset.addRepeat).querySelector("input, select, textarea")?.focus();
  const remove = event.target.closest("[data-remove-repeat]");
  if (!remove) return;
  const groupName = remove.dataset.removeRepeat;
  remove.closest("[data-repeat-row]").remove();
  refreshRepeatRows(groupName);
});

// ponytail: tiny smoke check keeps the parser honest without a test framework.
console.assert(parseText("姓名：张三\n邮箱：a@example.com").name === "张三");
console.assert(parseText("姓名：张三\u200b性别：男").gender === "男");
const splitExperience = parseText("工作经历\n公司A｜前端开发\n2024.01 — 2024.02\n职责：负责页面\n实习经历\n公司B｜前端开发实习生\n2025.01 — 2025.02\n职责：负责组件");
console.assert(splitExperience.work[0].company === "公司A" && splitExperience.internships[0].company === "公司B");
console.assert(certificatesFromLanguages("大学英语四级（CET-4）2024-02：516")[0].date === "2024-02");
console.assert(parseText("项目经历\n项目A｜开发\n2024.01 — 2024.02\n项目摘要\n项目职责：负责实现").projects[0].responsibilities === "项目职责：负责实现");
console.assert(parseText("民族：汉族\n微信号：wx123").nationality === "汉族");
console.assert(parseText("现居住地：广东省广州市").currentResidence === "广东省广州市");
console.assert(parseText("自定义字段：自定义内容").customFields.自定义字段 === "自定义内容");
console.assert(parseText("教育经历\n学校：广东工业大学\n学院：计算机学院\n专业：计算机科学与技术\n学号：3223004472").education[0].college === "计算机学院");
console.assert(parseText("教育经历\n学习方式：全日制").education[0].training === "全日制");
console.assert(parseText("教育经历\n受教育类型：统招全日制").education[0].training === "统招全日制");
console.assert(parseText('{"education":[{"school":"A","start":"2025-01","end":"2024-01"}]}').education[0].start === "2024-01");
console.assert(parseText("项目经历\n项目A\n2024.01 — 2024.02\n摘要\n核心职责：负责实现").projects[0].responsibilities === "核心职责：负责实现");
const preservedExperience = parseText("工作经历\n公司A｜产品部\n前端开发 2024.01 — 2024.02\n职责：\n负责页面开发\n亮点：\n1. 封装组件\n2. 优化请求").work[0];
console.assert(preservedExperience.description === "职责：\n负责页面开发");
console.assert(preservedExperience.highlights === "亮点：\n1. 封装组件\n2. 优化请求");
console.assert(parseText("工作经历\n公司A｜部门\n前端开发 2024.01 — 2024.02\n职责：负责页面\n**亮点：**\n1. 提升性能").work[0].highlights === "亮点：\n1. 提升性能");
console.assert(parseText("工作经历\n公司A｜部门\n前端开发 2024.01 — 2024.02\n工作内容：负责页面\n工作亮点：\n1. 提升性能").work[0].highlights === "工作亮点：\n1. 提升性能");
console.assert(awardsFromText("奖学金｜2024.09\n表现优秀")[0].description === "表现优秀");
console.assert(awardsFromText("- **奖学金**｜2024.09\n- 获奖级别：院级\n- 表现优秀")[0].level === "院级");
const completeCoverage = parseText("教育经历\n学校：某大学\n专业：计算机\n学历：本科\n就读日期：2023-09-01\n毕业日期：2027-06-30\n实习经历\n1. 实习一\n2. 实习二\n项目经历\n项目A\n2024-01-01 至 2024-06-30\n描述\n竞赛/获奖经历\n奖项｜2025-04-01\n说明");
console.assert(completeCoverage.education[0].start === "2023-09-01" && completeCoverage.education[0].end === "2027-06-30");
console.assert(completeCoverage.internships.length === 2 && completeCoverage.projects.length === 1 && completeCoverage.awards[0].date === "2025-04-01");
setupRepeatableForms();
const popupReady = Promise.all([load(), loadManualForm()]);
popupReady.then(async () => { const tab = await activeTab(); currentWindowId = tab?.windowId; if (tab?.id != null) await showPageAction(tab.id); }).catch(() => {});
