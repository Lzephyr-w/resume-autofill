const $ = (id) => document.getElementById(id);

const emptyProfile = () => ({
  name: "", phone: "", email: "", gender: "", birthDate: "", nationality: "", politicalStatus: "", wechat: "", nativePlace: "", currentResidence: "", householdRegistration: "", workExperience: "",
  jobIntent: { industry: "", occupation: "", currentSalary: "", expectedSalary: "", city: "", arrival: "" },
  education: [], experiences: [], work: [], internships: [], projects: [], cadres: [], skills: [], languages: [], certificates: [], awards: [], customFields: {}, extras: { hobbies: "", specialty: "", selfEvaluation: "", skills: "", languages: "", awards: "", studentCadres: "" }
});

function skillsFromText(value) {
  const source = String(value || "").trim();
  if (!source) return [];
  const rows = source.split(/(?:^|\n)\s*(?=\d+[、.．)]\s*|[-*•]\s*)/).map((item) => item.replace(/^\s*(?:\d+[、.．)]|[-*•])\s*/, "").trim()).filter(Boolean);
  const items = rows.length > 1 ? rows : (() => {
    const parts = source.split(/[、,，]/).map((item) => item.trim()).filter(Boolean);
    return parts.length > 1 && parts.every((item) => item.length <= 30 && !/熟悉|掌握|了解|使用|开发|设计|流程|协作|等/.test(item)) ? parts : [source];
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
  name: ["姓名", "名字"], phone: ["手机", "手机号", "电话", "联系电话"], email: ["邮箱", "电子邮箱", "email"],
  gender: ["性别"], birthDate: ["出生日期", "生日"], nationality: ["国籍", "民族"], politicalStatus: ["政治面貌"], wechat: ["微信号"], nativePlace: ["籍贯"], currentResidence: ["现居住地", "当前居住地", "现居地", "居住地"], workExperience: ["工作经验", "工作年限", "经验年限"],
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
  ["name", "phone", "email", "gender", "birthDate", "nationality", "politicalStatus", "wechat", "nativePlace", "currentResidence", "householdRegistration", "workExperience"].forEach((key) => {
    if (p[key] != null) base[key] = String(p[key]).trim();
  });
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
  const standard = new Set(["name", "phone", "email", "gender", "birthDate", "nationality", "politicalStatus", "wechat", "nativePlace", "currentResidence", "householdRegistration", "workExperience", "jobIntent", "education", "experiences", "work", "internships", "projects", "cadres", "skills", "languages", "certificates", "awards", "customFields", "extras"]);
  Object.entries(p).forEach(([key, value]) => {
    if (!standard.has(key) && value != null && typeof value !== "object" && String(value).trim()) base.customFields[key] = String(value).trim();
  });
  ["hobbies", "specialty", "selfEvaluation", "skills", "languages", "awards", "studentCadres"].forEach((key) => {
    if (p.extras?.[key] != null) base.extras[key] = String(p.extras[key]).trim();
  });
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
  const detailLine = (line) => /^(?:摘要|描述|项目描述|项目简介|项目内容|职责|项目职责|项目中职责|工作职责|工作内容|工作描述|亮点|工作亮点|工作成果|业绩亮点|成果|负责|使用|基于|实现|参与|主导|github|ai使用)\s*[：:]/i.test(String(line || ""));
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
        responsibilities.push(heading);
        continue;
      }
      if (!project && inHighlights) highlights.push(raw);
      else if (!/^项目成果[：:]/.test(raw)) {
        details.push(raw);
        if (project) (inResponsibilities ? responsibilities : summary).push(raw);
      }
    }
    row.description = details.join("\n").trim();
    if (project) {
      row.summary = summary.join("\n").trim();
      row.responsibilities = responsibilities.join("\n").trim();
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
  p.birthDate = findValue(lines, aliases.birthDate); p.nationality = findValue(lines, aliases.nationality);
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
    p.education.push({ school: school.replace(/^学校[：:]\s*/, "").replace(/\s*(计算机学院|软件学院|信息学院)$/, ""), college, major, degree: degreeValue || before.find((line) => /本科|硕士|博士|大专/.test(line))?.replace(/^(?:学历|学位)[：:]\s*/, "") || "", studentId, start: startValue || dateParts[0] || "", end: endValue || dateParts[1] || "", gpa: gpaText, rank, training: findValue(educationLines, ["培养方式", "学习方式", "就读方式"]) });
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
  p.extras.selfEvaluation = sectionBody(source, ["个人评价"]).split(/识别的与以下保存|保存的内容存在/)[0].trim();
  p.extras.skills = [...new Set((p.extras.selfEvaluation.match(/Vue3|React|TypeScript|JavaScript|微信小程序|uni-app|Node\.js|LangChain|Pinia|WebSocket|Vite/g) || []))].join("、");
  p.skills = skillsFromText(p.extras.skills);
  return cleanProfile(p);
}

function show(profile) { $("preview").textContent = JSON.stringify(profile, null, 2); }
function message(value, error = false, target = "status", variant = "") {
  const status = $(target) || $("status");
  status.textContent = value;
  status.className = variant || (error ? "error" : "success");
  status.style.color = error ? "#b42318" : "#15803d";
  if (status.id !== "status") { $("status").textContent = ""; $("status").className = ""; }
  chrome.storage.local.set({ lastStatus: value, lastStatusError: error, lastStatusTarget: status.id, lastStatusVariant: status.className });
}
async function activeTab() { return (await chrome.tabs.query({ active: true, currentWindow: true }))[0]; }
const CONTENT_MESSAGE_SUFFIX = "_V51";
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
  return [...new Set(parts)][0] || "";
}
function missingFieldLabels(missingFields, fields) {
  const pageLabels = (fields || []).map(fieldLabel).filter(Boolean);
  return [...new Set(missingFields || [])].reduce((result, label) => {
    const onPage = pageLabels.some((pageLabel) => pageLabel === label || pageLabel.includes(label) || label.includes(pageLabel));
    result[onPage ? "unresolved" : "unavailable"].push(label);
    return result;
  }, { unresolved: [], unavailable: [] });
}
function uniqueEmptyFields(fields) {
  const seen = new Set();
  return (fields || []).filter(Boolean).filter((field) => {
    if (field.currentValue) return false;
    const label = fieldLabel(field);
    // Navigation/search controls are editable page chrome, not application fields.
    if (!label || /^(?:首页|home|搜索|search|登录|login|搜索(?:职位|岗位|工作)?关键词|(?:职位|岗位|工作)关键词)$/i.test(label)) return false;
    const key = field.key || [field.module || "page", field.repeatIndex ?? "", label || field.index].join("::");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function aiFieldContext(field, profile) {
  const index = Math.max(0, Number(field?.repeatIndex) || 0, Number(field?.occurrence) || 0);
  const all = profile?.experiences?.length ? profile.experiences : [...(profile?.internships || []), ...(profile?.work || [])];
  const module = String(field?.module || "");
  const label = fieldLabel(field);
  const personalLocation = /家乡|籍贯|户籍|户口|居住|所在(?:地|地点|地区)?/.test(label) && !/(?:工作|期望|任职|办公)/.test(`${module} ${label}`);
  const personalSource = /家乡|籍贯/.test(label) ? profile?.nativePlace
    : /户籍|户口/.test(label) ? profile?.householdRegistration
      : /居住|所在(?:地|地点|地区)?/.test(label) ? profile?.currentResidence : "";
  const rows = /实习/.test(module) ? (profile?.internships?.length ? profile.internships : all) : /工作/.test(module) ? (profile?.work?.length ? profile.work : all) : /工作地点|月薪|职位名称|所在部门|工作性质/.test(label) ? all : [];
  const intentField = /求职意向|期望|现月薪|工作城市|行业|职业|到岗/.test(`${module} ${label}`);
  const sourceValue = /期望从事行业|期望行业|意向行业/.test(label) ? profile?.jobIntent?.industry
    : /期望从事职业|期望职业|意向职位/.test(label) ? profile?.jobIntent?.occupation
      : /期望月薪|期望薪资|期望待遇/.test(label) ? profile?.jobIntent?.expectedSalary
        : /期望工作城市|期望城市|意向城市|期望工作地点|期望地点/.test(label) ? profile?.jobIntent?.city
          : /工作地点|办公地点|工作地区|办公城市|任职地点/.test(label) ? rows[index]?.location : personalSource;
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
  const amounts = [...String(value || "").toLowerCase().matchAll(/(\d+(?:\.\d+)?)\s*(万|w|k|千)?/g)].map(([, number, unit]) => Number(number) * (/万|w/.test(unit) ? 10000 : /k|千/.test(unit) ? 1000 : 1));
  return amounts.length ? [Math.min(...amounts), Math.max(...amounts)] : null;
};
const localCandidate = (field, profile) => {
  const value = aiFieldContext(field, profile).sourceValue;
  const options = field.options || [];
  const wanted = choiceToken(value);
  if (!wanted) return "";
  const exact = options.find((option) => choiceToken(option) === wanted);
  if (exact) return exact;
  if (/薪|工资|待遇/.test(fieldLabel(field))) {
    const range = salaryRange(value);
    const matches = range && range[0] === range[1] ? options.filter((option) => {
      const candidate = salaryRange(option);
      return candidate && candidate[0] <= range[0] && range[0] <= candidate[1];
    }) : [];
    return matches.length === 1 ? matches[0] : "";
  }
  const matches = wanted.length >= 2 ? options.filter((option) => {
    const candidate = choiceToken(option);
    return candidate.length >= 2 && (candidate.includes(wanted) || wanted.includes(candidate));
  }) : [];
  return matches.length === 1 ? matches[0] : uniqueAnchorOption(value, options);
};
const isMultiIndustryField = (field) => !!field?.isMultiSelector && /行业/.test(fieldLabel(field));
const isCascadeField = (field) => !!field && (!field.isMultiSelector || isMultiIndustryField(field)) && field.optionSource !== "native"
  && (!!field.hasConfirmation || /城市|地点|地区|所在地|家乡|籍贯|户籍|户口|居住|行业|职业|职位|岗位/.test(fieldLabel(field)));
const committedCascadeCandidate = (value, source) => {
  const candidate = choiceToken(value); const wanted = choiceToken(source);
  const short = (text) => text.replace(/(?:特别行政区|自治区|省|市|区|县)$/g, "");
  return candidate === wanted || short(candidate) === short(wanted)
    || wanted.endsWith(candidate) && !/(?:省|自治区|特别行政区)$/.test(String(value));
};
const localCandidateAssignments = (fields, profile) => fields.flatMap((field) => {
  const value = localCandidate(field, profile);
  const source = aiFieldContext(field, profile).sourceValue;
  // A unique province is only a navigation step, not a committed city value.
  if (isCascadeField(field) && !committedCascadeCandidate(value, source)) return [];
  return value ? [{ key: field.key, index: field.index, label: field.label, value, confidence: 1 }] : [];
});
const isLocationField = (field) => /城市|地点|地区|所在地|家乡|籍贯|户籍|户口|居住/.test(fieldLabel(field));
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
  return (field?.hasSearch || isLocationField(field)) && (!field.isMultiSelector || isMultiIndustryField(field)) && !occupied.has(field.key) && /行业|职业|职位|岗位|城市|地点|地区|所在地/.test(fieldLabel(field)) && value
    ? [{ key: field.key, index: field.index, label: field.label, value, confidence: 1, sourceValue: value, locationHint: isLocationField(field) ? locationSearchHint(field, profile) : "", searchFallback: true, directLocationSearch: isLocationField(field) }] : [];
});
const searchableSelectorAssignments = (fields, profile, occupied = new Set()) => fields.flatMap((field) => {
  const value = localCandidate(field, profile) || aiFieldContext(field, profile).sourceValue;
  return field?.isMultiSelector && !isCascadeField(field) && field.hasSearch && !occupied.has(field.key) && /城市|地点|地区|所在地|行业|职业|职位|岗位/.test(fieldLabel(field)) && value
    ? [{ key: field.key, index: field.index, label: field.label, value, confidence: 1, sourceValue: value, local: true }] : [];
});
const cascadeChildOptions = (options, parentOptions) => (options || []).filter((option) => !parentOptions.has(choiceToken(option)));
const retryFieldKeys = (scannedFields, filled) => new Set(filled ? (scannedFields || [])
  .filter(Boolean)
  .filter((field) => field.optionSource === "popup" && !field.options?.length && !/日期|时间|年月|date|month/i.test(`${field.type || ""} ${field.label || ""} ${field.ariaLabel || ""} ${field.placeholder || ""}`))
  .map((field) => field.key) : []);
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

async function load() {
  const { profile, lastStatus, lastStatusError, lastStatusTarget, lastStatusVariant } = await chrome.storage.local.get(["profile", "lastStatus", "lastStatusError", "lastStatusTarget", "lastStatusVariant"]);
  if (profile) show(profile);
  if (lastStatus) {
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

$("ai").addEventListener("click", async () => {
  const tab = await activeTab();
  if (!isWebPage(tab?.url)) return message("请先打开要填充的网页表单。", true, "ai-status");
  const formData = collectManualForm();
  if (!hasManualData(formData)) return message("请先填写手动表单。", true, "ai-status");
  try {
    message("正在读取表单字段并请求 AI 匹配…", false, "ai-status");
    const profile = await saveManualProfile(false);
    await injectCurrentContent(tab.id);
    const target = await formFrame(tab.id);
    // Deterministic structured fill is the source of truth. AI only handles
    // fields that remain unresolved after real page choices are attempted.
    const repaired = await sendToFrame(tab.id, target.frameId, { type: "FILL_PROFILE", profile, options: { onlyEmpty: true, deferChoices: true } });
    let schema = await sendToFrame(tab.id, target.frameId, { type: "GET_FORM_SCHEMA" });
    let emptyFields = uniqueEmptyFields(schema.fields || []);
    if (!emptyFields.length) {
      return message(`已填充 ${repaired.filled} 项，保留页面原值 ${repaired.skippedFields?.length || 0} 项；请检查后自行提交。`, false, "ai-status");
    }
    let candidateFilled = 0; let aiFilled = 0;
    const aiDiagnostics = [];
    // The second pass only rereads cascade children that appeared after a real selection.
    let retryKeys;
    for (let pass = 0; pass < 2 && emptyFields.length; pass++) {
      const passFields = retryKeys ? emptyFields.filter((field) => retryKeys.has(field.key)) : emptyFields;
      const eligible = passFields.filter((field) => !missingLocalValue(field, profile) && hasProfileContext(field, profile));
      const live = eligible.length ? await sendToFrame(tab.id, target.frameId, { type: "GET_LIVE_OPTIONS", keys: eligible.map((field) => field.key) }) : { fields: [] };
      const eligibleKeys = new Set(eligible.map((field) => field.key));
      const scannedFields = uniqueEmptyFields(live.fields || []).filter((field) => eligibleKeys.has(field.key));
      const liveFields = fieldsWithLiveOptions(scannedFields).map((field) => ({ ...field, profileContext: aiFieldContext(field, profile) }));
      const absentFields = emptyFields.filter((field) => missingLocalValue(field, profile));
      const baseDiagnostics = absentFields.map((field) => ({ key: field.key, label: field.label, optionCount: 0, optionSource: "not-requested", reason: "profile-value-missing" }));
      const unreadChoices = scannedFields.filter((field) => ["popup", "popup-not-found"].includes(field.optionSource) && !field.options?.length)
        .map((field) => ({ key: field.key, label: field.label, optionCount: 0, optionSource: field.optionSource, reason: field.optionSource === "popup-not-found" ? "candidate-not-read" : "options-unavailable" }));
      if (!liveFields.length) { aiDiagnostics.push({ pass: pass + 1, fields: [], model: [...baseDiagnostics, ...unreadChoices], apply: [] }); break; }
      const localCascade = cascadeCandidateAssignments(liveFields.filter(isCascadeField), profile);
      const localCascadeKeys = new Set(localCascade.map((item) => item.key));
      const localAssignments = localCandidateAssignments(liveFields.filter((field) => !localCascadeKeys.has(field.key) && !field.isMultiSelector), profile);
      const directSearch = searchableSelectorAssignments(liveFields, profile, new Set(localAssignments.map((item) => item.key)));
      const local = await sendToFrame(tab.id, target.frameId, { type: "APPLY_ASSIGNMENTS", assignments: [...localAssignments, ...directSearch] });
      candidateFilled += local.filled || 0;
      const locallyFilled = new Set((local.diagnostics || []).filter((item) => item.reason === "filled").map((item) => item.key));
      const aiFields = liveFields.filter((field) => !locallyFilled.has(field.key) && !localCascadeKeys.has(field.key));
      let result = { assignments: [], diagnostics: [] };
      if (aiFields.length) {
        const response = await fetch("http://127.0.0.1:8787/match", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile, fields: aiFields })
        });
        result = await response.json();
        if (!response.ok) throw new Error(result.error || "AI 服务返回错误");
      }
      const fieldFor = (assignment) => liveFields.find((field) => field.key === assignment.key || field.index === assignment.index);
      const aiCascade = (result.assignments || []).filter((assignment) => isCascadeField(fieldFor(assignment)))
        .map((assignment) => {
          const field = fieldFor(assignment);
          const sourceValue = field?.profileContext?.sourceValue || assignment.value;
          return { ...assignment, value: isLocationField(field) ? sourceValue : assignment.value, sourceValue, locationHint: isLocationField(field) ? locationSearchHint(field, profile) : "", directLocationSearch: isLocationField(field) };
        });
      const cascadeAssignments = [...localCascade, ...aiCascade, ...searchableCascadeAssignments(liveFields.filter(isCascadeField), profile, new Set([...localCascade, ...aiCascade].map((item) => item.key)))];
      const regularAssignments = (result.assignments || []).filter((assignment) => !isCascadeField(fieldFor(assignment)));
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
            const response = await fetch("http://127.0.0.1:8787/match", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile, fields: [childField] }) });
            const childResult = await response.json();
            if (!response.ok) throw new Error(childResult.error || "AI 服务返回错误");
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
      aiDiagnostics.push({ pass: pass + 1, fields: liveFields.map(({ key, index, label, module, repeatIndex, optionSource, optionCount, hasSearch, scrolled, options }) => ({ key, index, label, module, repeatIndex, optionSource, optionCount, hasSearch, scrolled, options })), model: [...baseDiagnostics, ...unreadChoices, ...model, ...noAssignment], apply: [...(local.diagnostics || []), ...(applied.diagnostics || [])] });
      console.info("[resume-autofill] AI select diagnostics", aiDiagnostics.at(-1));
      aiFilled += appliedAiFilled;
      retryKeys = retryFieldKeys(scannedFields, (local.filled || 0) + (applied.filled || 0));
      if (!retryKeys.size) break;
      schema = await sendToFrame(tab.id, target.frameId, { type: "GET_FORM_SCHEMA" });
      emptyFields = uniqueEmptyFields(schema.fields || []).filter((field) => !missingLocalValue(field, profile));
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
    await chrome.storage.local.set({ lastAiDiagnostics: allDiagnostics });
    show({ ...profile, __aiDiagnostics: allDiagnostics });
    const failurePriority = { "page-option-or-validation-failed": 0, "field-not-found": 0, "cascade-child-options-not-read": 1, "not-a-page-option": 1, "candidate-not-read": 1, "options-unavailable": 1, "low-confidence": 2, "ai-no-assignment": 3, "unknown-field": 3, "cascade-parent-selected": 3, "profile-value-missing": 9 };
    const seenFailures = new Set();
    const failed = aiDiagnostics.flatMap((item) => [...item.model, ...item.apply])
      .filter((item) => item.reason && !["accepted", "filled", "profile-value-missing"].includes(item.reason))
      .sort((a, b) => (failurePriority[a.reason] ?? 4) - (failurePriority[b.reason] ?? 4))
      .filter((item) => { const key = item.key || item.label; if (!key || seenFailures.has(key)) return false; seenFailures.add(key); return true; }).slice(0, 3);
    const reasonText = { "popup-not-found": "未找到弹层", "candidate-not-read": "候选未读取", "cascade-child-options-not-read": "父级后未读到子级候选", "options-unavailable": "候选为空", "not-a-page-option": "候选校验拒绝", "ai-no-assignment": "AI未返回", "page-option-or-validation-failed": "点击后页面未确认", "low-confidence": "AI置信度不足", "unknown-field": "字段未定位", "field-not-found": "字段未定位", "cascade-parent-selected": "子级候选未确认", "profile-value-missing": "本地档案未提供", "deferred-to-ai": "已交给候选 AI", "page-value-protected": "已有值保护", "start-date-not-confirmed": "开始日期未确认，已跳过结束日期" };
    const structuralSalary = allDiagnostics.structured.find((item) => item.label === "月薪(税前)" && item.row === 2 && !["filled", "deferred-to-ai"].includes(item.reason));
    const choiceText = structuralSalary?.choice ? (structuralSalary.choice.optionFound ? `（候选“${structuralSalary.choice.option}”，点击后“${structuralSalary.choice.afterConfirm || structuralSalary.choice.afterClick || "空"}”）` : "（未找到3500对应候选）") : "";
    const structuralText = structuralSalary ? `；第2条经历月薪：${reasonText[structuralSalary.reason] || structuralSalary.reason}${choiceText}` : "";
    const structuralAward = allDiagnostics.structured.find((item) => item.section === "获奖经历" && item.row === 2 && item.label === "获奖时间" && item.reason !== "filled");
    const awardSource = structuralAward && (!structuralAward.value ? "本地日期为空" : structuralAward.datePartCount < 2 ? "本地仅含年份" : "本地含年月");
    const choiceStep = (choice, part) => {
      const trace = choice || {};
      const path = trace.path ? `路径 ${trace.path}，` : "";
      const state = trace.optionFound ? `候选“${trace.option || ""}”` : trace.failure === "popup-not-found" ? "未找到弹层" : "未找到候选";
      const after = trace.afterConfirm || trace.afterClick || "空";
      return `${part}：${path}${state}，点击后“${after}”${trace.confirmed ? "，已确认" : `，未确认${trace.failure ? `（${trace.failure}）` : ""}`}`;
    };
    const awardChoice = structuralAward?.choice ? `（${choiceStep(structuralAward.choice, "年")}${structuralAward.choice.month ? `；${choiceStep(structuralAward.choice.month, "月")}` : ""}）` : "（未记录选择路径）";
    const educationFailures = allDiagnostics.structured.filter((item) => item.section === "教育背景"
      && /学校名称|专业名称|学历/.test(item.label) && item.reason !== "filled");
    const educationText = educationFailures.length ? `；教育选择诊断：${educationFailures.map((item) => {
      const trace = item.choice || {};
      const state = trace.afterClickState || {};
      return `${choiceStep(trace, item.label)}，click=${trace.clickObserved ? "到达" : "未到达"}，显示=${(state.displays || []).join("/") || "空"}，弹层=${state.popupVisible ? "开" : "关"}`;
    }).join("；")}` : "";
    const awardTarget = structuralAward ? `（${structuralAward.targetIndex >= 0 ? "字段已定位" : "字段未定位"}，日期控件 ${structuralAward.dateControlCount || 0} 个）` : "";
    const awardText = structuralAward ? `；第2条获奖时间：${awardSource}，${reasonText[structuralAward.reason] || structuralAward.reason}${awardChoice}${awardTarget}` : "";
    const diagnosticText = failed.length ? `；AI诊断：${failed.map((item) => {
      const area = item.choice?.area;
      const choice = item.reason === "page-option-or-validation-failed" && item.choice ? (area ? `（地区协议 V${area.protocol || "?"}，值“${area.source || "空"}”，提示“${area.hint || area.companyHint || "空"}”，搜索“${area.search || area.city || "空"}”，弹层${area.popupFound ? "有" : "无"}，搜索框${area.searchFound ? "有" : "无"}，候选 ${area.candidates?.length || 0} 个${item.choice.optionFound ? `，匹配“${item.choice.option || ""}”，点击${item.choice.selectionAttempts?.length || 0}处（原生${item.choice.selectionAttempts?.some((attempt) => attempt.trusted) ? "已发送" : "未发送"}），已选${item.choice.selectionObserved ? "是" : "否"}，确认${item.choice.confirmFound ? "有" : "无"}` : "，未匹配"}，确认后“${item.choice.afterConfirm || "空"}”）` : item.choice.optionFound ? `（候选“${item.choice.option || ""}”，点击后“${item.choice.afterClick || "空"}”，确认后“${item.choice.afterConfirm || "空"}”${item.choice.confirmFound ? "，已找到确认" : "，无确认"}）` : "（未找到页面候选）")
        : "";
      const detail = choice ? "" : item.reason === "low-confidence" && Number.isFinite(Number(item.confidence)) ? `（置信度 ${Number(item.confidence).toFixed(2)}，候选 ${item.optionCount || 0} 个）`
        : ["ai-no-assignment", "not-a-page-option", "candidate-not-read", "options-unavailable"].includes(item.reason) ? `（候选 ${item.optionCount || 0} 个${item.optionSource ? `，${item.optionSource}` : ""}）` : "";
      return `${item.label || item.key}:${reasonText[item.reason] || item.reason}${choice || detail}`;
    }).join("、")}` : "";
    const dateFailures = allDiagnostics.structured.filter((item) => /开始时间|结束时间/.test(item.label) && !["filled", "page-value-protected"].includes(item.reason)).slice(0, 4);
    const dateText = dateFailures.length ? `；日期选择诊断：${dateFailures.map((item) => {
      const trace = item.choice || {}; const picker = trace.datePicker || {};
      const year = picker.targetYear ? `${picker.currentYear || "?"}→${picker.targetYear}(${picker.yearMethod || "未选择"}${picker.yearOptionFound === false ? "/无候选" : ""})` : "未识别";
      const month = picker.month ? `${picker.month}月${picker.monthFound ? "已点击" : "未找到"}` : "未识别";
      return `${item.section}[${item.row}].${item.label}:${reasonText[item.reason] || item.reason}（协议 ${picker.protocol ? `V${picker.protocol}` : "旧版"}，路径 ${trace.path || "无"}，弹层 ${picker.panelFound ? "年月" : picker.popupCount ? "非年月" : "无"}，年份 ${year}，月份 ${month}，显示“${picker.after || item.actual || trace.afterConfirm || "空"}”${trace.failure ? `，${trace.failure}` : ""}）`;
    }).join("；")}` : "";
    const absentProfile = [absentIntent, absentStructured].filter(Boolean).join("、");
    message(`结构化填充 ${repaired.filled} 项，实时候选匹配 ${candidateFilled} 项，AI 补充 ${aiFilled} 项，保留页面原值 ${repaired.skippedFields?.length || 0} 项${remaining.length ? `；页面仍有 ${remaining.length} 个空字段${examples ? `（${examples}）` : ""}` : ""}${unresolvedText ? `；结构化未完成：${unresolvedText}` : ""}${unavailableText ? `；页面未提供：${unavailableText}` : ""}${absentProfile ? `；本地档案未提供：${absentProfile}` : ""}${structuralText}${awardText}${educationText}${dateText}${diagnosticText}。请检查后自行提交。`, false, "ai-status");
  } catch (error) {
    const detail = String(error.message || error);
    if (detail.includes("Failed to fetch")) { $("ai-status").textContent = ""; $("ai-status").className = ""; message("配置已保存，但本地 Node 代理未启动。请先运行 README 中的 node 命令。", false, "connect-status", "hint"); }
    else message(detail.includes("Receiving end does not exist") ? "插件脚本未注入当前页面，请重新加载插件后重试。" : detail, true, "ai-status");
  }
});

const MANUAL_STORAGE_KEY = "applicationFormData";
const MANUAL_SINGLE_FIELD_IDS = [
  "fullName", "gender", "phone", "email", "birthDate", "idType", "idNumber", "nativePlace",
  "wechat", "nationality", "politicalStatus", "currentResidence", "householdRegistration", "workExperience", "intentIndustry", "intentOccupation", "intentCurrentSalary", "intentExpectedSalary", "intentCity", "intentArrival", "skills", "selfEvaluation"
];
const REPEAT_GROUPS = {
  educations: { firstId: "university", label: "教育经历", addLabel: "新增教育经历", fields: [["degree", "education"], ["training", "educationType"], ["school", "university"], ["college", "college"], ["major", "major"], ["start", "educationStart"], ["end", "graduationYear"], ["gpa", "gpa"]] },
  experiences: { firstId: "internCompany1", label: "经历", addLabel: "新增实习/工作经历", fields: [["company", "internCompany"], ["department", "internDepartment"], ["title", "internPosition"], ["start", "internStart"], ["end", "internEnd"], ["salary", "internSalary"], ["location", "internLocation"], ["reason", "internReason"], ["description", "internContent"]] },
  projects: { firstId: "projectName1", label: "项目", addLabel: "新增项目", fields: [["name", "projectName"], ["role", "projectRole"], ["start", "projectStart"], ["end", "projectEnd"], ["description", "projectDesc"], ["responsibilities", "projectDuty"]] },
  cadres: { firstId: "cadrePosition1", label: "干部经历", addLabel: "新增干部经历", fields: [["position", "cadrePosition"], ["level", "cadreLevel"], ["start", "cadreStart"], ["end", "cadreEnd"], ["duty", "cadreDuty"]] },
  languageAbilities: { firstId: "languageType1", label: "语言能力", addLabel: "新增语言能力", fields: [["language", "languageType"], ["proficiency", "languageProficiency"], ["speaking", "languageSpeaking"], ["reading", "languageReading"]] },
  certificates: { firstId: "languageCert1", label: "证书", addLabel: "新增证书", fields: [["name", "languageCert"], ["score", "languageScore"], ["date", "languageDate"]] },
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
    birthDate: data.birthDate, nativePlace: data.nativePlace, wechat: data.wechat,
    nationality: data.nationality, politicalStatus: data.politicalStatus,
    currentResidence: data.currentResidence, householdRegistration: data.householdRegistration, workExperience: data.workExperience,
    education: educations,
    experiences, work, internships,
    jobIntent: { industry: data.intentIndustry, occupation: data.intentOccupation, currentSalary: data.intentCurrentSalary, expectedSalary: data.intentExpectedSalary, city: data.intentCity, arrival: data.intentArrival },
    projects: repeatRowsFromData(data, "projects"),
    cadres: repeatRowsFromData(data, "cadres"),
    skills,
    languages: repeatRowsFromData(data, "languageAbilities"),
    certificates: repeatRowsFromData(data, "certificates").map((row) => ({ ...row, description: row.score ? `成绩：${row.score}` : "" })),
    awards: repeatRowsFromData(data, "awards"),
    customFields,
    extras: { skills: data.skills, selfEvaluation: data.selfEvaluation, studentCadres: cadres }
  });
}

function manualFormFromProfile(profile) {
  return {
    fullName: profile?.name, gender: profile?.gender, phone: profile?.phone, email: profile?.email,
    birthDate: profile?.birthDate, idType: profile?.customFields?.证件类型,
    idNumber: profile?.customFields?.证件号码, nativePlace: profile?.nativePlace,
    wechat: profile?.wechat, nationality: profile?.nationality, politicalStatus: profile?.politicalStatus,
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
  const data = stored[MANUAL_STORAGE_KEY] || (stored.profile && manualFormFromProfile(stored.profile));
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
    const data = stored[MANUAL_STORAGE_KEY] || (stored.profile && manualFormFromProfile(stored.profile));
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
load();
loadManualForm();
