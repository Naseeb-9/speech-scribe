"use client";

import { useEffect, useRef, useState } from "react";
import { RealtimeClient } from "@speechmatics/real-time-client";

type Status = "idle" | "recording";

export default function Page() {
  const [status, setStatus] = useState<Status>("idle");
  const [transcript, setTranscript] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReply, setAiReply] = useState<string>("");
  const clientRef = useRef<RealtimeClient | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);

  // helper: append text
  const append = (s: string) => setTranscript((p) => p + s);

  async function start() {
    setTranscript("");
    setAiReply("");
    // 1) JWT  (server se)
    const { jwt } = await (await fetch("/api/sm-jwt")).json();
    console.log("JWT", jwt);

    // 2) REAL-TIME (Speechmatics): client init + handlers
    const client = new RealtimeClient();
    client.addEventListener("receiveMessage", ({ data }) => {
      if (data.message === "AddTranscript") {
        for (const r of data.results) {
          const text = r?.alternatives?.[0]?.content || "";
          if (!text) continue;
          append((r.type === "word" ? " " : "") + text);
          if (r.is_eos) append("\n"); // sentence complete
        }
      } else if (data.message === "EndOfTranscript") {
        setStatus("idle"); // recording khatam → button enable ho jayega
      }
    });

    // 3) REAL-TIME: session start (docs: Realtime WS API v2)
    await client.start(jwt, {
      transcription_config: {
        language: "en",
        operating_point: "enhanced",
        enable_partials: true,
        max_delay: 2,
      },
    });
    clientRef.current = client;

    // 4 ) Open mic , chunks Speechmatics sent
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream, { mimeType: "audio/webm" }); // falls back if needed
    rec.ondataavailable = (e) =>
      e.data?.arrayBuffer().then((buf) => {
        client.sendAudio(new Uint8Array(buf)); // REAL-TIME audio → Speechmatics
      });
    rec.onstop = () => client.stopRecognition({ noTimeout: true });
    rec.start(250); // 250ms chunks
    recRef.current = rec;

    setStatus("recording");
  }

  function stop() {
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    setStatus("idle");
  }

  // SCRIBING: download TXT (organize/store the text record)
  function downloadTxt() {
    const blob = new Blob([transcript], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "transcript.txt"; // SCRIBING: saved record
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function sendToOpenAI() {
    try {
      setAiLoading(true);
      setAiReply("");
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: transcript.trim(),
        }),
      });
      const data = await res.json();
      setAiReply(data.reply || "No response");
    } catch (e) {
      setAiReply("⚠️ Failed to get response from OpenAI.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-3">Speech-Scribe (1-page)</h1>

      <div className="flex flex-wrap gap-3 mb-4">
        <button
          onClick={start}
          disabled={status === "recording"}
          className="px-3 py-2 rounded bg-black text-white disabled:opacity-50"
        >
          Start (Mic)
        </button>
        <button
          onClick={stop}
          disabled={status !== "recording"}
          className="px-3 py-2 rounded border disabled:opacity-50"
        >
          Stop
        </button>
        <button
          onClick={downloadTxt}
          disabled={!transcript}
          className="px-3 py-2 rounded border disabled:opacity-50"
        >
          Download .txt
        </button>

        {/* NEW: Send to OpenAI */}
        <button
          onClick={sendToOpenAI}
          disabled={!transcript.trim() || status === "recording" || aiLoading}
          className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
          title={
            status === "recording"
              ? "Stop recording first"
              : !transcript.trim()
              ? "Transcript is empty"
              : "Send transcript to OpenAI"
          }
        >
          {aiLoading ? "Sending..." : "Send to OpenAI"}
        </button>
      </div>

      <label className="text-sm font-medium">Transcript</label>
      <pre className="whitespace-pre-wrap bg-gray-100 p-3 rounded h-[36vh] overflow-auto mb-4">
        {transcript || "Transcript will appear here..."}
      </pre>

      {/* AI response panel */}
      <div className="bg-white border rounded p-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">AI Response</h2>
          {aiLoading && <span className="text-sm text-gray-500">Thinking…</span>}
        </div>
        <div className="min-h-[120px] whitespace-pre-wrap">
          {aiReply || "— no response yet —"}
        </div>
      </div>

      <p className="text-sm mt-4 text-gray-600">
        <strong>REAL-TIME:</strong> mic audio → Speechmatics WS → text.&nbsp;
        <strong>SCRIBING:</strong> File save/download.&nbsp;
        <strong>AI:</strong> Send transcript to OpenAI.
      </p>
    </main>
  );
}
