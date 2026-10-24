"use client";

import { useState } from "react";

type Deadline = { title: string; date: string | null; note: string };
type Result = {
  summary: string;
  deadlines: Deadline[];
  documents: string[];
  actions: string[];
};

const SAMPLE =
  "Sample notice: Semester registration for Spring 2027 closes on 30 November 2026. " +
  "Students must pay the registration fee at the accounts office by 25 November 2026 " +
  "and bring their ID card and the previous semester grade sheet.";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function buildICS(deadlines: Deadline[]) {
  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const compact = (d: string) => d.replace(/-/g, "");
  const nextDay = (d: string) => {
    const dt = new Date(d + "T00:00:00Z");
    dt.setUTCDate(dt.getUTCDate() + 1);
    return dt.toISOString().slice(0, 10).replace(/-/g, "");
  };
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";

  const events = deadlines
    .filter((d) => d.date && DATE_RE.test(d.date))
    .map((d, i) =>
      [
        "BEGIN:VEVENT",
        `UID:noticebridge-${i}-${compact(d.date as string)}@noticebridge`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${compact(d.date as string)}`,
        `DTEND;VALUE=DATE:${nextDay(d.date as string)}`,
        `SUMMARY:${esc(d.title || "Deadline")}`,
        `DESCRIPTION:${esc(d.note || "")}`,
        "END:VEVENT",
      ].join("\r\n")
    );

  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//NoticeBridge//EN", ...events, "END:VCALENDAR"].join("\r\n");
}

export default function Home() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function analyze() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "কিছু ভুল হয়েছে");
      setResult(data.result);
    } catch (e: any) {
      setError(e.message || "নেটওয়ার্ক সমস্যা");
    } finally {
      setLoading(false);
    }
  }

  function downloadICS() {
    if (!result) return;
    const blob = new Blob([buildICS(result.deadlines ?? [])], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "deadlines.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  const datedCount = (result?.deadlines ?? []).filter((d) => d.date && DATE_RE.test(d.date)).length;

  return (
    <main className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="text-center">
          <h1 className="text-4xl font-bold text-blue-400">NoticeBridge</h1>
          <p className="text-gray-400 mt-2">
            ক্যাম্পাসের নোটিশ পেস্ট করুন, ডেডলাইন ও করণীয় সহজ বাংলায় জেনে নিন
          </p>
        </header>

        <section className="bg-gray-800 p-5 rounded-xl border border-gray-700">
          <label htmlFor="notice" className="block text-sm text-gray-300 mb-2">
            নোটিশের লেখা
          </label>
          <textarea
            id="notice"
            className="w-full h-44 p-3 bg-gray-900 border border-gray-700 rounded-lg text-white resize-none"
            placeholder="এখানে নোটিশ পেস্ট করুন..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="mt-3 flex gap-3">
            <button
              onClick={analyze}
              disabled={loading || !text.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 font-bold py-3 rounded-lg"
            >
              {loading ? "বিশ্লেষণ চলছে..." : "বিশ্লেষণ করুন"}
            </button>
            <button
              onClick={() => setText(SAMPLE)}
              className="px-4 border border-gray-600 rounded-lg text-gray-300 hover:bg-gray-700"
            >
              নমুনা নোটিশ
            </button>
          </div>
        </section>

        {error && (
          <p role="alert" className="bg-red-900/40 border border-red-700 rounded-lg p-4 text-red-200">
            {error}
          </p>
        )}

        {result && (
          <div className="space-y-4">
            <section className="bg-gray-800 p-5 rounded-xl border border-gray-700">
              <h2 className="text-lg font-bold text-green-400 mb-2">সারাংশ</h2>
              <p className="text-gray-200 whitespace-pre-line">{result.summary}</p>
            </section>

            <section className="bg-gray-800 p-5 rounded-xl border border-gray-700">
              <h2 className="text-lg font-bold text-yellow-400 mb-3">ডেডলাইন</h2>
              {(result.deadlines ?? []).length === 0 && (
                <p className="text-gray-400">কোনো ডেডলাইন পাওয়া যায়নি।</p>
              )}
              <ul className="space-y-2">
                {(result.deadlines ?? []).map((d, i) => (
                  <li key={i} className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                    <p className="font-semibold">{d.title}</p>
                    <p className="text-sm text-yellow-300">{d.date ?? "তারিখ উল্লেখ নেই"}</p>
                    {d.note && <p className="text-sm text-gray-400">{d.note}</p>}
                  </li>
                ))}
              </ul>
              {datedCount > 0 && (
                <button
                  onClick={downloadICS}
                  className="mt-4 w-full border border-yellow-500 text-yellow-300 hover:bg-yellow-500/10 py-2 rounded-lg"
                >
                  ক্যালেন্ডারে যোগ করুন (.ics ডাউনলোড)
                </button>
              )}
            </section>

            <section className="bg-gray-800 p-5 rounded-xl border border-gray-700">
              <h2 className="text-lg font-bold text-purple-400 mb-2">যা যা লাগবে</h2>
              <ul className="list-disc pl-5 space-y-1 text-gray-200">
                {(result.documents ?? []).map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </section>

            <section className="bg-gray-800 p-5 rounded-xl border border-gray-700">
              <h2 className="text-lg font-bold text-pink-400 mb-2">করণীয়</h2>
              <ol className="list-decimal pl-5 space-y-1 text-gray-200">
                {(result.actions ?? []).map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}