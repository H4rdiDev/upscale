"use client";
import { useState, useRef, useEffect } from "react";
import ReactCompareImage from "react-compare-image";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [progress, setProgress] = useState<number>(1);
  const [fakeProgress, setFakeProgress] = useState<number>(1);
  const [showImageLoading, setShowImageLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fakeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setBeforeUrl(URL.createObjectURL(e.target.files[0]));
      setAfterUrl(null);
      setError("");
      setProgress(1);
      setFakeProgress(1);
      setImageLoaded(false);
    }
  };

  // Drag & drop handler
  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setBeforeUrl(URL.createObjectURL(e.dataTransfer.files[0]));
      setAfterUrl(null);
      setError("");
      setProgress(1);
      setFakeProgress(1);
      setImageLoaded(false);
    }
  };

  const handleButtonClick = () => {
    inputRef.current?.click();
  };

  // PROGRESS POLLING LOGIC
  const handleUpscale = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setAfterUrl(null);
    setProgress(1);
    setFakeProgress(1);
    setImageLoaded(false);
    setShowImageLoading(false);

    const formData = new FormData();
    formData.append("file", file);

    // Mulai fake progress (1% ke 90%)
    if (fakeIntervalRef.current) clearInterval(fakeIntervalRef.current);
    fakeIntervalRef.current = setInterval(() => {
      setFakeProgress((prev) => {
        if (prev < 90) {
          setProgress(prev + 1);
          return prev + 1;
        } else {
          return prev;
        }
      });
    }, 350); // 1% tiap 200ms, 18 detik ke 90%

    try {
      const res = await fetch("/api/upscale", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      // Backend selesai, stop fake progress
      if (fakeIntervalRef.current) clearInterval(fakeIntervalRef.current);

      if (data.success) {
        setShowImageLoading(true);
        setAfterUrl(data.result.url);
        setProgress(99); // progress tetap 99% sampai gambar loaded
      } /*else {
        setError(data.result?.error || "Upscale failed.");
        setLoading(false);
        setProgress(0);
        setShowImageLoading(false);
        return;
      }*/
    } catch (err) {
      if (fakeIntervalRef.current) clearInterval(fakeIntervalRef.current);
      setError("Upscale failed.");
      setProgress(0);
      setLoading(false);
      setShowImageLoading(false);
      return;
    }
    // Jangan setLoading(false) di sini!
    // Tunggu gambar loaded
  };

  // Set progress ke 100% dan loading ke false setelah gambar hasil sudah loaded
  useEffect(() => {
    if (afterUrl && imageLoaded) {
      setProgress(100);
      setShowImageLoading(false);
      setTimeout(() => setLoading(false), 500); // biar smooth, loading false setelah 0.5 detik
    }
  }, [afterUrl, imageLoaded]);

  useEffect(() => {
    if (afterUrl) {
      console.log("URL hasil:", afterUrl);
    }
  }, [afterUrl]);

  const handleDownload = () => {
    if (afterUrl && file) {
      const originalName = file.name.replace(/\.[^/.]+$/, "");
      const extMatch = afterUrl.match(/\.(jpg|jpeg|png|webp)(\?|$)/i);
      const ext = extMatch ? extMatch[1] : "jpg";
      const downloadName = `${originalName}-upscaled.${ext}`;
      const link = document.createElement("a");
      link.href = afterUrl;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <>
      <div className="animated-grid-bg" aria-hidden="true"></div>
      <div className="container">
        <h1>Lymcer Upscaler</h1>
        <div
          className={`upload-area${dragActive ? " drag-active" : ""}`}
          onClick={handleButtonClick}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          tabIndex={0}
        >
          <input
            type="file"
            accept="image/*"
            ref={inputRef}
            style={{ display: "none" }}
            onChange={handleFileChange}
            disabled={loading}
          />
          <div className="upload-content">
            <svg width="40" height="40" fill="none" viewBox="0 0 24 24">
              <path fill="#fff" d="M12 16V4m0 0l-4 4m4-4l4 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="4" y="16" width="16" height="4" rx="2" fill="#fff" fillOpacity="0.2"/>
            </svg>
            <div style={{ marginTop: 12, fontWeight: 600 }}>
              {file ? file.name : "Select or drag an image here"}
            </div>
          </div>
        </div>
        {!loading && (!afterUrl || !imageLoaded) && (
          <button onClick={handleUpscale} disabled={!file}>
            Upscale
          </button>
        )}
        {(loading || (afterUrl && !imageLoaded)) && (
          <div style={{ marginTop: 16 }}>
            <div className="progress-bar-container">
              <div
                className="progress-bar"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="progress-text">{Math.round(progress)}%</div>
            {showImageLoading && !imageLoaded && (
              <div className="image-loading-info">
                Displaying image results...
              </div>
            )}
          </div>
        )}
        {error && <div className="error-message">{error}</div>}
        {beforeUrl && afterUrl && imageLoaded && (
          <div className="compare" style={{ position: "relative" }}>
            <ReactCompareImage
              leftImage={beforeUrl}
              rightImage={afterUrl}
              leftImageLabel="Original"
              rightImageLabel="Upscaled"
              sliderLineColor="#fff"
            />
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button onClick={handleDownload} style={{ width: 180 }}>
                Simpan Gambar
              </button>
            </div>
          </div>
        )}
        {afterUrl && !imageLoaded && (
          <img
            src={afterUrl || ""}
            alt="hidden"
            style={{ display: "none" }}
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              setError("Gagal memuat gambar hasil. Coba lagi atau gunakan gambar lain.");
              setShowImageLoading(false);
              setLoading(false);
              setProgress(0);
            }}
          />
        )}
      </div>
      <footer className="footer-hardi">
        &copy; {new Date().getFullYear()} HardiDev. All rights reserved.
      </footer>
    </>
  );
}