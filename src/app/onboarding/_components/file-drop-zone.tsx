"use client";

import { useRef, useState, useCallback } from "react";
import { toast } from "sonner";

interface FileDropZoneProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const DEFAULT_ACCEPT = ".pdf,.ppt,.pptx,.doc,.docx";

export function FileDropZone({
  onFiles,
  accept = DEFAULT_ACCEPT,
  disabled = false,
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const validateAndEmit = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      const valid: File[] = [];

      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`"${file.name}" is too large (max 10 MB)`);
          continue;
        }

        const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
        const allowed = accept.split(",").map((a) => a.trim().toLowerCase());
        if (!allowed.includes(ext)) {
          toast.error(`"${file.name}" — unsupported file type`);
          continue;
        }

        valid.push(file);
      }

      if (valid.length > 0) onFiles(valid);
    },
    [accept, onFiles]
  );

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items?.length) setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragging(false);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;
    if (!disabled && e.dataTransfer.files?.length) {
      validateAndEmit(e.dataTransfer.files);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) {
      validateAndEmit(e.target.files);
    }
    e.target.value = "";
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => !disabled && fileInputRef.current?.click()}
      className={`
        flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed
        px-6 py-10 text-center transition-colors
        ${
          isDragging
            ? "border-brand bg-brand/5 dark:bg-brand/10"
            : "border-zinc-300 bg-zinc-50/50 hover:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-800/30 dark:hover:border-zinc-500"
        }
        ${disabled ? "pointer-events-none opacity-50" : ""}
      `}
    >
      {/* Upload icon */}
      <svg
        className={`mb-3 h-8 w-8 ${isDragging ? "text-brand" : "text-zinc-400"}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Drag &amp; drop files or{" "}
        <span className="font-medium text-brand underline-offset-2 hover:underline">
          click to browse
        </span>
      </p>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
}
