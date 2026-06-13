"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Clipboard, Languages, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppFrame } from "@/components/AppFrame";
import { getAvailableCredits, getTranslateCreditCharge, useBillingStore } from "@/store/useBillingStore";

const targetLanguages = [
  "English",
  "Hindi",
  "Spanish",
  "French",
  "German",
  "Arabic",
  "Japanese",
  "Korean",
  "Portuguese",
  "Chinese"
];

type TranslateResponse = {
  translation?: string;
  error?: string;
};

export function TranslatePageContent() {
  const [text, setText] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("Auto-detect");
  const [targetLanguage, setTargetLanguage] = useState("English");
  const [translation, setTranslation] = useState("");
  const [error, setError] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const cleanText = text.trim();

    if (!cleanText || isTranslating) {
      return;
    }

    const creditCharge = getTranslateCreditCharge(cleanText.length);
    const billingState = useBillingStore.getState();

    if (getAvailableCredits(billingState) < creditCharge.credits) {
      setError(`Need ${creditCharge.credits} credits for ${creditCharge.label}.`);
      return;
    }

    billingState.spendCredits(creditCharge);
    setIsTranslating(true);
    setError("");

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: cleanText,
          sourceLanguage: sourceLanguage === "Auto-detect" ? undefined : sourceLanguage,
          targetLanguage
        })
      });
      const data = (await response.json()) as TranslateResponse;

      if (!response.ok || typeof data.translation !== "string") {
        throw new Error(data.error || "Translate could not process that request.");
      }

      setTranslation(data.translation);
      toast.success("Translation ready");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Translate could not process that request.");
    } finally {
      setIsTranslating(false);
    }
  }

  async function copyTranslation() {
    if (!translation) {
      return;
    }

    try {
      await navigator.clipboard.writeText(translation);
      toast.success("Copied translation");
    } catch {
      toast.error("Could not copy translation");
    }
  }

  function swapLanguages() {
    if (sourceLanguage === "Auto-detect") {
      return;
    }

    setSourceLanguage(targetLanguage);
    setTargetLanguage(sourceLanguage);
    setText(translation || text);
    setTranslation(text);
  }

  return (
    <AppFrame title="Translate">
      <section className="route-content translate-route">
        <form className="translate-shell" onSubmit={handleSubmit}>
          <div className="translate-header">
            <span className="artifact-icon translate-icon">
              <Languages size={19} />
            </span>
            <div>
              <p className="eyebrow">Aria Translate</p>
              <h2>Translate</h2>
            </div>
          </div>

          <div className="translate-language-row">
            <label>
              From
              <select value={sourceLanguage} onChange={(event) => setSourceLanguage(event.target.value)}>
                <option>Auto-detect</option>
                {targetLanguages.map((language) => (
                  <option key={language}>{language}</option>
                ))}
              </select>
            </label>
            <button className="translate-swap" type="button" onClick={swapLanguages} aria-label="Swap languages">
              <ArrowRight size={16} />
            </button>
            <label>
              To
              <select value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)}>
                {targetLanguages.map((language) => (
                  <option key={language}>{language}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="translate-grid">
            <label className="translate-panel">
              <span>Text</span>
              <textarea
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  setError("");
                }}
                placeholder="Enter text to translate..."
              />
            </label>
            <div className="translate-panel translate-output-panel">
              <div className="translate-panel-heading">
                <span>Translation</span>
                <button type="button" onClick={copyTranslation} disabled={!translation} aria-label="Copy translation">
                  <Clipboard size={15} />
                </button>
              </div>
              <div className="translate-output">
                {isTranslating ? (
                  <span className="translate-muted">
                    <Loader2 className="spin" size={16} />
                    Translating
                  </span>
                ) : translation ? (
                  translation
                ) : (
                  <span className="translate-muted">Translation will appear here.</span>
                )}
              </div>
            </div>
          </div>

          {error ? <p className="translate-error">{error}</p> : null}

          <button className="primary-button translate-submit" type="submit" disabled={!text.trim() || isTranslating}>
            {isTranslating ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
            Translate
          </button>
        </form>
      </section>
    </AppFrame>
  );
}
