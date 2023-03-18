import mkdirp from "mkdirp";
import puppeteer, { Browser } from "puppeteer";
import args from "./util/args.mjs";
import xml2json from "xml2js";
import path from "path";
import pLimit from "p-limit";
import fs from "fs/promises";

const { target, chromeExecutePath, headless, p } = await args(process.argv);

console.info("Mode: comic-days");
console.info(`target: ${target}`);

const browser = await puppeteer.launch({
    headless,
    args: ["--lang=ja,en-US,en"],
    executablePath: chromeExecutePath ?? undefined,
    defaultViewport: { width: 640, height: 960 },
});

const page = await browser.newPage();
await page.goto(target, { waitUntil: "domcontentloaded" });
await page.waitForSelector("html");
const meta = await page.evaluate(() => {
    const el = document.getElementsByTagName("html")?.[0];
    const str = el.getAttribute("data-gtm-data-layer");
    if (str == null) {
        return null;
    }

    const comicData = JSON.parse(str).episode as ComicData;
    const { series_id: id } = comicData;

    const xhr = new XMLHttpRequest();
    return new Promise<{ comicData: ComicData; xml: string }>((res, rej) => {
        xhr.onreadystatechange = () => {
            switch (xhr.readyState) {
                case xhr.DONE: {
                    if (xhr.status !== 200) {
                        rej(xhr.responseText);
                        return;
                    }
                    if (xhr.responseText == null) {
                        rej("document was null.");
                        return;
                    }
                    res({ xml: xhr.responseText, comicData });
                }
            }
        };

        xhr.open("GET", `https://comic-days.com/atom/series/${id}?free_only=1`);
        xhr.send();
    });
});
if (meta == null) {
    console.error(`Not found comic data, visit: ${target}`);
    process.exit(1);
}

const {
    feed: { entry },
} = await xml2json.parseStringPromise(meta.xml);

const episodes: any[] = entry;

console.info(
    `Start: ${meta.comicData.series_title} episodes: ${episodes.length + 1}`
);

const limit = pLimit(p);

await Promise.all(
    episodes.reverse().map((ep, index) =>
        limit(async () => {
            const pageId = ep["id"][0].split(":")[2];
            const url = `https://comic-days.com/episode/${pageId}`;
            const subTitle = ep["title"][0];
            try {
                await takeEpisodeScreenshots(
                    browser,
                    url,
                    meta.comicData.series_title,
                    subTitle,
                    index
                );
                console.info(`${subTitle} done.`);
            } catch (e) {
                console.error(e);
            }
        })
    )
);

await page.close();
await browser.close();

async function takeEpisodeScreenshots(
    browser: Browser,
    url: string,
    title: string,
    subTitle: string,
    dirPrefix: number
) {
    const distPath = path.join(title, `${dirPrefix}_${subTitle}`);

    try {
        await fs.stat(distPath);
        // ディレクトリが既に存在する場合は飛ばす
        return;
    } catch {}

    mkdirp.mkdirpSync(distPath);
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    try {
        await page.waitForSelector(".js-direction-guide", {
            hidden: true,
            timeout: 5000,
        });
    } catch {}

    const imageElements = await page.$$("p.js-page-area");

    const timer = setInterval(async () => {
        // ページが最前面にないとずっと止まったままになることがあるので10秒に1回タブをアクティブにする
        // 10秒あればだいたい正常に終わってるので他のタブへの動作には影響がないはず
        page.bringToFront();
    }, 10000);

    // 1ページ目は広告なので飛ばす
    await page.keyboard.press("ArrowLeft", {
        delay: 1,
    });
    await page.waitForTimeout(2000);
    for (let i = 0; i < imageElements.length; ++i) {
        const elem = await imageElements[i].$("canvas");

        const filePath = path.join(distPath, `${i}.png`);

        await elem?.screenshot({
            path: filePath,
            type: "png",
        });
        await page.keyboard.press("ArrowLeft", {
            delay: 1,
        });
        await page.waitForTimeout(300);
    }

    clearInterval(timer);

    return await page.close();
}

type ComicData = {
    magazine_label_id: string;
    series_ongoing: number;
    magazine_label: string;
    content_id: string;
    magazine_label_title: string;
    series_title: string;
    episode_id: string;
    episode_title: string;
    series_id: string;
};
