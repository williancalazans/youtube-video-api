import { exec } from "child_process";

export function getRawLinks(url, format = "best") {
    return new Promise((resolve, reject) => {
        const cmd = `yt-dlp -g -f ${format} "${url}"`;

        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                reject(stderr || error.message);
                return;
            }

            const links = stdout
                .split("\n")
                .map(l => l.trim())
                .filter(Boolean);

            resolve(links);
        });
    });
}