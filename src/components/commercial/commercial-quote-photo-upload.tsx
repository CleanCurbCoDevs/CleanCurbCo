"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Camera,
  CheckCircle2,
  ImagePlus,
  Trash2,
  Upload,
} from "lucide-react";
import {
  COMMERCIAL_QUOTE_MAX_PHOTO_BYTES,
  COMMERCIAL_QUOTE_MAX_PHOTOS,
  COMMERCIAL_QUOTE_PHOTO_BUCKET,
  isAllowedCommercialPhotoType,
} from "@/lib/commercial-photo-config";
import {
  trackAnalyticsEvent,
} from "@/lib/client-analytics";
import {
  createClient,
} from "@/lib/supabase/client";
import {
  useActionFeedback,
} from "@/components/action-feedback";

type SelectedPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

type SignedUpload = {
  path: string;
  token: string;
  name: string;
  type: string;
  size: number;
};

export function CommercialQuotePhotoUpload({
  quoteId,
  uploadToken,
}: {
  quoteId: string;
  uploadToken: string;
}) {
  const feedback = useActionFeedback();

  const photosRef =
    useRef<SelectedPhoto[]>([]);

  const [photos, setPhotos] =
    useState<SelectedPhoto[]>([]);

  const [isUploading, setIsUploading] =
    useState(false);

  const [uploadedCount, setUploadedCount] =
    useState(0);

  const [completed, setCompleted] =
    useState(false);

  const [skipped, setSkipped] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      photosRef.current.forEach(
        (photo) => {
          URL.revokeObjectURL(
            photo.previewUrl,
          );
        },
      );
    };
  }, []);

  function handlePhotoSelection(
    event:
      React.ChangeEvent<HTMLInputElement>,
  ) {
    const incomingFiles =
      Array.from(
        event.target.files ?? [],
      );

    event.target.value = "";
    setError("");

    if (!incomingFiles.length) {
      return;
    }

    const remaining =
      COMMERCIAL_QUOTE_MAX_PHOTOS -
      photos.length;

    if (
      incomingFiles.length >
      remaining
    ) {
      setError(
        `You can add ${remaining} more photo${
          remaining === 1 ? "" : "s"
        }.`,
      );

      return;
    }

    const invalidFile =
      incomingFiles.find(
        (file) =>
          !isAllowedCommercialPhotoType(
            file.type,
          ) ||
          file.size >
            COMMERCIAL_QUOTE_MAX_PHOTO_BYTES,
      );

    if (invalidFile) {
      setError(
        `${invalidFile.name} is not a supported image or is larger than 10 MB.`,
      );

      return;
    }

    const nextPhotos =
      incomingFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl:
          URL.createObjectURL(file),
      }));

    setPhotos((current) => [
      ...current,
      ...nextPhotos,
    ]);
  }

  function removePhoto(
    photoId: string,
  ) {
    setPhotos((current) => {
      const removed = current.find(
        (photo) =>
          photo.id === photoId,
      );

      if (removed) {
        URL.revokeObjectURL(
          removed.previewUrl,
        );
      }

      return current.filter(
        (photo) =>
          photo.id !== photoId,
      );
    });
  }

  async function uploadPhotos() {
    if (!photos.length) {
      setError(
        "Select at least one photo before uploading.",
      );

      return;
    }

    setError("");
    setIsUploading(true);
    setUploadedCount(0);

    try {
      const signingResponse =
        await fetch(
          `/api/commercial-quotes/${quoteId}/photos`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              uploadToken,
              files: photos.map(
                ({ file }) => ({
                  name: file.name,
                  type: file.type,
                  size: file.size,
                }),
              ),
            }),
          },
        );

      const signingData =
        (await signingResponse.json()) as {
          uploads?: SignedUpload[];
          error?: string;
        };

      if (
        !signingResponse.ok ||
        !signingData.uploads
      ) {
        throw new Error(
          signingData.error ??
            "Photo upload permissions could not be created.",
        );
      }

      const supabase = createClient();
      const completedPaths: string[] =
        [];

      for (
        let index = 0;
        index <
        signingData.uploads.length;
        index += 1
      ) {
        const upload =
          signingData.uploads[index];

        const selectedPhoto =
          photos[index];

        const {
          error: uploadError,
        } = await supabase.storage
          .from(
            COMMERCIAL_QUOTE_PHOTO_BUCKET,
          )
          .uploadToSignedUrl(
            upload.path,
            upload.token,
            selectedPhoto.file,
            {
              contentType:
                selectedPhoto.file.type,
            },
          );

        if (uploadError) {
          throw uploadError;
        }

        completedPaths.push(
          upload.path,
        );

        setUploadedCount(
          index + 1,
        );
      }

      const completionResponse =
        await fetch(
          `/api/commercial-quotes/${quoteId}/photos`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              uploadToken,
              paths: completedPaths,
            }),
          },
        );

      const completionData =
        (await completionResponse.json()) as {
          photoPaths?: string[];
          error?: string;
        };

      if (
        !completionResponse.ok ||
        !completionData.photoPaths
      ) {
        throw new Error(
          completionData.error ??
            "The uploaded photos could not be attached to your request.",
        );
      }

      photos.forEach((photo) => {
        URL.revokeObjectURL(
          photo.previewUrl,
        );
      });

      setPhotos([]);
      setCompleted(true);

      trackAnalyticsEvent(
        "commercial_quote_photos_uploaded",
        {
          photo_count:
            completedPaths.length,
        },
      );

      feedback.success(
        `${completedPaths.length} photo${
          completedPaths.length === 1
            ? ""
            : "s"
        } added to the quote request.`,
      );
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "The photos could not be uploaded.";

      setError(message);
      feedback.error(message);
    } finally {
      setIsUploading(false);
    }
  }

  function skipPhotos() {
    photos.forEach((photo) => {
      URL.revokeObjectURL(
        photo.previewUrl,
      );
    });

    setPhotos([]);
    setSkipped(true);

    trackAnalyticsEvent(
      "commercial_quote_photos_skipped",
    );
  }

  if (completed) {
    return (
      <div className="commercial-photo-result commercial-photo-result-success">
        <CheckCircle2
          size={25}
          aria-hidden="true"
        />

        <div>
          <strong>
            Photos added successfully.
          </strong>

          <p>
            They are attached to your
            commercial quote request.
          </p>
        </div>
      </div>
    );
  }

  if (skipped) {
    return (
      <div className="commercial-photo-result">
        <CheckCircle2
          size={25}
          aria-hidden="true"
        />

        <div>
          <strong>
            Your request is already saved.
          </strong>

          <p>
            No problem—we can follow up if
            property photos would help.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="commercial-photo-upload-panel">
      <div className="commercial-photo-upload-heading">
        <span className="commercial-photo-upload-icon">
          <Camera
            size={22}
            aria-hidden="true"
          />
        </span>

        <div>
          <p className="section-kicker">
            Optional next step
          </p>

          <h3>
            Add property photos.
          </h3>

          <p>
            Photos can help us understand
            the containers, access, surrounding
            concrete, and current condition
            before we follow up.
          </p>
        </div>
      </div>

      <div className="commercial-photo-guidance">
        <strong>Helpful shots include:</strong>

        <span>
          The full service area, container
          placement, access points, buildup,
          leaks, and surrounding concrete.
        </span>
      </div>

      <p className="commercial-photo-privacy-note">
        Please avoid photographing people,
        access codes, private documents, or
        unnecessary license plates.
      </p>

      <label className="commercial-photo-picker">
        <input
          accept="
            image/jpeg,
            image/png,
            image/webp,
            image/heic,
            image/heif,
            .jpg,
            .jpeg,
            .png,
            .webp,
            .heic,
            .heif
          "
          disabled={
            isUploading ||
            photos.length >=
              COMMERCIAL_QUOTE_MAX_PHOTOS
          }
          multiple
          type="file"
          onChange={
            handlePhotoSelection
          }
        />

        <ImagePlus
          size={22}
          aria-hidden="true"
        />

        <span>
          <strong>
            Choose property photos
          </strong>

          <small>
            Up to six images, 10 MB
            each
          </small>
        </span>
      </label>

      {photos.length ? (
        <div className="commercial-photo-preview-grid">
          {photos.map((photo) => (
            <article
              className="commercial-photo-preview-card"
              key={photo.id}
            >
              <div
                className="commercial-photo-preview-image"
                style={{
                  backgroundImage:
                    `url("${photo.previewUrl}")`,
                }}
              />

              <div className="commercial-photo-preview-info">
                <strong>
                  {photo.file.name}
                </strong>

                <small>
                  {formatFileSize(
                    photo.file.size,
                  )}
                </small>
              </div>

              <button
                aria-label={`Remove ${photo.file.name}`}
                disabled={isUploading}
                type="button"
                onClick={() =>
                  removePhoto(photo.id)
                }
              >
                <Trash2
                  size={17}
                  aria-hidden="true"
                />
              </button>
            </article>
          ))}
        </div>
      ) : null}

      {error ? (
        <p
          className="commercial-form-error"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {isUploading ? (
        <p className="commercial-photo-progress">
          Uploading photo{" "}
          {Math.min(
            uploadedCount + 1,
            photos.length,
          )}{" "}
          of {photos.length}...
        </p>
      ) : null}

      <div className="commercial-photo-actions">
        <button
          className="button button-primary"
          disabled={
            isUploading ||
            !photos.length
          }
          type="button"
          onClick={uploadPhotos}
        >
          <Upload
            size={18}
            aria-hidden="true"
          />

          {isUploading
            ? "Uploading Photos..."
            : "Upload Selected Photos"}
        </button>

        <button
          className="button-link"
          disabled={isUploading}
          type="button"
          onClick={skipPhotos}
        >
          Skip photos
        </button>
      </div>
    </section>
  );
}

function formatFileSize(
  size: number,
) {
  return `${(
    size /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}
