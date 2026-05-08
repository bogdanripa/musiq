import { useEffect } from "react";

interface Props {
  message: string | null;
  kind?: "info" | "success" | "error";
  onDismiss: () => void;
}

export function Toast({ message, kind = "info", onDismiss }: Props) {
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) return null;
  return (
    <div className={`toast toast-${kind}`} onClick={onDismiss}>
      {message}
    </div>
  );
}
