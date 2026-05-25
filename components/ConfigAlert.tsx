"use client";

import { AlertCircle, ArrowRight } from "lucide-react";

type ConfigAlertProps = {
  message: string;
};

export function ConfigAlert({ message }: ConfigAlertProps) {
  return (
    <aside className="config-alert" role="status" aria-live="polite">
      <AlertCircle className="config-alert-icon" size={20} />
      <div>
        <p className="config-alert-title">Configuration needed</p>
        <p className="config-alert-body">{message}</p>
        <a
          className="config-alert-link"
          href="https://nextjs.org/docs/app/guides/environment-variables"
          target="_blank"
          rel="noreferrer"
        >
          View setup guide
          <ArrowRight size={13} />
        </a>
      </div>
    </aside>
  );
}
