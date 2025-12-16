const express = require("express");
const cors = require("cors");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware para parsing de JSON e cookies
app.use(express.json());
app.use(cors({
  origin: true,
  credentials: true,
  allowedHeaders: ["Content-Type", "Cookie"],
}));

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

log("INFO", "🚀 Servidor iniciado");

const requestOptions = {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  },
};

// Caminho absoluto para cookies
const cookiesPath = path.join(__dirname, "cookies", "youtube-cookies.txt");
const cookiesExists = fs.existsSync(cookiesPath);

if (!cookiesExists) {
  log("WARN", `Arquivo de cookies não encontrado em ${cookiesPath}`);
}

// Converter cookies simples para formato Netscape que yt-dlp entende
function convertToNetscapeFormat(cookieString) {
  if (!cookieString) return null;
  
  const cookies = cookieString.split('; ');
  const netscapeContent = [
    '# Netscape HTTP Cookie File',
    '# http://curl.haxx.se/rfc/cookie_spec.html',
    '# This is a generated file!  Do not edit.',
    ''
  ];

  cookies.forEach(cookie => {
    const [name, value] = cookie.split('=');
    if (name && value) {
      // Formato: domain, flag, path, secure, expiration, name, value
      netscapeContent.push(`.youtube.com\tTRUE\t/\tTRUE\t9999999999\t${name}\t${value}`);
    }
  });

  return netscapeContent.join('\n');
}

function runYtDlp(args, clientCookies = null) {
  return new Promise((resolve, reject) => {
    const ytdlpArgs = [
      "--user-agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "--js-runtimes",
      "node",
    ];

    // Se o cliente enviou cookies, usar eles
    if (clientCookies) {
      const cookieFile = path.join(__dirname, `temp-cookies-${Date.now()}.txt`);
      const netscapeFormat = convertToNetscapeFormat(clientCookies);
      
      if (netscapeFormat) {
        fs.writeFileSync(cookieFile, netscapeFormat);
        ytdlpArgs.push("--cookies", cookieFile);
        log("DEBUG", "Usando cookies do cliente (convertidos para formato Netscape)");
      } else {
        log("WARN", "Não foi possível converter cookies do cliente");
      }
      
      // Limpar arquivo temporário após execução
      setTimeout(() => {
        fs.unlink(cookieFile, () => {});
      }, 5000);
    }
    // Caso contrário, usar cookies internos se existirem
    else if (cookiesExists) {
      ytdlpArgs.push("--cookies", cookiesPath);
      log("DEBUG", "Usando cookies internos do servidor");
    }

    // 🔥 PROXY RESIDENCIAL
    if (process.env.YTDLP_PROXY) {
      ytdlpArgs.push("--proxy", process.env.YTDLP_PROXY);
    }

    ytdlpArgs.push(...args);

    execFile("yt-dlp", ytdlpArgs, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(stderr));
      }
      resolve(stdout.trim());
    });
  });
}

/**
 * 🎵 AUDIO
 */
app.post("/audio", async (req, res) => {
  try {
    const { url, cookies } = req.body;
    const clientCookies = cookies || req.headers.cookie;
    log("INFO", `Requisição de audio recebida - URL: ${url} - Cookies do cliente: ${!!clientCookies}`);

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
      ], clientCookies);
    } else {
      log("DEBUG", "Processando URL não-YouTube para audio");
      link = await runYtDlp([url], clientCookies);
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
app.post("/video", async (req, res) => {
  try {
    const { url, cookies } = req.body;
    const clientCookies = cookies || req.headers.cookie;
    log("INFO", `Requisição de video recebida - URL: ${url} - Cookies do cliente: ${!!clientCookies}`);

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
      ], clientCookies);
    } else {
      log("DEBUG", "Processando URL não-YouTube para video");
      link = await runYtDlp([url], clientCookies);
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