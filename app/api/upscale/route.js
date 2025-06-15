import { NextResponse } from "next/server";
import axios from "axios";
import FormData from "form-data";
import { promises as fs } from "fs";

// Disable Next.js default body parser
export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req) {
  // Parse multipart form
  const formData = await req.formData();
  const file = formData.get("file");
  if (!file) {
    return NextResponse.json({ success: false, result: { error: "No file uploaded" } }, { status: 400 });
  }

  // Read file buffer
  const arrayBuffer = await file.arrayBuffer();
  const imageBuffer = Buffer.from(arrayBuffer);

  // Upload image to pic.surf
  async function uploadImage(imageBuffer) {
    try {
      const form = new FormData();
      form.append("file", imageBuffer, {
        filename: "image.jpg",
        contentType: "image/jpeg",
      });
      const headers = { ...form.getHeaders() };
      const response = await axios.post("https://www.pic.surf/upload.php", form, { headers });
      const identifier = response.data.identifier;
      return `https://www.pic.surf/${identifier}`;
    } catch (error) {
      throw new Error("Upload failed");
    }
  }

  function getAvailableStyles() {
    return { art: "Artwork", photo: "Photo" };
  }
  function getAvailableNoise() {
    return { "-1": "None", "0": "Low", "1": "Medium", "2": "High", "3": "Highest" };
  }
  function getHeaders() {
    return {
      origin: "https://bigjpg.com",
      referer: "https://bigjpg.com/",
      "user-agent": "Postify/1.0.0",
      "x-requested-with": "XMLHttpRequest",
    };
  }
  function isValid(style, noise) {
    if (!style && !noise) return { valid: true, style: "art", noise: "-1" };
    if (style && !getAvailableStyles()[style]) return { valid: false, error: "Invalid style." };
    if (noise && !getAvailableNoise()[noise]) return { valid: false, error: "Invalid noise." };
    return { valid: true, style: style || "art", noise: noise || "-1" };
  }
  async function getImageInfo(img) {
    if (!img) return { valid: false, error: "No image URL" };
    try {
      const response = await axios.get(img, { responseType: "arraybuffer" });
      const fileSize = parseInt(response.headers["content-length"] || response.data.length);
      const width = Math.floor(Math.random() * (2000 - 800 + 1)) + 800;
      const height = Math.floor(Math.random() * (2000 - 800 + 1)) + 800;
      let fileName = img.split("/").pop().split("#")[0].split("?")[0] || "image.jpg";
      if (fileName.endsWith(".webp")) fileName = fileName.replace(".webp", ".jpg");
      if (fileSize > 5 * 1024 * 1024) return { valid: false, error: "Image size exceeds 5MB limit." };
      return { valid: true, info: { fileName, fileSize, width, height } };
    } catch {
      return { valid: false, error: "Error fetching the image." };
    }
  }

  // Main logic
  try {
    const imageUrl = await uploadImage(imageBuffer);
    const validation = await getImageInfo(imageUrl);
    if (!validation.valid) return NextResponse.json({ success: false, result: { error: validation.error } }, { status: 400 });

    const inputx = isValid();
    if (!inputx.valid) return NextResponse.json({ success: false, result: { error: inputx.error } }, { status: 400 });

    const config = {
      x2: "2",
      style: inputx.style,
      noise: inputx.noise,
      file_name: validation.info.fileName,
      files_size: validation.info.fileSize,
      file_height: validation.info.height,
      file_width: validation.info.width,
      input: imageUrl,
    };

    const params = new URLSearchParams();
    params.append("conf", JSON.stringify(config));
    const taskx = await axios.post("https://bigjpg.com/task", params, { headers: getHeaders() });

    if (taskx.data.status !== "ok") return NextResponse.json({ success: false, result: { error: "Error" } }, { status: 400 });

    const taskId = taskx.data.info;
    let attempts = 0;
    const maxAttempts = 20;
    while (attempts < maxAttempts) {
      const resultRes = await axios.get(
        `https://bigjpg.com/free?fids=${JSON.stringify([taskId])}`,
        { headers: getHeaders() }
      );
      const result = resultRes.data[taskId];
      if (result[0] === "success") {
        return NextResponse.json({
          success: true,
          result: {
            info: validation.info,
            url: result[1],
            size: result[2],
            config: {
              style: config.style,
              styleName: getAvailableStyles()[config.style],
              noise: config.noise,
              noiseName: getAvailableNoise()[config.noise],
            },
          },
        });
      } else if (result[0] === "error") {
        return NextResponse.json({ success: false, result: { error: "Upscaling failed. Please try again later." } }, { status: 400 });
      }
      await new Promise((resolve) => setTimeout(resolve, 15000));
      attempts++;
    }
    return NextResponse.json({ success: false, result: { error: "Timeout" } }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, result: { error: err.message || "Error" } }, { status: 500 });
  }
}
