import puppeteer from "puppeteer";
import mkdirp from "mkdirp";
import path from "path";

const headless = true;

(async () => {
    const indexUrl = process.argv[2] || "";
    const distPath = process.argv[3] || "./dist";
    const startIndex = parseInt(process.argv[4]) || 0;

    if (indexUrl.length === 0) {
        console.log("Usage: yarn start {url} [path]");
        process.exit(0);
    }

    await scraping(indexUrl, distPath, startIndex);
})();

async function scraping(
    targetUrl: string,
    distPath: string,
    startIndex: number
) {
    console.log("starting...");
    const browser = await puppeteer.launch({
        headless,
        args: ["--lang=ja,en-US,en"]
    });
    const page = await browser.newPage();
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });

    console.log("went to " + targetUrl);
    await page.waitForSelector(".chapters");

    const episodeAnchorList = await page.$$(".chapters > a");

    if (episodeAnchorList != null) {
        const links: string[] = await Promise.all(
            episodeAnchorList.map(
                async a => await (await a.getProperty("href")).jsonValue()
            )
        );

        // テスト用に1ページだけ
        // await takeEpisodeScreenshots(browser, links[0], distPath, startIndex);

        let index = startIndex;
        // 本番
        for (const url of links.splice(index)) {
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
    directoryPrefixIndex: number
) {
    const page = await browser.newPage();

    await page.setViewport({ width: 768, height: 1210 });

    await page.goto(url, { waitUntil: "domcontentloaded" });

    await page.waitForSelector(".popupad-close", {
        visible: true
    });

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

    const title = fullTitle
        .split("｜")[0]
        .replace(/["!?/*:<>\[\]]/g, " ")
        .trim(); // Winでディレクトリ名の末尾にスペースがあるとファイルの削除/移動が不可能になるバグ対策

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
            console.log(`    ${filePath}`);
            await canvasIncludeDiv.screenshot({
                path: filePath,
                type: "png"
            });
        } else {
            // element が取れなかったら終了する
            break;
        }
        await page.keyboard.press("ArrowLeft");
        // 要素が表示されるまで待つ
        await page.waitFor(200);
        pageIndex += 1;
    }

    return await page.close();
}
