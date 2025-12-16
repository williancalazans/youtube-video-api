const express = require("express");
const cors = require("cors");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

// 📝 Configuração de logs
const logsDir = path.join(__dirname, "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

const logFile = path.join(logsDir, `app-${new Date().toISOString().split('T')[0]}.log`);

function log(level, message, error = null) {
  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}] ${level}: ${message}`;
  if (error) {
    logMessage += `\n${error.stack || error}`;
  }
  
  console.log(logMessage);
  fs.appendFileSync(logFile, logMessage + "\n");
}

// Middleware de logging de requisições
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    log("INFO", `${req.method} ${req.path} - Status: ${res.statusCode} - ${duration}ms`);
  });
  next();
});

app.use(cors());
log("INFO", "🚀 Servidor iniciado");

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
    log("DEBUG", `Executando yt-dlp com argumentos: ${args.join(" ")}`);
    execFile(
      "yt-dlp",
      [
        "--cookies",
        "./cookies/youtube-cookies.txt",
        "--user-agent",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        ...args,
      ],
      { timeout: 15000 },
      (err, stdout, stderr) => {
        if (err) {
          log("ERROR", "Erro ao executar yt-dlp", err);
          return reject(stderr || err);
        }
        log("DEBUG", "yt-dlp executado com sucesso");
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
    log("INFO", `Requisição de audio recebida - URL: ${url}`);
    
    if (!url) {
      log("WARN", "URL não fornecida na requisição de audio");
      return res.status(400).json({ error: "URL obrigatória" });
    }
    
    var link = null;
    
    if (url.includes("youtube")) {
      log("DEBUG", "Detectado URL do YouTube para audio");
      link = await runYtDlp([
        "-f",
        "bestaudio",
        "-g",
        url,
      ]);
    } else {
      log("DEBUG", "Processando URL não-YouTube para audio");
      link = await runYtDlp([url]);
    }

    log("INFO", "Link de audio gerado com sucesso");
    res.json({
      type: "audio",
      url: link,
      note: "Link expira em alguns minutos",
    });
  } catch (err) {
    log("ERROR", "Falha ao gerar link de audio", err);
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
    log("INFO", `Requisição de video recebida - URL: ${url}`);
    
    if (!url) {
      log("WARN", "URL não fornecida na requisição de video");
      return res.status(400).json({ error: "URL obrigatória" });
    }

    var link = null;

    if (url.includes("youtube")) {
      log("DEBUG", "Detectado URL do YouTube para video");
      link = await runYtDlp([
        "-f",
        "bestvideo[height<=1080]",
        "-g",
        url,
      ]);
    } else {
      log("DEBUG", "Processando URL não-YouTube para video");
      link = await runYtDlp([url])
    }

    log("INFO", "Link de video 1080p gerado com sucesso");
    res.json({
      type: "video",
      quality: "1080p",
      url: link,
      note: "Sem áudio",
    });
  } catch (err) {
    log("ERROR", "Falha ao gerar link de video", err);
    res.status(500).json({
      error: "Falha ao gerar link",
      details: err.message,
    });
  }
});

app.listen(PORT, () => {
  log("INFO", `🚀 API rodando em http://localhost:${PORT}`);
});

// Tratamento de erros não capturados
process.on("uncaughtException", (err) => {
  log("ERROR", "Exceção não capturada", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  log("ERROR", "Promise rejeitada não tratada", new Error(reason));
});