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
    if (!units(q.maxMillipoints) || q.maxMillipoints === 0) errors.push(prefix + "positive integer millipoints required");
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
      case "essay":
        break;
      default:
        errors.push(prefix + "unsupported question kind");
    }
  });
  if (total !== 1e4) errors.push("exam: total must equal 10000 millipoints");
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
  if (e?.rubricVersion !== FLEX_RUBRIC) return validateMtmAssessment(input);
  const gate = validateAssessment(input);
  if (!gate.valid) return gate;
  const errors = [];
  if (!e.id.startsWith("mtm-custom-") && !e.id.startsWith("mtm-preview-") && !e.id.startsWith("mtm-practice-")) errors.push("Flexible profile requires a custom edition");
  if (!Array.isArray(e.sections) || !e.sections.length || e.sections.length > 12) return { valid: false, errors: [...errors, "Sections required"] };
  let offset = 0;
  for (const section of e.sections) {
    if (!section || typeof section.label !== "string" || !section.label.trim() || section.label.length > 100 || !["mc", "tf", "short"].includes(section.kind) || !Number.isSafeInteger(section.count) || section.count < 1 || section.count > 300) {
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

// server/btvn/publish-handler.ts
var hash = async (bytes) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes).buffer))).map((x) => x.toString(16).padStart(2, "0")).join("");
var canonical = (value) => JSON.stringify(value);
function expectedSlots(exam) {
  return exam.questions.flatMap((q) => q.kind === "tf" ? q.answer.map((expected, i) => ({ question_id: q.id, slot: "abcd"[i], expected })) : [{ question_id: q.id, slot: "answer", expected: q.kind === "short" ? q.acceptedAnswers : q.answer }]);
}
function ensure(value, message) {
  if (!value) throw Error(message);
}
function references(exam) {
  const refs = [];
  for (const q of exam.questions) for (const s of [...q.sourceContent?.questions ?? [], ...q.sourceContent?.solutions ?? []]) refs.push(s);
  refs.push(...exam.sourceInstructions ?? [], ...exam.solutionInstructions ?? []);
  for (const pdf of [exam.sourcePdf, exam.mtmDocuments?.questions, exam.mtmDocuments?.solutions]) if (pdf) {
    ensure(pdf.url.startsWith("/exam-assets/"), "PDF_MUST_BE_PRIVATE");
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
      const text2 = await request.text();
      ensure(text2.length <= 48 * 1024 * 1024, "PAYLOAD_TOO_LARGE");
      const body = JSON.parse(text2);
      ensure(body && typeof body === "object" && !Array.isArray(body), "INVALID_PAYLOAD");
      ensure(["lookup", "publish", "error"].includes(body.action) && /^[a-z0-9-]{1,160}$/.test(body.lesson_key), "INVALID_ACTION");
      const previous = await port.rpc("lookup", { lesson_key: body.lesson_key });
      if (body.action === "lookup") return respond(200, previous);
      if (previous.status === "da_dang") return respond(200, { status: "already_published" });
      ensure(/^[a-f0-9]{64}$/.test(body.source_version ?? ""), "INVALID_VERSION");
      const m = body.material;
      ensure(m?.lessonCode === body.lesson_key && Array.isArray(m.classNames) && m.classNames.length > 0 && m.classNames.length <= 50 && new Set(m.classNames).size === m.classNames.length && m.classNames.every((x) => typeof x === "string" && x.length > 0 && x.length <= 100), "INVALID_MATERIAL");
      ensure(/^\d{4}-\d{2}-\d{2}$/.test(m.date) && new Date(m.date).toISOString().slice(0, 10) === m.date && typeof m.title === "string" && m.title.length > 0 && m.title.length <= 300, "INVALID_MATERIAL");
      const link = (v) => {
        if (v === null || v === void 0 || v === "") return null;
        ensure(typeof v === "string" && v.length <= 4096, "INVALID_MATERIAL_LINK");
        const u = new URL(v);
        ensure(u.protocol === "https:" && !u.username && !u.password, "INVALID_MATERIAL_LINK");
        return u.href;
      };
      const classDates = m.classDates ?? {};
      ensure(classDates && typeof classDates === "object" && !Array.isArray(classDates) && Object.entries(classDates).every(([name, date]) => m.classNames.includes(name) && typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(date).toISOString().slice(0, 10) === date), "INVALID_CLASS_DATES");
      const material = { lessonCode: m.lessonCode, classNames: m.classNames, date: m.date, title: m.title, classDates, videoId: m.videoId ?? null, materialUrl: link(m.materialUrl), handoutUrl: link(m.handoutUrl), homeworkUrl: null };
      ensure(material.videoId === null || /^[a-zA-Z0-9_-]{11}$/.test(material.videoId), "INVALID_VIDEO");
      if (body.action === "error") {
        ensure(/^[A-Z0-9_]{1,80}$/.test(body.error_code ?? ""), "INVALID_ERROR");
        const reason = typeof body.reason === "string" && body.reason.length <= 1e3 && !/(https?:|@|bearer|sk-|secret|token|password|otp)/i.test(body.reason) ? body.reason.replace(/[\x00-\x1f]/g, " ") : "Kh\xF4ng \u0111\u1EA1t b\u1ED9 ki\u1EC3m; xem receipt ri\xEAng c\u1EE7a worker.";
        return respond(200, await port.rpc("error", { lesson_key: body.lesson_key, source_version: body.source_version, material, error_code: body.error_code, reason }));
      }
      const exam = body.exam;
      ensure(validatePracticeExam(exam).valid && exam.durationMinutes === 120, "VALIDATOR_FAILED");
      const proof = body.verification;
      ensure(proof?.validator === true && proof.independent === true && /^[a-f0-9]{64}$/.test(proof.receipt_hash ?? "") && typeof proof.provider === "string" && proof.provider.trim().length > 0 && typeof proof.model === "string" && proof.model.trim().length > 0, "REVIEW_REQUIRED");
      const slots = expectedSlots(exam);
      ensure(Array.isArray(proof.slots) && proof.slots.length === slots.length, "REVIEW_COVERAGE");
      ensure(typeof proof.extractor_provider === "string" && proof.extractor_provider !== proof.provider, "INDEPENDENT_PROVIDER_REQUIRED");
      for (const slot of slots) {
        const matches = proof.slots.filter((x) => x.question_id === slot.question_id && x.slot === slot.slot), q = exam.questions.find((q2) => q2.id === slot.question_id);
        ensure(matches.length === 1 && canonical(matches[0].expected) === canonical(slot.expected), "REVIEW_MISMATCH");
        const actual = matches[0].actual;
        ensure(q.kind === "short" ? typeof actual === "string" && normalizedShort(q.mode, actual) !== null && q.acceptedAnswers.some((a2) => normalizedShort(q.mode, a2) === normalizedShort(q.mode, actual)) : canonical(actual) === canonical(slot.expected), "REVIEW_MISMATCH");
      }
      ensure(Array.isArray(body.assets) && body.assets.length > 0 && body.assets.length <= 500, "INVALID_ASSETS");
      const assets = body.assets, paths = /* @__PURE__ */ new Set();
      let bytesTotal = 0;
      const decoded = await Promise.all(assets.map(async (asset) => {
        ensure(typeof asset.path === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_/-]*\.(png|pdf)$/.test(asset.path) && !asset.path.split("/").includes("..") && !asset.path.includes("//") && !paths.has(asset.path), "INVALID_PATH");
        paths.add(asset.path);
        ensure(/^[a-f0-9]{64}$/.test(asset.sha256) && ["application/pdf", "image/png"].includes(asset.content_type) && asset.path.endsWith(asset.content_type === "image/png" ? ".png" : ".pdf"), "INVALID_ASSET");
        ensure(typeof asset.data_base64 === "string" && /^[A-Za-z0-9+/]*={0,2}$/.test(asset.data_base64) && asset.data_base64.length <= 21 * 1024 * 1024, "INVALID_BASE64");
        const raw = atob(asset.data_base64), bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
        bytesTotal += bytes.length;
        ensure(bytes.length >= 8 && bytes.length <= 15 * 1024 * 1024 && bytesTotal <= 32 * 1024 * 1024 && await hash(bytes) === asset.sha256, "ASSET_HASH_MISMATCH");
        ensure(asset.content_type === "image/png" ? bytes.slice(0, 8).every((x, i) => x === [137, 80, 78, 71, 13, 10, 26, 10][i]) : new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-", "INVALID_FILE_SIGNATURE");
        return { asset, bytes, storage_path: `btvn/${body.lesson_key}/${body.source_version}/${asset.path}` };
      }));
      for (const ref of references(exam)) ensure(assets.some((a2) => a2.path === ref.path && a2.sha256 === ref.sha256), "ASSET_REFERENCE_MISSING");
      for (const item of decoded) await port.upload(item.storage_path, item.bytes, item.asset.content_type, item.asset.sha256);
      const metadata = decoded.map(({ asset, bytes, storage_path }) => ({ path: asset.path, sha256: asset.sha256, content_type: asset.content_type, bytes: bytes.length, storage_path }));
      return respond(200, await port.rpc("publish", { lesson_key: body.lesson_key, source_version: body.source_version, material, exam, assets: metadata, verification: proof }));
    } catch {
      return respond(422, { error_code: "PUBLISH_REJECTED" });
    }
  };
}
export {
  createBtvnPublishHandler,
  expectedSlots
};
