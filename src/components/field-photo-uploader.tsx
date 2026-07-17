"use client";

import { type ChangeEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  finalizeServicePhotoUploadAction,
  prepareServicePhotoUploadAction,
} from "@/app/field/actions";
import { createClient } from "@/lib/supabase/client";

type FieldPhotoType = "before" | "after" | "issue";

type FieldPhotoUploaderProps = {
  actionLabel: string;
  photoType: FieldPhotoType;
  visitId: string;
};

type Notice = {
  tone: "success" | "error" | "info";
  message: string;
};

const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const MAX_SELECTED_FILES = 20;

export function FieldPhotoUploader({
  actionLabel,
  photoType,
  visitId,
}: FieldPhotoUploaderProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState("");

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";

    if (!selected.length) return;

    const accepted: File[] = [];
    const rejected: string[] = [];

    for (const file of selected) {
      const contentType = normalizeImageContentType(file);

      if (!contentType) {
        rejected.push(`${file.name}: unsupported image format`);
        continue;
      }

      if (file.size <= 0) {
        rejected.push(`${file.name}: empty file`);
        continue;
      }

      if (file.size > MAX_PHOTO_BYTES) {
        rejected.push(`${file.name}: larger than 20 MB`);
        continue;
      }

      accepted.push(file);
    }

    setFiles((current) =>
      [...current, ...accepted].slice(0, MAX_SELECTED_FILES),
    );

    if (rejected.length) {
      setNotice({
        tone: "error",
        message: rejected.join(". "),
      });
    } else {
      setNotice({
        tone: "info",
        message: `${accepted.length} ${
          accepted.length === 1 ? "photo" : "photos"
        } selected. Press Upload Selected Photos to save ${
          accepted.length === 1 ? "it" : "them"
        }.`,
      });
    }
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function uploadSelectedPhotos() {
    if (!files.length || isUploading) return;

    const queue = [...files];
    let completed = 0;

    setIsUploading(true);
    setNotice(null);

    try {
      for (let index = 0; index < queue.length; index += 1) {
        const file = queue[index];
        const contentType = normalizeImageContentType(file);

        if (!contentType) {
          throw new Error(`${file.name} is not a supported image format.`);
        }

        setProgress(`Preparing photo ${index + 1} of ${queue.length}...`);

        const prepared = await prepareServicePhotoUploadAction({
          visitId,
          photoType,
          fileName: file.name,
          contentType,
          size: file.size,
        });

        if (!prepared.ok || !prepared.data) {
          throw new Error(
            prepared.error ?? `Could not prepare ${file.name} for upload.`,
          );
        }

        setProgress(`Uploading photo ${index + 1} of ${queue.length}...`);

        const { error: uploadError } = await supabase.storage
          .from(prepared.data.bucket)
          .uploadToSignedUrl(
            prepared.data.path,
            prepared.data.token,
            file,
            {
              cacheControl: "3600",
              contentType: prepared.data.contentType,
              upsert: false,
            },
          );

        if (uploadError) {
          throw new Error(
            `${file.name} did not reach Supabase: ${uploadError.message}`,
          );
        }

        setProgress(`Confirming photo ${index + 1} of ${queue.length}...`);

        let finalized = await finalizeServicePhotoUploadAction({
          visitId,
          photoType,
          storageBucket: prepared.data.bucket,
          storagePath: prepared.data.path,
        });

        // Storage listings can occasionally lag immediately after an upload.
        if (!finalized.ok) {
          await sleep(750);
          finalized = await finalizeServicePhotoUploadAction({
            visitId,
            photoType,
            storageBucket: prepared.data.bucket,
            storagePath: prepared.data.path,
          });
        }

        if (!finalized.ok) {
          throw new Error(
            finalized.error ??
              `${file.name} reached storage but could not be attached to this stop.`,
          );
        }

        completed += 1;
        setFiles(queue.slice(completed));
      }

      setProgress("");
      setNotice({
        tone: "success",
        message: `${completed} ${
          completed === 1 ? "photo is" : "photos are"
        } confirmed in Supabase and attached to this stop.`,
      });
      router.refresh();
    } catch (caught) {
      const message =
        caught instanceof Error && caught.message
          ? caught.message
          : "Photo upload failed.";

      setProgress("");
      setNotice({
        tone: "error",
        message:
          completed > 0
            ? `${completed} ${
                completed === 1 ? "photo was" : "photos were"
              } saved before the failure. ${message}`
            : message,
      });
      router.refresh();
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="field-photo-uploader">
      <div className="photo-upload-choice-grid">
        <button
          className="photo-upload-choice"
          disabled={isUploading}
          type="button"
          onClick={() => cameraInputRef.current?.click()}
        >
          <span aria-hidden="true">📷</span>
          <span>
            <strong>Take Photo</strong>
            <small>Open the rear camera.</small>
          </span>
        </button>

        <button
          className="photo-upload-choice"
          disabled={isUploading}
          type="button"
          onClick={() => libraryInputRef.current?.click()}
        >
          <span aria-hidden="true">🖼️</span>
          <span>
            <strong>Choose from Library</strong>
            <small>Select existing phone or computer photos.</small>
          </span>
        </button>
      </div>

      <input
        ref={cameraInputRef}
        className="photo-native-input"
        accept="image/*"
        capture="environment"
        type="file"
        onChange={addFiles}
      />

      <input
        ref={libraryInputRef}
        className="photo-native-input"
        accept="image/*,.heic,.heif"
        multiple
        type="file"
        onChange={addFiles}
      />

      {files.length ? (
        <div className="photo-selection-panel">
          <div className="photo-selection-heading">
            <strong>
              {files.length} {files.length === 1 ? "photo" : "photos"} selected
            </strong>
            <button
              disabled={isUploading}
              type="button"
              onClick={() => setFiles([])}
            >
              Clear
            </button>
          </div>

          <ul>
            {files.map((file, index) => (
              <li key={`${file.name}-${file.lastModified}-${index}`}>
                <span>
                  <strong>{file.name}</strong>
                  <small>{formatBytes(file.size)}</small>
                </span>
                <button
                  aria-label={`Remove ${file.name}`}
                  disabled={isUploading}
                  type="button"
                  onClick={() => removeFile(index)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        className="photo-upload-submit"
        disabled={!files.length || isUploading}
        type="button"
        onClick={uploadSelectedPhotos}
      >
        {isUploading ? progress || "Uploading..." : actionLabel}
      </button>

      <p className="photo-upload-warning">
        Photos are not saved until a green confirmation appears.
      </p>

      {notice ? (
        <p
          className={`photo-upload-notice is-${notice.tone}`}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          {notice.message}
        </p>
      ) : null}
    </div>
  );
}

function normalizeImageContentType(file: File) {
  const currentType = file.type.toLowerCase();

  if (
    [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ].includes(currentType)
  ) {
    return currentType;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "heic") return "image/heic";
  if (extension === "heif") return "image/heif";

  return "";
}

function formatBytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
