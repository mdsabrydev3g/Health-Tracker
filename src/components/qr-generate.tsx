"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button, Modal, toast } from "@/components/ui";

/** Renders a QR code image for a payload with print support. */
export function QrGenerateModal({
  open,
  onClose,
  payload,
  title,
}: {
  open: boolean;
  onClose: () => void;
  payload: string;
  title: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(payload, {
      width: 512,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#16233b", light: "#ffffff" },
    })
      .then(setDataUrl)
      .catch(() => toast("تعذر إنشاء الكود", "err"));
  }, [open, payload]);

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-3 text-center">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="QR" className="mx-auto w-56 rounded-xl border border-slate-200 dark:border-slate-600" />
        ) : (
          <p className="py-10 muted">جارٍ الإنشاء…</p>
        )}
        <p className="text-sm muted">
          اطبع الكود والصقه على علبة الدواء — مسحه سيملأ بيانات الدواء تلقائياً عند الإضافة.
        </p>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={async () => {
              if (!dataUrl) return;
              try {
                const blob = await (await fetch(dataUrl)).blob();
                await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
                toast("تم نسخ الصورة ✅");
              } catch {
                toast("تعذر النسخ — استخدم الطباعة", "err");
              }
            }}
          >
            نسخ الصورة
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => window.print()}>
            طباعة
          </Button>
        </div>
      </div>
    </Modal>
  );
}
