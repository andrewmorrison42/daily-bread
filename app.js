const { useState, useEffect, useCallback, useRef } = React;

// ---------------------------------------------------------------------------
// Bible reading & prayer tracker
// PWA build. Data persists in browser localStorage under key "tracker-data".
// Fully offline: no Claude, no server, no API key. Questions come from a
// baked-in Reformed reading pool.
// ---------------------------------------------------------------------------

const BOOKS = [
  ["Genesis", 50], ["Exodus", 40], ["Leviticus", 27], ["Numbers", 36], ["Deuteronomy", 34],
  ["Joshua", 24], ["Judges", 21], ["Ruth", 4], ["1 Samuel", 31], ["2 Samuel", 24],
  ["1 Kings", 22], ["2 Kings", 25], ["1 Chronicles", 29], ["2 Chronicles", 36], ["Ezra", 10],
  ["Nehemiah", 13], ["Esther", 10], ["Job", 42], ["Psalms", 150], ["Proverbs", 31],
  ["Ecclesiastes", 12], ["Song of Solomon", 8], ["Isaiah", 66], ["Jeremiah", 52],
  ["Lamentations", 5], ["Ezekiel", 48], ["Daniel", 12], ["Hosea", 14], ["Joel", 3],
  ["Amos", 9], ["Obadiah", 1], ["Jonah", 4], ["Micah", 7], ["Nahum", 3], ["Habakkuk", 3],
  ["Zephaniah", 3], ["Haggai", 2], ["Zechariah", 14], ["Malachi", 4],
  ["Matthew", 28], ["Mark", 16], ["Luke", 24], ["John", 21], ["Acts", 28],
  ["Romans", 16], ["1 Corinthians", 16], ["2 Corinthians", 13], ["Galatians", 6],
  ["Ephesians", 6], ["Philippians", 4], ["Colossians", 4], ["1 Thessalonians", 5],
  ["2 Thessalonians", 3], ["1 Timothy", 6], ["2 Timothy", 4], ["Titus", 3], ["Philemon", 1],
  ["Hebrews", 13], ["James", 5], ["1 Peter", 5], ["2 Peter", 3], ["1 John", 5],
  ["2 John", 1], ["3 John", 1], ["Jude", 1], ["Revelation", 22],
];

const OBSERVATION_QUESTIONS = [
  "What does this passage show you about God's character?",
  "Is there a command to obey, a promise to hold, or a warning to heed?",
  "What stood out or unsettled you — and why?",
  "How does this point to Christ or the gospel?",
  "What's one thing you'll carry into today?",
];

// Used when the live model call is unavailable. Questions in the register of
// the Reformed reading tradition: covenant, law and gospel, Christ throughout
// Scripture, God's sovereignty and initiative, the text's redemptive-historical
// place, self-knowledge before God. Questions only, never quotations.
const REFORMED_FALLBACK = [
  "Where in this chapter does God act first, before any human response — and what does that reveal about the ground of your standing before Him?",
  "What does this passage contribute to the unfolding story of redemption — where does it sit between promise and fulfilment?",
  "Is this text functioning as law (exposing sin and driving you to Christ) or as gospel (announcing grace) — and how should that shape how you receive it?",
  "How does this chapter point forward or backward to Christ, who is the substance of all Scripture?",
  "What knowledge of God here exposes something true about yourself you would rather not see?",
  "Where do you see God's sovereign hand at work, even in events the actors intended for other ends?",
  "What covenant promise, obligation, or sign is in view here, and how does it bind you to God?",
  "What mercy is offered here that your fallen reason would be slow to believe?",
  "How does this passage mean to humble you before it comforts you?",
  "What would the rest of Scripture have you understand about this text — where does Scripture interpret Scripture here?",
];

const STORAGE_KEY = "tracker-data";

const DEFAULT_DATA = {
  current: { book: "John", pace: 1, paceUnit: "chapters", done: {} }, // done: { "John": [1,2,...] }
  finished: [],
  sermon: { ref: "", read: false, week: "" },
  prayers: [],
  journal: [], // { id, date, ref, text }
  todayStamp: { date: "", done: false },
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function prettyDate(iso) {
  const d = iso ? new Date(iso + "T00:00:00") : new Date();
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function weekKey() {
  const d = new Date();
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

function downloadFile(filename, text, mime) {
  try {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch (e) {
    console.error("Download failed:", e);
    return false;
  }
}

function generateReformedQuestion(bookChapter) {
  // PWA build: fully offline. Returns a generic Reformed reading question
  // from the baked-in pool. No network, no Claude, no API key.
  return REFORMED_FALLBACK[Math.floor(Math.random() * REFORMED_FALLBACK.length)];
}

function journalToMarkdown(data) {
  const lines = ["# Daily Bread — Reading & Prayer Journal", ""];
  lines.push(`_Exported ${prettyDate(todayISO())}_`, "");

  if (data.finished && data.finished.length) {
    lines.push("## Books finished", "", data.finished.map((b) => `- ${b}`).join("\n"), "");
  }

  const ongoing = (data.prayers || []).filter((p) => p.status === "ongoing");
  const answered = (data.prayers || []).filter((p) => p.status === "answered");
  if (ongoing.length || answered.length) {
    lines.push("## Prayer list", "");
    if (ongoing.length) {
      lines.push("**Ongoing**", "");
      ongoing.forEach((p) => lines.push(`- ${p.name}${p.note ? ` — ${p.note}` : ""}`));
      lines.push("");
    }
    if (answered.length) {
      lines.push("**Answered**", "");
      answered.forEach((p) => lines.push(`- ${p.name}${p.note ? ` — ${p.note}` : ""}`));
      lines.push("");
    }
  }

  lines.push("## Reflections", "");
  if (!data.journal || data.journal.length === 0) {
    lines.push("_No reflections recorded yet._", "");
  } else {
    data.journal.forEach((e) => {
      lines.push(`### ${e.ref} · ${prettyDate(e.date)}`, "");
      if (e.prompt) lines.push(`> ${e.prompt}`, "");
      lines.push(e.text, "");
    });
  }
  return lines.join("\n");
}

const C = {
  cream: "#F4EFE3",
  paper: "#FBF7EC",
  ink: "#2B2622",
  faint: "#6E655A",
  red: "#7C2D2D",
  redDeep: "#5E1F1F",
  olive: "#5B6236",
  oliveLite: "#7C8350",
  rule: "#D9CDB6",
  gold: "#B08D4F",
};

function App() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("today");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          setData({ ...DEFAULT_DATA, ...JSON.parse(raw) });
        } else {
          setData(DEFAULT_DATA);
        }
      } catch {
        setData(DEFAULT_DATA);
      }
      setLoaded(true);
    })();
  }, []);

  const persist = useCallback(async (next) => {
    setData(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Could not save:", e);
    }
  }, []);

  if (!loaded || !data) {
    return (
      <div style={{ ...styles.shell, alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "Georgia, serif", color: C.faint }}>Opening your journal…</div>
      </div>
    );
  }

  const tabs = [
    ["today", "Today"],
    ["reading", "Reading"],
    ["prayer", "Prayer"],
    ["journal", "Journal"],
  ];

  return (
    <div style={styles.shell}>
      <style>{globalCss}</style>
      <header style={styles.header}>
        <div style={styles.flourish}>✶</div>
        <h1 style={styles.title}>Daily Bread</h1>
        <div style={styles.subtitle}>a reading &amp; prayer journal</div>
      </header>

      <nav style={styles.nav}>
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              ...styles.navBtn,
              ...(tab === key ? styles.navBtnActive : {}),
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      <main style={styles.main}>
        {tab === "today" && <Today data={data} persist={persist} setTab={setTab} />}
        {tab === "reading" && <Reading data={data} persist={persist} />}
        {tab === "prayer" && <Prayer data={data} persist={persist} />}
        {tab === "journal" && <Journal data={data} persist={persist} />}
      </main>
    </div>
  );
}

// --------------------------------------------------------------------- TODAY
function Today({ data, persist, setTab }) {
  const { current, sermon } = data;
  const chapters = BOOKS.find((b) => b[0] === current.book)?.[1] || 1;
  const doneList = current.done[current.book] || [];
  const nextChapter = (() => {
    for (let i = 1; i <= chapters; i++) if (!doneList.includes(i)) return i;
    return null; // book complete
  })();

  const [reflection, setReflection] = useState("");
  const [activeQ, setActiveQ] = useState(() => Math.floor(Math.random() * OBSERVATION_QUESTIONS.length));
  const [reformedQ, setReformedQ] = useState("");
  const [reformedLoading, setReformedLoading] = useState(false);

  const refLabel = nextChapter ? `${current.book} ${nextChapter}` : current.book;

  const primeReading = () => {
    const q = generateReformedQuestion(refLabel);
    setReformedQ(q);
  };

  // Clear a primed question once the reading moves to a new chapter/book,
  // so a stale question never sits above a passage it wasn't written for.
  useEffect(() => {
    setReformedQ("");
  }, [refLabel]);

  const markChapterDone = () => {
    if (nextChapter == null) return;
    const nextDone = { ...current.done, [current.book]: [...doneList, nextChapter].sort((a, b) => a - b) };
    const stillLeft = Array.from({ length: chapters }, (_, i) => i + 1).some((c) => !nextDone[current.book].includes(c));
    const finished = stillLeft || data.finished.includes(current.book) ? data.finished : [...data.finished, current.book];
    persist({
      ...data,
      current: { ...current, done: nextDone },
      finished,
      todayStamp: { date: todayISO(), done: true },
    });
  };

  const saveReflection = () => {
    const text = reflection.trim();
    if (!text) return;
    const entry = {
      id: Date.now(),
      date: todayISO(),
      ref: refLabel,
      prompt: reformedQ || OBSERVATION_QUESTIONS[activeQ],
      text,
    };
    persist({ ...data, journal: [entry, ...data.journal] });
    setReflection("");
    setActiveQ(Math.floor(Math.random() * OBSERVATION_QUESTIONS.length));
  };

  const markSermon = () => {
    persist({ ...data, sermon: { ...sermon, read: !sermon.read, week: weekKey() } });
  };
  const setSermonRef = (v) => persist({ ...data, sermon: { ...sermon, ref: v, week: weekKey() } });

  return (
    <div>
      <div style={styles.dateLine}>{prettyDate(todayISO())}</div>

      {/* Reading portion */}
      <Card title="Today's reading">
        {nextChapter ? (
          <>
            <div style={styles.bigRef}>{current.book} {nextChapter}</div>
            <div style={styles.metaLine}>
              {doneList.length} of {chapters} chapters read · {current.pace} {current.paceUnit}/day
            </div>
            <button onClick={markChapterDone} style={styles.stampBtn}>
              ✓ Mark {current.book} {nextChapter} read
            </button>
          </>
        ) : (
          <div style={styles.doneNote}>
            You've finished {current.book}. Choose your next book on the Reading tab.
            <button onClick={() => setTab("reading")} style={{ ...styles.linkBtn, marginTop: 10 }}>
              Go to Reading →
            </button>
          </div>
        )}
      </Card>

      {/* Prime your reading — Reformed reading question */}
      <Card title="Prime your reading">
        {reformedQ ? (
          <div style={styles.reformedQuestion}>{reformedQ}</div>
        ) : (
          <div style={styles.reformedEmpty}>
            A question to carry into {refLabel} as you read — what the Reformed tradition would have you attend to, never a quotation.
          </div>
        )}
        <button onClick={primeReading} style={styles.reformedBtn}>
          {reformedQ ? "↻ Another question" : `Pose a question for ${refLabel}`}
        </button>
      </Card>

      {/* Observation + reflection */}
      <Card title="Sit with it">
        <div style={styles.question}>{OBSERVATION_QUESTIONS[activeQ]}</div>
        <button
          onClick={() => setActiveQ((activeQ + 1) % OBSERVATION_QUESTIONS.length)}
          style={styles.linkBtn}
        >
          ↻ another question
        </button>
        <textarea
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          placeholder="Write a few honest lines…"
          style={styles.textarea}
          rows={4}
        />
        <button onClick={saveReflection} style={styles.primaryBtn} disabled={!reflection.trim()}>
          Save to journal
        </button>
      </Card>

      {/* Sermon passage */}
      <Card title="This week's sermon passage">
        <input
          value={sermon.ref}
          onChange={(e) => setSermonRef(e.target.value)}
          placeholder="e.g. Romans 8:18–30"
          style={styles.input}
        />
        <label style={styles.checkRow}>
          <input type="checkbox" checked={sermon.read} onChange={markSermon} style={styles.checkbox} />
          <span>{sermon.read ? "Read ✓" : "Mark as read"}</span>
        </label>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------- READING
function Reading({ data, persist }) {
  const { current, finished } = data;
  const chapters = BOOKS.find((b) => b[0] === current.book)?.[1] || 1;
  const doneList = current.done[current.book] || [];

  const changeBook = (book) => persist({ ...data, current: { ...current, book } });
  const changePace = (pace) => persist({ ...data, current: { ...current, pace: Math.max(1, Number(pace) || 1) } });
  const changeUnit = (paceUnit) => persist({ ...data, current: { ...current, paceUnit } });

  const toggleChapter = (n) => {
    const has = doneList.includes(n);
    const list = has ? doneList.filter((x) => x !== n) : [...doneList, n].sort((a, b) => a - b);
    const nextDone = { ...current.done, [current.book]: list };
    const complete = list.length === chapters;
    let nextFinished = finished.filter((b) => b !== current.book);
    if (complete) nextFinished = [...nextFinished, current.book];
    persist({ ...data, current: { ...current, done: nextDone }, finished: nextFinished });
  };

  return (
    <div>
      <Card title="What are you reading?">
        <select value={current.book} onChange={(e) => changeBook(e.target.value)} style={styles.select}>
          {BOOKS.map(([name]) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <div style={styles.paceRow}>
          <span style={styles.paceLabel}>Pace</span>
          <input
            type="number"
            min={1}
            value={current.pace}
            onChange={(e) => changePace(e.target.value)}
            style={styles.paceInput}
          />
          <select value={current.paceUnit} onChange={(e) => changeUnit(e.target.value)} style={styles.paceSelect}>
            <option value="chapters">chapters/day</option>
            <option value="verses">verses/day</option>
          </select>
        </div>
      </Card>

      <Card title={`${current.book} · ${doneList.length}/${chapters} read`}>
        <div style={styles.grid}>
          {Array.from({ length: chapters }, (_, i) => i + 1).map((n) => {
            const isDone = doneList.includes(n);
            return (
              <button
                key={n}
                onClick={() => toggleChapter(n)}
                style={{ ...styles.cell, ...(isDone ? styles.cellDone : {}) }}
                title={`Chapter ${n}`}
              >
                {n}
              </button>
            );
          })}
        </div>
      </Card>

      <Card title="Books finished">
        {finished.length === 0 ? (
          <div style={styles.emptyNote}>None yet. Complete every chapter of a book and it lands here.</div>
        ) : (
          <div style={styles.finishedWrap}>
            {finished.map((b) => (
              <span key={b} style={styles.finishedChip}>{b}</span>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// -------------------------------------------------------------------- PRAYER
function Prayer({ data, persist }) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");

  const add = () => {
    const n = name.trim();
    if (!n) return;
    const entry = { id: Date.now(), name: n, note: note.trim(), status: "ongoing", added: todayISO() };
    persist({ ...data, prayers: [entry, ...data.prayers] });
    setName("");
    setNote("");
  };
  const toggle = (id) =>
    persist({
      ...data,
      prayers: data.prayers.map((p) =>
        p.id === id ? { ...p, status: p.status === "ongoing" ? "answered" : "ongoing" } : p
      ),
    });
  const remove = (id) => persist({ ...data, prayers: data.prayers.filter((p) => p.id !== id) });

  return (
    <div>
      <Card title="Add a request">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Person or request" style={styles.input} />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="A note (optional)" style={styles.input} />
        <button onClick={add} style={styles.primaryBtn} disabled={!name.trim()}>Add to list</button>
      </Card>

      <Card title={`Praying for (${data.prayers.filter((p) => p.status === "ongoing").length} ongoing)`}>
        {data.prayers.length === 0 ? (
          <div style={styles.emptyNote}>Your list is empty. Add the first name above.</div>
        ) : (
          data.prayers.map((p) => (
            <div key={p.id} style={styles.prayerRow}>
              <button
                onClick={() => toggle(p.id)}
                style={{
                  ...styles.statusPill,
                  ...(p.status === "answered" ? styles.statusAnswered : styles.statusOngoing),
                }}
                title="Tap to toggle"
              >
                {p.status === "answered" ? "Answered" : "Ongoing"}
              </button>
              <div style={styles.prayerBody}>
                <div style={{ ...styles.prayerName, ...(p.status === "answered" ? styles.struck : {}) }}>{p.name}</div>
                {p.note && <div style={styles.prayerNote}>{p.note}</div>}
              </div>
              <button onClick={() => remove(p.id)} style={styles.removeBtn} title="Remove">×</button>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------- JOURNAL
function Journal({ data, persist }) {
  const [msg, setMsg] = useState("");
  const fileRef = React.useRef(null);

  const flash = (t) => {
    setMsg(t);
    setTimeout(() => setMsg(""), 3000);
  };

  const exportMarkdown = () => {
    const ok = downloadFile(`daily-bread-journal-${todayISO()}.md`, journalToMarkdown(data), "text/markdown");
    flash(ok ? "Journal exported as Markdown." : "Export failed — check your browser's download settings.");
  };

  const exportBackup = () => {
    const payload = JSON.stringify({ _format: "daily-bread", _version: 1, exported: todayISO(), data }, null, 2);
    const ok = downloadFile(`daily-bread-backup-${todayISO()}.json`, payload, "application/json");
    flash(ok ? "Full backup saved as JSON." : "Backup failed — check your browser's download settings.");
  };

  const importBackup = (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const incoming = parsed && parsed._format === "daily-bread" ? parsed.data : parsed;
        if (!incoming || typeof incoming !== "object" || !Array.isArray(incoming.journal)) {
          flash("That file isn't a recognised backup.");
          return;
        }
        persist({ ...DEFAULT_DATA, ...incoming });
        flash("Backup restored.");
      } catch {
        flash("Couldn't read that file — is it a Daily Bread backup?");
      } finally {
        if (fileRef.current) fileRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  return (
    <div>
      <Card title="Export & backup">
        <div style={styles.exportRow}>
          <button onClick={exportMarkdown} style={styles.exportBtn}>↓ Journal (Markdown)</button>
          <button onClick={exportBackup} style={styles.exportBtnAlt}>↓ Full backup (JSON)</button>
          <button onClick={() => fileRef.current && fileRef.current.click()} style={styles.exportBtnGhost}>↑ Restore backup</button>
        </div>
        <input ref={fileRef} type="file" accept=".json,application/json" onChange={importBackup} style={{ display: "none" }} />
        <div style={styles.exportHint}>
          Markdown is for reading and printing. JSON keeps everything — reading progress, prayers, reflections — and can be restored later.
        </div>
        {msg && <div style={styles.exportMsg}>{msg}</div>}
      </Card>

      {data.journal.length === 0 ? (
        <Card title="Journal">
          <div style={styles.emptyNote}>No reflections yet. Save one from the Today tab and it appears here, newest first.</div>
        </Card>
      ) : (
        data.journal.map((e) => (
          <div key={e.id} style={styles.journalEntry}>
            <div style={styles.journalHead}>
              <span style={styles.journalRef}>{e.ref}</span>
              <span style={styles.journalDate}>{prettyDate(e.date)}</span>
            </div>
            {e.prompt && <div style={styles.journalPrompt}>{e.prompt}</div>}
            <div style={styles.journalText}>{e.text}</div>
          </div>
        ))
      )}
    </div>
  );
}

// ----------------------------------------------------------------- PRIMITIVE
function Card({ title, children }) {
  return (
    <section style={styles.card}>
      <div style={styles.cardTitle}>{title}</div>
      {children}
    </section>
  );
}

const globalCss = `
  * { box-sizing: border-box; }
  button { cursor: pointer; font-family: Georgia, "Times New Roman", serif; }
  button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
    outline: 2px solid ${C.gold}; outline-offset: 2px;
  }
  ::placeholder { color: ${C.faint}; opacity: 0.7; }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

const styles = {
  shell: {
    minHeight: "100vh",
    background: `radial-gradient(circle at 50% 0%, ${C.paper}, ${C.cream})`,
    color: C.ink,
    fontFamily: 'Georgia, "Times New Roman", serif',
    display: "flex",
    flexDirection: "column",
    padding: "0 0 48px",
  },
  header: { textAlign: "center", padding: "32px 20px 12px" },
  flourish: { color: C.gold, fontSize: 18, letterSpacing: 6, marginBottom: 4 },
  title: { margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: 0.5, color: C.redDeep, fontVariant: "small-caps" },
  subtitle: { color: C.faint, fontStyle: "italic", fontSize: 14, marginTop: 2 },
  nav: {
    display: "flex",
    justifyContent: "center",
    gap: 4,
    borderTop: `1px solid ${C.rule}`,
    borderBottom: `1px solid ${C.rule}`,
    margin: "16px auto 0",
    maxWidth: 560,
    width: "100%",
  },
  navBtn: {
    flex: 1,
    background: "transparent",
    border: "none",
    padding: "12px 8px",
    fontSize: 15,
    color: C.faint,
    borderBottom: "3px solid transparent",
    transition: "color 0.15s, border-color 0.15s",
  },
  navBtnActive: { color: C.redDeep, borderBottom: `3px solid ${C.red}`, fontWeight: 700 },
  main: { maxWidth: 560, width: "100%", margin: "0 auto", padding: "20px 16px 0" },
  dateLine: { textAlign: "center", fontStyle: "italic", color: C.olive, marginBottom: 16, fontSize: 15 },

  card: {
    background: C.paper,
    border: `1px solid ${C.rule}`,
    borderRadius: 2,
    padding: "16px 18px",
    marginBottom: 18,
    boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
  },
  cardTitle: {
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: C.olive,
    borderBottom: `1px solid ${C.rule}`,
    paddingBottom: 8,
    marginBottom: 14,
  },

  bigRef: { fontSize: 28, color: C.redDeep, fontWeight: 700 },
  metaLine: { color: C.faint, fontSize: 13, margin: "4px 0 14px" },
  stampBtn: {
    width: "100%",
    background: C.red,
    color: C.paper,
    border: "none",
    padding: "12px",
    fontSize: 16,
    borderRadius: 2,
    letterSpacing: 0.5,
  },
  doneNote: { color: C.olive, fontStyle: "italic", lineHeight: 1.5 },

  question: { fontSize: 18, lineHeight: 1.4, color: C.ink, marginBottom: 6, fontStyle: "italic" },
  reformedQuestion: {
    fontSize: 17, lineHeight: 1.5, color: C.redDeep, fontStyle: "italic",
    borderLeft: `3px solid ${C.gold}`, paddingLeft: 14, marginBottom: 14,
  },
  reformedEmpty: { fontSize: 14, lineHeight: 1.5, color: C.faint, fontStyle: "italic", marginBottom: 14 },
  reformedBtn: {
    background: "transparent", color: C.olive, border: `1px solid ${C.oliveLite}`,
    padding: "9px 16px", fontSize: 14, borderRadius: 2,
  },
  textarea: {
    width: "100%",
    marginTop: 10,
    padding: 12,
    fontSize: 15,
    fontFamily: "inherit",
    background: C.cream,
    border: `1px solid ${C.rule}`,
    borderRadius: 2,
    color: C.ink,
    resize: "vertical",
    lineHeight: 1.5,
  },
  input: {
    width: "100%",
    padding: 11,
    fontSize: 15,
    fontFamily: "inherit",
    background: C.cream,
    border: `1px solid ${C.rule}`,
    borderRadius: 2,
    color: C.ink,
    marginBottom: 10,
  },
  primaryBtn: {
    background: C.olive,
    color: C.paper,
    border: "none",
    padding: "10px 18px",
    fontSize: 15,
    borderRadius: 2,
    marginTop: 4,
  },
  linkBtn: {
    background: "transparent",
    border: "none",
    color: C.red,
    fontSize: 13,
    fontStyle: "italic",
    padding: "2px 0",
    textDecoration: "underline",
  },
  checkRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 6, color: C.ink, fontSize: 15 },
  checkbox: { width: 18, height: 18, accentColor: C.olive },

  select: {
    width: "100%",
    padding: 11,
    fontSize: 16,
    fontFamily: "inherit",
    background: C.cream,
    border: `1px solid ${C.rule}`,
    borderRadius: 2,
    color: C.ink,
  },
  paceRow: { display: "flex", alignItems: "center", gap: 10, marginTop: 12 },
  paceLabel: { fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: C.faint },
  paceInput: {
    width: 56, padding: 8, fontSize: 15, textAlign: "center", fontFamily: "inherit",
    background: C.cream, border: `1px solid ${C.rule}`, borderRadius: 2, color: C.ink,
  },
  paceSelect: {
    flex: 1, padding: 8, fontSize: 14, fontFamily: "inherit",
    background: C.cream, border: `1px solid ${C.rule}`, borderRadius: 2, color: C.ink,
  },

  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(40px, 1fr))", gap: 6 },
  cell: {
    aspectRatio: "1 / 1",
    background: C.cream,
    border: `1px solid ${C.rule}`,
    borderRadius: 2,
    color: C.faint,
    fontSize: 13,
    transition: "background 0.12s, color 0.12s",
  },
  cellDone: { background: C.olive, color: C.paper, borderColor: C.olive, fontWeight: 700 },

  emptyNote: { color: C.faint, fontStyle: "italic", lineHeight: 1.5, fontSize: 14 },
  finishedWrap: { display: "flex", flexWrap: "wrap", gap: 8 },
  finishedChip: {
    background: C.cream, border: `1px solid ${C.oliveLite}`, color: C.olive,
    padding: "5px 12px", borderRadius: 14, fontSize: 13,
  },

  prayerRow: {
    display: "flex", alignItems: "flex-start", gap: 10,
    padding: "12px 0", borderBottom: `1px solid ${C.rule}`,
  },
  statusPill: { border: "none", borderRadius: 12, padding: "4px 10px", fontSize: 11, letterSpacing: 0.5, whiteSpace: "nowrap" },
  statusOngoing: { background: "#EFE4C9", color: C.gold },
  statusAnswered: { background: C.olive, color: C.paper },
  prayerBody: { flex: 1 },
  prayerName: { fontSize: 16, color: C.ink },
  prayerNote: { fontSize: 13, color: C.faint, fontStyle: "italic", marginTop: 2 },
  struck: { textDecoration: "line-through", color: C.faint },
  removeBtn: { background: "transparent", border: "none", color: C.faint, fontSize: 22, lineHeight: 1, padding: "0 4px" },

  exportRow: { display: "flex", flexWrap: "wrap", gap: 8 },
  exportBtn: {
    background: C.olive, color: C.paper, border: "none",
    padding: "9px 14px", fontSize: 14, borderRadius: 2, flex: "1 1 auto",
  },
  exportBtnAlt: {
    background: C.red, color: C.paper, border: "none",
    padding: "9px 14px", fontSize: 14, borderRadius: 2, flex: "1 1 auto",
  },
  exportBtnGhost: {
    background: "transparent", color: C.olive, border: `1px solid ${C.oliveLite}`,
    padding: "9px 14px", fontSize: 14, borderRadius: 2, flex: "1 1 auto",
  },
  exportHint: { color: C.faint, fontSize: 12.5, fontStyle: "italic", lineHeight: 1.5, marginTop: 12 },
  exportMsg: { color: C.olive, fontSize: 13, marginTop: 8, fontWeight: 700 },

  journalEntry: {
    background: C.paper, border: `1px solid ${C.rule}`, borderLeft: `3px solid ${C.red}`,
    borderRadius: 2, padding: "14px 16px", marginBottom: 14,
  },
  journalHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 },
  journalRef: { color: C.redDeep, fontWeight: 700, fontSize: 16 },
  journalDate: { color: C.faint, fontSize: 12, fontStyle: "italic" },
  journalPrompt: { color: C.olive, fontSize: 13, fontStyle: "italic", marginBottom: 6 },
  journalText: { color: C.ink, fontSize: 15, lineHeight: 1.6, whiteSpace: "pre-wrap" },
};

// --- Mount -----------------------------------------------------------------
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));
