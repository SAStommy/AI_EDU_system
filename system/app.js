/* =========================
   1. Config
========================= */
const sessionId =
    window.sessionId ||
    crypto.randomUUID();

console.log("app.js loaded", {
    sessionId,
});

/* =========================
   2. Gemini
========================= */

async function callGemini(prompt) {
    console.log("sending prompt:", prompt);

    const res = await fetch("/api/gemini", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt })
    });

    const data = await res.json();

    console.log("API response:", data);

    return data?.text || "";
}

/* =========================
   3. Kelly Grid
========================= */

const teacherGrid = [
    [1, 2, 4, 1, 5],
    [1, 3, 5, 4, 1],
    [1, 1, 1, 5, 1],
    [1, 1, 1, 4, 5]
];

let studentGrid = [];
let diffGrid = [];

/* =========================
   4. State
========================= */

let initialDistance = 0;
//let currentScore = 0;
let questions = [];
let index = 0;

let totalPossibleScore = 0;
let earnedScore = 0;

/* =========================
   5. Utils
========================= */

function computeDiff(t, s) {
    return t.map((r, i) =>
        r.map((v, j) =>
            Math.abs(v - s[i][j])
        )
    );
}

function sum(grid) {
    return grid.flat()
        .reduce((a, b) => a + b, 0);
}

function clamp1to5(el) {
    let v = el.value;

    // 允許空值先不處理（避免打字卡住）
    if (v === "") return;

    // 強制轉數字
    v = Number(v);

    if (Number.isNaN(v)) {
        el.value = 3;
        return;
    }

    if (v < 1) el.value = 1;
    else if (v > 5) el.value = 5;
}

function safeParseJSON(text) {
    try {
        // 1. 找第一個 [ 或 {
        const startObj = text.indexOf("{");
        const startArr = text.indexOf("[");

        let start;

        if (startObj === -1) start = startArr;
        else if (startArr === -1) start = startObj;
        else start = Math.min(startObj, startArr);

        if (start === -1) {
            console.error("No JSON start found");
            return null;
        }

        // 2. 從第一個 JSON 起切
        let sliced = text.slice(start);

        // 3. 去掉 ```（保險）
        sliced = sliced.replace(/```/g, "").trim();

        // 4. 找最後一個 } 或 ]
        const endObj = sliced.lastIndexOf("}");
        const endArr = sliced.lastIndexOf("]");

        const end = Math.max(endObj, endArr);

        if (end === -1) return null;

        const jsonStr = sliced.slice(0, end + 1);

        return JSON.parse(jsonStr);

    } catch (e) {
        console.error("JSON parse error:", e);
        console.log("raw:", text);
        return null;
    }
}



/* =========================
   6. Navigation
========================= */

function navigate(page){

    console.log("navigate:", page);

    document.querySelectorAll(".page")
        .forEach(p => p.classList.add("d-none"));

    const target =
        document.getElementById("page-" + page);

    console.log("target page:", target);

    target?.classList.remove("d-none");

    if (page === "mc") {
        console.log("mc page, questions:", questions.length);
    }

    if (page === "mc" && questions.length) {
        loadQuestion();
    }

    if (page === "post-test") {
        renderPostTest();
    }
}

/* =========================
   7. Render Kelly Grid
========================= */

function renderPreTest() {
    const body =
        document.getElementById(
            "preTestGridBody"
        );

    body.innerHTML = "";

    for (let i = 0; i < 4; i++) {

        const tr =
            document.createElement("tr");

        const config =
            constructConfig[i];

        tr.innerHTML =
            `
            <td>${config.name}</td>
            <td>${config.left}</td>
            ` +
            Array.from({ length: 5 })
                .map((_, j) => `
                    <td>
                        <input
                            class="form-control pre-grid-input"
                            data-row="${i}"
                            data-col="${j}"
                            type="number"
                            min="1"
                            max="5"
                            value="${config.values[j]}"
                        />
                    </td>
                `)
                .join("") +
            `
            <td>${config.right}</td>
            `;

        body.appendChild(tr);

        const inputs = tr.querySelectorAll("input");

        inputs.forEach(input => {
            input.addEventListener("input", e => clamp1to5(e.target));
            input.addEventListener("blur", e => clamp1to5(e.target));
            input.addEventListener("paste", e => {
                setTimeout(() => clamp1to5(e.target), 0);
            });
        });
    }
}

function renderPostTest() {
    const body =
        document.getElementById(
            "postTestGridBody"
        );

    body.innerHTML = "";

    for (let i = 0; i < 4; i++) {

        const tr =
            document.createElement("tr");

        const config =
            constructConfig[i];

        tr.innerHTML =
            `
            <td>${config.name}</td>
            <td>${config.left}</td>
            ` +
            Array.from({ length: 5 })
                .map((_, j) => `
                    <td>
                        <input
                            class="form-control post-grid-input"
                            data-row="${i}"
                            data-col="${j}"
                            type="number"
                            min="1"
                            max="5"
                            value="${config.values[j]}"
                        />
                    </td>
                `)
                .join("") +
            `
            <td>${config.right}</td>
            `;

        body.appendChild(tr);

        const inputs = tr.querySelectorAll("input");

        inputs.forEach(input => {
            input.addEventListener("input", e => clamp1to5(e.target));
            input.addEventListener("blur", e => clamp1to5(e.target));
            input.addEventListener("paste", e => {
                setTimeout(() => clamp1to5(e.target), 0);
            });
        });
    }
}

/* =========================
   8. Pretest
========================= */

async function submitPreTest() {

    const inputs =
        document.querySelectorAll(
            ".pre-grid-input"
        );

    studentGrid =
        Array.from(
            { length: 4 },
            () => Array(5).fill(0)
        );

    inputs.forEach(i => {
        studentGrid[
            i.dataset.row
        ][i.dataset.col] =
            +i.value;
    });

    diffGrid = computeDiff(
        teacherGrid,
        studentGrid
    );

    initialDistance = sum(diffGrid);

    if (initialDistance <= 0) {
        initialDistance = 1;
    }

    // ⭐修正：建立總分基準
    totalPossibleScore = initialDistance;
    earnedScore = 0;

    await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: "create",
            session_id: sessionId,
            pre_score: initialDistance
        })
    });

    navigate("knowledge");

    await generateQuestions();
}

/* =========================
   9. Prompt 保持原樣
========================= */

async function generateQuestions(){

const limit = initialDistance; // 根據錯誤程度調整題量，最多{initialDistance}題

const prompt = `
你是專業英語教學AI（Diagnostic Adaptive Tutor）。

# 📊 INPUT DATA

## Expert Grid（標準能力）
${JSON.stringify(teacherGrid)}

## Student Grid（學生理解）
${JSON.stringify(studentGrid)}

## Diff Grid（錯誤強度）
${JSON.stringify(diffGrid)}

---

# 🧠 教學任務

你要做的是：

1. 找出學生最大錯誤維度（time/space/motion/relation）
2. 判斷錯誤類型：
   - under-generalization（理解不足）
   - over-generalization（過度泛化）
3. 用錯誤點設計介系詞干擾選項
4. 生成「診斷型題目」

---

# 📌 feature 規則（重要）

feature 必須是：

「概念差異 + 介系詞對比 + 教學提示」

格式：

"motion vs space (to vs at): 區分動態移動與靜態位置"

---

# 🧠 explanation 規則（超重要）

必須是「針對學生錯誤理解」，不能是定義。

必須包含：

- 為什麼錯
- 學生現在怎麼想
- 正確修正方式（白話）

例子：

"你可能把 TO 當成位置，但這題是在說移動方向，所以會容易選錯。"

---

# 📦 output format（ONLY JSON）

🚨 OUTPUT RULE (STRICT):

You are a JSON generator.

You MUST follow ALL rules:

1. Output MUST start with "{" (no prefix text)
2. Output MUST NOT contain markdown
3. Output MUST NOT contain explanation outside JSON
4. Output MUST be valid JSON only
5. If you fail, the system will reject your output

最多 ${limit} 題：

{
  "index": number,
  "Question": string,
  "Translation": string,
  "feature": string,
  "type": "base",

  "A": "at",
  "B": "on",
  "C": "in",
  "D": "to",

  "answer": "A",

  "A_score": number,
  "B_score": number,
  "C_score": number,
  "D_score": number,

  "explanation": {
    "A": string,
    "B": string,
    "C": string,
    "D": string
  }
}

---

# 🎯 scoring和題目數決定

題目數表示要覆蓋多少錯誤點，題目數愈高反映學生混淆點愈多，每一題會因應學生介系詞理解程度來調整。
分數表示修正程度，單題正確分數愈高反映該題對於修正英語專家的幫助程度愈高。

# 4️⃣ 分數原則

每題分數必須符合下方規則：

1. 你需要保證所有correct的分數相加等於${initialDistance}，並且錯誤選項分數要能區分學生的理解程度
2. 你需要根據學生情況去決定題目的作用從以設定分數
- 是不是學生典型錯誤?
- 錯誤程度?
- 學生理解的幫助程度?
- 會不會解決一個混淆點就可以大幅修正學生理解?
3. 自定義分數範圍
- correct >= 1.0（依修正價值決定具體）
- near miss >= 0 and < correct的分數（依學生理解程度決定具體）
- wrong plausible = 0 ~ -0.9 固定
- misconception = -1.0 固定

# 4️⃣ 出題數目及內容原則

每題必須：

1. 對應一個錯誤概念
2. 能修正一個 misunderstanding
3. 避免重複測同一錯誤
4. 從「最嚴重錯誤」開始修正
5. 題目數為覆蓋到學生的全部錯誤點的數量
6. 正確答案需平均分布在A/B/C/D
`;

    console.log("===== Prompt =====");
    console.log(prompt);

    const raw =
        await callGemini(prompt);

    // 看 Gemini 原始輸出
    console.log(
        "===== Gemini Raw ====="
    );
    console.log(raw);

    const data =
        safeParseJSON(raw);

    // 看 parse 後結果
    console.log(
        "===== Parsed JSON ====="
    );
    console.log(data);

    // 防止 Gemini 格式漂移
    const generated =
        Array.isArray(data)
            ? data
            : data?.questions;

    if (
        generated &&
        generated.length > 0
    ) {

        questions = generated;
        index = 0;

        console.log(
            "===== Questions ====="
        );
        console.table(questions);

        document
            .getElementById(
                "loading-section"
            )
            ?.classList.add(
                "d-none"
            );

        // 方案 A
        // 自動進入教材
        if (generated && generated.length > 0) {

            questions = generated;
            index = 0;

            console.log("Questions ready:", questions);

            document
                .getElementById("loading-section")
                ?.classList.add("d-none");

            // ❗關鍵修正
            document
                .querySelectorAll(".page")
                .forEach(p => p.classList.add("d-none"));

            document
                .getElementById("page-mc")
                ?.classList.remove("d-none");

            loadQuestion(); // ⭐強制渲染第一題
        }

    } else {

        console.error(
            "Gemini JSON 失敗"
        );

        console.error(
            "raw:",
            raw
        );

        console.error(
            "parsed:",
            data
        );

        alert(
            "AI 題目生成失敗，請查看 Console"
        );
    }
}

async function addFollowUp(q, wrongChoice = null) {
    const prompt = `
你是專業英語教學AI（診斷型適性學習系統）。

# 📌 已知資訊
介系詞概念特徵：
${q.feature}

學生剛剛選錯的選項：
${wrongChoice ?? "未知"}

正確答案：
${q.answer}

---

# 🧠 任務目標

請根據學生剛剛的錯誤，生成 2 題 follow-up：

1. 第1題（hint）→ 有提示
2. 第2題（test）→ 無提示

👉 兩題必須：
- 相同語言概念
- 不同情境
- 用來測是否真正修正 misconception

---

# 🎯 出題規則

1. 不能改變語言概念
2. 情境要不同，但結構一致
3. 干擾選項要提高迷惑性
4. 必須針對同一 misconception
5. 兩題不可重複
6. hint 題 type = "hint"
7. test 題 type = "test"
8. hint 題 correct score 固定 1.0

---

# 📌 feature 規則
維持原 feature，不可修改

---

# 🧾 輸出格式（⚠️ 必須是 JSON ARRAY）

[
  {
    "index": 0,
    "Question": "英文題目",
    "Translation": "中文翻譯",
    "feature": "${q.feature}",
    "type": "hint",

    "A": "at",
    "B": "on",
    "C": "in",
    "D": "to",

    "answer": "A",

    "A_score": number,
    "B_score": number,
    "C_score": number,
    "D_score": number,

    "explanation": {
      "A": "針對A的說明",
      "B": "為什麼B錯",
      "C": "為什麼C錯",
      "D": "為什麼D錯"
    }
  },
  {
    "index": 1,
    "Question": "英文題目",
    "Translation": "中文翻譯",
    "feature": "${q.feature}",
    "type": "test",

    "A": "at",
    "B": "on",
    "C": "in",
    "D": "to",

    "answer": "A",

    "A_score": number,
    "B_score": number,
    "C_score": number,
    "D_score": number,

    "explanation": {
      "A": "針對A的說明",
      "B": "為什麼B錯",
      "C": "為什麼C錯",
      "D": "為什麼C錯"
    }
  }
]
`;

    const raw = await callGemini(prompt);

    console.log("follow-up raw:", raw);

    const data = safeParseJSON(raw);

    if (!Array.isArray(data) || data.length === 0) {
        console.warn("follow-up failed:", q.feature, data);
        return;
    }

    data.forEach((qItem, i) => {
        if (!qItem?.Question || !qItem?.answer) return;

        qItem.index = questions.length + i + 1;
        qItem.isFollowUp = true;
        qItem.parentIndex = index;

        questions.push(qItem);
    });

    console.log("follow-up added:", data.length);
}

/* =========================
   10. Question Render
========================= */

function loadQuestion() {

    const q =
        questions[index];

    if (!q) return;

    if (q.type === "hint") {
        document
        .getElementById(
            "question-text"
        ).innerHTML = `
        <h4>${q.Question}</h4>
        <p>${q.Translation}</p>
        <span class="badge bg-info">
            ${q.feature}
        </span> 
    `;
    } else { 
        document
        .getElementById(
            "question-text"
        ).innerHTML = `
        <h4>${q.Question}</h4>
        <p>${q.Translation}</p>
        <!-- <span class="badge bg-info">
            ${q.feature}
        </span> -->
    `;
    }

    const box =
        document.getElementById(
            "options-container"
        );

    box.innerHTML = "";

    ["A", "B", "C", "D"]
        .forEach(k => {

        const btn =
            document.createElement(
                "button"
            );

        btn.className =
            "btn btn-outline-secondary option-btn col-12";

        btn.innerText =
            `${k}. ${q[k]}`;

        btn.addEventListener(
            "click",
            () => check(k)
        );

        box.appendChild(btn);
    });

    document
        .getElementById(
            "explanation-container"
        )
        ?.classList.add("d-none");

    document
        .getElementById(
            "score-info"
        ).innerText =
        `進度：${index + 1} / ${questions.length}`;
}

/* =========================
   11. Progress
========================= */

function updateProgress() {

    const progress = (earnedScore / totalPossibleScore) * 100;

    const p = Math.max(0, Math.min(100, progress));

    const bar =
        document.getElementById(
            "student-progress-bar"
        );

    bar.style.width =
        p + "%";

    bar.innerText =
        p.toFixed(1) + "%";

    if (p >= 100) {
        setTimeout(() => {
            alert(
                "已完成學習，進入後測"
            );

            navigate(
                "post-test"
            );
        }, 700);
    }
}

/* =========================
   12. Answer Logic
========================= */

async function check(choice){

    const q = questions[index];
    const correct = choice === q.answer;

    document.querySelectorAll(".option-btn")
        .forEach(b => b.disabled = true);

    // =========================
    // ⭐ 1. 改選項顏色（重點）
    // =========================
    document.querySelectorAll(".option-btn")
        .forEach(btn => {

            const text = btn.innerText[0]; // A/B/C/D

            btn.classList.remove("btn-outline-secondary");

            if (text === q.answer) {
                btn.classList.add("btn-success");
            }

            if (text === choice && !correct) {
                btn.classList.add("btn-danger");
            }
        });

    // =========================
    // ⭐ 2. score logic（保留）
    // =========================
    let earned = 0;

    if (correct) {
        earned = q[q.answer + "_score"];
    } else {
        earned = q[choice + "_score"];
    }

    earnedScore += earned;

    updateProgress();

    // =========================
    // ⭐ 3. explanation UI（改背景）
    // =========================
    const box = document.getElementById("explanation-container");

    box.classList.remove("d-none", "alert-success", "alert-danger");

    box.classList.add(correct ? "alert-success" : "alert-danger");

    document.getElementById("explanation-title").innerText =
        correct ? "✔ 正確" : "✘ 解答說明";

    document.getElementById("explanation-text").innerText =
        q.explanation?.[choice] || "";

    // =========================
    // ⭐ 4. follow-up
    // =========================
    if (!correct) {
        await addFollowUp(q, choice);
    }
}

/* =========================
   13. Next Question
========================= */

function nextQuestion(){

    index++;

    if(index < questions.length){
        resetOptionUI();   // ⭐加這行
        loadQuestion();
    }
    else{
        //generateQuestions(); //重新做一次題目
        navigate("post-test"); // 或結束學習
    }
}

/* =========================
   14. Posttest
========================= */

async function finishExperiment(){

    const postInputs =
        document.querySelectorAll(
            ".post-grid-input"
        );

    let postGrid =
        Array.from(
            { length: 4 },
            () => Array(5)
            .fill(0)
        );

    postInputs.forEach(i=>{
        postGrid[
            i.dataset.row
        ][i.dataset.col] =
            +i.value;
    });

    const postDiff =
        computeDiff(
            teacherGrid,
            postGrid
        );

    const postScore =
        sum(postDiff);

    await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: "update",
            session_id: sessionId,
            post_score: postScore
        })
    });

    alert(
        "你學會了介系詞（已同步 Google Sheet）"
    );

    console.log({
        sessionId,
        initialDistance,
        postScore
    });

    navigate("home");
}

/* =========================
   15. Init
========================= */

function initApp(){

    renderPreTest();

    document
        .getElementById(
            "btn-start"
        )
        ?.addEventListener(
            "click",
            ()=>navigate(
                "pre-test"
            )
        );

    document
        .getElementById(
            "btn-submit-pretest"
        )
        ?.addEventListener(
            "click",
            submitPreTest
        );

    document
        .getElementById(
            "btn-next-question"
        )
        ?.addEventListener(
            "click",
            nextQuestion
        );

    document
        .getElementById(
            "btn-finish"
        )
        ?.addEventListener(
            "click",
            finishExperiment
        );
}

document.addEventListener(
    "DOMContentLoaded",
    initApp
);

function resetOptionUI(){

    document.querySelectorAll(".option-btn")
        .forEach(b => {

            b.disabled = false;

            b.className =
                "btn btn-outline-secondary option-btn col-12";
        });

    const box = document.getElementById("explanation-container");

    box.classList.add("d-none");
    box.classList.remove("alert-success", "alert-danger");
}