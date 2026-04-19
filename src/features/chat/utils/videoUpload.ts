import axios from "axios";

export async function generateVideoThumbnail(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const objectUrl = URL.createObjectURL(file);

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      video.load();
    };

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    video.onloadedmetadata = () => {
      const targetSecond = Math.min(
        1,
        Math.max((video.duration || 0) - 0.1, 0),
      );
      video.currentTime = targetSecond;
    };

    video.onseeked = () => {
      try {
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 180;
        const context = canvas.getContext("2d");
        if (!context) {
          cleanup();
          reject(new Error("Không thể tạo thumbnail từ video"));
          return;
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            cleanup();
            if (!blob) {
              reject(new Error("Không thể chuyển thumbnail sang blob"));
              return;
            }

            const baseName = file.name.replace(/\.[^/.]+$/, "");
            const thumbnail = new File([blob], `${baseName}-thumbnail.jpg`, {
              type: "image/jpeg",
            });
            resolve(thumbnail);
          },
          "image/jpeg",
          0.82,
        );
      } catch (error) {
        cleanup();
        reject(
          error instanceof Error ? error : new Error("Tạo thumbnail thất bại"),
        );
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Không thể đọc dữ liệu video để tạo thumbnail"));
    };
  });
}

export async function handleUploadToS3(
  file: File,
  presignedUrl: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
  await axios.put(presignedUrl, file, {
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    onUploadProgress: (event) => {
      if (!onProgress) return;
      const total = event.total || file.size || 1;
      const loaded = event.loaded || 0;
      const percent = Math.min(100, Math.round((loaded * 100) / total));
      onProgress(percent);
    },
  });
}
