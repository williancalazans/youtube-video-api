const express = require("express");
const cors = require("cors");
const { execFile } = require("child_process");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());

const requestOptions = {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  },
};

app.use(cors());

function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    execFile(
      "yt-dlp",
      [
        "--cookies",
        "/cookies/youtube.txt",
        "--user-agent",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        ...args,
      ],
      { timeout: 15000 },
      (err, stdout, stderr) => {
        if (err) return reject(stderr || err);
        resolve(stdout.trim());
      }
    );
  });
}
/**
 * 🎵 AUDIO
 */
app.get("/audio", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: "URL obrigatória" });
    }
    
    var link = null;
    
    if (url.includes("youtube")) {
      link = await runYtDlp([
        "-f",
        "bestaudio",
        "-g",
        url,
      ]);
    } else {
      link = await runYtDlp([url]);
    }

    res.json({
      type: "audio",
      url: link,
      note: "Link expira em alguns minutos",
    });
  } catch (err) {
    res.status(500).json({
      error: "Falha ao gerar link",
      details: err.message,
    });
  }
});

/**
 * 🎥 VIDEO 1080p
 */
app.get("/video", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: "URL obrigatória" });
    }

    var link = null;

    if (url.includes("youtube")) {
      link = await runYtDlp([
        "-f",
        "bestvideo[height<=1080]",
        "-g",
        url,
      ]);
    } else {
      link = await runYtDlp([url])
    }

    res.json({
      type: "video",
      quality: "1080p",
      url: link,
      note: "Sem áudio",
    });
  } catch (err) {
    res.status(500).json({
      error: "Falha ao gerar link",
      details: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 API rodando em http://localhost:${PORT}`);
});