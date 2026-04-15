import React from 'react';

export function SystemStatusRow({ label, ok, installCmd, docsUrl }: { label: string; ok: boolean; installCmd?: string; docsUrl?: string }): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);
  function copyCmd(): void {
    if (!installCmd) return;
    navigator.clipboard.writeText(installCmd).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }
  return (
    <div className="sys-status-row">
      <span className="sys-status-icon">{ok ? '✅' : '❌'}</span>
      <span className="sys-status-label">{label}</span>
      {!ok && installCmd && (
        <span className="sys-status-install">
          <code className="sys-status-cmd">{installCmd}</code>
          <button className="sys-status-copy-btn" onClick={copyCmd} title="Copy">{copied ? 'Copied' : 'Copy'}</button>
        </span>
      )}
      {!ok && docsUrl && (
        <a className="sys-status-link" href={docsUrl} target="_blank" rel="noreferrer">Docs</a>
      )}
    </div>
  );
}
