// src/native/exams/assessment.ts
var record = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var text = (v) => typeof v === "string" && v.trim().length > 0;
var units = (v) => Number.isSafeInteger(v) && v >= 0 && v <= 1e4;
var choices = ["A", "B", "C", "D"];
function canonicalNumeric(value) {
  const raw = value.trim();
  if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(raw)) return null;
  const sign = raw.startsWith("-") ? "-" : "";
  const [whole, fraction = ""] = raw.replace(/^[+-]/, "").replace(",", ".").split(".");
  const integer = whole.replace(/^0+(?=\d)/, "");
  const decimal = fraction.replace(/0+$/, "");
  return (integer === "0" && !decimal ? "" : sign) + integer + (decimal ? "." + decimal : "");
}
function canonicalRational(value) {
  const raw = value.trim();
  if (raw.length > 100) return null;
  let n, d;
  if (/^[+-]?\d+\/[+-]?\d+$/.test(raw)) {
    const pair = raw.split("/");
    n = BigInt(pair[0]);
    d = BigInt(pair[1]);
    if (d === 0n) return null;
  } else {
    const decimal = canonicalNumeric(raw);
    if (decimal === null) return null;
    const [whole, frac = ""] = decimal.split(".");
    n = BigInt(whole + frac);
    d = 10n ** BigInt(frac.length);
  }
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  let a = n < 0n ? -n : n, b = d;
  while (b) {
    const r = a % b;
    a = b;
    b = r;
  }
  return `${n / a}/${d / a}`;
}
var normalizedShort = (mode, value) => mode === "numeric" ? canonicalNumeric(value) : mode === "rational" ? canonicalRational(value) : value.trim();
function validateAssessment(input) {
  const errors = [];
  if (!record(input)) return { valid: false, errors: ["exam: object required"] };
  if (!text(input.id)) errors.push("exam: id required");
  if (!text(input.sourceRef)) errors.push("exam: sourceRef required");
  if (typeof input.sourceHash !== "string" || !/^[a-fA-F0-9]{64}$/.test(input.sourceHash)) errors.push("exam: SHA256 required");
  if (input.answerKeyVerified !== true) errors.push("exam: verified answer key required");
  if (input.rubricVerified !== true) errors.push("exam: verified rubric required");
  if (!Array.isArray(input.questions) || !input.questions.length) return { valid: false, errors: [...errors, "exam: complete questions required"] };
  if (!Number.isSafeInteger(input.questionCount) || input.questionCount !== input.questions.length) errors.push("exam: verified source questionCount must match imported questions");
  const ids = /* @__PURE__ */ new Set();
  let total = 0;
  Array.from(input.questions).forEach((q, index) => {
    const prefix = "question " + (index + 1) + ": ";
    if (!record(q)) {
      errors.push(prefix + "object required");
      return;
    }
    if (!text(q.id) || q.id !== q.id.trim()) errors.push(prefix + "nonblank unpadded id required");
    else if (ids.has(q.id)) errors.push(prefix + "duplicate id");
    else ids.add(q.id);
    if (!text(q.sourceRef)) errors.push(prefix + "sourceRef required");
    if (!units(q.maxMillipoints) || q.maxMillipoints === 0 && q.kind !== "self") errors.push(prefix + "positive integer millipoints required");
    else total += q.maxMillipoints;
    switch (q.kind) {
      case "mc":
        if (!Array.isArray(q.choices) || q.choices.length !== 4 || !Array.from(q.choices).every(text) || new Set(q.choices).size !== 4) errors.push(prefix + "four distinct choices required");
        if (!choices.includes(q.answer)) errors.push(prefix + "A-D answer required");
        break;
      case "tf": {
        if (!Array.isArray(q.answer) || q.answer.length !== 4 || !Array.from(q.answer).every((x) => typeof x === "boolean")) errors.push(prefix + "four boolean key entries required");
        const schedule = q.pointsByCorrectCount;
        if (!Array.isArray(schedule) || schedule.length !== 5 || !Array.from(schedule).every(units) || schedule[0] !== 0 || schedule[4] !== q.maxMillipoints || schedule.some((n, i) => i > 0 && n < schedule[i - 1])) errors.push(prefix + "explicit monotonic 0..max schedule of five integers required");
        break;
      }
      case "short": {
        if (!["numeric", "rational", "exact"].includes(q.mode)) errors.push(prefix + "explicit short answer mode required");
        if (!Array.isArray(q.acceptedAnswers) || !q.acceptedAnswers.length || !Array.from(q.acceptedAnswers).every(text)) errors.push(prefix + "nonblank accepted answers required");
        else {
          const normalized = q.acceptedAnswers.map((s) => normalizedShort(q.mode, s));
          if (normalized.includes(null) || new Set(normalized).size !== normalized.length) errors.push(prefix + "malformed or duplicate accepted answers");
        }
        break;
      }
      case "self":
        if (input.rubricVersion !== "MTM-BTVN-10-v1" || q.maxMillipoints !== 0 || "answer" in q || "acceptedAnswers" in q) errors.push(prefix + "self only allowed in BTVN without a key or points");
        break;
      case "essay":
        break;
      default:
        errors.push(prefix + "unsupported question kind");
    }
  });
  if (input.rubricVersion === "MTM-BTVN-10-v1" ? total <= 0 : total !== 1e4) errors.push(input.rubricVersion === "MTM-BTVN-10-v1" ? "exam: BTVN needs positive scored total" : "exam: total must equal 10000 millipoints");
  return { valid: !errors.length, errors };
}

// src/native/exams/mtm-profile.ts
var MTM_PROFILE = Object.freeze({ id: "MTM-12MC-4TF-6SHORT-v1", questionCount: 22, mc: 12, tf: 4, short: 6 });
function validateMtmAssessment(input) {
  const general = validateAssessment(input);
  if (!general.valid) return general;
  const exam = input, errors = [];
  if (exam.questionCount !== 22) errors.push("MTM profile: exactly22 source questions required (12MC + 4TF + 6short)");
  if (exam.questions.some((q) => q.kind === "essay")) errors.push("MTM profile: essays are excluded; do not convert them automatically");
  if (exam.questions.length === 22) exam.questions.forEach((q, i) => {
    const expected = i < 12 ? "mc" : i < 16 ? "tf" : "short";
    if (q.kind !== expected) errors.push("MTM profile: question " + (i + 1) + " must be " + expected + " in source section order");
  });
  return { valid: !errors.length, errors };
}

// src/native/exams/flexible-profile.ts
var FLEX_RUBRIC = "MTM-FLEX-10-v1";
function validatePracticeProfile(input) {
  const e = input;
  if (e?.rubricVersion !== FLEX_RUBRIC && e?.rubricVersion !== "MTM-BTVN-10-v1") return validateMtmAssessment(input);
  const gate = validateAssessment(input);
  if (!gate.valid) return gate;
  const errors = [];
  if (!e.id.startsWith("mtm-custom-") && !e.id.startsWith("mtm-preview-") && !e.id.startsWith("mtm-practice-")) errors.push("Flexible profile requires a custom edition");
  if (!Array.isArray(e.sections) || !e.sections.length || e.sections.length > 12) return { valid: false, errors: [...errors, "Sections required"] };
  let offset = 0;
  for (const section of e.sections) {
    if (!section || typeof section.label !== "string" || !section.label.trim() || section.label.length > 100 || !(e.rubricVersion === "MTM-BTVN-10-v1" ? ["mc", "tf", "short", "self"] : ["mc", "tf", "short"]).includes(section.kind) || !Number.isSafeInteger(section.count) || section.count < 1 || section.count > 300) {
      errors.push("Invalid section");
      continue;
    }
    if (e.questions.slice(offset, offset + section.count).length !== section.count || e.questions.slice(offset, offset + section.count).some((q) => q.kind !== section.kind)) errors.push("Section/question mismatch");
    offset += section.count;
  }
  if (offset !== e.questions.length || offset > 300) errors.push("Complete section counts required");
  return { valid: !errors.length, errors };
}

// src/native/exams/data.ts
var GRADES = [10, 11, 12];
var PERIODS = ["GK1", "CK1", "GK2", "CK2"];
var isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var boundedText = (value, max = 500) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
var isSha256 = (value) => typeof value === "string" && /^[a-fA-F0-9]{64}$/.test(value);
function isHttpsUrl(value) {
  if (typeof value !== "string" || value.length > 4096 || value !== value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}
function validPdfUrl(value, sha256) {
  if (typeof value !== "string" || !isSha256(sha256)) return false;
  if (value.startsWith("/")) return sha256 === sha256.toLowerCase() && (value === `/exam-assets/${sha256}.pdf` || value === `/qa-exam-assets/${sha256}.pdf`);
  return isHttpsUrl(value);
}
function validSourcePdf(value) {
  if (!isRecord(value) || value.verified !== true || !validPdfUrl(value.url, value.sha256) || !Number.isSafeInteger(value.bytes) || value.bytes < 8 || value.bytes > 15 * 1024 * 1024 || !Number.isSafeInteger(value.totalPages) || value.totalPages < 1 || value.totalPages > 200) return false;
  return Array.isArray(value.questionPages) && value.questionPages.length > 0 && new Set(value.questionPages).size === value.questionPages.length && Array.from(value.questionPages).every((p) => Number.isSafeInteger(p) && p >= 1 && p <= value.totalPages);
}
function validSourceSegments(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 12) return false;
  return value.every((segment) => isRecord(segment) && typeof segment.path === "string" && segment.path.length <= 300 && /^[a-zA-Z0-9][a-zA-Z0-9_/-]*\.png$/.test(segment.path) && !segment.path.includes("//") && !segment.path.split("/").includes("..") && isSha256(segment.sha256) && Number.isSafeInteger(segment.sourcePage) && (segment.sourcePage >= 1 || segment.mtmAuthored === true && segment.sourcePage === 0) && Number.isSafeInteger(segment.width) && segment.width >= 1 && segment.width <= 2e4 && Number.isSafeInteger(segment.height) && segment.height >= 1 && segment.height <= 3e4) && new Set(value.map((segment) => segment.path)).size === value.length;
}
function validatePracticeExam(input) {
  const gate = validatePracticeProfile(input);
  if (!gate.valid || !isRecord(input)) return gate;
  const errors = [];
  if (!boundedText(input.id, 120) || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(input.id) || input.id === "history") errors.push("Invalid or reserved route id");
  if (!GRADES.includes(input.grade) || !PERIODS.includes(input.period)) errors.push("Invalid grade or period");
  if (!boundedText(input.title, 300)) errors.push("Missing title");
  if (!Number.isSafeInteger(input.durationMinutes) || input.durationMinutes < 1 || input.durationMinutes > 1440) errors.push("Invalid duration");
  if (!isSha256(input.versionHash) || !boundedText(input.rubricVersion, 120)) errors.push("Invalid exam/rubric version");
  if (!isHttpsUrl(input.sourceUrl) || input.publicationVerified !== true || input.questionDisplayVerified !== true) errors.push("Publication/question display not verified");
  const material = input.sourceMaterial;
  if (!isRecord(material) || !["title", "publisher", "version", "locator"].every((key) => boundedText(material[key], 1e3))) errors.push("Incomplete source material");
  if (input.answerVerificationNote !== void 0 && !boundedText(input.answerVerificationNote, 2e3)) errors.push("Invalid answer verification note");
  if (input.preAttemptNotice !== void 0 && !boundedText(input.preAttemptNotice, 2e3)) errors.push("Invalid pre-attempt notice");
  if (input.sourcePdf !== void 0 && !validSourcePdf(input.sourcePdf)) errors.push("PDF question-page asset not verified");
  if (input.sourceInstructions !== void 0 && !validSourceSegments(input.sourceInstructions)) errors.push("Invalid question instructions");
  if (input.solutionInstructions !== void 0 && !validSourceSegments(input.solutionInstructions)) errors.push("Invalid solution instructions");
  if (input.mtmDocuments !== void 0) {
    const files = input.mtmDocuments;
    if (!isRecord(files) || !isRecord(files.questions) || !isRecord(files.solutions) || !validPdfUrl(files.questions.url, files.questions.sha256) || !validPdfUrl(files.solutions.url, files.solutions.sha256) || files.questions.sha256 === files.solutions.sha256) errors.push("Invalid separate MTM documents");
  }
  for (const q of input.questions) {
    if (!boundedText(q.id, 120) || ["__proto__", "constructor", "prototype"].includes(q.id)) errors.push("Unsafe question id");
    if (!boundedText(q.prompt ?? q.text ?? q.sourceRef, 2e4)) errors.push("Missing question text or source locator");
    if (q.prompt !== void 0 && !boundedText(q.prompt, 2e4)) errors.push("Invalid prompt");
    if (q.text !== void 0 && !boundedText(q.text, 2e4)) errors.push("Invalid text");
    if (q.convertedFrom !== void 0 && (input.rubricVersion !== "MTM-BTVN-10-v1" || q.kind !== "short" || q.convertedFrom !== "essay")) errors.push("Invalid essay conversion");
    if (q.kind === "self" && !boundedText(q.solution, 2e4) && !q.sourceContent?.solutions?.length) errors.push("Self question requires a solution");
    if (q.solution !== void 0 && !boundedText(q.solution, 2e4)) errors.push("Invalid solution");
    if (q.correctionNote !== void 0 && !boundedText(q.correctionNote, 2e3)) errors.push("Invalid correction note");
    if (q.sourceContent !== void 0) {
      if (!isRecord(q.sourceContent) || !validSourceSegments(q.sourceContent.questions) || !validSourceSegments(q.sourceContent.solutions)) errors.push("Invalid complete source fragments");
      else if (q.sourceContent.solutions.some((segment) => q.sourceContent.questions.some((question) => question.path === segment.path || question.sha256.toLowerCase() === segment.sha256.toLowerCase()))) errors.push("Question and solution fragments must be separate");
    }
    if (q.kind === "short" && !q.acceptedAnswers.every((answer) => boundedText(answer, 500))) errors.push("Short answer exceeds input limit");
    if (q.statements !== void 0 && (q.kind !== "tf" || !Array.isArray(q.statements) || q.statements.length !== 4 || !Array.from(q.statements).every((s) => boundedText(s, 1e4)))) errors.push("Invalid statement texts");
    if (input.sourcePdf === void 0 && q.sourceContent === void 0 && (!boundedText(q.prompt ?? q.text, 2e4) || q.kind === "tf" && !q.statements)) errors.push("Question content is missing; a source locator is insufficient");
  }
  return { valid: errors.length === 0, errors };
}

// server/btvn/class-schedule.json
var class_schedule_default = {
  "2K9 9+": [
    {
      weekday: 1,
      start: "17:30",
      end: "19:30"
    },
    {
      weekday: 3,
      start: "17:30",
      end: "19:30"
    },
    {
      weekday: 5,
      start: "17:30",
      end: "19:30"
    }
  ],
  "2K14": [
    {
      weekday: 1,
      start: "18:00",
      end: "20:00"
    },
    {
      weekday: 4,
      start: "09:00",
      end: "11:00"
    }
  ],
  "2K10 XPT": [
    {
      weekday: 1,
      start: "19:30",
      end: "21:30"
    },
    {
      weekday: 6,
      start: "15:30",
      end: "17:30"
    }
  ],
  "2K9 XPT": [
    {
      weekday: 1,
      start: "19:30",
      end: "21:30"
    },
    {
      weekday: 2,
      start: "19:30",
      end: "21:30"
    },
    {
      weekday: 4,
      start: "19:30",
      end: "21:30"
    }
  ],
  "2K9 8+": [
    {
      weekday: 2,
      start: "17:30",
      end: "19:30"
    },
    {
      weekday: 4,
      start: "17:30",
      end: "19:30"
    },
    {
      weekday: 6,
      start: "17:30",
      end: "19:30"
    }
  ],
  "2K10 9+": [
    {
      weekday: 2,
      start: "19:30",
      end: "21:30"
    },
    {
      weekday: 7,
      start: "08:00",
      end: "10:00"
    }
  ],
  "2K13": [
    {
      weekday: 2,
      start: "20:00",
      end: "22:00"
    },
    {
      weekday: 5,
      start: "20:00",
      end: "22:00"
    }
  ],
  "2K11 8+": [
    {
      weekday: 3,
      start: "19:30",
      end: "21:30"
    },
    {
      weekday: 7,
      start: "15:30",
      end: "17:30"
    }
  ],
  "2K11 XPT": [
    {
      weekday: 3,
      start: "19:30",
      end: "21:30"
    },
    {
      weekday: 6,
      start: "13:30",
      end: "15:30"
    }
  ],
  "HSA.2": [
    {
      weekday: 4,
      start: "14:30",
      end: "17:30"
    }
  ],
  "2K12": [
    {
      weekday: 4,
      start: "18:00",
      end: "20:00"
    },
    {
      weekday: 7,
      start: "15:00",
      end: "17:00"
    }
  ],
  "2K15": [
    {
      weekday: 4,
      start: "18:00",
      end: "20:00"
    },
    {
      weekday: 7,
      start: "14:00",
      end: "16:00"
    }
  ],
  "2K11 9+": [
    {
      weekday: 4,
      start: "19:30",
      end: "21:30"
    },
    {
      weekday: 7,
      start: "13:30",
      end: "15:30"
    }
  ],
  "2K10 8+": [
    {
      weekday: 5,
      start: "19:30",
      end: "21:30"
    },
    {
      weekday: 7,
      start: "10:00",
      end: "12:00"
    }
  ],
  TSA: [
    {
      weekday: 7,
      start: "14:00",
      end: "17:00"
    }
  ],
  HSA: [
    {
      weekday: 7,
      start: "17:00",
      end: "20:00"
    }
  ],
  "2K9 HSA (TH\u1EE8 5)": [
    {
      weekday: 4,
      start: "14:30",
      end: "17:30"
    }
  ],
  "2K10 Th\u1EE9 3, 6": [
    {
      weekday: 2,
      start: "19:30",
      end: "21:30"
    },
    {
      weekday: 5,
      start: "19:30",
      end: "21:30"
    }
  ]
};

// server/btvn/class-schedule.ts
function classOpeningTimes(material) {
  const result = {};
  for (const name of material.classNames) {
    const date2 = material.classDates?.[name] ?? material.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date2) || !Number.isFinite(Date.parse(date2 + "T00:00:00Z")) || (/* @__PURE__ */ new Date(date2 + "T00:00:00Z")).toISOString().slice(0, 10) !== date2) throw Error("INVALID_CLASS_DATE");
    const weekday = (/* @__PURE__ */ new Date(date2 + "T00:00:00Z")).getUTCDay() || 7;
    const sessions = class_schedule_default[name]?.filter((s) => s.weekday === weekday) ?? [];
    const end = sessions.map((s) => s.end).sort().at(-1) ?? "21:30";
    result[name] = date2 + "T" + end + ":00+07:00";
  }
  return result;
}

// server/btvn/publish-attendance.ts
var record2 = (v) => v && typeof v === "object" && !Array.isArray(v);
var text2 = (v, max) => typeof v === "string" && v.trim().length > 0 && v.length <= max && !/[\x00-\x1f\x7f]/.test(v);
var validAttendanceLabel = (v) => typeof v === "string" && /^2K\d{1,2}(?: (?:[89]\+|XPT|Thứ [2-7], [2-7]|HSA \((?:CN|THỨ 5)\)))?$/.test(v);
var ensure = (v) => {
  if (!v) throw Error("INVALID_ATTENDANCE");
};
var date = (v) => text2(v, 40) && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v)) && (/* @__PURE__ */ new Date(v.slice(0, 10) + "T00:00:00Z")).toISOString().slice(0, 10) === v.slice(0, 10);
function attendanceRpc(body) {
  if (!["sync_attendance", "sync_due", "support_report"].includes(body.action)) return null;
  if (body.action === "support_report") {
    ensure(Object.keys(body).every((k) => ["action", "since"].includes(k)) && date(body.since));
    return { name: "support_report", payload: { p_since: body.since } };
  }
  ensure(Object.keys(body).every((k) => ["action", "apply", body.action === "sync_due" ? "sessions" : "rows"].includes(k)));
  ensure(body.apply === void 0 || typeof body.apply === "boolean");
  if (body.action === "sync_attendance") {
    ensure(Array.isArray(body.rows) && body.rows.length > 0 && body.rows.length <= 1e4);
    for (const r of body.rows) ensure(record2(r) && Object.keys(r).every((k) => ["label", "fullName", "phone", "source"].includes(k)) && validAttendanceLabel(r.label) && text2(r.fullName, 160) && typeof r.phone === "string" && /^0\d{9}$/.test(r.phone) && (r.source === void 0 || text2(r.source, 200)));
    return { name: "sync_attendance", payload: { p_payload: { rows: body.rows }, p_apply: body.apply ?? false } };
  }
  ensure(Array.isArray(body.sessions) && body.sessions.length <= 2e3);
  let count = 0;
  const ids = /* @__PURE__ */ new Set();
  for (const s of body.sessions) {
    ensure(record2(s) && Object.keys(s).every((k) => ["classKey", "label", "startsAt", "sourceIdentity", "attendees"].includes(k)) && validAttendanceLabel(s.label) && text2(s.classKey, 100) && date(s.startsAt) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+07:00$/.test(s.startsAt) && text2(s.sourceIdentity, 300) && !ids.has(s.sourceIdentity) && Array.isArray(s.attendees) && s.attendees.length <= 1e3);
    ids.add(s.sourceIdentity);
    count += s.attendees.length;
    ensure(count <= 2e4);
    for (const a of s.attendees) ensure(record2(a) && Object.keys(a).every((k) => ["name", "phone", "status"].includes(k)) && text2(a.name, 160) && typeof a.phone === "string" && /^0\d{9}$/.test(a.phone) && typeof a.status === "string" && ["", "C", "M", "L", "K", "ON", "P", "PH P"].includes(a.status));
  }
  return { name: "sync_due", payload: { p_payload: { sessions: body.sessions }, p_apply: body.apply ?? false } };
}

// server/btvn/class-config.ts
function publicClassNames(names) {
  if (!Array.isArray(names) || names.length > 200 || names.some((name) => typeof name !== "string" || !name.trim() || name.length > 100)) throw Error("C\u1EA5u h\xECnh l\u1EDBp ch\u01B0a h\u1EE3p l\u1EC7");
  return [...new Set(names.map((name) => name.trim()))].sort((a, b) => a.localeCompare(b, "vi", { numeric: true }));
}

// server/btvn/publish-scorebook.ts
function scorebookRpc(body) {
  if (body.action === "classes") {
    if (Object.keys(body).some((k) => k !== "action")) throw Error("INVALID_CLASSES");
    return { name: "classes", payload: {} };
  }
  if (body.action !== "scorebook") return null;
  const from = body.from === void 0 ? "2026-10-01" : body.from;
  if (Object.keys(body).some((k) => !["action", "from"].includes(k)) || typeof from !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(from) || from < "2026-10-01" || !Number.isFinite(Date.parse(from)) || new Date(from).toISOString().slice(0, 10) !== from) throw Error("INVALID_SCOREBOOK");
  return { name: "scorebook", payload: { p_from: from, p_apply: false } };
}
function scorebookResult(action, result) {
  if (action === "classes") return { classNames: publicClassNames(result) };
  if (!Array.isArray(result)) throw Error("INVALID_SCOREBOOK_RESULT");
  return result.map((r) => ({
    studentId: r.studentId,
    fullName: r.fullName,
    className: r.className,
    lessonCode: r.lessonCode,
    title: r.title,
    date: r.date,
    dueAt: r.dueAt,
    expectedDueAt: r.expectedDueAt,
    sourceIdentity: r.sourceIdentity,
    receipts: r.receipts.map((s) => ({ score: s.score, submittedAt: s.submittedAt, late: s.late }))
  }));
}

// server/btvn/publish-handler.ts
var hash = async (bytes) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes).buffer))).map((x) => x.toString(16).padStart(2, "0")).join("");
var canonical = (value) => JSON.stringify(value);
function expectedSlots(exam) {
  return exam.questions.flatMap((q) => q.kind === "tf" ? q.answer.map((expected, i) => ({ question_id: q.id, slot: "abcd"[i], expected })) : [{ question_id: q.id, slot: "answer", expected: q.kind === "self" ? "self" : q.kind === "short" ? q.acceptedAnswers : q.answer }]);
}
function ensure2(value, message) {
  if (!value) throw Error(message);
}
function references(exam) {
  const refs = [];
  for (const q of exam.questions) for (const s of [...q.sourceContent?.questions ?? [], ...q.sourceContent?.solutions ?? []]) refs.push(s);
  refs.push(...exam.sourceInstructions ?? [], ...exam.solutionInstructions ?? []);
  for (const pdf of [exam.sourcePdf, exam.mtmDocuments?.questions, exam.mtmDocuments?.solutions]) if (pdf) {
    ensure2(pdf.url.startsWith("/exam-assets/"), "PDF_MUST_BE_PRIVATE");
    refs.push({ path: pdf.url.slice(1), sha256: pdf.sha256 });
  }
  return refs;
}
function createBtvnPublishHandler(port, secret) {
  return async (request) => {
    const respond = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
    if (request.method !== "POST") return respond(405, { error_code: "POST_REQUIRED" });
    const supplied = request.headers.get("X-MTM-Publish-Secret") ?? "";
    if (!secret || secret.length < 32 || supplied.length > 1024) return respond(401, { error_code: "UNAUTHORIZED" });
    const a = await hash(new TextEncoder().encode(secret)), b = await hash(new TextEncoder().encode(supplied));
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    if (diff) return respond(401, { error_code: "UNAUTHORIZED" });
    try {
      const text3 = await request.text();
      ensure2(text3.length <= 48 * 1024 * 1024, "PAYLOAD_TOO_LARGE");
      const body = JSON.parse(text3);
      ensure2(body && typeof body === "object" && !Array.isArray(body), "INVALID_PAYLOAD");
      const read = scorebookRpc(body);
      if (read) return respond(200, scorebookResult(read.name, await port.rpc(read.name, read.payload)));
      const attendance = attendanceRpc(body);
      if (attendance) {
        ensure2(new TextEncoder().encode(text3).length <= 10 * 1024 * 1024, "PAYLOAD_TOO_LARGE");
        return respond(200, await port.rpc(attendance.name, attendance.payload));
      }
      ensure2(["lookup", "publish", "error", "update_material"].includes(body.action) && /^[a-z0-9-]{1,160}$/.test(body.lesson_key), "INVALID_ACTION");
      const previous = await port.rpc("lookup", { lesson_key: body.lesson_key });
      if (body.action === "lookup") return respond(200, previous);
      if (body.action === "update_material") {
        ensure2(previous.status === "da_dang", "LESSON_NOT_PUBLISHED");
        ensure2(Object.keys(body).every((k) => ["action", "lesson_key", "material"].includes(k)), "INVALID_UPDATE");
        const patch = body.material;
        ensure2(patch && typeof patch === "object" && !Array.isArray(patch) && Object.keys(patch).length > 0, "INVALID_UPDATE");
        const allowed = ["videoId", "videoUrl", "materialUrl", "handoutUrl", "homeworkNote", "title", "classOpensAt"];
        ensure2(Object.keys(patch).every((k) => allowed.includes(k)), "INVALID_UPDATE");
        for (const [key, value] of Object.entries(patch)) {
          if (key === "videoId") ensure2(value === null || typeof value === "string" && /^[a-zA-Z0-9_-]{11}$/.test(value), "INVALID_VIDEO");
          else if (["videoUrl", "materialUrl", "handoutUrl"].includes(key)) {
            if (value !== null) {
              ensure2(typeof value === "string" && value.length <= 4096, "INVALID_MATERIAL_LINK");
              const url = new URL(value);
              ensure2(url.protocol === "https:" && !url.username && !url.password, "INVALID_MATERIAL_LINK");
            }
          } else if (key === "classOpensAt") {
            ensure2(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0 && Object.entries(value).every(([name, date2]) => name.length > 0 && name.length <= 100 && typeof date2 === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(date2) && Number.isFinite(Date.parse(date2)) && (/* @__PURE__ */ new Date(date2.slice(0, 10) + "T00:00:00Z")).toISOString().slice(0, 10) === date2.slice(0, 10)), "INVALID_CLASS_OPENING");
          } else ensure2(typeof value === "string" && value.length <= 300 && (key !== "title" || value.trim().length > 0), "INVALID_MATERIAL");
        }
        return respond(200, await port.rpc("update_material", { lesson_key: body.lesson_key, material: patch }));
      }
      if (previous.status === "da_dang") return respond(200, { status: "already_published" });
      ensure2(/^[a-f0-9]{64}$/.test(body.source_version ?? ""), "INVALID_VERSION");
      const kind = body.kind ?? "btvn";
      ensure2(["btvn", "kiem-tra-thang"].includes(kind), "INVALID_KIND");
      if (kind === "kiem-tra-thang") ensure2(typeof body.opensAt === "string" && typeof body.closesAt === "string" && /([zZ]|[+-]\d{2}:\d{2})$/.test(body.opensAt) && /([zZ]|[+-]\d{2}:\d{2})$/.test(body.closesAt) && Number.isFinite(Date.parse(body.opensAt)) && Date.parse(body.opensAt) >= Date.parse("2026-10-15T00:00:00+07:00") && Date.parse(body.closesAt) > Date.parse(body.opensAt), "INVALID_MONTHLY_WINDOW");
      const m = body.material;
      ensure2(m?.lessonCode === body.lesson_key && Array.isArray(m.classNames) && m.classNames.length > 0 && m.classNames.length <= 50 && new Set(m.classNames).size === m.classNames.length && m.classNames.every((x) => typeof x === "string" && x.length > 0 && x.length <= 100), "INVALID_MATERIAL");
      ensure2(/^\d{4}-\d{2}-\d{2}$/.test(m.date) && new Date(m.date).toISOString().slice(0, 10) === m.date && typeof m.title === "string" && m.title.length > 0 && m.title.length <= 300, "INVALID_MATERIAL");
      const link = (v) => {
        if (v === null || v === void 0 || v === "") return null;
        ensure2(typeof v === "string" && v.length <= 4096, "INVALID_MATERIAL_LINK");
        const u = new URL(v);
        ensure2(u.protocol === "https:" && !u.username && !u.password, "INVALID_MATERIAL_LINK");
        return u.href;
      };
      const classDates = m.classDates ?? {};
      ensure2(classDates && typeof classDates === "object" && !Array.isArray(classDates) && Object.entries(classDates).every(([name, date2]) => m.classNames.includes(name) && typeof date2 === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date2) && new Date(date2).toISOString().slice(0, 10) === date2), "INVALID_CLASS_DATES");
      const material = { lessonCode: m.lessonCode, classNames: m.classNames, date: m.date, title: m.title, classDates, classOpensAt: classOpeningTimes({ ...m, classDates }), videoId: m.videoId ?? null, materialUrl: link(m.materialUrl), handoutUrl: link(m.handoutUrl), homeworkUrl: null, videoUrl: link(m.videoUrl), homeworkNote: typeof m.homeworkNote === "string" ? m.homeworkNote.slice(0, 300) : void 0 };
      ensure2(material.videoId === null || /^[a-zA-Z0-9_-]{11}$/.test(material.videoId), "INVALID_VIDEO");
      if (body.action === "error") {
        ensure2(/^[A-Z0-9_]{1,80}$/.test(body.error_code ?? ""), "INVALID_ERROR");
        const reason = typeof body.reason === "string" && body.reason.length <= 1e3 && !/(https?:|@|bearer|sk-|secret|token|password|otp)/i.test(body.reason) ? body.reason.replace(/[\x00-\x1f]/g, " ") : "Kh\xF4ng \u0111\u1EA1t b\u1ED9 ki\u1EC3m; xem receipt ri\xEAng c\u1EE7a worker.";
        return respond(200, await port.rpc("error", { lesson_key: body.lesson_key, source_version: body.source_version, material, error_code: body.error_code, reason }));
      }
      const exam = body.exam;
      ensure2(validatePracticeExam(exam).valid && exam.durationMinutes === 120, "VALIDATOR_FAILED");
      const proof = body.verification;
      ensure2(proof?.validator === true && proof.independent === true && /^[a-f0-9]{64}$/.test(proof.receipt_hash ?? "") && typeof proof.provider === "string" && proof.provider.trim().length > 0 && typeof proof.model === "string" && proof.model.trim().length > 0, "REVIEW_REQUIRED");
      const slots = expectedSlots(exam);
      ensure2(Array.isArray(proof.slots) && proof.slots.length === slots.length, "REVIEW_COVERAGE");
      ensure2(typeof proof.extractor_provider === "string" && proof.extractor_provider !== proof.provider, "INDEPENDENT_PROVIDER_REQUIRED");
      for (const slot of slots) {
        const matches = proof.slots.filter((x) => x.question_id === slot.question_id && x.slot === slot.slot), q = exam.questions.find((q2) => q2.id === slot.question_id);
        ensure2(matches.length === 1 && canonical(matches[0].expected) === canonical(slot.expected), "REVIEW_MISMATCH");
        if (q.convertedFrom === "essay" || q.kind === "self" || exam.rubricVersion === "MTM-BTVN-10-v1" && q.kind === "short") ensure2(matches[0].conversion_verified === true, "CONVERSION_REVIEW_REQUIRED");
        const actual = matches[0].actual;
        ensure2(q.kind === "short" ? typeof actual === "string" && normalizedShort(q.mode, actual) !== null && q.acceptedAnswers.some((a2) => normalizedShort(q.mode, a2) === normalizedShort(q.mode, actual)) : canonical(actual) === canonical(slot.expected), "REVIEW_MISMATCH");
      }
      ensure2(Array.isArray(body.assets) && body.assets.length > 0 && body.assets.length <= 500, "INVALID_ASSETS");
      const assets = body.assets, paths = /* @__PURE__ */ new Set();
      let bytesTotal = 0;
      const decoded = await Promise.all(assets.map(async (asset) => {
        ensure2(typeof asset.path === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_/-]*\.(png|pdf)$/.test(asset.path) && !asset.path.split("/").includes("..") && !asset.path.includes("//") && !paths.has(asset.path), "INVALID_PATH");
        paths.add(asset.path);
        ensure2(/^[a-f0-9]{64}$/.test(asset.sha256) && ["application/pdf", "image/png"].includes(asset.content_type) && asset.path.endsWith(asset.content_type === "image/png" ? ".png" : ".pdf"), "INVALID_ASSET");
        ensure2(typeof asset.data_base64 === "string" && /^[A-Za-z0-9+/]*={0,2}$/.test(asset.data_base64) && asset.data_base64.length <= 21 * 1024 * 1024, "INVALID_BASE64");
        const raw = atob(asset.data_base64), bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
        bytesTotal += bytes.length;
        ensure2(bytes.length >= 8 && bytes.length <= 15 * 1024 * 1024 && bytesTotal <= 32 * 1024 * 1024 && await hash(bytes) === asset.sha256, "ASSET_HASH_MISMATCH");
        ensure2(asset.content_type === "image/png" ? bytes.slice(0, 8).every((x, i) => x === [137, 80, 78, 71, 13, 10, 26, 10][i]) : new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-", "INVALID_FILE_SIGNATURE");
        return { asset, bytes, storage_path: `btvn/${body.lesson_key}/${body.source_version}/${asset.path}` };
      }));
      for (const ref of references(exam)) ensure2(assets.some((a2) => a2.path === ref.path && a2.sha256 === ref.sha256), "ASSET_REFERENCE_MISSING");
      for (const item of decoded) await port.upload(item.storage_path, item.bytes, item.asset.content_type, item.asset.sha256);
      const metadata = decoded.map(({ asset, bytes, storage_path }) => ({ path: asset.path, sha256: asset.sha256, content_type: asset.content_type, bytes: bytes.length, storage_path }));
      return respond(200, await port.rpc("publish", { kind, opensAt: body.opensAt, closesAt: body.closesAt, lesson_key: body.lesson_key, source_version: body.source_version, material, exam, assets: metadata, verification: proof }));
    } catch {
      return respond(422, { error_code: "PUBLISH_REJECTED" });
    }
  };
}
export {
  createBtvnPublishHandler,
  expectedSlots
};
