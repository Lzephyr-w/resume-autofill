const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync(require.resolve("../popup.js"), "utf8");
const contentSource = fs.readFileSync(require.resolve("../content.js"), "utf8");
const backgroundSource = fs.readFileSync(require.resolve("../background.js"), "utf8");
const mockSource = fs.readFileSync(require.resolve("./mock-form.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(require.resolve("../manifest.json"), "utf8"));
const profileHelpers = source.slice(0, source.indexOf("function findValue"));
const { cleanProfile } = Function(`${profileHelpers}; return { cleanProfile };`)();
const helpers = source.slice(source.indexOf("function fieldLabel"), source.indexOf("const missingLocalValue"));
const { missingFieldLabels, uniqueEmptyFields, aiFieldContext, fieldsWithLiveOptions, hasProfileContext, localCandidate, localCandidateAssignments, retryFieldKeys, cascadeChildOptions, isCascadeField, cascadeCandidateAssignments, searchableCascadeAssignments, searchableSelectorAssignments, locationSearchHint, profileSources, semanticTextField } = Function(`${helpers}; return { missingFieldLabels, uniqueEmptyFields, aiFieldContext, fieldsWithLiveOptions, hasProfileContext, localCandidate, localCandidateAssignments, retryFieldKeys, cascadeChildOptions, isCascadeField, cascadeCandidateAssignments, searchableCascadeAssignments, searchableSelectorAssignments, locationSearchHint, profileSources, semanticTextField };`)();

const result = missingFieldLabels(["民族", "期望工作城市"], [{ label: "期望工作城市" }]);
assert.deepEqual(result, { unresolved: ["期望工作城市"], unavailable: ["民族"] });
assert.equal(cleanProfile({ awards: [{ name: "奖项", awardDate: "2025-06" }] }).awards[0].date, "2025-06");
assert.deepEqual(profileSources({ label: '目标职位类别' }, { jobIntent: { occupation: '前端开发', industry: '互联网' }, phone: '13800138000' }), [{ path: 'jobIntent["occupation"]', value: '前端开发' }]);
assert.deepEqual(profileSources({ label: '目标职位类别' }, { jobIntent: { industry: '互联网' } }), []);
const linkedAwards = { awards: [{ name: '优秀学生二等奖学金', description: '学业优秀' }, { name: '算法杯二等奖', level: '省级', description: '算法竞赛' }] };
assert.deepEqual(profileSources({ label: '获奖类型', module: '获奖信息', repeatIndex: 1 }, linkedAwards), [{ path: 'awards[1].name', value: '算法杯二等奖' }]);
assert.deepEqual(profileSources({ label: '奖项名称', module: '获奖信息', repeatIndex: 1 }, linkedAwards), [{ path: 'awards[1].name', value: '算法杯二等奖' }]);
assert.equal(cleanProfile({ workExperience: "1年" }).workExperience, "1年");
assert.equal(cleanProfile({ age: 22 }).age, "22");
assert.equal(cleanProfile({ birthDate: "2004-10" }).birthDate, "2004-10-01");
assert.equal(cleanProfile({ birthDate: "2004年2月" }).birthDate, "2004-02-01");
assert.equal(cleanProfile({ birthDate: "2004-10-02" }).birthDate, "2004-10-02");
assert.equal(cleanProfile({ education: [{ "受教育类型": "统招全日制" }] }).education[0].training, "统招全日制");
const manualProfileSource = source.slice(source.indexOf("function manualProfileFromForm"), source.indexOf("function manualFormFromProfile"));
const repeatConfigSource = source.slice(source.indexOf("const REPEAT_GROUPS"), source.indexOf("function prepareRepeatRow"));
const repeatDataSource = source.slice(source.indexOf("function repeatRowsFromData"), source.indexOf("function collectManualForm"));
const { REPEAT_GROUPS, repeatRowsFromData } = Function(`${repeatConfigSource}; ${repeatDataSource}; return { REPEAT_GROUPS, repeatRowsFromData };`)();
const manualProfileFromForm = Function("repeatRowsFromData", "skillsFromText", "cleanProfile", `${manualProfileSource}; return manualProfileFromForm;`)(
  repeatRowsFromData, () => [], cleanProfile
);
const manualFormSource = source.slice(source.indexOf("function manualFormFromProfile"), source.indexOf("function hasManualData"));
const manualFormFromProfile = Function(`${manualFormSource}; return manualFormFromProfile;`)();
const countryProfile = manualProfileFromForm(JSON.parse(JSON.stringify({ countryRegion: " 中国 ", nationality: "汉族" })));
assert.equal(countryProfile.countryRegion, "中国");
assert.equal(countryProfile.nationality, "汉族");
assert.equal(manualFormFromProfile(countryProfile).countryRegion, "中国");
assert.equal(cleanProfile({ nationality: "汉族" }).countryRegion, "");
assert.deepEqual(profileSources({ module: "个人信息", autocomplete: "country-name" }, countryProfile), [{ path: "countryRegion", value: "中国" }]);
for (const label of ["国家/地区", "国家地区", "国家（地区）", "Country/Region"]) {
  assert.equal(aiFieldContext({ module: "个人信息", label }, countryProfile).sourceValue, "中国");
  assert.equal(localCandidate({ module: "个人信息", label, options: ["中国", "美国"] }, countryProfile), "中国");
}
assert.equal(aiFieldContext({ module: "个人信息", label: "国家/地区" }, { nationality: "汉族" }).sourceValue, undefined);
assert.deepEqual(REPEAT_GROUPS.educations.fields.find(([key]) => key === "rank"), ["rank", "educationRank"]);
assert.deepEqual(REPEAT_GROUPS.educations.fields.find(([key]) => key === "gpaType"), ["gpaType", "gpaType"]);
const scaleProfile = manualProfileFromForm({educations:[{school:"回归院校",gpa:"3.6",gpaType:"5分制",rank:"前20%"}]});
assert.equal(scaleProfile.education[0].gpa,"3.6");
assert.equal(manualFormFromProfile(scaleProfile).educations[0].gpaType,"5分制");
assert.equal(scaleProfile.education[0].rank,"前20%");
assert.equal(manualProfileFromForm(manualFormFromProfile({ education: [{ school: "回归院校", gpa: "3.7", rank: "12%" }] })).education[0].rank, "12%");
const highlightRows = [
  { company: "公司甲", title: "前端实习生", description: "开发页面", highlights: "加载时间缩短 30%\n交付 5 个页面" },
  { company: "公司乙", title: "前端工程师", highlights: "优化组件" }
];
const highlightProfile = manualProfileFromForm(JSON.parse(JSON.stringify({ experiences: highlightRows })));
assert.deepEqual(highlightProfile.experiences, highlightRows);
assert.equal(highlightProfile.internships[0].highlights, highlightRows[0].highlights);
assert.equal(highlightProfile.work[0].highlights, highlightRows[1].highlights);
assert.deepEqual(manualFormFromProfile(highlightProfile).experiences, highlightRows);
assert.equal(repeatRowsFromData({ internHighlights1: "旧格式业绩" }, "experiences")[0].highlights, "旧格式业绩");
assert.equal(repeatRowsFromData({ internCompany1: "旧公司" }, "experiences")[0].highlights, "");
const highlightsPrefix = REPEAT_GROUPS.experiences.fields.find(([key]) => key === "highlights")[1];
assert.ok(fs.readFileSync(require.resolve("../popup.html"), "utf8").includes(`亮点/工作业绩<textarea id="${highlightsPrefix}1"`));
assert.ok(profileSources({ module: "实习经历", repeatIndex: 0 }, highlightProfile).some(({ path, value }) => path === "internships[0].highlights" && value === highlightRows[0].highlights));
assert.equal(manualProfileFromForm({ certificates: [{ name: "证书甲", score: "95", description: "独立说明" }] }).certificates[0].description, "独立说明");
assert.equal(manualProfileFromForm({ certificates: [{ name: "证书乙", score: "90" }] }).certificates[0].description, "成绩：90");
const restoreSource = source.slice(source.indexOf("function restoredManualData"), source.indexOf("async function saveManualProfile"));
const restoredManualData = Function("MANUAL_STORAGE_KEY", `${restoreSource}; return restoredManualData;`)("applicationFormData");
assert.deepEqual(restoredManualData({ applicationFormData: { certificates: [{ name: "证书甲" }, { name: "证书乙" }] }, profile: { certificates: [{ name: "证书乙", description: "乙说明" }] } }).certificates.map((row) => row.description || ""), ["", "乙说明"]);
assert.equal(uniqueEmptyFields([{ key: "page::工作地点::text::0", label: "工作地点", module: "", repeatIndex: 0 }, { key: "page::工作地点::text::1", label: "工作地点", module: "", repeatIndex: 0 }]).length, 2);
assert.deepEqual(uniqueEmptyFields([undefined, { key: "city", label: "期望城市" }]), [{ key: "city", label: "期望城市" }]);
assert.deepEqual(uniqueEmptyFields(), []);
assert.deepEqual(aiFieldContext({ label: "培训机构", module: "培训经历", repeatIndex: 0 }, { jobIntent: { city: "广州" } }), {});
assert.deepEqual(aiFieldContext({ label: "所在地点", module: "个人信息" }, { nativePlace: "广东省汕头市", currentResidence: "广东省广州市" }).locationCandidates, [{ key: "nativePlace", label: "籍贯", value: "广东省汕头市" }, { key: "currentResidence", label: "现居住地", value: "广东省广州市" }]);
assert.equal(aiFieldContext({ label: "所在地点", module: "个人信息" }, { currentResidence: "广东省广州市" }).sourceValue, "广东省广州市");
assert.deepEqual(fieldsWithLiveOptions([{ type: "text", optionSource: "popup", options: ["计算机软件"] }, { type: "radio", optionSource: "radio", options: [] }]), [{ type: "text", optionSource: "popup", options: ["计算机软件"] }]);
assert.deepEqual(fieldsWithLiveOptions([undefined, { options: ["广州"] }]), [{ options: ["广州"] }]);
assert.deepEqual(fieldsWithLiveOptions(), []);
assert.equal(hasProfileContext({ label: "培训地点", module: "培训经历", repeatIndex: 0 }, { jobIntent: { city: "广州" } }), false);
assert.equal(hasProfileContext({ label: "期望工作城市", module: "求职意向" }, { jobIntent: { city: "广州" } }), true);
assert.equal(hasProfileContext({ label: "家乡", module: "个人信息" }, { nativePlace: "广东省汕头市" }), true);
assert.equal(aiFieldContext({ label: "学历类型", module: "教育经历", repeatIndex: 0 }, { education: [{ training: "统招全日制" }] }).sourceValue, "统招全日制");
assert.equal(aiFieldContext({ label: "精通程度", module: "语言能力", repeatIndex: 0 }, { languages: [{ proficiency: "熟练" }] }).sourceValue, "熟练");
assert.equal(localCandidate({ label: "精通程度", module: "语言能力", options: ["入门", "日常会话", "商务会话", "无障碍沟通", "母语"] }, { languages: [{ proficiency: "熟练" }] }), "商务会话");
const candidateProfile = { jobIntent: { industry: "互联网", occupation: "前端开发", expectedSalary: "3500", city: "广州市" }, work: [{ location: "广州市" }, { location: "深圳市" }] };
assert.equal(localCandidate({ label: "期望从事行业", options: ["制造业", "互联网/电子商务"] }, candidateProfile), "互联网/电子商务");
assert.equal(localCandidate({ label: "期望从事行业", options: ["制造业", "互联网/电子商务"] }, { jobIntent: { industry: "互联网行业" } }), "互联网/电子商务");
assert.equal(localCandidate({ label: "期望从事职业", options: ["Java开发工程师", "Web前端开发工程师"] }, { jobIntent: { occupation: "前端工程" } }), "Web前端开发工程师");
assert.equal(localCandidate({ label: "期望月薪(税前)", options: ["2001～4000", "8001～10000"] }, candidateProfile), "2001～4000");
assert.equal(localCandidate({ label: "期望月薪(税前)", options: ["8001～10000", "10001～15000", "15001～25000"] }, { jobIntent: { expectedSalary: "10-15K" } }), "10001～15000");
assert.equal(localCandidate({ label: "期望月薪(税前)", options: ["8001～10000", "10001～15000", "15001～25000"] }, { jobIntent: { expectedSalary: "10-20K" } }), "");
assert.equal(localCandidate({ label: "工作地点", module: "工作经历", repeatIndex: 1, options: ["广州", "深圳"] }, candidateProfile), "深圳");
assert.equal(aiFieldContext({ label: "工作地点", module: "", repeatIndex: 0, occurrence: 1 }, candidateProfile).experience.location, "深圳市");
assert.equal(locationSearchHint({ label: "工作地点", module: "工作经历", repeatIndex: 0 }, { work: [{ location: "广东省", company: "广州市示例公司" }] }), "广州市");
assert.equal(locationSearchHint({ label: "工作地点", module: "工作经历", repeatIndex: 0 }, { work: [{ location: "广东省", company: "广州示例公司" }] }), "广州");
assert.equal(localCandidate({ label: "期望从事职业", options: ["前端开发工程师", "前端开发实习生"] }, candidateProfile), "");
assert.deepEqual(localCandidateAssignments([{ key: "city", index: 2, label: "期望工作城市", options: ["广州", "深圳"] }], candidateProfile), [{ key: "city", index: 2, label: "期望工作城市", value: "广州", confidence: 1 }]);
assert.deepEqual(localCandidateAssignments([{ key: "city", index: 2, label: "期望工作城市", options: ["广东省", "浙江省"] }], candidateProfile), []);
assert.deepEqual(localCandidateAssignments([{ key: "city", index: 2, label: "工作地点", module: "工作经历", repeatIndex: 0, options: ["广东省", "广州市"] }], candidateProfile), [{ key: "city", index: 2, label: "工作地点", value: "广州市", confidence: 1 }]);
assert.deepEqual(cascadeChildOptions(["广东省", "广州市", "深圳市"], new Set(["广东省"])), ["广州市", "深圳市"]);
assert.equal(isCascadeField({ label: "期望从事行业", optionSource: "popup" }), true);
assert.equal(isCascadeField({ label: "期望从事行业", optionSource: "popup", hasSearch: true, hasConfirmation: true, isMultiSelector: true }), false);
assert.equal(isCascadeField({ label: "工作地点", optionSource: "popup", hasSearch: true, hasConfirmation: true, isMultiSelector: true }), false);
assert.equal(isCascadeField({ label: "期望从事职业", optionSource: "popup" }), true);
assert.equal(isCascadeField({ label: "自定义分类", optionSource: "popup", hasConfirmation: true }), true);
assert.equal(isCascadeField({ label: "期望从事行业", optionSource: "native" }), false);
assert.deepEqual(cascadeCandidateAssignments([
  { key: "work-1", index: 1, label: "工作地点", module: "工作经历", repeatIndex: 0, optionSource: "popup", options: ["广东省", "浙江省"] },
  { key: "work-2", index: 2, label: "工作地点", module: "工作经历", repeatIndex: 1, optionSource: "popup", options: ["广东省", "浙江省"] }
], { work: [{ location: "广东省广州市" }, { location: "浙江省杭州市" }] }).map(({ key, value, directLocationSearch }) => ({ key, value, directLocationSearch })), [{ key: "work-1", value: "广东省广州市", directLocationSearch: true }, { key: "work-2", value: "浙江省杭州市", directLocationSearch: true }]);
assert.deepEqual(cascadeCandidateAssignments([{ key: "ambiguous", index: 0, label: "期望从事职业", optionSource: "popup", options: ["前端开发工程师", "前端开发实习生"] }], candidateProfile), []);
assert.deepEqual(searchableCascadeAssignments([{ key: "industry", index: 0, label: "期望从事行业", hasSearch: true }], candidateProfile).map(({ key, value }) => ({ key, value })), [{ key: "industry", value: "互联网" }]);
assert.deepEqual(searchableCascadeAssignments([{ key: "city", index: 0, label: "期望工作城市", hasSearch: true, isMultiSelector: true }], candidateProfile), []);
assert.deepEqual(searchableCascadeAssignments([{ key: "industry", index: 0, label: "期望从事行业", hasSearch: true, isMultiSelector: true }], candidateProfile), []);
assert.deepEqual(searchableCascadeAssignments([{ key: "work-city", index: 0, label: "工作地点", module: "工作经历", repeatIndex: 0, hasSearch: true }], candidateProfile).map(({ key, value, directLocationSearch }) => ({ key, value, directLocationSearch })), [{ key: "work-city", value: "广州市", directLocationSearch: true }]);
assert.deepEqual(searchableSelectorAssignments([{ key: "industry", index: 0, label: "期望从事行业", hasSearch: true, isMultiSelector: true, options: ["制造业", "互联网/电子商务"] }], candidateProfile).map(({ key, value }) => ({ key, value })), [{ key: "industry", value: "互联网/电子商务" }]);
assert.deepEqual(searchableSelectorAssignments([{ key: "industry", index: 0, label: "期望从事行业", isMultiSelector: true, options: ["制造业", "互联网/电子商务"] }], candidateProfile).map(({ key, value }) => ({ key, value })), [{ key: "industry", value: "互联网/电子商务" }]);
assert.deepEqual([...retryFieldKeys([{ key: "city", optionSource: "popup", options: [] }], 1)], ["city"]);
assert.deepEqual([...retryFieldKeys([undefined, { key: "city", optionSource: "popup", options: [] }], 1)], ["city"]);
assert.deepEqual([...retryFieldKeys(undefined, 1)], []);
assert.deepEqual([...retryFieldKeys([], 0)], []);
const rankOptionSource = contentSource.slice(contentSource.indexOf("const rankOption ="), contentSource.indexOf("const awardLevel ="));
const { rankOption } = Function(`const clean = (value) => String(value || "").trim(); ${rankOptionSource}; return { rankOption };`)();
assert.equal(rankOption("15%", ["前10%", "前20%", "前30%"]), "前20%");
const valueMatchesSource = contentSource.slice(contentSource.indexOf("const valueMatches ="), contentSource.indexOf("async function applyValue"));
const valueMatches = Function("normalize", "salaryRange", "dateParts", "rankOption", `${valueMatchesSource}; return valueMatches;`)(
  (value) => String(value || "").replace(/\s/g, ""), () => null, () => [], rankOption
);
assert.equal(valueMatches("TOP20%", "15%", "成绩排名"), true);
assert.equal(valueMatches("基于工具", "基于工具 开发测试平台，构建查询流程。", "项目描述"), false);
assert.equal(valueMatches("完整项目说明", "完整项目说明", "项目描述"), true);
const projectPartsSource = contentSource.slice(contentSource.indexOf("const projectParts ="), contentSource.indexOf("const clickOption ="));
const projectParts = Function(`${projectPartsSource}; return projectParts;`)();
const fullDescription = "基于工具 开发测试平台，构建查询流程。\n链接：https://example.test/project";
assert.deepEqual(projectParts({ description: fullDescription, responsibilities: "负责界面交互" }), { summary: fullDescription, responsibilities: "负责界面交互" });
assert.equal(projectParts({ description: fullDescription }).summary, fullDescription);
assert.deepEqual(projectParts({ description: "项目完整摘要\n项目职责：负责界面交互" }), { summary: "项目完整摘要", responsibilities: "项目职责：负责界面交互" });
const projectFieldOverrideSource = contentSource.slice(contentSource.indexOf("const projectFieldOverride ="), contentSource.indexOf("const rowField ="));
const projectFieldOverride = Function("controlSelector", "editable", "fieldTitle", "labelText", "normalize", `${projectFieldOverrideSource}; return projectFieldOverride;`)(
  "input, textarea", () => true, (control) => control.title, () => "", (value) => String(value || "").replace(/\s/g, "")
);
const shortDuty = { title: "职责", matches: () => false };
const detailedDuty = { title: "项目中职责", matches: () => true };
const projectRow = { querySelectorAll: () => [shortDuty, detailedDuty] };
assert.equal(projectFieldOverride(projectRow, "项目职务"), shortDuty);
assert.equal(projectFieldOverride(projectRow, "项目职责"), detailedDuty);
assert.equal(projectFieldOverride({ querySelectorAll: () => [shortDuty] }, "项目职责"), null);
const selectionTargetSource = contentSource.slice(contentSource.indexOf("const selectionTarget ="), contentSource.indexOf("const choiceState ="));
const { selectionTarget, selectionTargets } = Function(`${selectionTargetSource}; return { selectionTarget, selectionTargets };`)();
const areaIcon = {};
const areaRow = { querySelector: () => areaIcon };
assert.equal(selectionTarget({ closest: (selector) => selector.includes("area-item-container") ? areaRow : null }), areaIcon);
const listIcon = {};
const listLabel = {};
const listRow = { className: "list-item-container", querySelector: (selector) => selector.includes("icon-container") ? listIcon : listLabel };
assert.equal(selectionTarget({ closest: (selector) => selector.includes("list-item-container") ? listRow : null }), listRow);
assert.deepEqual(selectionTargets({ closest: (selector) => selector.includes("list-item-container") ? listRow : null }), [listRow, listLabel, listIcon]);
const phoenixListRow = { className: "list-item-container list-item-container-two", querySelector: () => listIcon };
assert.equal(selectionTarget({ closest: (selector) => selector.includes("list-item-container") ? phoenixListRow : null }), listIcon);
const phoenixLabel = {};
const phoenixTargetsRow = { className: "list-item-container list-item-container-two", querySelector: (selector) => selector.includes("icon-container") ? listIcon : phoenixLabel };
assert.deepEqual(selectionTargets({ closest: (selector) => selector.includes("list-item-container") ? phoenixTargetsRow : null }), [listIcon, phoenixLabel, phoenixTargetsRow]);
assert.doesNotMatch(source, /forceMatch/);
assert.match(source, /cascade-parent-selected/);
assert.match(source, /keepOpen: true/);
assert.match(source, /for \(const initial of cascadeAssignments\)/);
assert.match(source, /level <= 6/);
assert.match(source, /keys: \[assignment\.key\], keepOpen: true/);
assert.match(source, /chrome\.scripting\.executeScript/);
assert.equal(source.match(/CONTENT_MESSAGE_SUFFIX = "_V(\d+)"/)[1], contentSource.match(/CONTENT_PROTOCOL = (\d+)/)[1]);
assert.match(contentSource, /__resumeAutofillContentProtocol/);
assert.match(source, /"受教育类型"/);
assert.match(backgroundSource, /type: "mousePressed", x, y, button: "left", buttons: 1/);
assert.match(contentSource, /rect\.width > 0 && rect\.height > 0/);
assert.match(contentSource, /only trust the debugger click after the tree actually expands/);
assert.match(contentSource, /atsx-tree-switcher/);
assert.match(contentSource, /bounded virtual-tree scan/);
assert.match(contentSource, /selectionAttempts/);
assert.match(contentSource, /record\.trusted/);
assert.match(contentSource, /const areaText = \(node\) => clean\(node\?\.innerText \|\| node\?\.textContent\)/);
assert.match(contentSource, /\.atsx-tree-node-content-wrapper/);
assert.match(contentSource, /const displaySelected =/);
assert.match(contentSource, /const treeCity =/);
assert.match(contentSource, /const isAtsxTree = !!areaPopup\.querySelector/);
assert.match(contentSource, /#id-card-select-component/);
assert.match(contentSource, /atsx-date-picker-period-month-label/);
assert.match(contentSource, /atsx-year-picker/);
assert.match(contentSource, /"获奖名称"/);
assert.match(contentSource, /atsx-period-month/);
assert.match(contentSource, /\.createFormSection-repeatable/);
assert.match(contentSource, /\.resumeEditForm-item/);
assert.match(mockSource, /ui === "atsx"/);
assert.match(mockSource, /#id-card-select-component/);
assert.match(mockSource, /#projectRows \.resumeEditForm-item/);
assert.match(mockSource, /#internshipRows \.resumeEditForm-item/);
assert.match(contentSource, /: \[selectionTarget\(city\)\]/);
assert.match(contentSource, /if \(!isAtsxTree\) return \[\.\.\.areaPopup\.querySelectorAll/);
assert.match(contentSource, /normalize\(el\.textContent\)\.endsWith\(normalize\(name\)\)/);
assert.match(contentSource, /for \(const term of citySearchTerms\)/);
assert.match(contentSource, /cityPart\.replace\(/);
assert.match(contentSource, /const cityPart = location\?\.\[2\]/);
assert.match(contentSource, /controlBox\]\.flatMap/);
assert.match(contentSource, /for \(const cityTarget of cityTargets\)/);
assert.match(contentSource, /await clickOption\(cityTarget, true, null, attempt\);/);
assert.match(contentSource, /waitFor\(selectionChanged, 1500\)/);
assert.match(contentSource, /!isLocationPicker/);
assert.match(contentSource, /area-city-not-found/);
assert.match(contentSource, /trace\.area = \{ protocol: CONTENT_PROTOCOL/);
assert.match(source, /locationSearchHint/);
assert.match(contentSource, /chooseOptions\.locationHint/);
assert.match(contentSource, /const companyHint/);
assert.match(contentSource, /for \(const plainTrusted of \[false, true\]\)/);
assert.match(contentSource, /else if \(phoenixTwoColumn\)/);
assert.match(contentSource, /await clickOption\(target, true, selectionChanged, attempt\)/);
assert.match(contentSource, /const multiSelector = !!selectedBeforeClick \|\| !!control\.closest/);
assert.match(contentSource, /descriptor\.isMultiSelector = .*phoenix-select--multi/s);
assert.match(contentSource, /CheckboxChecked/);
assert.match(contentSource, /RadioChecked/);
assert.match(contentSource, /const commitTargets = selectionTargets\(option\)/);
assert.match(contentSource, /!readControl\(\) && !\(multiSelector && trace\.selectionObserved\)/);
assert.match(contentSource, /\[\.\.\.new Set\(\[popup, \.\.\.popupFor\(control\)\]\)\]/);
assert.match(contentSource, /const waitForAreaResult = async/);
assert.match(contentSource, /queryResults\.push/);
assert.match(contentSource, /result\.settled && result\.count/);
assert.match(source, /searchableSelectorAssignments/);
assert.match(contentSource, /isMultiSelector/);
assert.match(contentSource, /list-item-container/);
assert.match(contentSource, /area-item-container/);
assert.match(source, /!field\.isMultiSelector/);
assert.match(contentSource, /commitTarget/);
assert.match(contentSource, /const commitTarget = commitTargets\[0\]/);
assert.doesNotMatch(contentSource, /chooseOptions\.deferConfirm \? option/);
assert.match(contentSource, /RESUME_AUTOFILL_TRUSTED_CLICK/);
assert.match(contentSource, /selectionObserved/);
assert.match(contentSource, /selection-not-observed/);
assert.match(contentSource, /await clickOption\(target, true, null, attempt, plainTrusted\)/);
assert.match(contentSource, /confirmAttempted/);
assert.doesNotMatch(contentSource, /multiCommitted/);
assert.match(contentSource, /await wait\(100\);/);
assert.match(contentSource, /confirmTarget = \{ tag: confirm\.tagName/);
assert.match(contentSource, /const phoenixSelectionCart = multiSelector/);
assert.match(contentSource, /popup\?\.matches\?\.\("\.constant-main-selector-container"\)/);
assert.match(contentSource, /right-container \.select-text-label/);
assert.match(contentSource, /trace\.selectionCartReady/);
assert.match(contentSource, /confirmationButton\(phoenixSelectionCart \|\| popup\)/);
assert.match(contentSource, /const phoenixTwoColumn = .*list-item-container-two/);
assert.match(contentSource, /plainPhoenixConfirm = !!phoenixSelectionCart && \/期望从事行业\//);
assert.match(contentSource, /plain-trusted-industry/);
assert.doesNotMatch(contentSource, /phoenixIndustry|phoenixNationality/);
assert.match(contentSource, /result\?\.clicked && \(!changed \|\| await waitFor\(changed, 150\)\)/);
assert.match(contentSource, /"项目职务": \["职务", "项目角色", "角色"\]/);
assert.match(contentSource, /"项目职责": \["职责", "项目中职责", "个人工作"\]/);
assert.doesNotMatch(contentSource, /\["项目职责", "role"\]/);
assert.match(contentSource, /label === "项目职责" \? row\?\.responsibilities \|\| parts\?\.responsibilities/);
assert.match(contentSource, /reason: "language-type-not-confirmed"/);
assert.match(contentSource, /if \(!multiSelector\) restoreChoiceSearch\(control, trace\.before\);/);
assert.match(contentSource, /trace\.restoreSkipped = "multi-selector"/);
assert.match(contentSource, /const scanPopup = !control\.closest/);
assert.match(contentSource, /if \(!control\?\.closest\?\.\("\.phoenix-select--multi"\)\)/);
assert.match(contentSource, /!actualDate\[2\] \|\| actualDate\[2\] === expectedDate\[2\]/);
assert.match(contentSource, /type\.endsWith\(suffix\)/);
assert.match(contentSource, /writeAndObserveSuggestion/);
assert.match(contentSource, /\["项目链接", "link"\]/);
assert.match(contentSource, /isSuggestionControl/);
assert.match(contentSource, /pointerdown/);
assert.match(contentSource, /a, button, \[role=button\]/);
assert.match(contentSource, /trace\.optionFound/);
assert.doesNotMatch(contentSource, /lastChoice\.optionFound/);
assert.match(contentSource, /semantic\.length \? semantic : leaves/);
assert.doesNotMatch(contentSource, /setSearchValue\(sourceSearch, sourceValue\)/);
assert.match(source, /childOptionsUpdated/);
assert.match(source, /confirmedValue/);
assert.match(contentSource, /const visibleCalendar = \(\) => popupRoots\(\)\.flatMap/);
assert.match(contentSource, /const owner = popupRoots\(\)\.find\(\(popup\) => popup === grid \|\| popup\.contains\(grid\)\)/);
assert.match(contentSource, /const day = sourceDay \|\| "01"/);
assert.match(contentSource, /if \(!candidate\) return null/);
assert.match(contentSource, /"英语能力"/);
assert.match(contentSource, /const isEnglishCertificate =/);
assert.match(contentSource, /const alignRows =/);
assert.match(contentSource, /englishCertificates: englishCertificates\.length/);
assert.match(contentSource, /await clickOption\(dayNode\)/);
assert.match(contentSource, /visibleCalendar\(\) \|\| calendar/);
assert.match(contentSource, /el\?\.closest\?\.\("div\.form\[id\]"\)/);
assert.match(contentSource, /!\/学号\/\.test\(anchor\)/);
assert.match(contentSource, /"评价内容"/);
assert.match(contentSource, /\["分数", "_score"\]/);
assert.match(contentSource, /let calendarPanel = panelFor\(calendar\)/);
assert.match(contentSource, /const dayNode = dayCell\?\.querySelector/);
assert.match(contentSource, /const commitCalendarInput = async/);
assert.match(contentSource, /input\[class\*='calendar-input'\]/);
assert.match(contentSource, /calendarInputScope = hasDayCells \? \(calendarPanel\.closest/);
assert.match(contentSource, /const hasDayCells = \[\.\.\.calendar\.querySelectorAll/);
assert.match(contentSource, /yearButton\(\)\?\.click\(\)/);
assert.match(contentSource, /if \(monthNode\) monthNode\.click\(\);/);
assert.match(contentSource, /const liveMonthPanel =/);
assert.match(contentSource, /dateValueMatches\(liveDateControl\(\), value\)/);
assert.match(mockSource, /phoenix-rerender/);
assert.match(contentSource, /normalize\(fieldTitle\(el\)\) === normalize\(label\)/);
assert.match(contentSource, /label === "成绩排名"/);
assert.ok(manifest.permissions.includes("scripting"));
assert.ok(manifest.permissions.includes("debugger"));
assert.match(backgroundSource, /chrome\.debugger\.attach/);
assert.match(backgroundSource, /Input\.dispatchMouseEvent/);
assert.match(backgroundSource, /sender\.id !== chrome\.runtime\.id/);
console.log("PASS popup diagnostics");

assert.equal(semanticTextField({ type: "text", isChoice: false, options: [] }), true);
assert.equal(semanticTextField({ type: "text", isChoice: true, options: [] }), false);
assert.deepEqual(profileSources({ module: "教育经历", repeatIndex: 1 }, { education: [{ major: "A" }, { major: "B" }] }), [{ path: "education[1].major", value: "B" }]);
assert.deepEqual(profileSources({ module: "教育经历", label: "GPA类型" }, { education: [{ gpa: "3.7" }] }), []);
assert.deepEqual(profileSources({ module: "教育经历", label: "GPA类型" }, { education: [{ gpa: "3.7", gpaScale: "4分制" }] }), [{ path: "education[0].gpaScale", value: "4分制" }]);
assert.deepEqual(profileSources({ module: "基本信息", label: "国籍/地区" }, { nationality: "测试民族" }), []);
assert.deepEqual(profileSources({ module: "基本信息", label: "国籍/地区" }, { nationality: "测试民族", countryRegion: "测试国家" }), [{ path: "countryRegion", value: "测试国家" }]);
assert.equal(aiFieldContext({ label: "目标工作城市" }, { jobIntent: { city: "测试城市" } }).sourceValue, "测试城市");
assert.equal(aiFieldContext({ label: "目标职位类别" }, { jobIntent: { occupation: "测试岗位" } }).sourceValue, "测试岗位");
assert.deepEqual(profileSources({ module: "工作经历", repeatIndex: 0, rowAnchor: { value: "陌生公司" } }, { work: [{ company: "A", title: "B" }] }), []);
const separatedExperienceProfile = { separateInternships: true, work: [], internships: [{ company: "实习公司", title: "实习岗位" }], experiences: [{ company: "实习公司", title: "实习岗位" }] };
assert.deepEqual(profileSources({ module: "工作经历", repeatIndex: 0 }, separatedExperienceProfile), []);
assert.deepEqual(aiFieldContext({ label: "职位名称", module: "工作经历", repeatIndex: 0 }, separatedExperienceProfile), {});
assert.equal(profileSources({ module: "实习经历", repeatIndex: 0 }, separatedExperienceProfile)[0].path, "internships[0].company");
assert.deepEqual(profileSources({ module: "证书", repeatIndex: 0, rowAnchor: { value: "页面已有其他证书" } }, { certificates: [{ name: "CET-4", date: "2024-06" }] }), []);
assert.deepEqual(profileSources({ module: "英语能力", repeatIndex: 0, rowAnchor: { value: "CET-6" } }, { certificates: [{ name: "CET-4" }, { name: "CET-6", date: "2025-06" }] }).map(({ path }) => path), ["certificates[1].name", "certificates[1].date"]);
const splitCertificates = { separateEnglishCertificates: true, certificates: [{ name: "CET-4" }, { name: "技术资格证", date: "2025-06" }] };
assert.deepEqual(profileSources({ module: "证书", repeatIndex: 0 }, splitCertificates).map(({ path }) => path), ["certificates[1].name", "certificates[1].date"]);
assert.deepEqual(profileSources({ module: "英语能力", repeatIndex: 0 }, splitCertificates).map(({ path }) => path), ["certificates[0].name"]);
assert.deepEqual(profileSources({ module: "证书", repeatIndex: 0 }, { separateEnglishCertificates: true, certificates: [{ name: "CET-4", date: "2024-06" }] }), []);
assert.doesNotMatch(contentSource, /assignment\.index != null/);
assert.doesNotMatch(source, /field\.index === assignment\.index/);
assert.doesNotMatch(source, /JSON\.stringify\(\{ profile, fields/);
assert.match(source, /body: JSON\.stringify\(\{ fields: payload \}\)/);
console.log("PASS generic text eligibility, repeat isolation and private payload");

(async () => {
  let pageHandler;
  const opened = [];
  Function("chrome", backgroundSource)({
    action: { onClicked: { addListener() {} } },
    sidePanel: { open: async ({ tabId }) => opened.push(tabId) },
    runtime: { id: "test-extension", onMessage: { addListener: (handler) => { pageHandler = handler; } },
      sendMessage: async (request) => { assert.deepEqual(request, { type: "RESUME_AUTOFILL_PAGE_RUN_V100", tabId: 42 }); return { status: "confirmed" }; } }
  });
  const request = { type: "RESUME_AUTOFILL_PAGE_FILL_V100" };
  assert.equal(pageHandler(request, { id: "foreign", tab: { id: 42 }, frameId: 0 }, () => {}), undefined);
  assert.equal(pageHandler(request, { id: "test-extension", tab: { id: 42 }, frameId: 1 }, () => {}), undefined);
  const relayed = await new Promise((resolve) => assert.equal(pageHandler(request, { id: "test-extension", tab: { id: 42 }, frameId: 0 }, resolve), true));
  assert.deepEqual(opened, [42]);
  assert.equal(relayed.status, "confirmed");
  console.log("PASS page fill bridge: sender/frame boundary and explicit target tab");
  let payload;
  let returned;
  const semanticMatch = Function("fetch", "proxyUrl", `${helpers}; return semanticMatch;`)(async (_url, request) => {
    payload = JSON.parse(request.body);
    return { ok: true, json: async () => ({ assignments: returned }) };
  }, "http://127.0.0.1:8787");
  const profile = { email: "private@example.test", phone: "13800138000", education: [{ major: "甲专业" }, { major: "乙专业" }], customFields: { apiKey: "must-not-send" } };
  const fields = [
    { key: "contact", type: "email", label: "接收通知的地址", autocomplete: "email" },
    { key: "major-2", type: "text", label: "主修方向", module: "教育经历", repeatIndex: 1 }
  ];
  returned = [
    { key: "contact", profilePath: "email", value: "invented@example.test", confidence: 0.95 },
    { key: "major-2", profilePath: "education[1].major", value: "模型生成内容", confidence: 0.95 }
  ];
  assert.deepEqual((await semanticMatch(fields, profile)).assignments.map(({ value }) => value), [profile.email, "乙专业"]);
  assert.deepEqual(payload.fields[0].sources, [{ path: "email" }]);
  assert.ok(!JSON.stringify(payload).includes(profile.email) && !JSON.stringify(payload).includes(profile.phone));
  assert.ok(!JSON.stringify(payload).includes("must-not-send"));
  for (const item of [
    { key: "expired", index: 0, profilePath: "email", confidence: 0.95 },
    { key: "contact", profilePath: "phone", confidence: 0.95 },
    { key: "major-2", profilePath: "education[0].major", confidence: 0.95 },
    { key: "contact", profilePath: "email", confidence: "NaN" },
    { key: "contact", profilePath: "email", confidence: 2 }
  ]) {
    returned = [item];
    assert.deepEqual((await semanticMatch(fields, profile)).assignments, []);
  }
  returned = Array(2).fill({ key: "contact", profilePath: "email", confidence: 0.95 });
  assert.deepEqual((await semanticMatch(fields, profile)).assignments, []);
  returned = [{ key: "award-2", profilePath: "awards[1].name", value: "其他", confidence: 0.99 }];
  const awardProfile = { awards: [{ name: "赛事名称", level: "省级" }, { name: "优秀学生二等奖学金", level: "院级" }] };
  const awardsMatched = await semanticMatch([{ key: "award-2", label: "奖项名称", type: "select", isChoice: true, module: "获奖信息", repeatIndex: 1, options: ["国家奖学金", "其他"] }], awardProfile);
  assert.equal(awardsMatched.assignments[0].value, "其他");
  assert.equal(payload.fields[0].sourceLevel, "院级");
  assert.deepEqual(payload.fields[0].sources, [{ path: "awards[1].name", value: "优秀学生二等奖学金" }]);
  console.log("PASS client AI boundary: local text, private payload, stale keys, wrong rows, duplicate mappings");
})().catch((error) => { console.error(error); process.exitCode = 1; });
