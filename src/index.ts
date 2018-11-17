import puppeteer from "puppeteer";
import fs from "fs";
import mkdirp from "mkdirp";
import path from "path";

(async () => {
    const indexUrl = process.argv[2] || "";
    const distPath = process.argv[3] || "./dist";
    if (indexUrl.length === 0) {
        console.log("Usage: yarn start {url} [path]");
        process.exit(0);
    }

    await scraping(indexUrl, distPath);
})();

async function scraping(targetUrl: string, distPath: string) {
    console.log("starting...");
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--lang=ja,en-US,en"]
    });
    const page = await browser.newPage();
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });

    console.log("went to " + targetUrl);
    await page.waitForSelector(".booktitle-volume-list");

    const episodeAnchorList = await page.$$(".volume-details > a");

    if (episodeAnchorList != null) {
        const links: string[] = await Promise.all(
            episodeAnchorList.map(
                async a => await (await a.getProperty("href")).jsonValue()
            )
        );

        // テスト用に1ページだけ
        // await takeEpisodeScreenshots(browser, links[0]);

        let index = 0;
        // 本番
        for (const url of links) {
            await takeEpisodeScreenshots(browser, url, distPath, index);
            index += 1;
        }
    }

    return await browser.close();
}

async function takeEpisodeScreenshots(
    browser: puppeteer.Browser,
    url: string,
    distPath: string,
    directoryPrefixIndex: number,
    size?: { witdh: number; height: number }
) {
    const page = await browser.newPage();
    if (size) {
        await page.setViewport({ width: size.witdh, height: size.height });
    } else {
        await page.setViewport({ width: 768, height: 1210 });
    }

    await page.goto(url, { waitUntil: "domcontentloaded" });

    // 広告を閉じる
    const ad = await page.$(".popupad-close");
    if (ad) {
        await ad.click();
    }

    // ページ上に掛かっているコントローラーを消す
    const rightBlankPage = await page.$("#canvas_1");

    if (rightBlankPage) {
        await rightBlankPage.click();
    }

    // コントローラーが消えるまで待つ
    await page.waitFor(500);

    const fullTitle = await page.title();

    const title = fullTitle.split("｜")[0].replace(/["!?/*:<>\[\]]/g, " ");

    console.log(title);

    const comicPath = path.join(distPath, `${directoryPrefixIndex}_${title}`);

    mkdirp.sync(comicPath);

    // ページ番号のIDは 1 オリジン
    let pageIndex = 1;
    while (true) {
        const divId = `#canvas_${pageIndex}`;

        const canvasIncludeDiv = await page.$(divId);

        if (canvasIncludeDiv) {
            const filePath =
                path.join(comicPath, pageIndex.toString()) + ".png";
            console.log(`   page:${filePath}`);
            await canvasIncludeDiv.screenshot({
                path: filePath,
                type: "png"
            });
        } else {
            // element が取れなかったら終了する
            break;
        }

        const nextBtn = await page.$("#btn-next");
        if (nextBtn) {
            await nextBtn.click();
        }
        // ページが切り替わるまで待つ
        await page.waitFor(200);
        pageIndex += 1;
    }

    return await page.close();
}
