"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Button, Modal, toast } from "@/components/ui";

/**
 * QR scanner modal: getUserMedia camera feed + jsQR frame decoding.
 * Payload contract: see src/lib/med-qr.ts — decode result is passed as raw text.
 */
export function QrScannerModal({
  open,
  onClose,
  onScan,
}: {
  open: boolean;
  onClose: () => void;
  onScan: (text: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [state, setState] = useState<"idle" | "starting" | "scanning" | "denied" | "error">("idle");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function start() {
      setState("starting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        await video.play();
        setState("scanning");
        tick();
      } catch (e) {
        setState((e as DOMException)?.name === "NotAllowedError" ? "denied" : "error");
      }
    }

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
          if (code?.data) {
            stop();
            onScan(code.data);
            return;
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    function stop() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    start();
    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="مسح QR">
      <div className="space-y-3">
        <div className="relative overflow-hidden rounded-xl bg-black" style={{ minHeight: 260 }}>
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          <canvas ref={canvasRef} className="hidden" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-44 w-44 rounded-2xl border-4 border-white/80" />
          </div>
          {state === "starting" && (
            <p className="absolute inset-0 flex items-center justify-center text-white">جارٍ تشغيل الكاميرا…</p>
          )}
        </div>
        {state === "denied" && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900 dark:text-red-200">
            مرفوض الوصول للكاميرا. اسمح لل موقع باستخدام الكاميرا من إعدادات المتصفح، أو من إعدادات التطبيق على الموبايل.
          </p>
        )}
        {state === "error" && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900 dark:text-red-200">
            تعذر فتح الكاميرا. تأكد أن الجهاز يحتوي كاميرا والموقع يعمل على https.
          </p>
        )}
        <p className="text-center text-sm muted">وجّه الكاميرا نحو كود QR الموجود على علبة الدواء</p>
        <Button variant="outline" className="w-full" onClick={onClose}>
          إلغاء
        </Button>
      </div>
    </Modal>
  );
}

export function toastScanUnsupported() {
  toast("المتصفح لا يدعم الكاميرا", "err");
}
